/**
 * ==========================================================================
 * AURASTAY AI - THREE.JS INTERACTIVE 3D BACKDROP SCRIPT
 * ==========================================================================
 */

(function () {
  let scene, camera, renderer;
  let architecturalGroup;
  let particles;
  let targetRotationX = 0;
  let targetRotationY = 0;
  let currentRotationX = 0;
  let currentRotationY = 0;
  
  // Theme color settings
  const themeColors = {
    dark: {
      wireframe: 0x22d3ee, // cyan
      accent: 0x6366f1,    // indigo
      particles: 0x475569  // slate
    },
    light: {
      wireframe: 0x4f46e5, // indigo
      accent: 0x0ea5e9,    // sky blue
      particles: 0xcbd5e1  // light slate
    }
  };

  function init() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;

    // 1. Create Scene & Camera
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 20;

    // 2. Create Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 3. Populate 3D Geometric Architectural Layout (Hollow Cubes structure)
    architecturalGroup = new THREE.Group();
    scene.add(architecturalGroup);

    // Create a series of nested wireframe boxes to simulate a 3D architectural schematic
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const colors = themeColors[currentTheme];

    // Main Outer Grid
    const outerGeo = new THREE.BoxGeometry(6, 6, 6, 2, 2, 2);
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: colors.wireframe,
      wireframe: true,
      transparent: true,
      opacity: 0.15
    });
    const outerMesh = new THREE.Mesh(outerGeo, wireframeMat);
    architecturalGroup.add(outerMesh);

    // Inner Core Room Wireframe
    const innerGeo = new THREE.BoxGeometry(3.5, 3.5, 3.5);
    const innerMat = new THREE.MeshBasicMaterial({
      color: colors.accent,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    architecturalGroup.add(innerMesh);

    // Floating structural support rings
    const ringGeo = new THREE.TorusGeometry(5, 0.03, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colors.wireframe,
      transparent: true,
      opacity: 0.2
    });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2;
    architecturalGroup.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.rotation.y = Math.PI / 4;
    architecturalGroup.add(ring2);

    // 4. Create floating particle swarm
    const particleCount = 200;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Random coordinates in space
      positions[i] = (Math.random() - 0.5) * 35;
      positions[i + 1] = (Math.random() - 0.5) * 35;
      positions[i + 2] = (Math.random() - 0.5) * 35;
    }

    particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );

    // Simple custom circular particle canvas texture
    const pMaterial = new THREE.PointsMaterial({
      color: colors.particles,
      size: 0.08,
      transparent: true,
      opacity: 0.5
    });

    particles = new THREE.Points(particleGeometry, pMaterial);
    scene.add(particles);

    // 5. Ambient lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // 6. Listeners
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onWindowResize);

    // Observe theme mutations to update 3D line colors dynamically
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          updateThemeColors();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    // Begin Loop
    animate();
  }

  // Mouse move updates target rotation (parallax)
  function onMouseMove(event) {
    const mouseX = (event.clientX / window.innerWidth) - 0.5;
    const mouseY = (event.clientY / window.innerHeight) - 0.5;
    
    // Limits the rotation angle
    targetRotationY = mouseX * 0.8;
    targetRotationX = mouseY * 0.8;
  }

  // Resize handler
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  // Sync theme changes with the materials
  function updateThemeColors() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const colors = themeColors[currentTheme];

    if (architecturalGroup) {
      // Index 0: outer box, Index 1: inner box, Index 2 & 3: rings
      architecturalGroup.children[0].material.color.setHex(colors.wireframe);
      architecturalGroup.children[1].material.color.setHex(colors.accent);
      architecturalGroup.children[2].material.color.setHex(colors.wireframe);
      architecturalGroup.children[3].material.color.setHex(colors.wireframe);
    }
    
    if (particles) {
      particles.material.color.setHex(colors.particles);
    }
  }

  // Core Animation Loop
  function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.0006;

    // Slow rotation
    if (architecturalGroup) {
      architecturalGroup.rotation.y = time * 0.15;
      
      // Heartbeat pulse simulation
      const pulse = 1 + Math.sin(time * 3) * 0.03;
      architecturalGroup.scale.set(pulse, pulse, pulse);
      
      // Interpolate rotation based on mouse coords (Dampened easing)
      currentRotationX += (targetRotationX - currentRotationX) * 0.05;
      currentRotationY += (targetRotationY - currentRotationY) * 0.05;
      
      architecturalGroup.rotation.x = currentRotationX;
      architecturalGroup.rotation.y += currentRotationY;
    }

    // Drift particles slightly
    if (particles) {
      particles.rotation.y = -time * 0.04;
      particles.rotation.x = time * 0.02;
    }

    renderer.render(scene, camera);
  }

  // Wait for scripts and window load to initialize
  window.addEventListener('DOMContentLoaded', () => {
    // Check if Three.js is loaded
    if (typeof THREE !== 'undefined') {
      init();
    } else {
      console.warn("Three.js not loaded. Retrying in 500ms...");
      setTimeout(() => {
        if (typeof THREE !== 'undefined') init();
      }, 500);
    }
  });
})();
