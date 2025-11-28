import { ViewerCore } from '/js/viewer-core.js';
import { UIManager } from '/js/ui-manager.js';
import { LightingSystem } from '/js/lighting-system.js';
import { EffectsSystem } from '/js/effects-system.js';
import { EnvironmentSystem } from '/js/environment-mapping.js';
import { PaintingSystem } from '/js/painting-system.js';
import { BoundarySharpeningSystem } from '/js/boundary-sharpening.js';

class GaussianSplattingViewer {
    constructor() {
        this.systems = {
            viewer: null,
            ui: null,
            lighting: null,
            effects: null,
            environment: null,
            painting: null,
            deformation: null,
            postProcessing: null
        };
    }

    async init() {
        try {
            console.log("Initializing Gaussian Splatting Viewer...");
            
            this.systems.viewer = new ViewerCore();
            this.systems.ui = new UIManager();
            this.systems.lighting = new LightingSystem();
            this.systems.effects = new EffectsSystem();
            this.systems.environment = new EnvironmentSystem();
            this.systems.painting = new PaintingSystem();
            this.systems.boundarySharpening = new BoundarySharpeningSystem();


            await this.systems.viewer.init();
            await this.setupDependencies();

            this.systems.ui.init();
            this.systems.lighting.init();
            this.systems.effects.init();
            this.systems.environment.init();
            this.systems.painting.init();
            this.systems.boundarySharpening.init();

            this.systems.viewer.animate();

            console.log("Viewer initialized successfully!");

        } catch (error) {
            console.error('Failed to initialize viewer:', error);
            // this.showError(error.message);
        }
    }

    async setupDependencies() {
        this.systems.viewer.setSystems({
            lighting: this.systems.lighting,
            effects: this.systems.effects,
            environment: this.systems.environment,
            painting: this.systems.painting,
            boundarySharpening: this.systems.boundarySharpening
        });

        this.systems.ui.setSystems(this.systems);

        this.systems.lighting.setViewerCore(this.systems.viewer);
        this.systems.effects.setViewerCore(this.systems.viewer);
        this.systems.environment.setViewerCore(this.systems.viewer);
        this.systems.painting.setViewerCore(this.systems.viewer);
        this.systems.boundarySharpening.setViewerCore(this.systems.viewer);
    }

}


// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new GaussianSplattingViewer();
    window.viewerApp = app; 
    app.init();
});

// Export for potential module usage
export { GaussianSplattingViewer };