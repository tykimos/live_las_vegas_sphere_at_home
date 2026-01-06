import './style.css';
import * as THREE from 'three';
import { createScene } from './scene.js';
import { FaceTracker } from './tracker.js';
import { OffAxisProjection } from './projection.js';

async function init() {
  const { scene, camera, renderer, sphereMesh } = createScene();

  // Default Parameters (User updated)
  const params = {
    cx: 0.3567,
    cy: 0.7932,
    rx: 0.2942,
    ry: 0.4236,
    sphereY: -25.7,
    sphereScale: 1.0,
    sphereSizeX: 1.04, // Width Scale (Initial value set to 1.04)
    sphereSizeY: 1.0,  // Height Scale (Initial value set to 1.0)
    sphereSizeZ: 1.0,   // Depth Scale
    useVideo: 0.0      // Current video state
  };

  // --- REUSABLE APPLY FUNCTION ---
  const applyAllParams = () => {
    // Apply position
    sphereMesh.position.y = params.sphereY;

    // Apply scale
    sphereMesh.scale.set(
      params.sphereScale * params.sphereSizeX,
      params.sphereScale * params.sphereSizeY,
      params.sphereScale * params.sphereSizeZ
    );

    // Apply shader uniforms
    sphereMesh.material.uniforms.cx.value = params.cx;
    sphereMesh.material.uniforms.cy.value = params.cy;
    sphereMesh.material.uniforms.rx.value = params.rx;
    sphereMesh.material.uniforms.ry.value = params.ry;
    sphereMesh.material.uniforms.useVideo.value = params.useVideo;
  };

  // --- APPLY INITIAL PARAMS IMMEDIATELY ---
  applyAllParams();

  const projection = new OffAxisProjection(camera);
  projection.updateAspect(window.innerWidth / window.innerHeight);

  window.addEventListener('resize', () => {
    projection.updateAspect(window.innerWidth / window.innerHeight);
  });

  const tracker = new FaceTracker();
  const onEyePos = (pos) => {
    projection.updateEyePosition(pos.x, pos.y, pos.z);
  };

  window.addEventListener('wheel', (e) => {
    projection.setZoom(e.deltaY * 0.1);
  }, { passive: true });

  // --- Calibration UI Creation ---
  const createCalibrationUI = () => {
    const panel = document.createElement('div');
    panel.className = 'caliber-panel';
    panel.innerHTML = `
            <div class="caliber-section">
                <h3>3D Sphere Settings</h3>
                <div class="caliber-row">
                    <div class="caliber-label">Y Position <span id="val-sphereY" class="caliber-value">${params.sphereY}</span></div>
                    <input type="range" id="input-sphereY" class="caliber-input" min="-100" max="50" step="0.1" value="${params.sphereY}">
                </div>
                <div class="caliber-row">
                    <div class="caliber-label">Total Scale <span id="val-sphereScale" class="caliber-value">${params.sphereScale}</span></div>
                    <input type="range" id="input-sphereScale" class="caliber-input" min="0.1" max="5.0" step="0.01" value="${params.sphereScale}">
                </div>
                <div class="caliber-row">
                    <div class="caliber-label">Width (X) <span id="val-sphereSizeX" class="caliber-value">${params.sphereSizeX}</span></div>
                    <input type="range" id="input-sphereSizeX" class="caliber-input" min="0.5" max="3.0" step="0.01" value="${params.sphereSizeX}">
                </div>
                <div class="caliber-row">
                    <div class="caliber-label">Height (Y) <span id="val-sphereSizeY" class="caliber-value">${params.sphereSizeY}</span></div>
                    <input type="range" id="input-sphereSizeY" class="caliber-input" min="0.5" max="3.0" step="0.01" value="${params.sphereSizeY}">
                </div>
                 <div class="caliber-row">
                    <div class="caliber-label">Depth (Z) <span id="val-sphereSizeZ" class="caliber-value">${params.sphereSizeZ}</span></div>
                    <input type="range" id="input-sphereSizeZ" class="caliber-input" min="0.5" max="3.0" step="0.01" value="${params.sphereSizeZ}">
                </div>
            </div>
            <div class="caliber-section">
                <h3>Source Mapping</h3>
                <div class="caliber-row">
                    <div class="caliber-label">Center X <span id="val-cx" class="caliber-value">${params.cx}</span></div>
                    <input type="range" id="input-cx" class="caliber-input" min="0" max="1" step="0.0001" value="${params.cx}">
                </div>
                <div class="caliber-row">
                    <div class="caliber-label">Center Y <span id="val-cy" class="caliber-value">${params.cy}</span></div>
                    <input type="range" id="input-cy" class="caliber-input" min="0" max="1" step="0.0001" value="${params.cy}">
                </div>
                <div class="caliber-row">
                    <div class="caliber-label">Radius X <span id="val-rx" class="caliber-value">${params.rx}</span></div>
                    <input type="range" id="input-rx" class="caliber-input" min="0" max="1" step="0.0001" value="${params.rx}">
                </div>
                <div class="caliber-row">
                    <div class="caliber-label">Radius Y <span id="val-ry" class="caliber-value">${params.ry}</span></div>
                    <input type="range" id="input-ry" class="caliber-input" min="0" max="1" step="0.0001" value="${params.ry}">
                </div>
            </div>
            <div style="font-size:9px; color:rgba(255,255,255,0.4); text-align:center;">MANUAL OVERRIDE ACTIVE</div>
        `;
    document.body.appendChild(panel);

    const updateParam = (id, val) => {
      params[id] = parseFloat(val);
      const valDisplay = document.getElementById(`val-${id}`);
      if (valDisplay) valDisplay.innerText = params[id].toFixed(4);
      applyAllParams();
    };

    panel.addEventListener('input', (e) => {
      if (e.target.id.startsWith('input-')) {
        const id = e.target.id.replace('input-', '');
        updateParam(id, e.target.value);
      }
    });

    // Final check to ensure UI reflects initial state
    applyAllParams();
  };

  const setupContentSource = () => {
    const btn = document.createElement('button');
    btn.innerHTML = "🔴 CONNECT LIVE SPHERE";
    btn.className = "connect-btn";

    btn.onclick = async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } }
        });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.play();

        video.onloadedmetadata = () => {
          const texture = new THREE.VideoTexture(video);
          texture.colorSpace = THREE.SRGBColorSpace;

          sphereMesh.material.uniforms.tVideo.value = texture;
          params.useVideo = 1.0;
          applyAllParams();
        };

        btn.style.display = 'none';
        stream.getVideoTracks()[0].onended = () => {
          params.useVideo = 0.0;
          applyAllParams();
          btn.style.display = 'block';
        };
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          console.warn("Screen sharing permission denied by user.");
        } else {
          console.error(err);
        }
        params.useVideo = 0.0;
        applyAllParams();
      }
    };
    document.body.appendChild(btn);
  };

  createCalibrationUI();
  setupContentSource();

  try {
    await tracker.init(onEyePos);
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 500);
    }
  } catch (e) { }

  const animate = () => {
    requestAnimationFrame(animate);
    projection.update();
    renderer.render(scene, camera);
  };
  animate();
}

init();
