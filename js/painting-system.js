import * as THREE from 'three';
import { dyno } from '@sparkjsdev/spark';

export class PaintingSystem {
    constructor() {
        this.viewerCore = null;
        this.spark = null;
        this.mesh = null;
        
        // Painting parameters
        this.parameters = {
            controlsEnabled: true,
            brushEnabled: dyno.dynoBool(false),
            brushDepth: dyno.dynoFloat(10.0),
            brushRadius: dyno.dynoFloat(0.02),
            brushOrigin: dyno.dynoVec3(new THREE.Vector3(0.0, 0.0, 0.0)),
            brushDirection: dyno.dynoVec3(new THREE.Vector3(0.0, 0.0, 0.0)),
            brushColorHex: "#87CEEB",
            brushColor: dyno.dynoVec3(new THREE.Vector3(0.529, 0.808, 0.922)),
        };

        // State management
        this.isDragging = false;
        this.isPaintingActive = false;
        this.raycaster = null;
        this.mouse = new THREE.Vector2();

        // Constants
        this.MIN_BRUSH_RADIUS = 0.01;
        this.MAX_BRUSH_RADIUS = 0.25;
        this.MIN_BRUSH_DEPTH = 0.1;
        this.MAX_BRUSH_DEPTH = 100.0;
    }

    setViewerCore(viewerCore) {
        this.viewerCore = viewerCore;
        this.spark = viewerCore.spark;
        this.mesh = viewerCore.mesh;
        this.raycaster = new THREE.Raycaster();
    }

    init() {
        if (!this.mesh) {
            console.warn('PaintingSystem: Mesh not available yet');
            return;
        }

        this.setupPaintingModifier();
        this.setupEventListeners();
        console.log('Painting system initialized');
    }

    setupPaintingModifier() {
        if (!this.mesh) return;

        // Apply the brush dyno modifier to the mesh
        this.mesh.worldModifier = this.brushDyno(
            this.parameters.brushEnabled,
            this.parameters.brushRadius,
            this.parameters.brushDepth,
            this.parameters.brushOrigin,
            this.parameters.brushDirection,
            this.parameters.brushColor,
        );
        
        this.mesh.updateGenerator();
    }

    // Brush dyno function for painting
    brushDyno(brushEnabled, brushRadius, brushDepth, brushOrigin, brushDirection, brushColor) {
        const flatColor = dyno.dynoVec3(new THREE.Vector3(1.0, 1.0, 1.0));
        const luminanceThreshold = dyno.dynoFloat(0.1);
        return dyno.dynoBlock({ gsplat: dyno.Gsplat }, { gsplat: dyno.Gsplat }, ({ gsplat }) => {
            if (!gsplat) {
            throw new Error("No gsplat input");
            }
            let { center, rgb, opacity } = dyno.splitGsplat(gsplat).outputs;
            const projectionAmplitude = dyno.dot(brushDirection, dyno.sub(center, brushOrigin));
            const projectedCenter = dyno.add(brushOrigin, dyno.mul(brushDirection, projectionAmplitude));
            const distance = dyno.length(dyno.sub(projectedCenter, center)); // distance from projected center to actual center
            const isInside = dyno.and(dyno.lessThan(distance, brushRadius), 
                                      dyno.and(dyno.greaterThan(projectionAmplitude, dyno.dynoFloat(0.0)),
                                      dyno.lessThan(projectionAmplitude, brushDepth)));
            const luminanceOld = dyno.div(dyno.dot(rgb, flatColor), dyno.dynoFloat(3.0));
            const luminanceNew = dyno.div(dyno.dot(brushColor, flatColor), dyno.dynoFloat(3.0));
            const weightedRgb = dyno.mul(brushColor, dyno.div(luminanceOld, luminanceNew));
            const isLuminanceAboveThreshold = dyno.greaterThan(luminanceOld, luminanceThreshold);
            const newRgb = dyno.select(dyno.and(dyno.and(brushEnabled, isInside), isLuminanceAboveThreshold), weightedRgb, rgb);
            gsplat = dyno.combineGsplat({ gsplat, rgb: newRgb });
            return { gsplat };
        });
    }

    setupEventListeners() {
        if (!this.viewerCore || !this.viewerCore.renderer) return;

        const canvas = this.viewerCore.renderer.domElement;
        
        canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
        canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', this.onKeyDown.bind(this));
    }

    // Painting mode control
    enableBrushMode(){
        this.parameters.brushEnabled.value = true;
        this.parameters.controlsEnabled = false;
        this.isPaintingActive = true;
        
        if (this.viewerCore && this.viewerCore.controls) {
            this.viewerCore.controls.enabled = false;
        }
        
        console.log('Paint mode enabled');
        this.updateUIState();
    }

    enableViewMode() {
        this.parameters.brushEnabled.value = false;
        this.parameters.controlsEnabled = true;
        this.isPaintingActive = false;
        
        if (this.viewerCore && this.viewerCore.controls) {
            this.viewerCore.controls.enabled = true;
        }
        
        console.log('View mode enabled');
        console.log("ppppp",  this.isPaintingActive)
        this.updateUIState();
    }

    // Brush parameter controls
    setBrushRadius(radius) {
        const clampedRadius = Math.max(this.MIN_BRUSH_RADIUS, Math.min(this.MAX_BRUSH_RADIUS, radius));
        this.parameters.brushRadius.value = clampedRadius;
        console.log('Brush radius set to:', clampedRadius);
    }

    setBrushDepth(depth) {
        const clampedDepth = Math.max(this.MIN_BRUSH_DEPTH, Math.min(this.MAX_BRUSH_DEPTH, depth));
        this.parameters.brushDepth.value = clampedDepth;
        console.log('Brush depth set to:', clampedDepth);
    }

    setBrushColor(colorHex) {
        const color = new THREE.Color(colorHex);
        this.parameters.brushColor.value.set(color.r, color.g, color.b);
        this.parameters.brushColorHex = colorHex;
        console.log('Brush color set to:', colorHex);
    }

    increaseBrushRadius() {
        const currentRadius = this.parameters.brushRadius.value;
        const newRadius = Math.min(currentRadius + 0.01, this.MAX_BRUSH_RADIUS);
        this.setBrushRadius(newRadius);
        return newRadius;
    }

    decreaseBrushRadius() {
        const currentRadius = this.parameters.brushRadius.value;
        const newRadius = Math.max(currentRadius - 0.01, this.MIN_BRUSH_RADIUS);
        this.setBrushRadius(newRadius);
        return newRadius;
    }

    // Pointer event handlers
    onPointerDown(event) {
        if (!this.mesh || !this.isPaintingActive) return;

        this.isDragging = true;
        
        if (this.viewerCore && this.viewerCore.controls) {
            this.viewerCore.controls.enabled = false;
        }

        // Initialize painting if not already done
        if (this.mesh && !this.mesh.splatRgba) {
            this.mesh.splatRgba = this.spark.getRgba({ 
                generator: this.mesh, 
                rgba: this.mesh.splatRgba 
            });
            this.mesh.updateGenerator();
        }

        this.updateBrushPosition(event);
        console.log('Painting started');
    }

    onPointerMove(event) {
        if (!this.isDragging || !this.mesh || !this.isPaintingActive) return;

        this.updateBrushPosition(event);

        // Apply painting effect while dragging
        if (this.parameters.brushEnabled.value) {
            this.mesh.splatRgba = this.spark.getRgba({ 
                generator: this.mesh, 
                rgba: this.mesh.splatRgba 
            });
            this.mesh.updateVersion(); // Fast GPU-only update
        }
    }

    onPointerUp(event) {
        if (!this.isDragging) return;

        this.isDragging = false;
        
        // Keep controls disabled in painting mode
        if (this.parameters.brushEnabled.value) {
            if (this.viewerCore && this.viewerCore.controls) {
                this.viewerCore.controls.enabled = false;
            }
        } else {
            if (this.viewerCore && this.viewerCore.controls) {
                this.viewerCore.controls.enabled = true;
            }
        }

        console.log('Painting ended');
    }

    updateBrushPosition(event) {
        if (!this.viewerCore || !this.viewerCore.renderer || !this.viewerCore.camera) return;

        const canvas = this.viewerCore.renderer.domElement;
        
        // Calculate mouse coordinates in normalized device coordinates
        const clickCoords = new THREE.Vector2(
            (event.clientX / canvas.width) * 2 - 1,
            -(event.clientY / canvas.height) * 2 + 1,
        );
        
        // Update raycaster
        this.raycaster.setFromCamera(clickCoords, this.viewerCore.camera);
        const direction = this.raycaster.ray.direction.normalize();
        
        // Update brush parameters
        this.parameters.brushDirection.value.copy(direction);
        this.parameters.brushOrigin.value.copy(this.raycaster.ray.origin);
    }

    // Keyboard event handler
    onKeyDown(event) {

        switch (event.key) {
            case '1':
                this.enableBrushMode();
                break;
            case 'Escape':
                this.enableViewMode();
                break;
            case '+':
                this.increaseBrushRadius();
                this.updateUIBrushRadius();
                break;
            case '-':
                this.decreaseBrushRadius();
                this.updateUIBrushRadius();
                break;
        }
    }

    // UI integration methods
    updateUIState() {
        // Update UI elements to reflect current state
        const paintingStatus = document.getElementById('paintingStatus');
        const brushModeBtn = document.getElementById('brushModeBtn');
        
        if (paintingStatus) {
            if (this.isPaintingActive) {
                paintingStatus.textContent = 'Paint Mode - Click and drag to paint';
            } else {
                paintingStatus.textContent = 'View Mode - Use 1 for Paint';
            }
        }
        
        if (brushModeBtn) {
            if (this.isPaintingActive) {
                brushModeBtn.style.background = '#44ff44';
            } else {
                brushModeBtn.style.background = '#4CAF50';
            }
        }
    }

    updateUIBrushRadius() {
        const brushRadiusValue = document.getElementById('brushRadiusValue');
        const brushRadiusSlider = document.getElementById('brushRadiusSlider');
        
        if (brushRadiusValue) {
            brushRadiusValue.textContent = this.parameters.brushRadius.value.toFixed(2);
        }
        
        if (brushRadiusSlider) {
            brushRadiusSlider.value = this.parameters.brushRadius.value;
        }
    }

    updateUIBrushDepth() {
        const brushDepthValue = document.getElementById('brushDepthValue');
        const brushDepthSlider = document.getElementById('brushDepthSlider');
        
        if (brushDepthValue) {
            brushDepthValue.textContent = this.parameters.brushDepth.value.toFixed(1);
        }
        
        if (brushDepthSlider) {
            brushDepthSlider.value = this.parameters.brushDepth.value;
        }
    }

    updateUIBrushColor() {
        const brushColorPicker = document.getElementById('brushColorPicker');
        
        if (brushColorPicker) {
            brushColorPicker.value = this.parameters.brushColorHex;
        }
    }

    // Reset function
    reset() {
        this.enableViewMode();
        this.setBrushRadius(0.02);
        this.setBrushDepth(10.0);
        this.setBrushColor("#87CEEB");
        this.isDragging = false;
        
        console.log('Painting system reset');
    }

   
    getState() {
        return {
            isPaintingActive: this.isPaintingActive,
            brushRadius: this.parameters.brushRadius.value,
            brushDepth: this.parameters.brushDepth.value,
            brushColor: this.parameters.brushColorHex,
            isDragging: this.isDragging
        };
    }

    // Cleanup
    dispose() {
        this.isDragging = false;
        this.isPaintingActive = false;
        
        // Remove event listeners
        if (this.viewerCore && this.viewerCore.renderer) {
            const canvas = this.viewerCore.renderer.domElement;
            canvas.removeEventListener('pointerdown', this.onPointerDown);
            canvas.removeEventListener('pointermove', this.onPointerMove);
            canvas.removeEventListener('pointerup', this.onPointerUp);
        }
        
        document.removeEventListener('keydown', this.onKeyDown);
        
        console.log('Painting system disposed');
    }
}

export default PaintingSystem;