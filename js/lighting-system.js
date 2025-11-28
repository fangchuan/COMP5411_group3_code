import * as THREE from 'three';
import { setWorldNormalColor, setWorldPLYNormalColor, setRoughnessColor, setSpecularColor } from '@sparkjsdev/spark';

export class LightingSystem {
    constructor() {
        this.viewerCore = null;
        this.mesh = null;
        this.sparkRenderer = null;
        
        // Lighting parameters
        this.parameters = {
            brightness: 0.8,
            lightColor: new THREE.Vector4(1, 1, 1, 1),
            ambient: 0.4,
            lightDirection: new THREE.Vector3(1, 1, 0).normalize(),
            useGsplatNormals: false,
            showGsplatNormals: false,
            showGsplatPLYNormals: false
        };

        // State management
        this.originalModifier = null;
        this.currentVisualization = 'none';
        this.originalColors = null;
        
        // Lighting controls reference
        this.lightingControls = null;
    }

    setViewerCore(viewerCore) {
        this.viewerCore = viewerCore;
        this.mesh = viewerCore.mesh;
        this.sparkRenderer = viewerCore.spark;
    }

    init() {
        console.log('Initializing Lighting System...');
        
        this.setupSplatLighting();
        this.setupGsplatNormalVisualization();
        this.setupGsplatPLYNormalVisualization();
        
        console.log('Lighting System initialized');
    }

    // Main lighting setup
    setupSplatLighting() {
        console.log('Setting up splat lighting on SparkRenderer...');

        const checkForSparkRenderer = () => {
            if (this.sparkRenderer && this.sparkRenderer.material) {
                console.log('Found SparkRenderer material, patching for lighting...');
                this.patchSparkRendererMaterial(this.sparkRenderer.material);
                return true;
            }
            return false;
        };

        // Try immediately
        if (!checkForSparkRenderer()) {
            // If not found, check periodically
            const interval = setInterval(() => {
                if (checkForSparkRenderer()) {
                    clearInterval(interval);
                }
            }, 100);

            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(interval);
                if (!this.sparkRenderer) {
                    console.warn('SparkRenderer not found for lighting setup');
                }
            }, 5000);
        }
    }

    patchSparkRendererMaterial(material) {
        console.log('Patching SparkRenderer material with WORLD SPACE GSplat lighting...');

        // Add lighting uniforms - WORLD SPACE
        material.uniforms.lightDirection = { value: this.parameters.lightDirection.clone() };
        material.uniforms.lightColor = { value: new THREE.Vector3(1.0, 1.0, 1.0) };
        material.uniforms.lightIntensity = { value: this.parameters.brightness };
        material.uniforms.ambientIntensity = { value: this.parameters.ambient };
        material.uniforms.useGsplatNormals = { value: this.parameters.useGsplatNormals ? 1.0 : 0.0 };

        // Store original shaders for reference
        const originalVertexShader = material.vertexShader;
        const originalFragmentShader = material.fragmentShader;

        // Patch vertex shader - SIMPLIFIED (just pass data)
        if (originalVertexShader) {
            let modifiedVertexShader = originalVertexShader;

            // Add varying outputs - ONLY what we need for world space lighting
            if (modifiedVertexShader.includes('out vec4 vRgba;')) {
                modifiedVertexShader = modifiedVertexShader.replace(
                    'out vec4 vRgba;',
                    `out vec4 vRgba;
                    out vec3 vScales;
                    out vec4 vQuaternion;`
                );
            }

            // Pass splat data (scales and quaternion) - NO VIEW SPACE CALCULATIONS
            if (modifiedVertexShader.includes('unpackSplatEncoding(packed, center, scales, quaternion, rgba, rgbMinMaxLnScaleMinMax);')) {
                modifiedVertexShader = modifiedVertexShader.replace(
                    'unpackSplatEncoding(packed, center, scales, quaternion, rgba, rgbMinMaxLnScaleMinMax);',
                    `unpackSplatEncoding(packed, center, scales, quaternion, rgba, rgbMinMaxLnScaleMinMax);
                    vScales = scales;
                    vQuaternion = quaternion;`
                );
            }

            material.vertexShader = modifiedVertexShader;
        }

        // Patch fragment shader - PURE WORLD SPACE
        if (originalFragmentShader) {
            let modifiedShader = originalFragmentShader;

            // Add uniform declarations
            const uniformMatch = modifiedShader.match(/uniform float (\w+);/);
            if (uniformMatch) {
                modifiedShader = modifiedShader.replace(
                    /uniform float \w+;/,
                    `uniform float ${uniformMatch[1]};\nuniform vec3 lightDirection;\nuniform vec3 lightColor;\nuniform float lightIntensity;\nuniform float ambientIntensity;\nuniform float useGsplatNormals;`
                );
            }

            // Add varying declarations - REMOVED view space data
            if (modifiedShader.includes('in vec4 vRgba;')) {
                modifiedShader = modifiedShader.replace(
                    'in vec4 vRgba;',
                    `in vec4 vRgba;
                    in vec3 vScales;
                    in vec4 vQuaternion;`
                );
            }

            // Add WORLD SPACE GSplat normal function
            const gsplatNormalCode = `
                // Gaussian splat normal calculation - WORLD SPACE
                vec3 gsplatNormal(vec3 scales, vec4 quat) {
                    float minScale = min(scales.x, min(scales.y, scales.z));
                    vec3 normal;
                    if (scales.z == minScale) {
                        normal = vec3(0.0, 0.0, 1.0);
                    } else if (scales.y == minScale) {
                        normal = vec3(0.0, 1.0, 0.0);
                    } else {
                        normal = vec3(1.0, 0.0, 0.0);
                    }
                    return quatVec(quat, normal);
                }

                vec3 safeNormalize(vec3 v) {
                    float len = length(v);
                    if (len > 0.0) {
                        return v / len;
                    }
                    return vec3(0.0, 0.0, 1.0);
                }
            `;

            // Insert the GSplat normal code
            if (modifiedShader.includes('void main() {')) {
                modifiedShader = modifiedShader.replace(
                    'void main() {',
                    `${gsplatNormalCode}\n\nvoid main() {`
                );
            }

            // Replace lighting calculation with PURE WORLD SPACE
            if (modifiedShader.includes('rgba.rgb = srgbToLinear(rgba.rgb);')) {
                modifiedShader = modifiedShader.replace(
                    /rgba\.rgb = srgbToLinear\(rgba\.rgb\);\s*\}/,
                    `rgba.rgb = srgbToLinear(rgba.rgb);
                    }

                    // PURE WORLD SPACE LIGHTING
                    vec3 lightDir = normalize(lightDirection);

                    // Choose between GSplat normals and simple fallback
                    vec3 finalNormal;
                    if (useGsplatNormals > 0.5) {
                        // Use actual GSplat normals in WORLD SPACE
                        finalNormal = safeNormalize(gsplatNormal(vScales, vQuaternion));
                    } else {
                        // Simple fallback - point slightly upward in world space
                        finalNormal = vec3(0.0, 1.0, 0.0); // World up vector
                    }

                    // Simple diffuse lighting in WORLD SPACE
                    float diffuse = max(dot(finalNormal, lightDir), 0.0);

                    // Apply lighting
                    rgba.rgb = (ambientIntensity + diffuse * lightIntensity) * lightColor * rgba.rgb;`
                );
            }

            material.fragmentShader = modifiedShader;
            material.needsUpdate = true;

            console.log('WORLD SPACE GSplat lighting successfully patched');

            // Enhanced lighting controls
            this.lightingControls = {
                setLightDirection: (x, y, z) => {
                    material.uniforms.lightDirection.value.set(x, y, z).normalize();
                    material.uniformsNeedUpdate = true;
                    console.log('Light direction (WORLD SPACE):', x.toFixed(2), y.toFixed(2), z.toFixed(2));
                },
                setLightColor: (r, g, b) => {
                    material.uniforms.lightColor.value.set(r, g, b);
                    material.uniformsNeedUpdate = true;
                },
                setIntensity: (intensity) => {
                    material.uniforms.lightIntensity.value = intensity;
                    material.uniformsNeedUpdate = true;
                },
                setAmbient: (intensity) => {
                    material.uniforms.ambientIntensity.value = intensity;
                    material.uniformsNeedUpdate = true;
                },
                setUseGsplatNormals: (use) => {
                    material.uniforms.useGsplatNormals.value = use ? 1.0 : 0.0;
                    material.uniformsNeedUpdate = true;
                    console.log('Using GSplat normals:', use);
                },
                getMaterial: () => material
            };
        }
    }

    // GSplat Normal Visualization
    setupGsplatNormalVisualization() {
        console.log('Setting up Gaussian splat normal visualization...');

        const checkForSplatMesh = () => {
            if (this.mesh && this.mesh.isInitialized) {
                console.log('Found splat mesh, setting up normal visualization');
                this.applyGsplatNormalVisualization(this.mesh);
                return true;
            }
            return false;
        };

        if (!checkForSplatMesh()) {
            const interval = setInterval(() => {
                if (checkForSplatMesh()) {
                    clearInterval(interval);
                }
            }, 100);

            setTimeout(() => {
                clearInterval(interval);
                if (!this.mesh) {
                    console.warn('Splat mesh not found for GSplat normal visualization');
                }
            }, 5000);
        }
    }

    applyGsplatNormalVisualization(splatMesh) {
        console.log('Applying GSplat normal visualization to mesh:', splatMesh);

        try {
            // Store original state
            this.originalModifier = splatMesh.worldModifier;

            // Create global controls
            this.gsplatNormalDebug = {
                showNormals: (show) => {
                    if (show) {
                        // Enable normal visualization
                        setWorldNormalColor(splatMesh);
                        this.parameters.showGsplatNormals = true;
                        console.log('GSplat normal visualization: ON');
                    } else {
                        // Disable normal visualization - restore original state
                        splatMesh.worldModifier = this.originalModifier;
                        splatMesh.updateGenerator();
                        this.parameters.showGsplatNormals = false;
                        console.log('GSplat normal visualization: OFF');
                    }
                },

                toggleNormals: () => {
                    const newState = !this.parameters.showGsplatNormals;
                    this.gsplatNormalDebug.showNormals(newState);
                    return newState;
                },

                getState: () => this.parameters.showGsplatNormals
            };

            console.log('GSplat normal visualization system ready');

        } catch (error) {
            console.error('Error applying GSplat normal visualization:', error);
        }
    }

    // GSplat PLY Normal Visualization
    setupGsplatPLYNormalVisualization() {
        console.log('Setting up Gaussian splat PLY normal visualization...');

        const checkForSplatMesh = () => {
            if (this.mesh && this.mesh.isInitialized) {
                console.log('Found splat mesh, setting up PLY normal visualization');
                this.applyGsplatPLYNormalVisualization(this.mesh);
                return true;
            }
            return false;
        };

        if (!checkForSplatMesh()) {
            const interval = setInterval(() => {
                if (checkForSplatMesh()) {
                    clearInterval(interval);
                }
            }, 100);

            setTimeout(() => {
                clearInterval(interval);
                if (!this.mesh) {
                    console.warn('Splat mesh not found for GSplat PLY normal visualization');
                }
            }, 5000);
        }
    }

    applyGsplatPLYNormalVisualization(splatMesh) {
        console.log('Applying GSplat PLY normal visualization to mesh:', splatMesh);

        try {
            // Store original state
            this.originalModifier = splatMesh.worldModifier;

            // Create controls
            this.gsplatPLYNormalDebug = {
                showNormals: (show) => {
                    if (show) {
                        // Enable PLY normal visualization
                        setWorldPLYNormalColor(splatMesh);
                        this.parameters.showGsplatPLYNormals = true;
                        console.log('GSplat PLY normal visualization: ON');
                    } else {
                        // Disable normal visualization - restore original state
                        splatMesh.worldModifier = this.originalModifier;
                        splatMesh.updateGenerator();
                        this.parameters.showGsplatPLYNormals = false;
                        console.log('GSplat PLY normal visualization: OFF');
                    }
                },

                toggleNormals: () => {
                    const newState = !this.parameters.showGsplatPLYNormals;
                    this.gsplatPLYNormalDebug.showNormals(newState);
                    return newState;
                },

                getState: () => this.parameters.showGsplatPLYNormals
            };

            console.log('GSplat PLY normal visualization system ready');

        } catch (error) {
            console.error('Error applying GSplat PLY normal visualization:', error);
        }
    }

    // Public API Methods
    setBrightness(brightness) {
        this.parameters.brightness = brightness;
        if (this.lightingControls) {
            this.lightingControls.setIntensity(brightness);
        }
        console.log('Brightness set to:', brightness);
    }

    setColorPreset(preset) {
        switch (preset) {
            case 'warm':
                this.parameters.lightColor.set(2.0, 1.5, 0.5, 1.0);
                break;
            case 'cool':
                this.parameters.lightColor.set(0.5, 1.0, 2.0, 1.0);
                break;
            case 'sunlight':
                this.parameters.lightColor.set(2.0, 2.0, 1.0, 1.0);
                break;
            case 'night':
                this.parameters.lightColor.set(0.2, 0.3, 1.0, 1.0);
                break;
            default:
                this.parameters.lightColor.set(1.0, 1.0, 1.0, 1.0);
        }

        if (this.lightingControls) {
            this.lightingControls.setLightColor(
                this.parameters.lightColor.x,
                this.parameters.lightColor.y,
                this.parameters.lightColor.z
            );
        }
        console.log('Color preset set to:', preset);
    }

    setLightDirection(angle) {
        const rad = angle * Math.PI / 180;
        this.parameters.lightDirection.set(Math.cos(rad), 1, Math.sin(rad)).normalize();
        
        if (this.lightingControls) {
            this.lightingControls.setLightDirection(
                this.parameters.lightDirection.x,
                this.parameters.lightDirection.y,
                this.parameters.lightDirection.z
            );
        }
        console.log('Light direction set to:', angle + '°');
    }

    setAmbient(ambient) {
        this.parameters.ambient = ambient;
        if (this.lightingControls) {
            this.lightingControls.setAmbient(ambient);
        }
        console.log('Ambient light set to:', ambient);
    }

    toggleGsplatNormals(useGsplat) {
        this.parameters.useGsplatNormals = useGsplat;
        if (this.lightingControls) {
            this.lightingControls.setUseGsplatNormals(useGsplat);
        }
        console.log('GSplat normals for lighting:', useGsplat ? 'ENABLED' : 'DISABLED');
    }

    toggleGsplatNormalVisualization(show) {
        if (this.gsplatNormalDebug) {
            this.gsplatNormalDebug.showNormals(show);
        } else {
            console.log('GSplat normal debug system not ready yet');
        }
    }

    toggleGsplatPLYNormalVisualization(show) {
        if (this.gsplatPLYNormalDebug) {
            this.gsplatPLYNormalDebug.showNormals(show);
        } else {
            console.log('GSplat PLY normal debug system not ready yet');
        }
    }

    // Advanced lighting effects
    setRoughnessVisualization(enable) {
        if (this.mesh) {
            if (enable) {
                setRoughnessColor(this.mesh);
                this.currentVisualization = 'roughness';
                console.log('Roughness visualization: ON');
            } else {
                this.restoreOriginalColors();
                console.log('Roughness visualization: OFF');
            }
        }
    }

    setSpecularVisualization(enable) {
        if (this.mesh) {
            if (enable) {
                setSpecularColor(this.mesh);
                this.currentVisualization = 'specular';
                console.log('Specular visualization: ON');
            } else {
                this.restoreOriginalColors();
                console.log('Specular visualization: OFF');
            }
        }
    }

    // Store and restore original colors for visualizations
    storeOriginalColors() {
        if (!this.mesh || !this.mesh.packedSplats) return;

        if (!this.originalColors) {
            this.originalColors = new Map();
            this.mesh.packedSplats.forEachSplat((index, center, scales, quaternion, opacity, color) => {
                this.originalColors.set(index, {
                    r: color.r,
                    g: color.g,
                    b: color.b,
                    opacity: opacity
                });
            });
            console.log('Stored original colors for', this.originalColors.size, 'splats');
        }
    }

    restoreOriginalColors() {
        if (!this.mesh || !this.originalColors) return;

        try {
            // This would need to be implemented based on your splat modification system
            // For now, we'll just reset the mesh modifier
            if (this.originalModifier) {
                this.mesh.worldModifier = this.originalModifier;
                this.mesh.updateGenerator();
            }
            this.currentVisualization = 'none';
            console.log('Restored original colors');
        } catch (error) {
            console.error('Error restoring colors:', error);
        }
    }

    // Apply all current lighting settings
    applyLighting() {
        if (this.lightingControls) {
            this.lightingControls.setLightDirection(
                this.parameters.lightDirection.x,
                this.parameters.lightDirection.y,
                this.parameters.lightDirection.z
            );
            this.lightingControls.setLightColor(
                this.parameters.lightColor.x,
                this.parameters.lightColor.y,
                this.parameters.lightColor.z
            );
            this.lightingControls.setIntensity(this.parameters.brightness);
            this.lightingControls.setAmbient(this.parameters.ambient);
            this.lightingControls.setUseGsplatNormals(this.parameters.useGsplatNormals);
            
            console.log('Applied all lighting settings');
        }
    }

    // Reset to default lighting
    reset() {
        this.parameters.brightness = 1.0;
        this.parameters.lightColor.set(1, 1, 1, 1);
        this.parameters.ambient = 0.5;
        this.parameters.lightDirection.set(1, 1, 0).normalize();
        this.parameters.useGsplatNormals = false;
        
        // Reset visualizations
        this.toggleGsplatNormalVisualization(false);
        this.toggleGsplatPLYNormalVisualization(false);
        this.restoreOriginalColors();
        
        // Apply reset settings
        this.applyLighting();
        
    }

    // Get current state for UI
    getState() {
        return {
            ...this.parameters,
            currentVisualization: this.currentVisualization,
            lightingControlsAvailable: !!this.lightingControls
        };
    }


    // Cleanup
    dispose() {
        // Reset any visualizations
        this.restoreOriginalColors();
        
        // Clear references
        this.lightingControls = null;
        this.gsplatNormalDebug = null;
        this.gsplatPLYNormalDebug = null;
        this.originalColors = null;
        
        console.log('Lighting system disposed');
    }
}

export default LightingSystem;