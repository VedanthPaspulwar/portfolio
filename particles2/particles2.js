/**
 * 3D Particle Point Cloud Physics Engine
 * High-performance 60+ FPS zero-allocation interactive simulation
 */

(function () {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const cursorRing = document.getElementById('cursorRing');
  const cursorDot = document.getElementById('cursorDot');
  const settingsDrawer = document.getElementById('settingsDrawer');
  const settingsToggle = document.getElementById('settingsToggle');
  const drawerClose = document.getElementById('drawerClose');
  const hintBadge = document.getElementById('hintBadge');
  const fpsDisplay = document.getElementById('fpsDisplay');

  // Sliders & Labels
  const radiusSlider = document.getElementById('sliderRadius');
  const powerSlider = document.getElementById('sliderPower');
  const springSlider = document.getElementById('sliderSpring');
  const sizeSlider = document.getElementById('sliderSize');
  const tiltSlider = document.getElementById('sliderTilt');

  const radiusVal = document.getElementById('valRadius');
  const powerVal = document.getElementById('valPower');
  const springVal = document.getElementById('valSpring');
  const sizeVal = document.getElementById('valSize');
  const tiltVal = document.getElementById('valTilt');

  // Action Buttons
  const btnScatter = document.getElementById('btnScatter');
  const btnReset = document.getElementById('btnReset');
  const modeButtons = document.querySelectorAll('.btn-mode');
  const presetButtons = document.querySelectorAll('.btn-preset');

  // Particle System Config
  const config = {
    mode: 'repel', // 'repel' | 'attract' | 'vortex'
    colorPreset: 'cosmic', // 'cosmic' | 'cyan' | 'matrix' | 'synthwave' | 'gold'
    spreadRadius: 150,
    repulsionPower: 8,
    springSpeed: 0.055,
    damping: 0.88,
    dotSize: 2.0,
    tiltSensitivity: 0.45,
    fov: 650
  };

  function computeWorldScale() {
    // Fits eagle to viewport: balanced proportion — not too big, not too small
    // Height span is 1.00, Width span is 0.628
    const scaleFromHeight = (height * 0.78) / 1.00;
    const scaleFromWidth = (width * 0.86) / 0.628;
    return Math.min(scaleFromHeight, scaleFromWidth);
  }

  // Canvas Dimensions
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);
  let cx = width / 2;
  let cy = height / 2;
  let baseWorldScale = computeWorldScale();

  // Mouse State
  const mouse = {
    x: -9999,
    y: -9999,
    targetX: -9999,
    targetY: -9999,
    active: false,
    down: false
  };

  // 3D Parallax Tilt State
  let rotX = 0;
  let rotY = 0;
  let targetRotX = 0;
  let targetRotY = 0;

  // Expanding Shockwave Ripples
  const ripples = [];

  // Particle Buffers (Allocated once)
  let count = 0;
  let origX, origY, origZ;
  let currX, currY, currZ;
  let vx, vy, vz;
  let brightnessArr;

  function initParticles() {
    if (!window.PARTICLE_DATA_2 || window.PARTICLE_DATA_2.length === 0) {
      console.warn('Particle data not loaded yet.');
      return;
    }

    const raw = window.PARTICLE_DATA_2;
    count = Math.floor(raw.length / 4);

    origX = new Float32Array(count);
    origY = new Float32Array(count);
    origZ = new Float32Array(count);

    currX = new Float32Array(count);
    currY = new Float32Array(count);
    currZ = new Float32Array(count);

    vx = new Float32Array(count);
    vy = new Float32Array(count);
    vz = new Float32Array(count);

    brightnessArr = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const idx = i * 4;
      const x = raw[idx];
      const y = raw[idx + 1];
      const z = raw[idx + 2];
      const b = raw[idx + 3];

      origX[i] = x;
      origY[i] = y;
      origZ[i] = z;

      // Start with subtle random initial emergence
      currX[i] = x + (Math.random() - 0.5) * 0.15;
      currY[i] = y + (Math.random() - 0.5) * 0.15;
      currZ[i] = z + (Math.random() - 0.5) * 0.15;

      brightnessArr[i] = b;
    }

    const pCountEl = document.getElementById('particleCount');
    if (pCountEl) {
      pCountEl.textContent = `${count.toLocaleString()} Particles`;
    }
  }

  // Color Mapping Helper
  function getParticleColor(brightness, normY, preset) {
    const alpha = Math.min(1, Math.max(0.18, brightness * 0.95));

    switch (preset) {
      case 'cyan':
        return `rgba(0, ${Math.floor(215 + brightness * 40)}, 255, ${alpha})`;
      case 'matrix':
        return `rgba(${Math.floor(brightness * 60)}, 255, ${Math.floor(120 + brightness * 80)}, ${alpha})`;
      case 'synthwave':
        if (normY < 0) {
          return `rgba(255, 30, 140, ${alpha})`;
        } else {
          return `rgba(165, 80, 255, ${alpha})`;
        }
      case 'gold':
        return `rgba(255, ${Math.floor(175 + brightness * 60)}, 30, ${alpha})`;
      case 'white': {
        const wrgb = Math.floor(210 + brightness * 45);
        return `rgba(${wrgb}, ${wrgb}, ${Math.min(255, wrgb + 15)}, ${alpha})`;
      }
      case 'cosmic':
      default: {
        // Celestial Eagle: Pure Diamond White Core -> Icy Cyan Starlight Wings -> Deep Nebula Indigo Tail
        const lum = brightness;
        if (lum > 0.70) {
          // Brilliant starlight white / eagle head focal point
          const w = Math.min(255, Math.floor(235 + lum * 25));
          return `rgba(${w}, ${Math.min(255, w + 3)}, 255, ${alpha})`;
        } else if (lum > 0.40) {
          // Luminous celestial icy cyan & electric starlight blue
          const r = Math.floor(90 + lum * 90);
          const g = Math.floor(190 + lum * 65);
          const b = 255;
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } else {
          // Deep cosmic nebula indigo / stardust tendrils
          const r2 = Math.floor(65 + lum * 120);
          const g2 = Math.floor(95 + lum * 130);
          const b2 = Math.floor(195 + lum * 60);
          return `rgba(${r2}, ${g2}, ${b2}, ${alpha})`;
        }
      }
    }
  }

  // Pre-cached color arrays for maximum speed
  const COLOR_LUT_SIZE = 32;
  const colorLUTs = {};

  function initColorLUTs() {
    ['cosmic', 'white', 'cyan', 'matrix', 'synthwave', 'gold'].forEach(preset => {
      colorLUTs[preset] = new Array(COLOR_LUT_SIZE);
      for (let i = 0; i < COLOR_LUT_SIZE; i++) {
        const b = i / (COLOR_LUT_SIZE - 1);
        colorLUTs[preset][i] = getParticleColor(b, 0, preset);
      }
    });
  }

  // Shockwave Trigger
  function spawnShockwave(originX, originY, strength = 18) {
    ripples.push({
      x: originX,
      y: originY,
      radius: 5,
      maxRadius: Math.max(width, height) * 0.9,
      speed: 26,
      thickness: 75,
      strength: strength
    });

    if (cursorRing) {
      cursorRing.classList.add('clicked');
      setTimeout(() => cursorRing.classList.remove('clicked'), 240);
    }

    if (hintBadge && !hintBadge.classList.contains('fade-out')) {
      hintBadge.classList.add('fade-out');
    }
  }

  // Scatter Wave Explosion
  function triggerScatterWave() {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const force = 12 + Math.random() * 24;
      vx[i] += Math.cos(angle) * force * 0.003;
      vy[i] += Math.sin(angle) * force * 0.003;
      vz[i] += (Math.random() - 0.5) * force * 0.004;
    }
    spawnShockwave(cx, cy, 30);
  }

  // Reset System
  function resetDefaults() {
    config.mode = 'repel';
    config.colorPreset = 'cosmic';
    config.spreadRadius = 150;
    config.repulsionPower = 8;
    config.springSpeed = 0.055;
    config.dotSize = 1.5;
    config.tiltSensitivity = 0.45;

    radiusSlider.value = 150;
    powerSlider.value = 8;
    springSlider.value = 0.055;
    sizeSlider.value = 1.5;
    tiltSlider.value = 0.45;

    radiusVal.textContent = '150px';
    powerVal.textContent = '8';
    springVal.textContent = '0.055';
    sizeVal.textContent = '1.5px';
    tiltVal.textContent = '0.45';

    modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === 'repel'));
    presetButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.preset === 'cosmic'));
    cursorRing.className = '';

    for (let i = 0; i < count; i++) {
      vx[i] = 0;
      vy[i] = 0;
      vz[i] = 0;
      currX[i] = origX[i];
      currY[i] = origY[i];
      currZ[i] = origZ[i];
    }
  }

  // Animation & Physics Update Loop
  let lastTime = performance.now();
  let frameCount = 0;
  let fpsTimer = 0;

  function render(now) {
    requestAnimationFrame(render);

    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // FPS Meter
    frameCount++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      const fps = Math.round(frameCount / fpsTimer);
      if (fpsDisplay) fpsDisplay.textContent = `${fps} FPS`;
      frameCount = 0;
      fpsTimer = 0;
    }

    // Smooth Cursor Lerp
    mouse.x += (mouse.targetX - mouse.x) * 0.35;
    mouse.y += (mouse.targetY - mouse.y) * 0.35;

    if (cursorRing && mouse.active) {
      cursorRing.style.left = `${mouse.x}px`;
      cursorRing.style.top = `${mouse.y}px`;
      cursorDot.style.left = `${mouse.targetX}px`;
      cursorDot.style.top = `${mouse.targetY}px`;
    }

    // Smooth 3D Parallax Tilt
    rotX += (targetRotX - rotX) * 0.08;
    rotY += (targetRotY - rotY) * 0.08;

    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);

    // Update Expanding Ripples
    for (let r = ripples.length - 1; r >= 0; r--) {
      const rip = ripples[r];
      rip.radius += rip.speed;
      if (rip.radius > rip.maxRadius) {
        ripples.splice(r, 1);
      }
    }

    // Clear Canvas
    ctx.fillStyle = '#060608';
    ctx.fillRect(0, 0, width, height);

    if (count === 0) return;

    const spreadSq = config.spreadRadius * config.spreadRadius;
    const invSpread = 1 / config.spreadRadius;
    const power = config.repulsionPower * 0.00035;
    const spring = config.springSpeed;
    const damp = config.damping;
    const baseSize = config.dotSize;
    const mode = config.mode;
    const preset = config.colorPreset;
    const currentLUT = colorLUTs[preset] || colorLUTs['cosmic'];

    const numRipples = ripples.length;

    // Update Physics & Draw Particles
    for (let i = 0; i < count; i++) {
      let x = currX[i];
      let y = currY[i];
      let z = currZ[i];

      // 3D Parallax Rotation
      // Rotate around Y
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      // Rotate around X
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      // Perspective Projection
      const pScale = config.fov / (config.fov + z2 * baseWorldScale * 0.35);
      const screenX = cx + x1 * baseWorldScale * pScale;
      const screenY = cy + y1 * baseWorldScale * pScale;

      // Mouse Proximity Force
      if (mouse.active) {
        const dx = screenX - mouse.x;
        const dy = screenY - mouse.y;
        const dSq = dx * dx + dy * dy;

        if (dSq < spreadSq && dSq > 0.01) {
          const d = Math.sqrt(dSq);
          const force = (1 - d * invSpread) * power;

          if (mode === 'repel') {
            vx[i] += (dx / d) * force;
            vy[i] += (dy / d) * force;
            vz[i] += (Math.random() - 0.5) * force * 0.5;
          } else if (mode === 'attract') {
            vx[i] -= (dx / d) * force * 1.1;
            vy[i] -= (dy / d) * force * 1.1;
          } else if (mode === 'vortex') {
            // Tangential rotational swirl + subtle inward suction
            const nx = dx / d;
            const ny = dy / d;
            vx[i] += (-ny * 1.6 - nx * 0.4) * force;
            vy[i] += (nx * 1.6 - ny * 0.4) * force;
          }
        }
      }

      // Shockwave Ripples Impulse
      for (let r = 0; r < numRipples; r++) {
        const rip = ripples[r];
        const rdx = screenX - rip.x;
        const rdy = screenY - rip.y;
        const rDist = Math.sqrt(rdx * rdx + rdy * rdy);
        const diff = Math.abs(rDist - rip.radius);

        if (diff < rip.thickness && rDist > 0.01) {
          const rForce = (1 - diff / rip.thickness) * (rip.strength * 0.00018);
          vx[i] += (rdx / rDist) * rForce;
          vy[i] += (rdy / rDist) * rForce;
          vz[i] += (Math.random() - 0.5) * rForce * 0.8;
        }
      }

      // Elastic Spring Return to Home Position
      const ax = (origX[i] - x) * spring;
      const ay = (origY[i] - y) * spring;
      const az = (origZ[i] - z) * spring;

      vx[i] = (vx[i] + ax) * damp;
      vy[i] = (vy[i] + ay) * damp;
      vz[i] = (vz[i] + az) * damp;

      currX[i] += vx[i];
      currY[i] += vy[i];
      currZ[i] += vz[i];

      // Draw Point
      const b = brightnessArr[i];
      const lutIdx = Math.min(COLOR_LUT_SIZE - 1, Math.max(0, Math.floor(b * COLOR_LUT_SIZE)));
      ctx.fillStyle = currentLUT[lutIdx];

      const pSize = Math.max(1, baseSize * pScale);
      ctx.fillRect(screenX - pSize * 0.5, screenY - pSize * 0.5, pSize, pSize);
    }
  }

  // Event Listeners
  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    cx = width / 2;
    cy = height / 2;
    baseWorldScale = computeWorldScale();
  });

  window.addEventListener('mousemove', e => {
    mouse.targetX = e.clientX;
    mouse.targetY = e.clientY;
    mouse.active = true;

    // 3D Tilt calculation
    const normX = (e.clientX - cx) / cx;
    const normY = (e.clientY - cy) / cy;
    targetRotY = normX * config.tiltSensitivity * 0.45;
    targetRotX = -normY * config.tiltSensitivity * 0.35;

    if (hintBadge && !hintBadge.classList.contains('fade-out')) {
      hintBadge.classList.add('fade-out');
    }
  });

  window.addEventListener('mouseleave', () => {
    mouse.active = false;
    mouse.targetX = -9999;
    mouse.targetY = -9999;
    targetRotX = 0;
    targetRotY = 0;
  });

  // Shockwave on Click/Tap
  window.addEventListener('mousedown', e => {
    // Ignore clicks inside drawer
    if (e.target.closest('.settings-drawer') || e.target.closest('.btn-settings-toggle') || e.target.closest('.btn-back')) {
      return;
    }
    mouse.down = true;
    spawnShockwave(e.clientX, e.clientY, 20);
  });

  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  // Touch Support for Mobile
  window.addEventListener('touchmove', e => {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      mouse.targetX = t.clientX;
      mouse.targetY = t.clientY;
      mouse.active = true;

      const normX = (t.clientX - cx) / cx;
      const normY = (t.clientY - cy) / cy;
      targetRotY = normX * config.tiltSensitivity * 0.45;
      targetRotX = -normY * config.tiltSensitivity * 0.35;
    }
  }, { passive: true });

  window.addEventListener('touchstart', e => {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      if (!e.target.closest('.settings-drawer') && !e.target.closest('.btn-settings-toggle') && !e.target.closest('.btn-back')) {
        mouse.targetX = t.clientX;
        mouse.targetY = t.clientY;
        mouse.active = true;
        spawnShockwave(t.clientX, t.clientY, 20);
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    mouse.active = false;
  });

  // Settings Drawer Toggle
  function toggleDrawer() {
    const isOpen = settingsDrawer.classList.toggle('open');
    settingsToggle.classList.toggle('drawer-open', isOpen);
  }

  settingsToggle.addEventListener('click', toggleDrawer);
  drawerClose.addEventListener('click', () => {
    settingsDrawer.classList.remove('open');
    settingsToggle.classList.remove('drawer-open');
  });

  // Mode Selection
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      config.mode = btn.dataset.mode;

      cursorRing.className = '';
      if (config.mode === 'attract') cursorRing.classList.add('active-attract');
      if (config.mode === 'vortex') cursorRing.classList.add('active-vortex');
    });
  });

  // Color Preset Selection
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      config.colorPreset = btn.dataset.preset;
    });
  });

  // Slider Inputs
  radiusSlider.addEventListener('input', e => {
    config.spreadRadius = parseFloat(e.target.value);
    radiusVal.textContent = `${config.spreadRadius}px`;
  });

  powerSlider.addEventListener('input', e => {
    config.repulsionPower = parseFloat(e.target.value);
    powerVal.textContent = `${config.repulsionPower}`;
  });

  springSlider.addEventListener('input', e => {
    config.springSpeed = parseFloat(e.target.value);
    springVal.textContent = `${config.springSpeed}`;
  });

  sizeSlider.addEventListener('input', e => {
    config.dotSize = parseFloat(e.target.value);
    sizeVal.textContent = `${config.dotSize}px`;
  });

  tiltSlider.addEventListener('input', e => {
    config.tiltSensitivity = parseFloat(e.target.value);
    tiltVal.textContent = `${config.tiltSensitivity}`;
  });

  // Actions
  btnScatter.addEventListener('click', triggerScatterWave);
  btnReset.addEventListener('click', resetDefaults);

  // Keyboard Shortcuts
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      triggerScatterWave();
    } else if (e.key === 'r' || e.key === 'R') {
      resetDefaults();
    } else if (e.key === 'Escape') {
      settingsDrawer.classList.remove('open');
      settingsToggle.classList.remove('drawer-open');
    }
  });

  // Initialize
  initColorLUTs();
  initParticles();
  requestAnimationFrame(render);
})();


