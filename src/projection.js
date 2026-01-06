import * as THREE from 'three';

export class OffAxisProjection {
    constructor(camera) {
        this.camera = camera;
        this.screenConfig = {
            width: 10,
            height: 10,
        };
        this.currentEyePos = new THREE.Vector3(0, 0, 10);
        this.targetEyePos = new THREE.Vector3(0, 0, 10);

        // Zoom state
        this.baseZ = 10;     // Default distance
        this.zoomOffset = 0; // Controlled by wheel
    }

    updateAspect(aspect) {
        this.screenConfig.height = this.screenConfig.width / aspect;
    }

    updateEyePosition(rawX, rawY, rawZ) {
        const rangeX = 20;
        const rangeY = 20;

        const x = (rawX - 0.5) * rangeX;
        const y = -(rawY - 0.5) * rangeY;
        const z = this.baseZ + rawZ * 10;

        this.targetEyePos.set(x, y, Math.max(z, 2));
    }

    setZoom(delta) {
        // Delta > 0 (scroll down) -> Zoom Out (Move Camera Back)
        // Delta < 0 (scroll up)   -> Zoom In (Move Camera Forward)

        this.zoomOffset += delta * 0.05;
        // Clamp zoom
        this.zoomOffset = Math.max(-8, Math.min(this.zoomOffset, 20));
    }

    update() {
        this.currentEyePos.lerp(this.targetEyePos, 0.1);

        const cx = this.currentEyePos.x;
        const cy = this.currentEyePos.y;

        // Apply zoom to Z
        // If we move closer (smaller Z), the FOV widens effectively (window logic)
        // Wait, for a window:
        // Eye closer to window = Wider Field of View seen THROUGH window (Frustum Top/Bottom increases for same near plane?)
        // Let's stick to Physical Camera Movement.
        // User moves eye Z.
        // Zoom In = Move Camera Forward (Reduce Z).
        // Zoom Out = Move Camera backward (Increase Z).

        let cz = this.currentEyePos.z + this.zoomOffset;
        cz = Math.max(0.5, cz); // Prevent clipping through screen

        this.camera.position.set(cx, cy, cz);
        this.camera.rotation.set(0, 0, 0);
        this.camera.updateMatrixWorld();

        // Off-axis projection
        const hw = this.screenConfig.width / 2;
        const hh = this.screenConfig.height / 2;

        const near = 0.1;
        const far = 30000;
        const dist = cz;

        const left = (-hw - cx) * (near / dist);
        const right = (hw - cx) * (near / dist);
        const top = (hh - cy) * (near / dist);
        const bottom = (-hh - cy) * (near / dist);

        this.camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
    }
}
