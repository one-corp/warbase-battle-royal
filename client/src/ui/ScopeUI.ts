/**
 * ScopeUI.ts - Decoupled FPS Scope Overlay Component
 * Manages 2D scope overlay HUD, reticles, and ADS zoom UI.
 */

export class ScopeUI {
    private static container: HTMLElement | null = null;
    private static isInitialized = false;

    /**
     * Initializes and injects the Scope Overlay DOM structure into the document.
     */
    public static init(): void {
        if (this.isInitialized) return;

        // Check if container already exists in DOM
        let overlay = document.getElementById("scopeOverlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "scopeOverlay";
            document.body.appendChild(overlay);
        }

        // Apply Scope CSS Styles & Reticle HTML
        overlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            pointer-events: none;
            z-index: 500;
            justify-content: center; align-items: center;
            overflow: hidden;
        `;

        overlay.innerHTML = `
            <!-- Lens Container with solid black exterior -->
            <div id="scopeLens" style="
                width: 70vh; height: 70vh; border-radius: 50%;
                border: 4px solid #111;
                box-shadow: 0 0 0 100vmax rgba(0,0,0,1), inset 0 0 40px rgba(0,0,0,0.8);
                position: relative;
                display: flex; justify-content: center; align-items: center;
            ">
                <!-- Tactical Crosshairs -->
                <div style="width: 2px; height: 100%; background: rgba(0, 0, 0, 0.9); position: absolute;"></div>
                <div style="width: 100%; height: 2px; background: rgba(0, 0, 0, 0.9); position: absolute;"></div>
                
                <!-- Distance Markings -->
                <div style="width: 15px; height: 1px; background: #ff2a4b; position: absolute; transform: translateY(50px);"></div>
                <div style="width: 15px; height: 1px; background: #ff2a4b; position: absolute; transform: translateY(100px);"></div>
                <div style="width: 15px; height: 1px; background: #ff2a4b; position: absolute; transform: translateY(150px);"></div>
                
                <!-- Center Red Dot Reticle -->
                <div style="width: 6px; height: 6px; background: #ff2a4b; border-radius: 50%; position: absolute; box-shadow: 0 0 10px #ff2a4b;"></div>
            </div>
        `;

        this.container = overlay;
        this.isInitialized = true;

        // Register event listener for decoupling
        window.addEventListener('scope-toggle', (e: Event) => {
            const customEv = e as CustomEvent<{ active: boolean }>;
            if (customEv.detail) {
                ScopeUI.setVisible(customEv.detail.active);
            }
        });
    }

    /**
     * Show or hide the scope overlay.
     */
    public static setVisible(active: boolean): void {
        if (!this.container) {
            this.init();
        }
        if (this.container) {
            this.container.style.display = active ? 'flex' : 'none';
        }
    }

    /**
     * Customizer method to adjust scope reticle size or lens diameter.
     */
    public static setLensSize(vhSize: number): void {
        const lens = document.getElementById("scopeLens");
        if (lens) {
            lens.style.width = `${vhSize}vh`;
            lens.style.height = `${vhSize}vh`;
        }
    }
}
