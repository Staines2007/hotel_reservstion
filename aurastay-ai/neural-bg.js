/**
 * ==========================================================================
 * AURASTAY AI - INTERACTIVE AI NEURAL NETWORK BACKDROP
 * ==========================================================================
 */

(function () {
  const canvasId = 'neural-canvas';
  let canvas, ctx;
  let particles = [];
  let mouse = { x: null, y: null, radius: 150 };
  let animationFrameId;

  // Design Tokens (matching Poppins/Playfair premium theme)
  const colors = {
    dark: {
      nodes: ['#2dd4bf', '#7c3aed', '#60a5fa', '#f59e0b'],
      lineBase: '124, 58, 237', // Purple
      lineTeal: '45, 212, 191', // Teal
      lineBlue: '96, 165, 250'  // Blue
    },
    light: {
      nodes: ['#0ea5e9', '#6366f1', '#14b8a6', '#f59e0b'],
      lineBase: '99, 102, 241',
      lineTeal: '20, 184, 166',
      lineBlue: '14, 165, 233'
    }
  };

  class Particle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 0.7;
      this.vy = (Math.random() - 0.5) * 0.7;
      this.radius = Math.random() * 2 + 1;
      
      const theme = document.documentElement.getAttribute('data-theme') || 'dark';
      const nodeColors = colors[theme].nodes;
      this.color = nodeColors[Math.floor(Math.random() * nodeColors.length)];
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      
      // Node glow effect
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    }

    update() {
      // Bounce boundaries
      if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
      if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;

      // Mouse interactive gravity/attraction
      if (mouse.x !== null && mouse.y !== null) {
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          // Gently attract to mouse
          const force = (mouse.radius - dist) / mouse.radius;
          this.x -= (dx / dist) * force * 0.4;
          this.y -= (dy / dist) * force * 0.4;
        }
      }

      this.x += this.vx;
      this.y += this.vy;
    }
  }

  function init() {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resizeCanvas();

    particles = [];
    // Spawn particles based on screen size (denser on desktop)
    const particleCount = Math.min(120, Math.floor((canvas.width * canvas.height) / 11000));
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      particles.push(new Particle(x, y));
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseOut);

    // Watch for theme changes to dynamically re-color nodes
    const observer = new MutationObserver(() => {
      recolorParticles();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    animate();
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function handleResize() {
    resizeCanvas();
    // Re-initialize particles to fit new screen bounds
    particles = [];
    const particleCount = Math.min(120, Math.floor((canvas.width * canvas.height) / 11000));
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle(Math.random() * canvas.width, Math.random() * canvas.height));
    }
  }

  function handleMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }

  function handleMouseOut() {
    mouse.x = null;
    mouse.y = null;
  }

  function recolorParticles() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nodeColors = colors[theme].nodes;
    particles.forEach(p => {
      p.color = nodeColors[Math.floor(Math.random() * nodeColors.length)];
    });
  }

  function drawLines() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const currentThemeColors = colors[theme];
    const threshold = 110;

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < threshold) {
          const alpha = (1 - (dist / threshold)) * 0.16;
          
          // Select line color based on particle colors
          let lineRGB = currentThemeColors.lineBase;
          if (p1.color === '#2dd4bf' || p1.color === '#14b8a6') {
            lineRGB = currentThemeColors.lineTeal;
          } else if (p1.color === '#60a5fa' || p1.color === '#0ea5e9') {
            lineRGB = currentThemeColors.lineBlue;
          }

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(${lineRGB}, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // Draw mouse cursor lines
      if (mouse.x !== null && mouse.y !== null) {
        const p = particles[i];
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius) {
          const alpha = (1 - (dist / mouse.radius)) * 0.25;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = `rgba(${currentThemeColors.lineTeal}, ${alpha})`;
          ctx.lineWidth = 1.0;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.update();
      p.draw();
    });

    drawLines();

    animationFrameId = requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
