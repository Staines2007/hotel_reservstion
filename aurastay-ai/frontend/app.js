/**
 * ==========================================================================
 * AURASTAY AI - LANDING PAGE CONTROLLER (FRONTEND)
 * ==========================================================================
 */

function initApp() {
  initCustomCursor();
  initThemeToggle();
  loadSubscriptionPrice();
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  
  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  btn.addEventListener('click', () => {
    document.documentElement.classList.add('no-transitions');
    
    const activeTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', activeTheme);
    localStorage.setItem('theme', activeTheme);
    
    // Force browser reflow to apply styles instantly
    window.getComputedStyle(document.documentElement).opacity;
    
    setTimeout(() => {
      document.documentElement.classList.remove('no-transitions');
    }, 50);
  });
}

// Custom cursor trail
function initCustomCursor() {
  const cursor = document.getElementById('custom-cursor');
  const dot = document.getElementById('custom-cursor-dot');
  if (!cursor || !dot) return;

  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;
  let dotX = 0, dotY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function update() {
    cursorX += (mouseX - cursorX) * 0.12;
    cursorY += (mouseY - cursorY) * 0.12;
    dotX += (mouseX - dotX) * 0.25;
    dotY += (mouseY - dotY) * 0.25;

    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
    dot.style.left = `${dotX}px`;
    dot.style.top = `${dotY}px`;

    requestAnimationFrame(update);
  }
  update();

  const triggers = 'a, button, select, input';
  document.body.addEventListener('mouseenter', (e) => {
    if (e.target.matches && e.target.matches(triggers)) {
      cursor.classList.add('hovering');
    }
  }, true);

  document.body.addEventListener('mouseleave', (e) => {
    if (e.target.matches && e.target.matches(triggers)) {
      cursor.classList.remove('hovering');
    }
  }, true);
}

// Fetch and render the dynamic membership subscription price
async function loadSubscriptionPrice() {
  const goldPriceSpan = document.getElementById('gold-price-val');
  if (!goldPriceSpan) return;

  // 1. Load from cache or default
  const cachedPrice = localStorage.getItem('aurastay_sub_price') || '3000';
  goldPriceSpan.textContent = formatCurrencyNumber(cachedPrice);

  // 2. Fetch from backend API
  try {
    const res = await fetch('http://localhost:5000/api/settings');
    if (res.ok) {
      const settings = await res.json();
      if (settings && settings.subscription_price) {
        const price = settings.subscription_price;
        localStorage.setItem('aurastay_sub_price', price);
        goldPriceSpan.textContent = formatCurrencyNumber(price);
      }
    }
  } catch (err) {
    console.warn("API settings endpoint offline, using cached subscription price.", err);
  }
}

function formatCurrencyNumber(str) {
  const num = parseInt(str.replace(/,/g, ''));
  if (isNaN(num)) return str;
  return num.toLocaleString('en-IN');
}
