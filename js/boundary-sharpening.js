import * as THREE from "three";

export class BoundarySharpeningSystem {
    constructor() {
        this.viewerCore = null;
        this.mesh = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;

        // Boundary sharpening systems
        this.laplacianSystemActive = false;
        this.bilateralSystemActive = false;
        this.boundaryTestActive = false;

        // Render targets and scenes
        this.laplacianRenderTarget = null;
        this.laplacianQuad = null;
        this.laplacianScene = null;

        this.bilateralRenderTarget = null;
        this.bilateralQuad = null;
        this.bilateralScene = null;

        // Parameters
        this.parameters = {
            laplacianEnabled: false,
            bilateralEnabled: false,
            laplacianThreshold: 0.3,
            bilateralSpatialSigma: 2.0,
            bilateralRangeSigma: 0.1,
            bilateralKernelSize: 5,
            kernelType: 'basic', // 'basic', 'extended', 'sobel'
            colorCodeEdges: true,
            sharpeningStrength: 0.5,
            preserveSplatAlpha: true
        };

        // Store original animate function
        this.originalAnimateFunction = null;
    }

    setViewerCore(viewerCore) {
        this.viewerCore = viewerCore;
        this.mesh = viewerCore.mesh;
        this.renderer = viewerCore.renderer;
        this.scene = viewerCore.scene;
        this.camera = viewerCore.camera;
    }

    init() {
        console.log('Initializing Boundary Sharpening System...');
        this.setupLaplacianBoundaries();
        this.setupBilateralFiltering();
        console.log('Boundary Sharpening System initialized');
    }

    // Laplacian Boundary Detection System
    setupLaplacianBoundaries() {
        console.log('Setting up Laplacian boundary detection system...');

        const width = window.innerWidth;
        const height = window.innerHeight;

        // Create render target for first pass
        this.laplacianRenderTarget = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false,
            depthBuffer: true
        });

        // Create fullscreen quad for second pass
        const geometry = new THREE.PlaneGeometry(2, 2);
        const laplacianMaterial = new THREE.ShaderMaterial({
            uniforms: {
                inputTexture: { value: null },
                textureSize: { value: new THREE.Vector2(width, height) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: this.createBasicLaplacianShader(),
            transparent: true,
            depthWrite: false,
            depthTest: false
        });

        this.laplacianQuad = new THREE.Mesh(geometry, laplacianMaterial);
        this.laplacianQuad.visible = false;
        this.laplacianQuad.frustumCulled = false;

        // Create dedicated scene for quad
        this.laplacianScene = new THREE.Scene();
        this.laplacianScene.add(this.laplacianQuad);

        console.log('Laplacian boundary detection setup complete');
    }

    // Bilateral Filtering System
    setupBilateralFiltering() {
        console.log('Setting up Bilateral filtering system...');

        const width = window.innerWidth;
        const height = window.innerHeight;

        // Create render target
        this.bilateralRenderTarget = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false,
            depthBuffer: true
        });

        // Create processing quad
        const geometry = new THREE.PlaneGeometry(2, 2);
        const bilateralMaterial = new THREE.ShaderMaterial({
            uniforms: {
                inputTexture: { value: null },
                textureSize: { value: new THREE.Vector2(width, height) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: this.createBilateralShader(),
            transparent: true,
            depthWrite: false,
            depthTest: false
        });

        this.bilateralQuad = new THREE.Mesh(geometry, bilateralMaterial);
        this.bilateralQuad.visible = false;
        this.bilateralQuad.frustumCulled = false;

        // Create dedicated scene
        this.bilateralScene = new THREE.Scene();
        this.bilateralScene.add(this.bilateralQuad);

        console.log('Bilateral filtering setup complete');
    }

    // Control Methods
    toggleLaplacianBoundaries(enable) {
        console.log('Laplacian boundaries:', enable ? 'ENABLED' : 'DISABLED');

        if (enable === this.laplacianSystemActive) return;

        this.laplacianSystemActive = enable;
        this.parameters.laplacianEnabled = enable;

        if (enable) {
            this.enableLaplacianBoundaries();
        } else {
            this.disableLaplacianBoundaries();
        }
    }

    toggleBilateralFiltering(enable) {
        console.log('Bilateral filtering:', enable ? 'ENABLED' : 'DISABLED');

        this.bilateralSystemActive = enable;
        this.parameters.bilateralEnabled = enable;

        if (enable && (!this.bilateralQuad || !this.bilateralRenderTarget)) {
            this.setupBilateralFiltering();
        }
    }

    enableLaplacianBoundaries() {
        if (!this.laplacianQuad || !this.laplacianRenderTarget) {
            this.setupLaplacianBoundaries();
        }

        // Store original animate function if not already stored
        if (!this.originalAnimateFunction && this.viewerCore) {
            this.originalAnimateFunction = this.viewerCore.animate.bind(this.viewerCore);
        }
    }

    disableLaplacianBoundaries() {
        // Hide quad
        if (this.laplacianQuad) {
            this.laplacianQuad.visible = false;
        }

        // Reset render target
        if (this.renderer) {
            this.renderer.setRenderTarget(null);
        }
    }

    // Parameter Setters
    setLaplacianThreshold(threshold) {
        this.parameters.laplacianThreshold = threshold;
        this.updateLaplacianShader();
    }

    setKernelType(kernelType) {
        document.getElementById('kernelSizeSelect').value = kernelType;
        this.parameters.kernelType = kernelType;
        this.updateLaplacianShader();
    }

    setColorCodeEdges(enabled) {
        this.parameters.colorCodeEdges = enabled;
        this.updateLaplacianShader();
    }

    setSharpeningStrength(strength) {
        this.parameters.sharpeningStrength = strength;
        this.updateLaplacianShader();
    }

    setPreserveSplatAlpha(enabled) {
        this.parameters.preserveSplatAlpha = enabled;
        this.updateLaplacianShader();
    }

    setBilateralSpatialSigma(sigma) {
        this.parameters.bilateralSpatialSigma = sigma;
        this.updateBilateralShader();
    }

    setBilateralRangeSigma(sigma) {
        this.parameters.bilateralRangeSigma = sigma;
        this.updateBilateralShader();
    }

    setBilateralKernelSize(size) {
        this.parameters.bilateralKernelSize = size;
        this.updateBilateralShader();
    }

    // Test functions
    toggleTestBoundaries() {
        if (!this.laplacianSystemActive) {
            console.log('Please enable Laplacian boundaries first');
            return;
        }
        this.boundaryTestActive = !this.boundaryTestActive;

        const testBtn = document.getElementById('testBoundariesBtn');
        if (testBtn) {
            if (this.boundaryTestActive) {
                testBtn.textContent = 'Hide Boundaries';
                testBtn.style.background = '#44ff44';
                console.log('=== TESTING LAPLACIAN BOUNDARIES ===');
            } else {
                testBtn.textContent = 'Test Boundaries';
                testBtn.style.background = '#ff4444';
                console.log('=== HIDING BOUNDARIES ===');
            }
        }


        this.updateLaplacianShader();

        console.log('Boundary testing:', this.boundaryTestActive ? 'ENABLED' : 'DISABLED');
    }

    quickComparison() {
        if (!this.laplacianSystemActive) {
            console.log('Please enable Laplacian boundaries first');
            return;
        }

        console.log('=== QUICK KERNEL COMPARISON ===');

        const kernels = ['basic', 'extended', 'sobel'];
        let current = 0;

        const testNextKernel = () => {
            if (current >= kernels.length) {
                console.log('Comparison complete!');
                return;
            }

            const kernel = kernels[current];
            console.log('Testing kernel:', kernel);

            this.setKernelType(kernel);
            current++;
            setTimeout(testNextKernel, 2000);
        };

        testNextKernel();
    }

    // Shader Creation Methods
    createBasicLaplacianShader() {
        const threshold = this.parameters.laplacianThreshold;
        const colorCodeEdges = this.parameters.colorCodeEdges;
        const sharpeningStrength = this.parameters.sharpeningStrength;
        const preserveSplatAlpha = this.parameters.preserveSplatAlpha;

        return `
        precision highp float;
        uniform sampler2D inputTexture;
        uniform vec2 textureSize;
        varying vec2 vUv;

        void main() {
            vec2 texelSize = 1.0 / textureSize;
            
            // Sample 3x3 neighborhood
            vec4 center = texture2D(inputTexture, vUv);
            vec4 left   = texture2D(inputTexture, vUv + vec2(-texelSize.x, 0));
            vec4 right  = texture2D(inputTexture, vUv + vec2(texelSize.x, 0));
            vec4 top    = texture2D(inputTexture, vUv + vec2(0, texelSize.y));
            vec4 bottom = texture2D(inputTexture, vUv + vec2(0, -texelSize.y));
            
            // Basic Laplacian kernel
            vec4 laplacian = (left + right + top + bottom) - center * 4.0;
            float edgeStrength = length(laplacian.rgb);
            
            // Apply boundary detection and sharpening
            if (edgeStrength > ${threshold.toFixed(2)}) {
                ${this.boundaryTestActive ? `
                // Show boundaries when testing
                ${colorCodeEdges ? `
                // Color by edge strength
                if (edgeStrength > ${(threshold * 2).toFixed(2)}) {
                    gl_FragColor = vec4(1.0, 0.0, 0.0, ${preserveSplatAlpha ? 'center.a' : '1.0'});
                } else {
                    gl_FragColor = vec4(1.0, 0.5, 0.0, ${preserveSplatAlpha ? 'center.a' : '1.0'});
                }
                ` : `
                gl_FragColor = vec4(1.0, 0.0, 0.0, ${preserveSplatAlpha ? 'center.a' : '1.0'});
                `}
                ` : `
                // Apply sharpening at boundaries
                vec4 sharpened = center - laplacian * ${sharpeningStrength.toFixed(2)};
                gl_FragColor = vec4(sharpened.rgb, ${preserveSplatAlpha ? 'center.a' : 'sharpened.a'});
                `}
            } else {
                // Return original scene with potential sharpening
                vec4 sharpened = center - laplacian * ${(sharpeningStrength * 0.3).toFixed(2)};
                gl_FragColor = vec4(sharpened.rgb, ${preserveSplatAlpha ? 'center.a' : 'sharpened.a'});
            }
        }`;
    }

    createExtendedLaplacianShader() {
        const threshold = this.parameters.laplacianThreshold;
        const colorCodeEdges = this.parameters.colorCodeEdges;
        const sharpeningStrength = this.parameters.sharpeningStrength;
        const preserveSplatAlpha = this.parameters.preserveSplatAlpha;

        return `
        precision highp float;
        uniform sampler2D inputTexture;
        uniform vec2 textureSize;
        varying vec2 vUv;

        void main() {
            vec2 texelSize = 1.0 / textureSize;
            
            // Sample 5x5 neighborhood
            vec4 center = texture2D(inputTexture, vUv);
            
            // Immediate neighbors
            vec4 left   = texture2D(inputTexture, vUv + vec2(-texelSize.x, 0));
            vec4 right  = texture2D(inputTexture, vUv + vec2(texelSize.x, 0));
            vec4 top    = texture2D(inputTexture, vUv + vec2(0, texelSize.y));
            vec4 bottom = texture2D(inputTexture, vUv + vec2(0, -texelSize.y));
            
            // Diagonal neighbors
            vec4 topLeft    = texture2D(inputTexture, vUv + vec2(-texelSize.x, texelSize.y));
            vec4 topRight   = texture2D(inputTexture, vUv + vec2(texelSize.x, texelSize.y));
            vec4 bottomLeft = texture2D(inputTexture, vUv + vec2(-texelSize.x, -texelSize.y));
            vec4 bottomRight= texture2D(inputTexture, vUv + vec2(texelSize.x, -texelSize.y));
            
            // Extended Laplacian kernel (more sensitive)
            vec4 laplacian = (left + right + top + bottom + topLeft + topRight + bottomLeft + bottomRight) - center * 8.0;
            float edgeStrength = length(laplacian.rgb);
            
            // Apply boundary detection and sharpening
            if (edgeStrength > ${threshold.toFixed(2)}) {
                ${this.boundaryTestActive ? `
                // Show boundaries when testing
                ${colorCodeEdges ? `
                // Color by edge orientation
                vec4 horizontal = (right - left) * 2.0 + (topRight + bottomRight - topLeft - bottomLeft);
                vec4 vertical = (top - bottom) * 2.0 + (topLeft + topRight - bottomLeft - bottomRight);
                float edgeAngle = atan(length(vertical), length(horizontal));
                
                if (abs(edgeAngle) < 0.5) {
                    gl_FragColor = vec4(1.0, 0.0, 0.0, ${preserveSplatAlpha ? 'center.a' : '1.0'});
                } else if (abs(edgeAngle) > 2.6) {
                    gl_FragColor = vec4(0.0, 1.0, 0.0, ${preserveSplatAlpha ? 'center.a' : '1.0'});
                } else {
                    gl_FragColor = vec4(0.0, 0.0, 1.0, ${preserveSplatAlpha ? 'center.a' : '1.0'});
                }
                ` : `
                gl_FragColor = vec4(1.0, 0.0, 0.0, ${preserveSplatAlpha ? 'center.a' : '1.0'});
                `}
                ` : `
                // Apply sharpening at boundaries
                vec4 sharpened = center - laplacian * ${sharpeningStrength.toFixed(2)};
                gl_FragColor = vec4(sharpened.rgb, ${preserveSplatAlpha ? 'center.a' : 'sharpened.a'});
                `}
            } else {
                // Return original scene with potential sharpening
                vec4 sharpened = center - laplacian * ${(sharpeningStrength * 0.3).toFixed(2)};
                gl_FragColor = vec4(sharpened.rgb, ${preserveSplatAlpha ? 'center.a' : 'sharpened.a'});
            }
        }`;
    }

    createSobelShader() {
        const threshold = this.parameters.laplacianThreshold;
        const colorCodeEdges = this.parameters.colorCodeEdges;
        const sharpeningStrength = this.parameters.sharpeningStrength;
        const preserveSplatAlpha = this.parameters.preserveSplatAlpha;

        return `
precision highp float;
uniform sampler2D inputTexture;
uniform vec2 textureSize;
varying vec2 vUv;

void main() {
    vec2 texelSize = 1.0 / textureSize;
    
    // Sample 3x3 neighborhood for Sobel
    vec4 topLeft     = texture2D(inputTexture, vUv + vec2(-texelSize.x, texelSize.y));
    vec4 top         = texture2D(inputTexture, vUv + vec2(0, texelSize.y));
    vec4 topRight    = texture2D(inputTexture, vUv + vec2(texelSize.x, texelSize.y));
    vec4 left        = texture2D(inputTexture, vUv + vec2(-texelSize.x, 0));
    vec4 center      = texture2D(inputTexture, vUv);
    vec4 right       = texture2D(inputTexture, vUv + vec2(texelSize.x, 0));
    vec4 bottomLeft  = texture2D(inputTexture, vUv + vec2(-texelSize.x, -texelSize.y));
    vec4 bottom      = texture2D(inputTexture, vUv + vec2(0, -texelSize.y));
    vec4 bottomRight = texture2D(inputTexture, vUv + vec2(texelSize.x, -texelSize.y));
    
    // Sobel operators
    vec4 sobelX = (topRight + 2.0 * right + bottomRight) - (topLeft + 2.0 * left + bottomLeft);
    vec4 sobelY = (bottomLeft + 2.0 * bottom + bottomRight) - (topLeft + 2.0 * top + topRight);
    
    float edgeStrength = sqrt(dot(sobelX.rgb, sobelX.rgb) + dot(sobelY.rgb, sobelY.rgb));
    
    // Apply boundary detection and sharpening
    if (edgeStrength > ${threshold.toFixed(2)}) {
        ${this.boundaryTestActive ? `
        // Show boundaries when testing
        ${colorCodeEdges ? `
        // Color by gradient direction
        float gradientX = length(sobelX.rgb);
        float gradientY = length(sobelY.rgb);
        
        if (gradientX > gradientY * 1.5) {
            gl_FragColor = vec4(1.0, 0.0, 0.0, ${preserveSplatAlpha ? 'center.a' : '1.0'});
        } else if (gradientY > gradientX * 1.5) {
            gl_FragColor = vec4(0.0, 1.0, 0.0, ${preserveSplatAlpha ? 'center.a' : '1.0'});
        } else {
            gl_FragColor = vec4(0.0, 0.0, 1.0, ${preserveSplatAlpha ? 'center.a' : '1.0'});
        }
        ` : `
        gl_FragColor = vec4(1.0, 0.0, 0.0, ${preserveSplatAlpha ? 'center.a' : '1.0'});
        `}
        ` : `
        // Apply sharpening at boundaries using unsharp masking
        vec4 sharpened = center + (sobelX + sobelY) * ${sharpeningStrength.toFixed(2)} * 0.5;
        gl_FragColor = vec4(sharpened.rgb, ${preserveSplatAlpha ? 'center.a' : 'sharpened.a'});
        `}
    } else {
        // Return original scene with potential sharpening
        vec4 sharpened = center + (sobelX + sobelY) * ${(sharpeningStrength * 0.2).toFixed(2)} * 0.5;
        gl_FragColor = vec4(sharpened.rgb, ${preserveSplatAlpha ? 'center.a' : 'sharpened.a'});
    }
}`;
    }

    createBilateralShader() {
        const spatialSigma = this.parameters.bilateralSpatialSigma;
        const rangeSigma = this.parameters.bilateralRangeSigma;
        const kernelSize = this.parameters.bilateralKernelSize;
        const kernelRadius = Math.floor(kernelSize / 2);

        return `
    precision highp float;
    uniform sampler2D inputTexture;
    uniform vec2 textureSize;
    varying vec2 vUv;
    
    void main() {
        vec2 texelSize = 1.0 / textureSize;
        vec4 center = texture2D(inputTexture, vUv);
        vec4 sum = vec4(0.0);
        float totalWeight = 0.0;
        
        float twoSpacialSigma2 = 2.0 * ${spatialSigma.toFixed(2)} * ${spatialSigma.toFixed(2)};
        float twoRangeSigma2 = 2.0 * ${rangeSigma.toFixed(2)} * ${rangeSigma.toFixed(2)};
        
        for (int x = -${kernelRadius}; x <= ${kernelRadius}; x++) {
            for (int y = -${kernelRadius}; y <= ${kernelRadius}; y++) {
                vec2 offset = vec2(float(x), float(y)) * texelSize;
                vec4 samples = texture2D(inputTexture, vUv + offset);
                
                // Spatial Gaussian weight (distance-based)
                float spatialDist = length(offset * textureSize);
                float spatialWeight = exp(-(spatialDist * spatialDist) / twoSpacialSigma2);
                
                // Range Gaussian weight (color similarity)
                float colorDist = length(samples.rgb - center.rgb);
                float rangeWeight = exp(-(colorDist * colorDist) / twoRangeSigma2);
                
                float weight = spatialWeight * rangeWeight;
                sum += samples * weight;
                totalWeight += weight;
            }
        }
        
        gl_FragColor = sum / totalWeight;
    }`;
    }

    // Shader Update Methods
    updateLaplacianShader() {
        if (!this.laplacianQuad) return;

        let fragmentShader;

        switch (this.parameters.kernelType) {
            case 'basic':
                fragmentShader = this.createBasicLaplacianShader();
                break;
            case 'extended':
                fragmentShader = this.createExtendedLaplacianShader();
                break;
            case 'sobel':
                fragmentShader = this.createSobelShader();
                break;
            default:
                fragmentShader = this.createBasicLaplacianShader();
        }

        this.laplacianQuad.material.fragmentShader = fragmentShader;
        this.laplacianQuad.material.needsUpdate = true;

        console.log('Updated Laplacian shader:', this.parameters.kernelType);
    }

    updateBilateralShader() {
        if (!this.bilateralQuad) return;

        this.bilateralQuad.material.fragmentShader = this.createBilateralShader();
        this.bilateralQuad.material.needsUpdate = true;

        console.log('Updated bilateral shader');
    }

    // Rendering Integration
    render() {
        if (this.bilateralSystemActive && this.laplacianSystemActive) {
            // BOTH SYSTEMS: Bilateral → Laplacian
            this.renderer.setRenderTarget(this.bilateralRenderTarget);
            this.renderer.clear(true, true, true);
            this.renderer.render(this.scene, this.camera);

            this.renderer.setRenderTarget(this.laplacianRenderTarget);
            this.bilateralQuad.material.uniforms.inputTexture.value = this.bilateralRenderTarget.texture;
            this.bilateralQuad.visible = true;
            this.renderer.render(this.bilateralScene, this.camera);

            this.renderer.setRenderTarget(null);
            this.laplacianQuad.material.uniforms.inputTexture.value = this.laplacianRenderTarget.texture;
            this.laplacianQuad.visible = true;
            this.renderer.render(this.laplacianScene, this.camera);

        } else if (this.bilateralSystemActive) {
            // ONLY BILATERAL
            this.renderer.setRenderTarget(this.bilateralRenderTarget);
            this.renderer.clear(true, true, true);
            this.renderer.render(this.scene, this.camera);

            this.renderer.setRenderTarget(null);
            this.bilateralQuad.material.uniforms.inputTexture.value = this.bilateralRenderTarget.texture;
            this.bilateralQuad.visible = true;
            this.renderer.render(this.bilateralScene, this.camera);

        } else if (this.laplacianSystemActive) {
            // ONLY LAPLACIAN
            this.renderer.setRenderTarget(this.laplacianRenderTarget);
            this.renderer.clear(true, true, true);
            this.renderer.render(this.scene, this.camera);

            this.renderer.setRenderTarget(null);
            this.laplacianQuad.material.uniforms.inputTexture.value = this.laplacianRenderTarget.texture;
            this.laplacianQuad.visible = true;
            this.renderer.render(this.laplacianScene, this.camera);

        } else {

            // NO POST-PROCESSING
            this.renderer.setRenderTarget(null);
            this.renderer.render(this.scene, this.camera);
        }
    }

    // Reset function
    reset() {
        this.toggleLaplacianBoundaries(false);
        this.toggleBilateralFiltering(false);

        this.parameters.laplacianThreshold = 0.3;
        this.parameters.bilateralSpatialSigma = 2.0;
        this.parameters.bilateralRangeSigma = 0.1;
        this.parameters.bilateralKernelSize = 5;
        this.parameters.kernelType = 'basic';
        this.parameters.colorCodeEdges = true;
        this.parameters.sharpeningStrength = 0.5;
        this.parameters.preserveSplatAlpha = true;

        this.boundaryTestActive = false;

        console.log('Boundary sharpening system reset');
    }

    // Get current state for UI
    getState() {
        return {
            ...this.parameters,
            laplacianSystemActive: this.laplacianSystemActive,
            bilateralSystemActive: this.bilateralSystemActive,
            boundaryTestActive: this.boundaryTestActive
        };
    }

    // Cleanup
    dispose() {
        // Clean up render targets
        if (this.laplacianRenderTarget) {
            this.laplacianRenderTarget.dispose();
        }
        if (this.bilateralRenderTarget) {
            this.bilateralRenderTarget.dispose();
        }

        // Clean up materials
        if (this.laplacianQuad && this.laplacianQuad.material) {
            this.laplacianQuad.material.dispose();
        }
        if (this.bilateralQuad && this.bilateralQuad.material) {
            this.bilateralQuad.material.dispose();
        }

        console.log('Boundary sharpening system disposed');
    }
}

export default BoundarySharpeningSystem;