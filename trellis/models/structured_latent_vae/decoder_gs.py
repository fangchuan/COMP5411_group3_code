from typing import List, Literal, Optional

import torch
import torch.nn as nn
import torch.nn.functional as F

from trellis.models.sparse_elastic_mixin import SparseTransformerElasticMixin
from trellis.models.structured_latent_vae.base import SparseTransformerBase
from trellis.modules import sparse as sp
from trellis.representations import Gaussian
from trellis.utils.random_utils import hammersley_sequence
from trellis.modules.utils import convert_module_to_f16, convert_module_to_f32, zero_module
from trellis.modules.sparse.linear import SparseLinear
from trellis.modules.sparse.nonlinearity import SparseGELU


class SparseOccHead(nn.Module):
    def __init__(self, channels: int, out_channels: int, mlp_ratio: float = 4.0):
        super().__init__()
        self.mlp = nn.Sequential(
            SparseLinear(channels, int(channels * mlp_ratio)),
            SparseGELU(approximate="tanh"),
            SparseLinear(int(channels * mlp_ratio), out_channels),
        )

    def forward(self, x: sp.SparseTensor) -> sp.SparseTensor:
        return self.mlp(x)


class SparseSubdivideBlock3d(nn.Module):
    """
    A 3D subdivide block that can subdivide the sparse tensor.

    Args:
        in_channels: channels in the inputs and outputs.
        out_channels: if specified, the number of output channels.
        num_groups: the number of groups for the group norm.
    """

    def __init__(
        self,
        in_channels: int,
        resolution: int,
        out_channels: Optional[int] = None,
        num_groups: int = 32,
        use_checkpoint: bool = False,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.resolution = resolution
        self.out_resolution = resolution * 2
        self.out_channels = out_channels or in_channels
        self.use_checkpoint = use_checkpoint
        print(
            f"[SparseSubdivideBlock3d] in_channels: {in_channels}, out_channels: {out_channels}, out_resolution: {self.out_resolution} use_checkpoint: {self.use_checkpoint}"
        )
        self.act_layers = nn.Sequential(sp.SparseGroupNorm32(num_groups, in_channels), sp.SparseSiLU())

        self.sub = sp.SparseSubdivide()

        self.out_layers = nn.Sequential(
            sp.SparseConv3d(in_channels, self.out_channels, 3, indice_key=f"res_{self.out_resolution}"),
            sp.SparseGroupNorm32(num_groups, self.out_channels),
            sp.SparseSiLU(),
            zero_module(
                sp.SparseConv3d(
                    self.out_channels,
                    self.out_channels,
                    3,
                    indice_key=f"res_{self.out_resolution}",
                )
            ),
        )

        if self.out_channels == in_channels:
            self.skip_connection = nn.Identity()
        else:
            self.skip_connection = sp.SparseConv3d(in_channels, self.out_channels, 1, indice_key=f"res_{self.out_resolution}")

    def _forward(self, x: sp.SparseTensor) -> sp.SparseTensor:
        """
        Apply the block to a Tensor, conditioned on a timestep embedding.

        Args:
            x: an [N x C x ...] Tensor of features.
        Returns:
            an [N x C x ...] Tensor of outputs.
        """
        h = self.act_layers(x)
        h = self.sub(h)
        x = self.sub(x)
        h = self.out_layers(h)
        h = h + self.skip_connection(x)
        return h

    def forward(self, x: sp.SparseTensor) -> sp.SparseTensor:
        if self.use_checkpoint:
            return torch.utils.checkpoint.checkpoint(self._forward, x, use_reentrant=False)
        else:
            return self._forward(x)


class SLatGaussianDecoder(SparseTransformerBase):
    def __init__(
        self,
        resolution: int,
        model_channels: int,
        latent_channels: int,
        num_blocks: int,
        num_heads: Optional[int] = None,
        num_head_channels: Optional[int] = 64,
        mlp_ratio: float = 4,
        attn_mode: Literal["full", "shift_window", "shift_sequence", "shift_order", "swin"] = "swin",
        window_size: int = 8,
        pe_mode: Literal["ape", "rope"] = "ape",
        use_fp16: bool = False,
        use_checkpoint: bool = False,
        qk_rms_norm: bool = False,
        representation_config: dict = None,
    ):
        super().__init__(
            in_channels=latent_channels,
            model_channels=model_channels,
            num_blocks=num_blocks,
            num_heads=num_heads,
            num_head_channels=num_head_channels,
            mlp_ratio=mlp_ratio,
            attn_mode=attn_mode,
            window_size=window_size,
            pe_mode=pe_mode,
            use_fp16=use_fp16,
            use_checkpoint=use_checkpoint,
            qk_rms_norm=qk_rms_norm,
        )
        # self.upsample = nn.ModuleList(
        #     [
        #         SparseSubdivideBlock3d(
        #             in_channels=model_channels,
        #             # out_channels=model_channels // 4,
        #             out_channels=model_channels,
        #             resolution=resolution,
        #             use_checkpoint=use_checkpoint,
        #         ),
        #     ]
        # )
        # self.resolution = resolution * (2 ** len(self.upsample))  # upsample 1 times
        self.resolution = resolution
        self.rep_config = representation_config
        self._calc_layout()  # calculate out_channels and gs premitives shape
        self.out_layer = sp.SparseLinear(model_channels, self.out_channels)
        self._build_perturbation()

        self.initialize_weights()
        if use_fp16:
            self.convert_to_fp16()

    def initialize_weights(self) -> None:
        super().initialize_weights()
        # Zero-out output layers:
        nn.init.constant_(self.out_layer.weight, 0)
        nn.init.constant_(self.out_layer.bias, 0)

    def convert_to_fp16(self) -> None:
        """
        Convert the torso of the model to float16.
        """
        super().convert_to_fp16()
        # self.upsample.apply(convert_module_to_f16)

    def convert_to_fp32(self) -> None:
        """
        Convert the torso of the model to float32.
        """
        super().convert_to_fp32()
        # self.upsample.apply(convert_module_to_f32)

    def _build_perturbation(self) -> None:
        perturbation = [hammersley_sequence(3, i, self.rep_config["num_gaussians"]) for i in range(self.rep_config["num_gaussians"])]
        perturbation = torch.tensor(perturbation).float() * 2 - 1
        perturbation = perturbation / self.rep_config["voxel_size"]
        perturbation = torch.atanh(perturbation).to(self.device)
        self.register_buffer("offset_perturbation", perturbation)

    def _calc_layout(self) -> None:
        """
        Calculate out_channels and gs premitives shape.
        """
        self.layout = {
            "_xyz": {
                "shape": (self.rep_config["num_gaussians"], 3),
                "size": self.rep_config["num_gaussians"] * 3,
            },
            "_features_dc": {
                "shape": (self.rep_config["num_gaussians"], 1, 3),
                "size": self.rep_config["num_gaussians"] * 3,
            },
            "_scaling": {
                "shape": (self.rep_config["num_gaussians"], 3),
                "size": self.rep_config["num_gaussians"] * 3,
            },
            "_rotation": {
                "shape": (self.rep_config["num_gaussians"], 4),
                "size": self.rep_config["num_gaussians"] * 4,
            },
            "_opacity": {
                "shape": (self.rep_config["num_gaussians"], 1),
                "size": self.rep_config["num_gaussians"],
            },
        }
        start = 0
        for k, v in self.layout.items():
            v["range"] = (start, start + v["size"])
            start += v["size"]
        self.out_channels = start

    def to_representation(self, x: sp.SparseTensor) -> List[Gaussian]:
        """
        Convert a batch of network outputs to 3D representations.

        Args:
            x: The [N x * x C] sparse tensor output by the network.
            voxel_occs: The voxel occupancy tensor.

        Returns:
            list of representations
        """
        ret = []
        for i in range(x.shape[0]):
            representation = Gaussian(
                sh_degree=0,
                aabb=[-0.5, -0.5, -0.5, 1.0, 1.0, 1.0],
                mininum_kernel_size=self.rep_config["3d_filter_kernel_size"],
                scaling_bias=self.rep_config["scaling_bias"],
                opacity_bias=self.rep_config["opacity_bias"],
                scaling_activation=self.rep_config["scaling_activation"],
                scaling_max=self.rep_config["scaling_max"],
            )
            # convert xyz to [0, 1]
            xyz = (x.coords[x.layout[i]][:, 1:].float() + 0.5) / self.resolution
            for k, v in self.layout.items():
                if k == "_xyz":
                    offset = x.feats[x.layout[i]][:, v["range"][0] : v["range"][1]].reshape(-1, *v["shape"])
                    offset = offset * self.rep_config["lr"][k]
                    if self.rep_config["perturb_offset"]:
                        offset = offset + self.offset_perturbation
                    offset = torch.tanh(offset) / self.resolution * 0.5 * self.rep_config["voxel_size"]
                    # print(f"[SLatGaussianDecoder:to_representation] offset min: {offset.min().item()}, max: {offset.max().item()}, mean: {offset.mean().item()}")
                    _xyz = xyz.unsqueeze(1) + offset
                    setattr(representation, k, _xyz.flatten(0, 1))
                    # print(f"[SLatGaussianDecoder:to_representation] xyz: {_xyz.flatten(0, 1).shape}")
                else:
                    feats = x.feats[x.layout[i]][:, v["range"][0] : v["range"][1]].reshape(-1, *v["shape"]).flatten(0, 1)
                    feats = feats * self.rep_config["lr"][k]
                    # if k == "_scaling":
                    #     feats = feats.clamp(max=self.rep_config["scaling_max"])
                        # # we set _scaling range to [-inf, inf], and GaussianModel will handle the activation and clamp
                        # print(
                        #     f"[SLatGaussianDecoder:to_representation] _scaling min: {feats.min().item()}, max: {feats.max().item()}, mean: {feats.mean().item()}"
                        # )
                    # if k == "_opacity":
                    #     print(
                    #         f"[SLatGaussianDecoder:to_representation] _opacity min: {feats.min().item()}, max: {feats.max().item()}, mean: {feats.mean().item()}"
                    #     )
                    # if k == "_rotation":
                    #     print(f"[SLatGaussianDecoder:to_representation] _rotation shape: {feats.shape}, min: {feats.min().item()}, max: {feats.max().item()}, mean: {feats.mean().item()}")
                    setattr(representation, k, feats)
                    # print(f"[SLatGaussianDecoder:to_representation] {k}: {feats.shape}")
            ret.append(representation)
        return ret

    def forward(self, x: sp.SparseTensor, x_mask: Optional[torch.tensor] = None) -> List[Gaussian]:
        # if x_mask is not None:
        #     print(f"[SLatGaussianDecoder:forward] x shape: {x.shape}, x_mask shape: {x_mask.shape}")
        h = super().forward(x)
        # for block in self.upsample:
        #     h = block(h)
        h = h.type(x.dtype)
        h = h.replace(F.layer_norm(h.feats, h.feats.shape[-1:]))
        h = self.out_layer(h)
        # print(f"[SLatGaussianDecoder:forward] h shape: {h.shape}, h feats: {h.feats.shape}, h coords: {h.coords.shape}")
        return self.to_representation(h), h


class ElasticSLatGaussianDecoder(SparseTransformerElasticMixin, SLatGaussianDecoder):
    """
    Slat VAE Gaussian decoder with elastic memory management.
    Used for training with low VRAM.
    """

    pass
