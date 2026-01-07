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
    sphereY: -8.0,
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
    // Create settings toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'settings-toggle';
    toggleBtn.innerHTML = '⚙️';
    toggleBtn.title = 'Settings';
    document.body.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.className = 'caliber-panel';

    // Toggle panel visibility on button click
    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('visible');
      toggleBtn.classList.toggle('active');
    });

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
    // Container for buttons
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.bottom = '20px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.textAlign = 'center';
    container.style.zIndex = '1000';
    container.style.width = '100%';
    document.body.appendChild(container);

    const btn = document.createElement('button');
    btn.innerHTML = "🔴 AUTO CONNECT LIVE (BETA)";
    btn.className = "connect-btn";
    // Reuse class but style might need adjustment if container is used
    container.appendChild(btn);

    // Manual Fallback
    const manualLink = document.createElement('div');
    manualLink.innerText = "or select manual screen share";
    manualLink.style.marginTop = '10px';
    manualLink.style.color = 'rgba(255,255,255,0.7)';
    manualLink.style.fontSize = '12px';
    manualLink.style.textDecoration = 'underline';
    manualLink.style.cursor = 'pointer';
    manualLink.style.fontFamily = 'monospace';
    container.appendChild(manualLink);

    const startVideo = (video) => {
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      sphereMesh.material.uniforms.tVideo.value = texture;
      params.useVideo = 1.0;
      applyAllParams();
      container.style.display = 'none';
    };

    btn.onclick = async () => {
      btn.innerHTML = "⌛ CONNECTING TO BACKEND...";
      btn.disabled = true;

      try {
        // Priority 1: Local MJPEG Streamer (Best for local dev / mac capture)
        // Check if our local streamer is reachable
        try {
          // Try WebSocket streaming for real-time updates
          console.log("Attempting WebSocket connection...");
          
          const ws = new WebSocket('ws://localhost:8080');
          let frameCount = 0;
          
          // Create canvas for frame rendering (matching server size)
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { alpha: false });
          canvas.width = 640;
          canvas.height = 360;
          
          // Create texture from canvas
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          
          ws.binaryType = 'arraybuffer';
          
          ws.onopen = () => {
            console.log("WebSocket stream connected");
            sphereMesh.material.uniforms.tVideo.value = texture;
            params.useVideo = 1.0;
            applyAllParams();
            container.style.display = 'none';
            btn.innerHTML = "✅ LIVE STREAMING";
          };
          
          // Enhanced frame buffer for smooth playback
          const frameBuffer = [];
          const maxBufferSize = 50; // Much larger buffer for smoother playback
          const minBufferSize = 25; // Start playback when we have half the buffer full
          let isPlaying = false;
          let lastFrameTime = 0;
          const targetFPS = 10; // Match server FPS
          const frameInterval = 1000 / targetFPS;
          let actualFPS = 0;
          let fpsFrameCount = 0;
          let fpsLastTime = performance.now();
          let droppedFrames = 0;
          let networkLatency = 0;
          
          // Create buffer status indicator
          const createBufferIndicator = () => {
            const indicator = document.createElement('div');
            indicator.className = 'buffer-status';
            indicator.innerHTML = `
              <div class="buffer-info">
                <span class="buffer-label">Buffer</span>
                <span class="buffer-value" id="buffer-count">0/${maxBufferSize}</span>
              </div>
              <div class="buffer-bar">
                <div class="buffer-fill" id="buffer-fill" style="width: 0%"></div>
              </div>
              <div class="fps-indicator">
                <div class="stream-status">
                  <span class="stream-quality good" id="stream-dot"></span>
                  <span class="buffer-label">Stream</span>
                </div>
                <span class="buffer-value" id="fps-value">0 FPS</span>
              </div>
              <div class="latency-info" id="latency">Buffering...</div>
            `;
            document.body.appendChild(indicator);
            return indicator;
          };
          
          const bufferIndicator = createBufferIndicator();
          
          // Update buffer indicator
          const updateBufferIndicator = () => {
            const bufferPercent = (frameBuffer.length / maxBufferSize) * 100;
            document.getElementById('buffer-fill').style.width = `${bufferPercent}%`;
            document.getElementById('buffer-count').textContent = `${frameBuffer.length}/${maxBufferSize}`;
            
            // Update status class
            if (frameBuffer.length < 5) {
              bufferIndicator.className = 'buffer-status error';
              document.getElementById('stream-dot').className = 'stream-quality poor';
            } else if (frameBuffer.length < minBufferSize) {
              bufferIndicator.className = 'buffer-status warning';
              document.getElementById('stream-dot').className = 'stream-quality medium';
            } else {
              bufferIndicator.className = 'buffer-status';
              document.getElementById('stream-dot').className = 'stream-quality good';
            }
            
            // Calculate and display FPS
            const now = performance.now();
            fpsFrameCount++;
            if (now - fpsLastTime >= 1000) {
              actualFPS = Math.round(fpsFrameCount * 1000 / (now - fpsLastTime));
              document.getElementById('fps-value').textContent = `${actualFPS} FPS`;
              fpsFrameCount = 0;
              fpsLastTime = now;
            }
            
            // Update latency
            if (isPlaying) {
              const latencyMs = Math.round((frameBuffer.length / targetFPS) * 1000);
              document.getElementById('latency').textContent = `Latency: ${latencyMs}ms`;
            }
          };
          
          // Smooth frame playback with adaptive timing
          const playFrames = () => {
            if (!isPlaying) {
              requestAnimationFrame(playFrames);
              return;
            }
            
            // Pause if buffer is too low
            if (frameBuffer.length < 5 && frameCount > 0) {
              console.log('Buffer underrun, pausing...');
              document.getElementById('latency').textContent = 'Buffering...';
              isPlaying = false;
              requestAnimationFrame(playFrames);
              return;
            }
            
            const currentTime = performance.now();
            const elapsed = currentTime - lastFrameTime;
            
            if (elapsed >= frameInterval) {
              // Get next frame from buffer
              const frameData = frameBuffer.shift();
              if (frameData) {
                ctx.drawImage(frameData, 0, 0, canvas.width, canvas.height);
                texture.needsUpdate = true;
                frameCount++;
                updateBufferIndicator();
              } else {
                droppedFrames++;
              }
              
              lastFrameTime = currentTime - (elapsed % frameInterval);
            }
            
            requestAnimationFrame(playFrames);
          };
          
          ws.onmessage = (event) => {
            // Convert ArrayBuffer to Blob
            const blob = new Blob([event.data], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            
            // Create image from blob
            const img = new Image();
            img.onload = () => {
              // Add to buffer
              if (frameBuffer.length < maxBufferSize) {
                frameBuffer.push(img);
              } else {
                // Replace oldest frame if buffer is full
                frameBuffer.shift();
                frameBuffer.push(img);
              }
              
              // Start playback when we have enough frames
              if (!isPlaying && frameBuffer.length >= minBufferSize) {
                isPlaying = true;
                lastFrameTime = performance.now();
                console.log("Starting buffered playback with", frameBuffer.length, "frames");
                document.getElementById('latency').textContent = 'Playing...';
              } else if (frameBuffer.length < 5 && isPlaying) {
                // Resume playback if buffer recovers
                if (frameBuffer.length >= minBufferSize) {
                  isPlaying = true;
                  console.log("Resuming playback");
                }
              }
              
              updateBufferIndicator();
              
              // Clean up
              URL.revokeObjectURL(url);
            };
            img.src = url;
          };
          
          // Start the playback loop
          playFrames();
          
          ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            btn.innerHTML = "❌ STREAM ERROR";
            btn.disabled = false;
          };
          
          ws.onclose = () => {
            console.log("WebSocket disconnected");
            params.useVideo = 0.0;
            applyAllParams();
            container.style.display = 'block';
            if (bufferIndicator) {
              bufferIndicator.remove();
            }
          };
          
          // Wait for connection
          await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve);
            ws.addEventListener('error', reject);
            setTimeout(() => reject(new Error("WebSocket timeout")), 5000);
          });
          
          return;
        } catch (e) {
          console.log("WebSocket stream not available. Make sure 'node ws-streamer.cjs' is running.", e);
        }

        // Priority 2: Vercel API - Search for YouTube live stream
        btn.innerHTML = "⌛ SEARCHING YOUTUBE...";
        const res = await fetch('/api');
        if (!res.ok) throw new Error(`Backend Error: ${res.status}`);
        const data = await res.json();

        if (data.success && data.videoId) {
          // Found a stream - show info and guide user to screen share
          const isLive = data.isLive ? '🔴 LIVE' : '📺 VIDEO';
          
          // Create info panel
          const infoPanel = document.createElement('div');
          infoPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            border: 1px solid #00ff88;
            border-radius: 16px;
            padding: 30px;
            z-index: 3000;
            max-width: 400px;
            text-align: center;
            color: white;
            font-family: monospace;
          `;
          infoPanel.innerHTML = `
            <h2 style="color: #00ff88; margin-top: 0;">${isLive} Found!</h2>
            <p style="color: #ccc; font-size: 14px;">${data.title}</p>
            <img src="${data.thumbnail}" style="width: 100%; border-radius: 8px; margin: 15px 0;" />
            <p style="color: #888; font-size: 12px;">YouTube 라이브 스트림을 직접 가져올 수 없습니다.<br>아래 버튼을 눌러 YouTube를 열고 화면 공유를 해주세요.</p>
            <a href="${data.url}" target="_blank" style="
              display: inline-block;
              background: #ff0055;
              color: white;
              padding: 12px 24px;
              border-radius: 30px;
              text-decoration: none;
              font-weight: bold;
              margin: 10px 5px;
            ">🔗 Open YouTube</a>
            <button id="close-info-panel" style="
              background: transparent;
              border: 1px solid #00ff88;
              color: #00ff88;
              padding: 12px 24px;
              border-radius: 30px;
              cursor: pointer;
              font-weight: bold;
              margin: 10px 5px;
            ">📺 Screen Share</button>
          `;
          document.body.appendChild(infoPanel);
          
          document.getElementById('close-info-panel').onclick = async () => {
            infoPanel.remove();
            manualLink.click(); // Trigger screen share
          };
          
          btn.innerHTML = "🔴 STREAM FOUND";
          btn.disabled = false;

        } else {
          console.error(data.error);
          alert("Could not find a live stream automatically.\nBackend: " + (data.error || "Unknown"));
          btn.innerHTML = "🔴 TRY AGAIN";
          btn.disabled = false;
        }
      } catch (err) {
        console.error(err);
        alert("Connection error: " + err.message);
        btn.innerHTML = "🔴 RETRY";
        btn.disabled = false;
      }
    };

    manualLink.onclick = async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } }
        });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true; // Chrome blocks autoplay with sound usually
        video.play();

        video.onloadedmetadata = () => {
          startVideo(video);
        };

        stream.getVideoTracks()[0].onended = () => {
          params.useVideo = 0.0;
          applyAllParams();
          container.style.display = 'block';
        };
      } catch (e) {
        console.warn(e);
      }
    };
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
