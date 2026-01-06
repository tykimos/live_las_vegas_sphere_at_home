import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export class FaceTracker {
    constructor() {
        this.videoElement = null;
        this.faceMesh = null;
        this.camera = null;
        this.onEyePositionChange = null;
    }

    async init(onEyePositionChange) {
        this.onEyePositionChange = onEyePositionChange;

        // Create a hidden video element
        this.videoElement = document.createElement('video');
        this.videoElement.style.display = 'none'; // Hide it, or show for debug
        document.body.appendChild(this.videoElement);

        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true, // For iris tracking
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults(this.onResults.bind(this));

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.faceMesh.send({ image: this.videoElement });
            },
            width: 1280,
            height: 720
        });

        await this.camera.start();
    }

    onResults(results) {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // Iris indices: Left: 468, Right: 473 (Center of iris)
            const leftIris = landmarks[468];
            const rightIris = landmarks[473];

            if (leftIris && rightIris) {
                // Average the two eyes for a central view point
                const x = (leftIris.x + rightIris.x) / 2;
                const y = (leftIris.y + rightIris.y) / 2;
                const z = (leftIris.z + rightIris.z) / 2; // Relative depth

                if (this.onEyePositionChange) {
                    // Mediapipe coordinates are normalized [0, 1]
                    // x: 0 (left) -> 1 (right)
                    // y: 0 (top) -> 1 (bottom)
                    this.onEyePositionChange({ x, y, z });
                }
            }
        }
    }
}
