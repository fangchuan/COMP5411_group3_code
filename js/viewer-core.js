import * as THREE from "three";
import { SplatMesh, setWorldNormalColor, setWorldPLYNormalColor, setRoughnessColor, setSpecularColor, makeSplatColorModifier,dyno, SparkRenderer } from "@sparkjsdev/spark";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class ViewerCore {
    constructor() {
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.mesh = null;
        this.spark = null;
        
        this.isMoveMode = false;
        this.moveSpeed = 0.01;
        this.keys = {};

        this.systems = {};
        this.isInitialized = false;
        this.animationId = null;

        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        this.fpsDisplay = null;
    }

    // Accept dependencies as parameters
    async init() {
        this.showLoadingScreen();


        await this.initThreeJS();
        await this.loadSplatMesh();
        this.setupControls();
        this.setupEventListeners();
        this.hideLoadingScreen(); 
        this.isInitialized = true;
    }

    setSystems(systems) {
        this.systems = systems;
    }

    async initThreeJS() {
        console.log("Initializing Three.js...");
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
        
        const canvas = document.getElementById('threeCanvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: false 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        this.spark = new SparkRenderer({ renderer: this.renderer });
        this.scene.add(this.spark);

        console.log("Three.js initialized successfully");
    }
    async loadSplatMesh() {
        console.log("Loading splat mesh...");
        
        if (!plyBase64 || plyBase64 === "{{PLY_DATA}}") {
            throw new Error("No PLY data provided. Please generate a 3D model first.");
        }

        this.mesh = new SplatMesh({ url: plyBase64 });
        await this.mesh.initialized;
        
        this.mesh.quaternion.set(1, 0, 0, 0);
        this.mesh.position.set(0, 0, 0);
        this.scene.add(this.mesh);

        console.log("Splat mesh loaded successfully");
    }
    setupControls() {
        console.log("Setting up controls...");
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Set initial camera position based on mesh bounds
        if (this.mesh) {
            const boundingBox = this.mesh.getBoundingBox();
            const meshCenter = new THREE.Vector3();
            boundingBox.getCenter(meshCenter);
            
            this.camera.position.set(
                meshCenter.x + 0.2,
                meshCenter.y,
                meshCenter.z + 0.2
            );
            
            this.controls.target.copy(meshCenter);
            this.controls.update();
        }

        console.log("Controls setup completed");
    }

    setupEventListeners() {
        // Window resize handler
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Global keyboard handlers
        window.addEventListener('keydown', (event) => this.onKeyDown(event));
        window.addEventListener('keyup', (event) => this.onKeyUp(event));
    }

    onKeyDown(event) {
        this.systems.painting.onKeyDown(event);
        
        if (this.systems.ui) {
            this.systems.ui.onKeyDown(event);
        }
    }

    onKeyUp(event) {
        if (this.systems.ui) {
            this.systems.ui.onKeyUp(event);
        }
    }

    animate() {
        this.updateFPS(); 
        this.hideLoadingScreen();
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Update controls
        if (this.controls) {
            this.controls.update();
        }
        
        if (this.isMoveMode) {
            this.updateMovement();
        }

        if (this.systems.effects && this.systems.effects.isActive) {
            this.systems.effects.update();
        }
        
        if (this.systems.environment && this.systems.environment.parameters.enabled) {
            this.systems.environment.update();
        }
        
        if (this.systems.boundarySharpening && 
            (this.systems.boundarySharpening.laplacianSystemActive || 
            this.systems.boundarySharpening.bilateralSystemActive)) {            this.systems.boundarySharpening.render();
        } else {
            this.renderer.setRenderTarget(null);
            this.renderer.render(this.scene, this.camera);
        }
    
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }


    updateMovement() {
        if (!this.isMoveMode || !this.camera || !this.controls) return;
        
        const direction = new THREE.Vector3();
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
    
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
    
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    
        if (this.keys['w'] || this.keys['arrowup']) {
            direction.add(forward);
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            direction.sub(forward);
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            direction.sub(right);
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            direction.add(right);
        }
    
        if (direction.length() > 0) {
            direction.normalize().multiplyScalar(this.moveSpeed);
            this.camera.position.add(direction);
            this.controls.target.add(direction);
            this.controls.update();
        }
    }
    updateMoveMode(enabled) {
        this.isMoveMode = enabled;
        
        if (this.controls) {
            this.controls.enabled = !enabled;
        }
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Clean up all systems
        Object.values(this.systems).forEach(system => {
            if (system && typeof system.dispose === 'function') {
                system.dispose();
            }
        });
        
        // Clean up Three.js resources
        if (this.renderer) {
            this.renderer.dispose();
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        const renderScreen = document.getElementById('renderPage');
        if (renderScreen) {
            renderScreen.style.display = 'block';
        }
    }
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }



    // Create FPS display element
    createFPSDisplay() {
        this.fpsDisplay = document.createElement('div');
        this.fpsDisplay.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #00ff00;
            padding: 8px 12px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 14px;
            z-index: 1000;
            pointer-events: none;
        `;
        this.fpsDisplay.textContent = 'FPS: --';
        document.body.appendChild(this.fpsDisplay);
    }
    updateFPS() {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime >= this.lastTime + 1000) { // Update every second
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            this.frameCount = 0;
            this.lastTime = currentTime;
            
            if (this.fpsDisplay) {
                this.fpsDisplay.textContent = `FPS: ${this.fps}`;
                // Color coding based on FPS
                if (this.fps >= 50) this.fpsDisplay.style.color = '#00ff00';
                else if (this.fps >= 30) this.fpsDisplay.style.color = '#ffff00';
                else this.fpsDisplay.style.color = '#ff0000';
            }
            
            // Optional: Log to console
            console.log(`FPS: ${this.fps}`);
        }
    }

}

window.ViewerCore = ViewerCore;