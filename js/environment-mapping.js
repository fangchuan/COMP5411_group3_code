import * as THREE from "three";

export class EnvironmentSystem {
    constructor() {
        this.viewerCore = null;
        this.spark = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Environment mapping state
        this.environmentMap = null;
        this.envMapRendered = false;
        this.envMapObjects = [];
        this.reflectiveObjects = [];
        
        // Environment ball for dragging
        this.isDraggingEnvBall = false;
        this.dragStartEnvBall = null;
        this.dragStartMouse = null;
        
        // Performance optimization
        this.envMapGenerationInProgress = false;
        this.envMapUpdateRequested = false;
        this.envMapUpdateTimeout = null;
        this.lastEnvMapUpdate = 0;
        this.ENV_MAP_UPDATE_INTERVAL = 100; // ms
        
        // Parameters
        this.parameters = {
            enabled: false,
            metalness: 1.0,
            roughness: 0.02,
            reflectivity: 1.0,
            envMapIntensity: 1.0
        };
    }

    setViewerCore(viewerCore) {
        this.viewerCore = viewerCore;
        this.spark = viewerCore.spark;
        this.scene = viewerCore.scene;
        this.camera = viewerCore.camera;
        this.renderer = viewerCore.renderer;
    }

    init() {
        console.log('Initializing Environment Mapping System...');
        
        this.createReflectiveObjects();
        this.setupEventListeners();
        
        console.log('Environment Mapping System initialized');
    }

    // Create reflective objects in the scene
    createReflectiveObjects() {
        if (!this.scene || !this.viewerCore || !this.viewerCore.mesh) return;

        const mesh = this.viewerCore.mesh;
        const boundingBox = mesh.getBoundingBox();
        const meshCenter = new THREE.Vector3();
        boundingBox.getCenter(meshCenter);

        const geometry = new THREE.SphereGeometry(0.08, 32, 32);
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 1.0,
            roughness: 0.,
            envMapIntensity: 1.0 // Start with 0 until env map is generated
        });

        const reflectiveSphere = new THREE.Mesh(geometry, material);
        reflectiveSphere.position.set(
            meshCenter.x , 
            meshCenter.y , 
            meshCenter.z 
        );
        reflectiveSphere.visible = false;
        

        this.scene.add(reflectiveSphere);
        this.reflectiveObjects.push(reflectiveSphere);
        this.envMapObjects.push(reflectiveSphere);

    }

    // Setup event listeners for environment ball dragging
    setupEventListeners() {
        if (!this.renderer) return;

        const canvas = this.renderer.domElement;
        
        canvas.addEventListener('mousedown', this.onEnvBallMouseDown.bind(this));
        canvas.addEventListener('mousemove', this.onEnvBallMouseMove.bind(this));
        canvas.addEventListener('mouseup', this.onEnvBallMouseUp.bind(this));
        canvas.addEventListener('mouseleave', this.onEnvBallMouseUp.bind(this));

    }

    // Mouse event handlers
    onEnvBallMouseDown(event) {
        if (!this.reflectiveObjects.length || !this.reflectiveObjects[0].visible) return;

        const reflectiveSphere = this.reflectiveObjects[0];
        const mouse = this.getMousePosition(event);
        const intersects = this.raycastObject(mouse, reflectiveSphere);

        if (intersects.length > 0) {
            this.isDraggingEnvBall = true;
            this.dragStartEnvBall = reflectiveSphere.position.clone();
            this.dragStartMouse = mouse.clone();
            
            // Disable orbit controls while dragging
            if (this.viewerCore && this.viewerCore.controls) {
                this.viewerCore.controls.enabled = false;
            }
            
            event.preventDefault();
            event.stopPropagation();
        }
    }

    onEnvBallMouseMove(event) {
        if (!this.isDraggingEnvBall || !this.reflectiveObjects.length) return;

        const reflectiveSphere = this.reflectiveObjects[0];
        const mouse = this.getMousePosition(event);
        const mouseDelta = this.calculateMouseDelta(mouse);
        const worldMovement = this.calculateWorldMovement(mouseDelta, reflectiveSphere);

        // Update sphere position
        reflectiveSphere.position.copy(this.dragStartEnvBall).add(worldMovement);

        // Schedule environment map update (low quality during drag)
        if (this.envMapRendered) {
            this.scheduleEnvironmentMapUpdate(false); // Use low quality during drag
        }

        event.preventDefault();
        event.stopPropagation();
    }

    onEnvBallMouseUp(event) {
        if (this.isDraggingEnvBall) {
            this.finishDragging();
            event.preventDefault();
            event.stopPropagation();
        }
    }

  
    getMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        return new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
    }

    raycastObject(mouse, object) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        return raycaster.intersectObject(object);
    }

    calculateMouseDelta(mouse) {
        return new THREE.Vector2(
            mouse.x - this.dragStartMouse.x,
            mouse.y - this.dragStartMouse.y
        );
    }

    calculateWorldMovement(mouseDelta, object) {
        const cameraRight = new THREE.Vector3();
        const cameraUp = new THREE.Vector3();
        
        this.camera.getWorldDirection(new THREE.Vector3());
        cameraRight.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
        cameraUp.setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();

        // Scale the movement based on distance from camera
        const distanceToCamera = this.camera.position.distanceTo(object.position);
        const movementScale = distanceToCamera * 0.5;

        return new THREE.Vector3()
            .addScaledVector(cameraRight, mouseDelta.x * movementScale)
            .addScaledVector(cameraUp, mouseDelta.y * movementScale);
    }

    finishDragging() {
        this.isDraggingEnvBall = false;
        
        // Clear any pending low-quality updates
        if (this.envMapUpdateTimeout) {
            clearTimeout(this.envMapUpdateTimeout);
        }
        
        // Cancel any in-progress generation
        this.envMapUpdateRequested = false;
        
        // Final high-quality environment map update
        if (this.envMapRendered) {
            setTimeout(() => {
                this.generateEnvironmentMap(true); // High quality final update
            }, 150);
        }
        
        this.dragStartEnvBall = null;
        this.dragStartMouse = null;
        
        // Re-enable orbit controls
        if (this.viewerCore && this.viewerCore.controls) {
            this.viewerCore.controls.enabled = true;
        }
    }

    // Environment Map Generation
    async generateEnvironmentMap(highQuality = false) {
        // If already generating, mark that an update is needed and return
        if (this.envMapGenerationInProgress) {
            this.envMapUpdateRequested = true;
            return;
        }
        
        if (!this.spark || !this.scene) return;
        
        try {
            this.envMapGenerationInProgress = true;
            
            const resolution = highQuality ? 256 : 128; // Lower resolution for real-time
            
            
            const worldCenter = this.reflectiveObjects && this.reflectiveObjects[0] 
                ? this.reflectiveObjects[0].position.clone() 
                : this.getMeshCenter();
            
            const tempEnvMap = await this.spark.renderEnvMap({
                scene: this.scene,
                worldCenter: worldCenter,
                hideObjects: this.envMapObjects,
                update: true,
                resolution: resolution
            });
            
            if (tempEnvMap) {
                this.environmentMap = tempEnvMap;
                this.updateReflectiveMaterials();
                this.envMapRendered = true;
                console.log('Environment map updated successfully');
            }
            
        } catch (error) {
            console.error('Error generating environment map:', error);
        } finally {
            this.envMapGenerationInProgress = false;
            
            // If another update was requested while we were generating, process it
            if (this.envMapUpdateRequested) {
                this.envMapUpdateRequested = false;
                setTimeout(() => this.generateEnvironmentMap(highQuality), 16); // Wait one frame
            }
        }
    }

    // Debounced environment map update
    scheduleEnvironmentMapUpdate(highQuality = false) {
        if (this.envMapUpdateTimeout) {
            clearTimeout(this.envMapUpdateTimeout);
        }
        
        this.envMapUpdateTimeout = setTimeout(() => {
            this.generateEnvironmentMap(highQuality);
        }, highQuality ? 50 : 16); // Longer delay for high quality
    }

    getMeshCenter() {
        if (this.viewerCore && this.viewerCore.mesh) {
            const boundingBox = this.viewerCore.mesh.getBoundingBox();
            const meshCenter = new THREE.Vector3();
            boundingBox.getCenter(meshCenter);
            return meshCenter;
        }
    }

    // Material Management
    updateReflectiveMaterials() {
        if (!this.environmentMap) return;
        
        this.reflectiveObjects.forEach(obj => {
            if (obj.material) {
                obj.material.envMap = this.environmentMap;
                obj.material.metalness = this.parameters.metalness;
                obj.material.roughness = this.parameters.roughness;
                obj.material.envMapIntensity = this.parameters.reflectivity;
                obj.material.needsUpdate = true;
            }
        });

        console.log('Reflective materials updated');
    }

    toggleEnvironmentMapping(enable) {
        this.parameters.enabled = enable;
        
        this.reflectiveObjects.forEach(obj => {
            obj.visible = enable;
        });

        if (enable && !this.envMapRendered) {
            // Cancel any pending requests
            if (this.envMapUpdateTimeout) {
                clearTimeout(this.envMapUpdateTimeout);
            }
            this.envMapUpdateRequested = false;
            this.generateEnvironmentMap(true); // High quality for initial generation
        } else if (!enable) {
            // Cancel any pending generation
            if (this.envMapUpdateTimeout) {
                clearTimeout(this.envMapUpdateTimeout);
            }
            this.envMapUpdateRequested = false;
            this.envMapGenerationInProgress = false;
            
            this.resetEnvironmentMap();
        }

        console.log('Environment mapping:', enable ? 'ENABLED' : 'DISABLED');
    }

    setMetalness(value) {
        this.parameters.metalness = value;
        this.updateReflectiveMaterials();
        console.log('Metalness set to:', value);
    }

    setRoughness(value) {
        this.parameters.roughness = value;
        this.updateReflectiveMaterials();
        console.log('Roughness set to:', value);
    }

    setReflectivity(value) {
        this.parameters.reflectivity = value;
        this.updateReflectiveMaterials();
        console.log('Reflectivity set to:', value);
    }

    resetEnvironmentMap() {
        this.reflectiveObjects.forEach(obj => {
            if (obj.material) {
                obj.material.envMap = null;
                obj.material.metalness = 0.0;
                obj.material.roughness = 1.0;
                obj.material.envMapIntensity = 0.0;
                obj.material.needsUpdate = true;
            }
            obj.visible = false;
        });

        this.environmentMap = null;
        this.envMapRendered = false;
        
        console.log('Environment mapping reset');
    }

    update() {
        // Update environment map if effects are active and enough time has passed
        if (this.envMapRendered && this.parameters.enabled) {
            const currentTime = Date.now();
            if (currentTime - this.lastEnvMapUpdate > this.ENV_MAP_UPDATE_INTERVAL) {
                this.scheduleEnvironmentMapUpdate(false); // Low quality for real-time updates
                this.lastEnvMapUpdate = currentTime;
            }
        }
    }

    getState() {
        return {
            ...this.parameters,
            envMapRendered: this.envMapRendered,
            isDraggingEnvBall: this.isDraggingEnvBall
        };
    }

    dispose() {
        // Remove event listeners
        if (this.renderer) {
            const canvas = this.renderer.domElement;
            canvas.removeEventListener('mousedown', this.onEnvBallMouseDown);
            canvas.removeEventListener('mousemove', this.onEnvBallMouseMove);
            canvas.removeEventListener('mouseup', this.onEnvBallMouseUp);
            canvas.removeEventListener('mouseleave', this.onEnvBallMouseUp);
            canvas.removeEventListener('touchstart', this.onEnvBallTouchStart);
            canvas.removeEventListener('touchmove', this.onEnvBallTouchMove);
            canvas.removeEventListener('touchend', this.onEnvBallTouchEnd);
        }
        
        // Clear timeouts
        if (this.envMapUpdateTimeout) {
            clearTimeout(this.envMapUpdateTimeout);
        }
        
        // Clean up environment map
        if (this.environmentMap) {
            this.environmentMap.dispose();
        }
        
    }
}

export default EnvironmentSystem;