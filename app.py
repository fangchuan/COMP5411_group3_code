import gradio as gr
import spaces
from gradio_litmodel3d import LitModel3D

import os
import sys
sys.path.append('.')
sys.path.append('..')
import json
import shutil
os.environ['SPCONV_ALGO'] = 'native'
from typing import *
import torch
import numpy as np
import imageio
from easydict import EasyDict as edict
from PIL import Image


import trellis
from trellis.modules import sparse as sp
from trellis.representations import Gaussian
from trellis.utils import render_utils
from trellis.models import ElasticSLatEncoder, ElasticSLatGaussianDecoder



MAX_SEED = np.iinfo(np.int32).max
TMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp')
os.makedirs(TMP_DIR, exist_ok=True)

    
def start_session(req: gr.Request):
    user_dir = os.path.join(TMP_DIR, str(req.session_hash))
    os.makedirs(user_dir, exist_ok=True)
    
    
def end_session(req: gr.Request):
    user_dir = os.path.join(TMP_DIR, str(req.session_hash))
    shutil.rmtree(user_dir)


@spaces.GPU(duration=120)
def recon_scene_gaussian(
    scene_name: dict,
    req: gr.Request,
) -> Tuple[str, str, str]:
    """
    Convert an image to a 3D model and extract GLB file.

    Args:
        scene_feature_filepath (str): The input file path of scene feature.
        seed (int): The random seed.

    Returns:
        dict: The information of the generated 3D model.
        str: The path to the video of the 3D model.
        str: The path to the extracted GLB file.
        str: The path to the extracted GLB file (for download).
    """
    user_dir = os.path.join(TMP_DIR, str(req.session_hash))

    scene_feature_filepath = f"assets/example_spatialgen_image/{scene_name['scene_name']}.npz"
    voxelized_feats = np.load(scene_feature_filepath)
    print(f"Loading scene features from {scene_feature_filepath}. feats shape: {voxelized_feats['patchtokens'].shape}, indices shape: {voxelized_feats['indices'].shape}")
    
    feats = sp.SparseTensor(
        feats=torch.from_numpy(voxelized_feats["patchtokens"]).float(),
        coords=torch.cat(
            [
                torch.zeros(voxelized_feats["patchtokens"].shape[0], 1).int(),
                torch.from_numpy(voxelized_feats["indices"]).int(),
            ],
            dim=1,
        ),
    ).cuda()
    output_gaussians = pipeline.run(feats)

    # Render video
    video = render_utils.render_video(output_gaussians[0], num_frames=120)['color']
    video_path = os.path.join(user_dir, 'sample.mp4')
    imageio.mimsave(video_path, video, fps=15)
    
    # Save Gaussians as PLY files
    gs = output_gaussians[0]
    ply_path = os.path.join(user_dir, 'sample.ply')
    gs.save_ply(ply_path)
    
    torch.cuda.empty_cache()
    return video_path, {"gs_ply_path": ply_path}, ply_path  # video, ply_path (for viewer), ply_path (for download)



def prepare_multi_example() -> List[str]:
    multi_case = list(set([i.split('.png')[0] for i in os.listdir("assets/example_spatialgen_image")]))
    image_paths = []
    for case in multi_case:
        _images = []
        if os.path.exists(f'assets/example_spatialgen_image/{case}.png'):
            img = Image.open(f'assets/example_spatialgen_image/{case}.png')
            W, H = img.size
            img = img.resize((int(W / H * 512), 512))
            _images.append(np.array(img))
        if len(_images) > 0:
            image_paths.append(f'assets/example_spatialgen_image/{case}.png')
    return image_paths

def show_scene_images(path: str) -> Tuple[List[Image.Image], str]:
    """
    Split a multi-view image into separate view images.
    
    This function is called when users select multi-image examples that contain
    multiple views in a single concatenated image. It automatically splits them
    based on alpha channel boundaries and preprocesses each view.
    
    Args:
        image (Image.Image): A concatenated image containing multiple views
        
    Returns:
        List[Image.Image]: List of individual preprocessed view images
    """
    if isinstance(path, Image.Image):
        image_np = np.array(path)
        scene_name = "3FO4K5FY7KYD_room_513"
        print(f"Loaded example scene {scene_name} from image input.")
    elif isinstance(path, str):
        scene_image_path = path
        scene_name = os.path.basename(scene_image_path).split('.png')[0]
        image_np = np.array(Image.open(scene_image_path))
        print(f"Loaded example scene {scene_name} from {scene_image_path}.")
    else:
        raise ValueError("Input must be an image or a file path string.")
    img_size = image_np.shape[0]
    num_imgs = image_np.shape[1] // img_size

    images = []
    for i in range(0, num_imgs):
        s = i * img_size
        e = (i + 1) * img_size - 1
        images.append(Image.fromarray(image_np[:, s:e+1]))

    return images, {"scene_name": scene_name}

def prepare_scene_file(images: List[Tuple[Image.Image, str]], curr_scene_name: str) -> List[Image.Image]:
    """
    Preprocess a list of input images for multi-image 3D generation.
    
    This function is called when users upload multiple images in the gallery.
    It processes each image to prepare them for the multi-image 3D generation pipeline.
    
    Args:
        images (List[Tuple[Image.Image, str]]): The input images from the gallery
        
    Returns:
        List[Image.Image]: The preprocessed images ready for 3D generation
    """
    images_lst = [image[0] for image in images]
    scene_npz_filepath = f"assets/example_spatialgen_image/{curr_scene_name}.npz"
    curr_scene_feat_filepath = scene_npz_filepath
    print(f"Load scene features from {curr_scene_feat_filepath}.")
    return images_lst

def update_3d_viewer(ply_path):
    if ply_path is None or ply_path == "" or not os.path.exists(ply_path.get('gs_ply_path', None)):
        return """<div style='width:100%; height:1000px; display:flex; align-items:center; justify-content:center; background:#f0f0f0;'>
                    <p>3D model will appear here after generation</p>
                 </div>"""
    
    ply_path = ply_path.get('gs_ply_path')
    
    import time
    timestamp = int(time.time() * 1000)
    external_viewer_url = f"http://0.0.0.0:9001/viewer?file={ply_path}&t={timestamp}"
    
    print(f"Reloading 3D viewer: {ply_path}")
    print(f"External viewer URL: {external_viewer_url}")
    
    return f"""
    <div style="width:100%; height:1000px; position:relative; background:#222;">
        <div id="loadingState" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; text-align:center; z-index:10;">
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin:0 auto 15px;"></div>
            <p>Loading 3D Viewer...</p>
        </div>
        <iframe 
            id="dynamicViewer"
            src="{external_viewer_url}"
            style="width:100%; height:100%; border:none; border-radius:8px;"
            title="3D Gaussian Splatting Viewer"
            onload="document.getElementById('loadingState').style.display='none'; console.log('Viewer reloaded successfully');"
        ></iframe>
    </div>
    <style>
        @keyframes spin {{
            0% {{ transform: rotate(0deg); }}
            100% {{ transform: rotate(360deg); }}
        }}
    </style>
    <script>
        // Force reload with new timestamp
        console.log('Initializing new 3D viewer session...');
    </script>
    """

# Create interface - THIS COMES AFTER THE FUNCTION DEFINITION
demo = gr.Blocks(
    title="Group3",
    css="""
        .slider .inner { width: 5px; background: #FFF; }
        .viewport { aspect-ratio: 4/3; }
        .tabs button.selected { font-size: 20px !important; color: crimson !important; }
        h1, h2, h3 { text-align: center; display: block; }
        .md_feedback li { margin-bottom: 0px !important; }
    """
)

with demo:
    gr.Markdown("""
    # 💻 Group3: 3D Scene Reconstruction using Gaussian Splatting based on Structured Latent 
    """)
    curr_scene_name = gr.State(value="")

    with gr.Row():        # 左侧输入列 - 使用scale控制比例
        with gr.Column(scale=1):
            with gr.Tabs() as input_tabs:
                with gr.Tab(label="Input Images", id=0) as multiimage_input_tab:
                    image_prompt = gr.Image(
                        label="Image Prompt", 
                        type="filepath", 
                        visible=False
                    )
                    multiimage_prompt = gr.Gallery(
                        label="Image Prompt", 
                        format="png", 
                        type="pil", 
                        columns=3,
                        rows=2,
                        object_fit="contain",
                        height="auto"
                    )
                    gr.Markdown("""
                        Input different views of the indoor scene.
                    """)
                    # Example images at the bottom of the page
            with gr.Row() as multiimage_example:
                examples_multi = gr.Examples(
                    examples=prepare_multi_example(),
                    inputs=[image_prompt],
                    fn=show_scene_images,
                    outputs=[multiimage_prompt, curr_scene_name],
                    run_on_click=True,
                    examples_per_page=3,
                )
            generate_btn = gr.Button("Reconstruct Gaussians", variant="primary", size="lg")
            
            gr.Markdown("""
                *NOTE: Gaussian file can be very large (~150MB), it will take a while to display and download.*
            """)

        # 右侧输出列 - 使用scale控制比例
        with gr.Column(scale=1):
            video_output = gr.Video(
                label="Rendered video", 
                autoplay=True, 
                loop=True,
                height="auto",
                # min_height=400
            )
            
            model_output = LitModel3D(
                label="Extracted Gaussian", 
                exposure=10.0,
                height="auto",
                # min_height=400
            )
            with gr.Row():
                download_gs = gr.DownloadButton(label="Download Gaussian", interactive=False)  
    with gr.Row():

        model_output = gr.HTML(
            label="3D Gaussian Viewer",
            value=update_3d_viewer(None) # Initial state
        )            

    
    current_ply_path = gr.State(value="")



    # Handlers
    demo.load(start_session)
    demo.unload(end_session)

    multiimage_prompt.select(
        prepare_scene_file,
        inputs=[multiimage_prompt],  # Added curr_scene_name input
        outputs=[multiimage_prompt],
    )
    
    generate_btn.click(
        recon_scene_gaussian,
        inputs=[curr_scene_name],
        outputs=[video_output, current_ply_path, download_gs],
    ).then(
        update_3d_viewer,
        inputs=[current_ply_path],
        outputs=[model_output]
    ).then(
        lambda: gr.Button(interactive=True),
        outputs=[download_gs],
    )

    video_output.clear(
        lambda: tuple([gr.Button(interactive=False)]),
        outputs=[download_gs],
    )
    

class GaussianVAE(torch.nn.Module):
    def __init__(self, cfg_file: str, encoder_ckpt_file: str, decoder_ckpt_file: str):
        super().__init__()
        train_cfg = edict(json.load(open(cfg_file, "r")))
        encoder: ElasticSLatEncoder = getattr(trellis.models, train_cfg.models.encoder.name)(**train_cfg.models.encoder.args).cuda()
        encoder.load_state_dict(torch.load(encoder_ckpt_file), strict=False)
        encoder.eval()
        print(f"Loaded {train_cfg.models.encoder.name} from {encoder_ckpt_file}")

        decoder: ElasticSLatGaussianDecoder = getattr(trellis.models, train_cfg.models.decoder.name)(**train_cfg.models.decoder.args).cuda()
        decoder.load_state_dict(torch.load(decoder_ckpt_file), strict=False)
        decoder.eval()
        print(f"Loaded {train_cfg.models.decoder.name} from {decoder_ckpt_file}")
        self.encoder = encoder
        self.decoder = decoder

    def forward(self, feats: sp.SparseTensor) -> Tuple[sp.SparseTensor, List[Gaussian]]:
        structure_latent, _, _ = self.encoder(feats, sample_posterior=True, return_raw=True)
        print(f"Encoded latent code: {structure_latent.shape}")
        assert torch.isfinite(structure_latent.feats).all(), "Non-finite latent"

        decoded_gaussians: List[Gaussian] = self.decoder(structure_latent)[0]
        print(f"Decoded gaussians: {decoded_gaussians[0].get_xyz.shape}")
    
        return structure_latent, decoded_gaussians
    
    def run(self, feats: sp.SparseTensor) -> List[Gaussian]:
        _, decoded_gaussians = self.forward(feats)
        return decoded_gaussians
    
    
# Launch the Gradio app
if __name__ == "__main__":

    pipeline = GaussianVAE(
        cfg_file="./pretrained_ckpts/slat_vae_128_mv/config.json",
        encoder_ckpt_file="./pretrained_ckpts/slat_vae_128_mv/encoder_step0010000.pt",
        decoder_ckpt_file="./pretrained_ckpts/slat_vae_128_mv/decoder_step0010000.pt",
    )
    pipeline.cuda()
    
    demo.launch(share=True)