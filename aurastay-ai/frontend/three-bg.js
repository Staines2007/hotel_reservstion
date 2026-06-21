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
  
  const themeColors = {
    dark: {
      wireframe: 0x22d3ee, // Cyan
      accent: 0x6366f1,    // Indigo
      particles: 0x475569  // Slate
    },
    light: {
      wireframe: 0x4f46e5, // Indigo
      accent: 0x0ea5e9,    // Sky Blue
      particles: 0xcbd5e1  // Light Gray
    }
  };

  function init() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;

    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 20;

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    architecturalGroup = new THREE.Group();
    scene.add(architecturalGroup);

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const colors = themeColors[currentTheme];

    // Outer grid box
    const outerGeo = new THREE.BoxGeometry(6, 6, 6, 2, 2, 2);
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: colors.wireframe,
      wireframe: true,
      transparent: true,
      opacity: 0.15
    });
    const outerMesh = new THREE.Mesh(outerGeo, wireframeMat);
    architecturalGroup.add(outerMesh);

    // Inner suite wireframe
    const innerGeo = new THREE.BoxGeometry(3.5, 3.5, 3.5);
    const innerMat = new THREE.MeshBasicMaterial({
      color: colors.accent,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    architecturalGroup.add(innerMesh);

    // Torus rings
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

    // Particles swarms
    const particleCount = 100;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 30;
      positions[i + 1] = (Math.random() - 0.5) * 30;
      positions[i + 2] = (Math.random() - 0.5) * 30;
    }

    particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );

    const pMaterial = new THREE.PointsMaterial({
      color: colors.particles,
      size: 0.08,
      transparent: true,
      opacity: 0.5
    });

    particles = new THREE.Points(particleGeometry, pMaterial);
    scene.add(particles);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onWindowResize);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          updateThemeColors();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    animate();
  }

  function onMouseMove(event) {
    const mouseX = (event.clientX / window.innerWidth) - 0.5;
    const mouseY = (event.clientY / window.innerHeight) - 0.5;
    
    targetRotationY = mouseX * 0.6;
    targetRotationX = mouseY * 0.6;
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  function updateThemeColors() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const colors = themeColors[currentTheme];

    if (architecturalGroup) {
      architecturalGroup.children[0].material.color.setHex(colors.wireframe);
      architecturalGroup.children[1].material.color.setHex(colors.accent);
      architecturalGroup.children[2].material.color.setHex(colors.wireframe);
      architecturalGroup.children[3].material.color.setHex(colors.wireframe);
    }
    
    if (particles) {
      particles.material.color.setHex(colors.particles);
    }
  }

  function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.0006;

    if (architecturalGroup) {
      architecturalGroup.rotation.y = time * 0.12;
      const scaleFactor = 1 + Math.sin(time * 2) * 0.02;
      architecturalGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);
      
      currentRotationX += (targetRotationX - currentRotationX) * 0.05;
      currentRotationY += (targetRotationY - currentRotationY) * 0.05;
      
      architecturalGroup.rotation.x = currentRotationX;
      architecturalGroup.rotation.y += currentRotationY;
    }

    if (particles) {
      particles.rotation.y = -time * 0.02;
    }

    renderer.render(scene, camera);
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (typeof THREE !== 'undefined') {
      init();
    } else {
      setTimeout(() => {
        if (typeof THREE !== 'undefined') init();
      }, 500);
    }
  });
})();
