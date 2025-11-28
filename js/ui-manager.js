
import * as THREE from "three";
export class UIManager {
    constructor() {
        this.systems = {};
        this.isMoveMode = false;
        this.isPanelCollapsed = false;
        this.collapsedSections = new Set();
    }

    setSystems(systems) {
        this.systems = systems;
    }

    init() {
        this.createControlPanel();
        this.createGlobalButtons();
        this.makePanelDraggable();
        this.initializeSections();
    }

    createControlPanel() {
        const panel = document.getElementById('controlPanel');
        if (!panel) return;

        panel.innerHTML = this.generatePanelHTML();
        this.setupPanelInteractions();
    }
    createGlobalButtons() {
        // Create Reset Button
        const resetBtn = document.createElement('button');
        resetBtn.className = 'reset-btn';
        resetBtn.textContent = 'Reset View';
        resetBtn.addEventListener('click', () => this.resetCamera());
        
        // // Create Move Mode Button
        // const moveModeBtn = document.createElement('button');
        // moveModeBtn.className = 'mode-btn';
        // moveModeBtn.id = 'moveModeBtn';
        // moveModeBtn.textContent = 'Move Mode';
        // moveModeBtn.addEventListener('click', () => this.toggleMoveMode());
        
        // Add to DOM - insert before the canvas
        const canvas = document.getElementById('threeCanvas');
        const renderPage = document.getElementById('renderPage');
        
        if (canvas && renderPage) {
            renderPage.insertBefore(resetBtn, canvas);
            // renderPage.insertBefore(moveModeBtn, canvas);
        } else {
            // Fallback - append to body
            document.body.appendChild(resetBtn);
            // document.body.appendChild(moveModeBtn);
        }
        
        console.log('Global buttons created successfully');
    }

    generatePanelHTML() {
        return `
            <div class="panel-header" id="panelHeader">
                <h3 class="panel-title">Control Panel</h3>
                <div class="panel-controls">
                    <button class="panel-btn" onclick="UIManager.getInstance().collapseAllSections()" title="Collapse All">-</button>
                    <button class="panel-btn" onclick="UIManager.getInstance().togglePanel()" title="Hide Panel">x</button>
                </div>
            </div>
            <div class="panel-content" id="panelContent">
                ${this.generateLightingSection()}
                ${this.generateEnvironmentSection()}
                ${this.generateEffectsSection()}
                ${this.generatePaintingSection()}
                ${this.generateBoundarySharpeningSection()}
                ${this.generateActionsSection()}
            </div>
        `;
    }

    generateLightingSection() {
        return `
        <div class="panel-section">
            <div class="section-header">
                Lighting Controls
                <button class="section-toggle" onclick="UIManager.getInstance().toggleSection('lightingControls')">+</button>
            </div>
            <div id="lightingControls" class="collapsible-content">
                <div class="control-group">
                    <label class="control-label">
                        Brightness
                        <span class="control-value" id="brightnessValue">1.0</span>
                    </label>
                    <input type="range" id="brightnessSlider" class="slider-control" 
                        min="0.1" max="3.0" step="0.1" value="1.0">
                </div>

                <div class="control-group">
                    <label class="control-label">Light Color</label>
                    <select id="colorPreset" class="select-control">
                        <option value="default">Default White</option>
                        <option value="warm">Warm Light</option>
                        <option value="cool">Cool Light</option>
                        <option value="sunlight">Sunlight</option>
                        <option value="night">Night Blue</option>
                    </select>
                </div>

                <div class="control-group">
                    <label class="control-label">
                        Light Direction
                        <span class="control-value" id="lightDirectionValue">45°</span>
                    </label>
                    <input type="range" id="lightDirectionSlider" class="slider-control" 
                        min="0" max="360" step="1" value="45">
                </div>

                <div class="control-group">
                    <label class="control-label">
                        Ambient
                        <span class="control-value" id="ambientValue">0.9</span>
                    </label>
                    <input type="range" id="ambientSlider" class="slider-control" 
                        min="0" max="1" step="0.1" value="0.9">
                </div>

                <div class="control-row">
                    <input type="checkbox" id="useGsplatNormalsCheckbox" class="checkbox-control">
                    <label class="control-label" style="margin: 0;">Use GSplat Normals for Lighting</label>
                </div>
            </div>
        </div>

        `;
    }

    generateEnvironmentSection() {
        return `
        <div class="panel-section">
            <div class="section-header">
                Environment Mapping
                <button class="section-toggle" onclick="UIManager.getInstance().toggleSection('envMapControls')">^</button>
            </div>
            <div id="envMapControls" class="collapsible-content">
                <div class="control-row">
                    <input type="checkbox" id="envMapCheckbox" class="checkbox-control" 
                        ">
                    <label class="control-label" style="margin: 0;">Enable Environment Mapping</label>
                </div>

                <div id="envMapSettings" style="display: none;">
                    <div class="control-group">
                        <label class="control-label">
                            Metalness: <span class="control-value" id="metalnessValue">1.0</span>
                        </label>
                        <input type="range" id="metalnessSlider" class="slider-control" 
                            min="0" max="1" step="0.1" value="1.0">
                    </div>

                    <div class="control-group">
                        <label class="control-label">
                            Roughness: <span class="control-value" id="roughnessValue">0.02</span>
                        </label>
                        <input type="range" id="roughnessSlider" class="slider-control" 
                            min="0" max="1" step="0.01" value="0.02">
                    </div>

                    <div class="control-group">
                        <label class="control-label">
                            Reflectivity: <span class="control-value" id="reflectivityValue">1.0</span>
                        </label>
                        <input type="range" id="reflectivitySlider" class="slider-control" 
                            min="0" max="1" step="0.1" value="1.0">
                    </div>


                    
                    <div style="font-size: 11px; color: #888; margin-top: 10px; text-align: center;">
                        Applies to reflective objects in the scene
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    generateEffectsSection() {
        return `
        <div class="panel-section">
            <div class="section-header">
                Fractal Effects
                <button class="section-toggle" onclick="UIManager.getInstance().toggleSection('effectsControls')">+</button>
            </div>
            <div id="effectsControls" class="collapsible-content">
                <div class="control-group">
                    <label class="control-label">Effect Type</label>
                    <select id="effectTypeSelect" class="select-control">
                        <option value="None">None</option>
                        <option value="Electronic">Electronic</option>
                        <option value="Deep Meditation">Deep Meditation</option>
                        <option value="Waves">Waves</option>
                        <option value="Disintegrate">Disintegrate</option>
                        <option value="Flare">Flare</option>
                        <option value="Disco">Disco</option>
                    </select>
                </div>

                <div class="control-group">
                    <label class="control-label">
                        Effect Intensity: <span class="control-value" id="intensityValue">0.8</span>
                    </label>
                    <input type="range" id="intensitySlider" class="slider-control" 
                        min="0" max="1" step="0.01" value="0.8">
                </div>
            </div>
        </div>

        `;
    }

    generatePaintingSection() {
        return `
            <div class="panel-section">
                <div class="section-header">
                    Splat Painting
                    <button class="section-toggle" onclick="UIManager.getInstance().toggleSection('colorControls')">^</button>
                </div>
                <div id="colorControls" class="collapsible-content">

                    <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                        <button id="brushModeBtn" onclick="UIManager.getInstance().enableBrushMode()" 
                                style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 5px;">
                            Paint Mode (1)
                        </button>
                    </div>
                    
                    <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                        <button onclick="UIManager.getInstance().enableViewMode()" 
                                style="flex: 1; padding: 8px; background: #2196F3; color: white; border: none; border-radius: 5px;">
                            View Mode (Esc)
                        </button>
                    </div>
                    
                    <div id="paintingStatus" style="font-size: 12px; color: #888; text-align: center; margin-bottom: 10px;">
                        View Mode - Use 1 for Paint, 2 for Erase
                    </div>
                        
                    <div class="control-row">
                        <label>
                            Paint Radius: <span id="brushRadiusValue">0.02</span>
                        </label>
                        <input type="range" id="brushRadiusSlider" min="0.01" max="0.25" step="0.01" value="0.02" style="width: 100%;">
                    </div>
                    
                    <div class="control-row">
                        <label>
                            Paint Depth: <span id="brushDepthValue">10.0</span>
                        </label>
                        <input type="range" id="brushDepthSlider" min="0.1" max="100.0" step="0.1" value="10.0" style="width: 100%;">
                    </div>
                    
                    <div class="control-row">
                        <label>Paint Color:</label>
                        <input type="color" id="brushColorPicker" value="#87CEEB" 
                            style="width: 100%; height: 40px; border: none; border-radius: 5px;">
                    </div>
                    
                    <div style="font-size: 11px; color: #888; margin-top: 10px;">
                        <strong>Paint (1):</strong> Paint on splats<br>
                        <strong>View (Esc):</strong> Orbit camera<br>
                        <strong>Drag:</strong> Paint/erase while moving
                    </div>
                </div>
            </div>
        `;
    }

    generateBoundarySharpeningSection() {
        return `
        <div class="panel-section">
            <div class="section-header">
                    Bilateral Filtering
                <button class="section-toggle" onclick="UIManager.getInstance().toggleSection('bilateralFilter')">^</button>
            </div>

            <div id="bilateralFilter" class="collapsible-content">
                <div class="control-row">
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <input type="checkbox" id="bilateralEnabledCheckbox" 
                        style="margin: 0;">
                    Enable Bilateral Filtering
                </label>
            </div>
                <div id="bilateralSettings" style="display: none; margin-top: 10px;">
                    <div class="control-row">
                        <label>
                            Spatial Sigma: <span id="spatialSigmaValue">2.0</span>
                        </label>
                        <input type="range" id="spatialSigmaSlider" min="0.5" max="5.0" step="0.1" value="2.0" style="width: 100%;">
                    </div>
                    
                    <div class="control-row">
                        <label>
                            Range Sigma: <span id="rangeSigmaValue">0.1</span>
                        </label>
                        <input type="range" id="rangeSigmaSlider" min="0.01" max="0.5" step="0.01" value="0.1" style="width: 100%;">
                    </div>
                    
                    <div class="control-row">
                        <label>
                            Kernel Size: <span id="bilateralKernelSize">5</span>
                        </label>
                        <input type="range" id="kernelSizeSlider" min="3" max="9" step="2" value="5" style="width: 100%;">
                    </div>
                    
                    <div style="font-size: 11px; color: #888; margin-top: 10px;">
                        <strong>Spatial:</strong> Controls spatial blur (distance)<br>
                        <strong>Range:</strong> Controls color similarity tolerance<br>
                        <strong>Effect:</strong> Smooths noise while preserving edges
                    </div>
                </div>
            </div>
        </div>

        <div class="panel-section">
            <div class="section-header">
                Laplacian Boundaries Detection & Sharpening
                <button class="section-toggle" onclick="UIManager.getInstance().toggleSection('laplacianBoundaries')">^</button>
            </div>
            <div id="laplacianBoundaries" class="collapsible-content">
                <div class="control-row">

                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <input type="checkbox" id="laplacianEnabledCheckbox" 
                            style="margin: 0;">
                        Enable Laplacian Boundaries
                    </label>
                </div>
                <div id="laplacianSettings" style="display: none; margin-top: 10px;">
                    <div class="control-row">
                        <label>
                            Edge Threshold: <span id="laplacianThresholdValue">0.3</span>
                        </label>
                        <input type="range" id="laplacianThresholdSlider" min="0.05" max="1.0" step="0.05" value="0.3" style="width: 100%;">
                    </div>
                    
                    <div class="control-row">
                    <label>
                        Detection Type: <span id="kernelSizeValue"></span>
                    </label>
                    <select id="kernelSizeSelect" style="width: 100%; padding: 5px; border-radius: 5px; background: #333; color: white; border: 1px solid #555;">
                        <option value="basic">Basic Laplacian</option>
                        <option value="extended">Extended Laplacian</option>
                        <option value="sobel">Sobel Operator</option>
                    </select>
                    </div>
                    
                    <div class="control-row">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="colorCodeEdgesCheckbox" checked
                                style="margin: 0;">
                            Color-Code Edge Types
                        </label>
                    </div>
                    
                    <div class="control-row">
                        <label>
                            Sharpening Strength: <span id="sharpeningStrengthValue">0.5</span>
                        </label>
                        <input type="range" id="sharpeningStrengthSlider" min="0.0" max="2.0" step="0.1" value="0.5" style="width: 100%;">
                    </div>
                    
                    <div class="control-row">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="preserveSplatAlphaCheckbox" checked
                                style="margin: 0;">
                            Preserve Splat Alpha
                        </label>
                    </div>
                    
                    <div style="font-size: 11px; color: #888; margin-top: 10px;">
                        <strong>Laplacian:</strong> True neighbor sampling for accurate boundaries<br>
                        <strong>Multi-pass:</strong> Renders scene to texture, then detects edges<br>
                        <strong>Sharpening:</strong> Uses boundaries to enhance edge clarity
                    </div>
                    
                    <div style="display: flex; gap: 5px; margin-top: 10px;">
                        <button id="testBoundariesBtn" style="flex: 1; padding: 8px; font-size: 12px; background: #ff4444; color: white; border: none; border-radius: 5px;">
                            Test Boundaries
                        </button>
                    </div>

                    <div style="display: flex; gap: 5px; margin-top: 10px;">

                        <button id="quickComparisonBtn" style="flex: 1; padding: 8px; font-size: 12px; background: #4444ff; color: white; border: none; border-radius: 5px;">
                            Quick Compare
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    generateActionsSection() {
        return `
        <div class="panel-section">
            <div class="btn-group">
                <button class="control-btn" id="resetLightingBtn">
                    Reset Lighting
                </button>
                <button class="control-btn" id="resetEffectsBtn">  
                    Reset Effects
                </button>
            </div>
            <div class="btn-group" style="margin-top: 8px;">
                <button class="control-btn primary" onclick="UIManager.getInstance().togglePanel()">
                    Hide Panel
                </button>
            </div>
        </div>
        `;
    }

    setupPanelInteractions() {
        this.setupLightingControls();
        this.setupEnvironmentControls();
        this.setupEffectsControls();
        this.setupPaintingControls();
        this.setupBoundarySharpeningControls();
        this.setupActionButtons();
    }

    setupLightingControls() {
        const brightnessSlider = document.getElementById('brightnessSlider');
        const colorPreset = document.getElementById('colorPreset');
        const lightDirectionSlider = document.getElementById('lightDirectionSlider');
        const ambientSlider = document.getElementById('ambientSlider');
        const useGsplatNormalsCheckbox = document.getElementById('useGsplatNormalsCheckbox');

        if (brightnessSlider) {
            brightnessSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('brightnessValue').textContent = value.toFixed(1);
                if (this.systems.lighting) {
                    this.systems.lighting.setBrightness(value);
                }
            });
        }

        if (colorPreset) {
            colorPreset.addEventListener('change', (e) => {
                if (this.systems.lighting) {
                    this.systems.lighting.setColorPreset(e.target.value);
                }
            });
        }

        if (lightDirectionSlider) {
            lightDirectionSlider.addEventListener('input', (e) => {
                const angle = parseFloat(e.target.value);
                document.getElementById('lightDirectionValue').textContent = angle + '°';
                if (this.systems.lighting) {
                    this.systems.lighting.setLightDirection(angle);
                }
            });
        }

        if (ambientSlider) {
            ambientSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('ambientValue').textContent = value.toFixed(1);
                if (this.systems.lighting) {
                    this.systems.lighting.setAmbient(value);
                }
            });
        }

        if (useGsplatNormalsCheckbox) {
            useGsplatNormalsCheckbox.addEventListener('change', (e) => {
                if (this.systems.lighting) {
                    this.systems.lighting.toggleGsplatNormals(e.target.checked);
                }
            });
        }
    }

    setupEnvironmentControls() {
        const envMapCheckbox = document.getElementById('envMapCheckbox');
        const metalnessSlider = document.getElementById('metalnessSlider');
        const roughnessSlider = document.getElementById('roughnessSlider');
        const reflectivitySlider = document.getElementById('reflectivitySlider');

        if (envMapCheckbox) {
            envMapCheckbox.addEventListener('change', (e) => {
                const envMapSettings = document.getElementById('envMapSettings');
                if (envMapSettings) {
                    envMapSettings.style.display = e.target.checked ? 'block' : 'none';
                }
                if (this.systems.environment) {
                    this.systems.environment.toggleEnvironmentMapping(e.target.checked);
                }
            });
        }

        if (metalnessSlider) {
            metalnessSlider.addEventListener('input', (e) => {
                document.getElementById('metalnessValue').textContent = e.target.value;
                if (this.systems.environment) {
                    this.systems.environment.setMetalness(parseFloat(e.target.value));
                }
            });
        }

        if (roughnessSlider) {
            roughnessSlider.addEventListener('input', (e) => {
                document.getElementById('roughnessValue').textContent = e.target.value;
                if (this.systems.environment) {
                    this.systems.environment.setRoughness(parseFloat(e.target.value));
                }
            });
        }

        if (reflectivitySlider) {
            reflectivitySlider.addEventListener('input', (e) => {
                document.getElementById('reflectivityValue').textContent = e.target.value;
                if (this.systems.environment) {
                    this.systems.environment.setReflectivity(parseFloat(e.target.value));
                }
            });
        }
    }

    setupEffectsControls() {
        const effectTypeSelect = document.getElementById('effectTypeSelect');
        const intensitySlider = document.getElementById('intensitySlider');

        if (effectTypeSelect) {
            effectTypeSelect.addEventListener('change', (e) => {
                if (this.systems.effects) {
                    this.systems.effects.setEffectType(e.target.value);
                }
            });
        }

        if (intensitySlider) {
            intensitySlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('intensityValue').textContent = value.toFixed(2);
                if (this.systems.effects) {
                    this.systems.effects.setIntensity(value);
                }
            });
        }
    }

    setupBoundarySharpeningControls() {
        const laplacianEnabledCheckbox = document.getElementById('laplacianEnabledCheckbox');
        const laplacianThresholdSlider = document.getElementById('laplacianThresholdSlider');
        const kernelSizeSelect = document.getElementById('kernelSizeSelect');
        const colorCodeEdgesCheckbox = document.getElementById('colorCodeEdgesCheckbox');
        const sharpeningStrengthSlider = document.getElementById('sharpeningStrengthSlider');
        const preserveSplatAlphaCheckbox = document.getElementById('preserveSplatAlphaCheckbox');
        
        const bilateralEnabledCheckbox = document.getElementById('bilateralEnabledCheckbox');
        const spatialSigmaSlider = document.getElementById('spatialSigmaSlider');
        const rangeSigmaSlider = document.getElementById('rangeSigmaSlider');
        const bilateralKernelSizeSlider = document.getElementById('kernelSizeSlider');
    
        const testBoundariesBtn = document.getElementById('testBoundariesBtn');
        const quickCompareBtn = document.getElementById('quickComparisonBtn');

        if (laplacianEnabledCheckbox) {
            laplacianEnabledCheckbox.addEventListener('change', (e) => {
                const settings = document.getElementById('laplacianSettings');
                if (settings) {
                    settings.style.display = e.target.checked ? 'block' : 'none';
                }
                if (this.systems.boundarySharpening) {
                    this.systems.boundarySharpening.toggleLaplacianBoundaries(e.target.checked);
                }
            });
        }
    
        if (laplacianThresholdSlider) {
            laplacianThresholdSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('laplacianThresholdValue').textContent = value.toFixed(2);
                if (this.systems.boundarySharpening) {
                    this.systems.boundarySharpening.setLaplacianThreshold(value);
                }
            });
        }
    
        if (kernelSizeSelect) {
            kernelSizeSelect.addEventListener('change', (e) => {
                if (this.systems.boundarySharpening) {
                    this.systems.boundarySharpening.setKernelType(e.target.value);
                }
            });
        }
    
        if (colorCodeEdgesCheckbox) {
            colorCodeEdgesCheckbox.addEventListener('change', (e) => {
                if (this.systems.boundarySharpening) {
                    this.systems.boundarySharpening.setColorCodeEdges(e.target.checked);
                }
            });
        }
    
        if (sharpeningStrengthSlider) {
            sharpeningStrengthSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('sharpeningStrengthValue').textContent = value.toFixed(1);
                if (this.systems.boundarySharpening) {
                    this.systems.boundarySharpening.setSharpeningStrength(value);
                }
            });
        }
    
        if (preserveSplatAlphaCheckbox) {
            preserveSplatAlphaCheckbox.addEventListener('change', (e) => {
                if (this.systems.boundarySharpening) {
                    this.systems.boundarySharpening.setPreserveSplatAlpha(e.target.checked);
                }
            });
        }
    
        // Button event listeners
        if (testBoundariesBtn) {
            testBoundariesBtn.addEventListener('click', () => {
                this.toggleTestBoundaries();
            });
        }
    
        if (quickCompareBtn) {
            quickCompareBtn.addEventListener('click', () => {
                this.quickComparison();
            });
        }
    
    
        // Bilateral controls
        if (bilateralEnabledCheckbox) {
            bilateralEnabledCheckbox.addEventListener('change', (e) => {
                const settings = document.getElementById('bilateralSettings');
                if (settings) {
                    settings.style.display = e.target.checked ? 'block' : 'none';
                }
                if (this.systems.boundarySharpening) {
                    this.systems.boundarySharpening.toggleBilateralFiltering(e.target.checked);
                }
            });
        }
    
        if (spatialSigmaSlider) {
            spatialSigmaSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('spatialSigmaValue').textContent = value.toFixed(1);
                if (this.systems.boundarySharpening) {
                    this.systems.boundarySharpening.setBilateralSpatialSigma(value);
                }
            });
        }
    
        if (rangeSigmaSlider) {
            rangeSigmaSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('rangeSigmaValue').textContent = value.toFixed(2);
                if (this.systems.boundarySharpening) {
                    this.systems.boundarySharpening.setBilateralRangeSigma(value);
                }
            });
        }
    
        if (bilateralKernelSizeSlider) {
            bilateralKernelSizeSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                document.getElementById('bilateralKernelSize').textContent = value;
                if (this.systems.boundarySharpening) {
                    this.systems.boundarySharpening.setBilateralKernelSize(value);
                }
            });
        }
    }

    setupPaintingControls() {
        const brushModeBtn = document.getElementById('brushModeBtn');
        const viewModeBtn = document.getElementById('viewModeBtn');
        const brushRadiusSlider = document.getElementById('brushRadiusSlider');
        const brushDepthSlider = document.getElementById('brushDepthSlider');
        const brushColorPicker = document.getElementById('brushColorPicker');

        if (brushModeBtn) {
            brushModeBtn.addEventListener('click', () => this.enableBrushMode());
        }

        if (viewModeBtn) {
            viewModeBtn.addEventListener('click', () => this.enableViewMode());
        }

        if (brushRadiusSlider) {
            brushRadiusSlider.addEventListener('input', (e) => {
                document.getElementById('brushRadiusValue').textContent = e.target.value;
                if (this.systems.painting) {
                    this.systems.painting.setBrushRadius(parseFloat(e.target.value));
                }
            });
        }

        if (brushDepthSlider) {
            brushDepthSlider.addEventListener('input', (e) => {
                document.getElementById('brushDepthValue').textContent = e.target.value;
                if (this.systems.painting) {
                    this.systems.painting.setBrushDepth(parseFloat(e.target.value));
                }
            });
        }

        if (brushColorPicker) {
            brushColorPicker.addEventListener('input', (e) => {
                if (this.systems.painting) {
                    this.systems.painting.setBrushColor(e.target.value);
                }
            });
        }
    }

    toggleTestBoundaries() {
        if (this.systems.boundarySharpening) {
            this.systems.boundarySharpening.toggleTestBoundaries();
        }
    }

    quickComparison() {
        if (this.systems.boundarySharpening) {
            this.systems.boundarySharpening.quickComparison();
        }
    }


    setupActionButtons() {
        const resetLightingBtn = document.getElementById('resetLightingBtn');
        const resetEffectsBtn = document.getElementById('resetEffectsBtn');
        const hidePanelBtn = document.getElementById('hidePanelBtn');

        if (resetLightingBtn) {
            resetLightingBtn.addEventListener('click', () => this.resetLighting());
        }

        if (resetEffectsBtn) {
            resetEffectsBtn.addEventListener('click', () => this.resetEffects());
        }

        if (hidePanelBtn) {
            hidePanelBtn.addEventListener('click', () => this.togglePanel());
        }
    }

    toggleMoveMode() {
        this.isMoveMode = !this.isMoveMode;
        // const moveModeBtn = document.getElementById('moveModeBtn');
        const controlsInfo = document.getElementById('controlsInfo');

        if (!moveModeBtn) {
            console.error('Move mode button not found');
            return;
        }

        if (this.isMoveMode) {
            moveModeBtn.classList.add('active');
            moveModeBtn.textContent = 'Exit Move Mode';
            
            if (controlsInfo) {
                controlsInfo.innerHTML = `
                    <h3>Move Mode</h3>
                    <p>Use WASD or Arrow Keys to move around</p>
                    <p>Camera height: 0.1 units above ground</p>
                    <p>Use "Reset View" to return to start</p>
                `;
            }

            if (this.systems.viewer) {
                this.systems.viewer.updateMoveMode(true);
            }

            this.addMoveModeEventListeners();
            console.log('Move mode enabled - Use WASD to move');
        } else {
            moveModeBtn.classList.remove('active');
            moveModeBtn.textContent = 'Move Mode';
            
            if (controlsInfo) {
                controlsInfo.innerHTML = `
                    <h3>Drag Mode</h3>
                    <p>Drag to look around</p>
                    <p>Use "Reset View" to return to start</p>
                `;
            }
            
            if (this.systems.viewer) {
                this.systems.viewer.updateMoveMode(false);
            }

            this.removeMoveModeEventListeners();
            console.log('Move mode disabled');
        }
    }

    addMoveModeEventListeners() {
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
    }

    removeMoveModeEventListeners() {
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
    }

    onKeyDown(event) {
        if (!this.isMoveMode || !this.systems.viewer) return;
        this.systems.viewer.onKeyDown(event);
    }

    onKeyUp(event) {
        if (!this.isMoveMode || !this.systems.viewer) return;
        this.systems.viewer.onKeyUp(event);
    }

    // Painting mode functions
    enableBrushMode() {
        console.log("11111",  this.isPaintingActive, this.systems.painting)

        if (this.systems.painting) {
            this.systems.painting.enableBrushMode();
        }
        
    }

    enableViewMode() {
        console.log("2222",  this.isPaintingActive, this.systems.painting)

        if (this.systems.painting) {
            this.systems.painting.enableViewMode();
        }
        

    }

    // Panel management
    togglePanel() {
        const panel = document.getElementById('controlPanel');
        const showBtn = document.getElementById('showPanelBtn');
        
        if (!panel) return;
        
        this.isPanelCollapsed = !this.isPanelCollapsed;
        panel.classList.toggle('collapsed', this.isPanelCollapsed);
        
        if (showBtn) {
            if (this.isPanelCollapsed) {
                showBtn.style.display = 'block';
                showBtn.textContent = 'Show Controls';
            } else {
                showBtn.style.display = 'none';
                showBtn.textContent = 'Show Controls';
            }
        }
    }

    toggleSection(sectionId) {
        const section = document.getElementById(sectionId);
        const toggleBtn = section?.parentElement?.querySelector('.section-toggle');
        
        if (!section || !toggleBtn) return;
        
        const isCollapsed = section.classList.contains('collapsed');
        
        if (isCollapsed) {
            section.classList.remove('collapsed');
            this.collapsedSections.delete(sectionId);
            toggleBtn.textContent = '^';
        } else {
            section.classList.add('collapsed');
            this.collapsedSections.add(sectionId);
            toggleBtn.textContent = '+';
        }
        
        section.style.maxHeight = isCollapsed ? section.scrollHeight + 'px' : '0px';
    }

    collapseAllSections() {
        const sections = document.querySelectorAll('.collapsible-content');
        const toggleBtns = document.querySelectorAll('.section-toggle');
        
        sections.forEach(section => {
            section.classList.add('collapsed');
            section.style.maxHeight = '0px';
            this.collapsedSections.add(section.id);
        });
        
        toggleBtns.forEach(btn => {
            btn.textContent = '+';
        });
    }

    expandAllSections() {
        const sections = document.querySelectorAll('.collapsible-content');
        const toggleBtns = document.querySelectorAll('.section-toggle');
        
        sections.forEach(section => {
            section.classList.remove('collapsed');
            section.style.maxHeight = section.scrollHeight + 'px';
            this.collapsedSections.delete(section.id);
        });
        
        toggleBtns.forEach(btn => {
            btn.textContent = '^';
        });
    }

    initializeSections() {
        const sections = document.querySelectorAll('.collapsible-content');
        sections.forEach(section => {
            section.classList.remove('collapsed');
            section.style.maxHeight = section.scrollHeight + 'px';
            
            const toggleBtn = section.parentElement.querySelector('.section-toggle');
            if (toggleBtn) {
                toggleBtn.textContent = '^';
            }
        });
    }

    // Reset functions
    resetLighting() {
        if (this.systems.lighting) {
            this.systems.lighting.reset();
        }
        
        // Reset UI elements
        document.getElementById('brightnessSlider').value = '1.0';
        document.getElementById('brightnessValue').textContent = '1.0';
        document.getElementById('colorPreset').value = 'default';
        document.getElementById('ambientSlider').value = '0.9';
        document.getElementById('ambientValue').textContent = '0.9';
        document.getElementById('lightDirectionSlider').value = '45';
        document.getElementById('lightDirectionValue').textContent = '45°';
    }

    resetEffects() {
        if (this.systems.effects) {
            this.systems.effects.reset();
        }
        
        document.getElementById('effectTypeSelect').value = 'None';
        document.getElementById('intensitySlider').value = '0.8';
        document.getElementById('intensityValue').textContent = '0.8';
    }

    // Dynamic UI additions
    addGsplatNormalControl() {
        const container = document.getElementById('gsplatNormalControlContainer');
        if (!container || document.getElementById('showGsplatNormalsCheckbox')) return;

        container.innerHTML = `
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="showGsplatNormalsCheckbox" style="margin: 0;">
                Show GSplat Normals
            </label>
        `;

        const checkbox = document.getElementById('showGsplatNormalsCheckbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                if (this.systems.lighting) {
                    this.systems.lighting.toggleGsplatNormalVisualization(e.target.checked);
                }
            });
        }
    }


    makePanelDraggable() {
        const panel = document.getElementById('controlPanel');
        const header = document.getElementById('panelHeader');
        
        if (!panel || !header) return;

        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        const startDrag = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            panel.style.transition = 'none';
        };

        const drag = (e) => {
            if (!isDragging) return;
            
            panel.style.left = (e.clientX - dragOffset.x) + 'px';
            panel.style.top = (e.clientY - dragOffset.y) + 'px';
            panel.style.right = 'auto';
        };

        const stopDrag = () => {
            isDragging = false;
            panel.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        };

        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
    }

    showClickIndicator(x, y, isValid) {
        const indicator = document.createElement('div');
        indicator.className = isValid ? 'click-indicator' : 'invalid-click';
        indicator.style.left = (x - 10) + 'px';
        indicator.style.top = (y - 10) + 'px';
        document.body.appendChild(indicator);

        setTimeout(() => {
            if (document.body.contains(indicator)) {
                document.body.removeChild(indicator);
            }
        }, 500);
    }

    updateControlsInfo(html) {
        const controlsInfo = document.getElementById('controlsInfo');
        if (controlsInfo) {
            controlsInfo.innerHTML = html;
        }
    }

    resetCamera() {
        if (this.systems.viewer) {
            const viewer = this.systems.viewer;
            if (viewer.mesh && viewer.controls) {
                const boundingBox = viewer.mesh.getBoundingBox();
                const meshCenter = new THREE.Vector3();
                boundingBox.getCenter(meshCenter);
                
                viewer.camera.position.set(
                    meshCenter.x + 0.2,
                    meshCenter.y,
                    meshCenter.z + 0.2
                );
                
                viewer.controls.target.copy(meshCenter);
                viewer.controls.update();
            }
        }
    }

    // Cleanup
    dispose() {
        this.removeMoveModeEventListeners();
        this.collapsedSections.clear();
    }

    // Singleton pattern for global access
    static getInstance() {
        const viewerApp = window.viewerApp;
        if (viewerApp && viewerApp.systems && viewerApp.systems.ui) {
            return viewerApp.systems.ui;
        }
    }
}

// Initialize singleton
UIManager.instance = null;

// Make available globally for HTML event handlers
window.UIManager = UIManager;