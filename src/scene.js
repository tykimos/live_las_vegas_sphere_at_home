import * as THREE from 'three';

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.0001);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Set higher pixel ratio for extra sharpness
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
    camera.position.set(0, 0, 0);

    const groundY = -40;
    const sphereRadius = 65;
    const sphereZ = -350;
    const sphereCenterY = -25.7;

    // --- Sphere Shader ---
    const sphereMat = new THREE.ShaderMaterial({
        uniforms: {
            tVideo: { value: null },
            useVideo: { value: 0.0 },
            cx: { value: 0.354995 },
            cy: { value: 0.880417 },
            rx: { value: 0.300645 },
            ry: { value: 0.534479 }
        },
        vertexShader: `
            varying vec3 vLocalPos;
            void main() {
                vLocalPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tVideo;
            uniform float useVideo;
            uniform float cx;
            uniform float cy;
            uniform float rx;
            uniform float ry;
            varying vec3 vLocalPos;

            void main() {
                if (useVideo > 0.5) {
                    vec3 n = normalize(vLocalPos);
                    vec2 videoCoord;
                    videoCoord.x = cx + (n.x * rx);
                    videoCoord.y = (1.0 - cy) + (n.y * ry); 
                    
                    if (videoCoord.x < 0.0 || videoCoord.x > 1.0 || videoCoord.y < 0.0 || videoCoord.y > 1.0) {
                        discard;
                    }
                    gl_FragColor = texture2D(tVideo, videoCoord);
                } else {
                    // Fallback: Semi-transparent target for calibration
                    gl_FragColor = vec4(0.2, 0.2, 0.2, 0.5);
                }
            }
        `,
        side: THREE.FrontSide,
        transparent: true
    });

    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 64, 64);
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.set(0, sphereCenterY, sphereZ);
    scene.add(sphereMesh);

    // --- Super-Stable Texture-based Grid Floor ---
    const generateGridTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 512, 512);

        // Draw grid lines with anti-aliasing
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 4;

        // Border lines
        ctx.strokeRect(0, 0, 512, 512);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(150, 150); // Control grid density

        // Anti-flicker settings
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;

        return texture;
    };

    const groundSize = 30000;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshBasicMaterial({
        map: generateGridTexture(),
        transparent: true,
        opacity: 0.9
    });

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = groundY;
    scene.add(groundMesh);

    // Solid base underneath
    const floorBase = new THREE.Mesh(
        groundGeo,
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    floorBase.rotation.x = -Math.PI / 2;
    floorBase.position.y = groundY - 0.5;
    scene.add(floorBase);

    return { scene, camera, renderer, sphereMesh };
}
