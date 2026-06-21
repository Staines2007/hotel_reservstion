/**
 * ==========================================================================
 * AURASTAY AI - LOGIN PAGE CONTROLLER
 * ==========================================================================
 */

function initLogin() {
  // Sync active theme from localStorage
  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);

  initCustomCursor();
  initAuthForm();
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initLogin);
} else {
  initLogin();
}

function initAuthForm() {
  const authForm = document.getElementById('auth-form');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const nameGroup = document.getElementById('name-group');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      if (nameGroup) nameGroup.classList.add('hide');
      if (submitBtn) submitBtn.textContent = 'Log In';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      if (nameGroup) nameGroup.classList.remove('hide');
      if (submitBtn) submitBtn.textContent = 'Register Account';
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const selectedRole = document.getElementById('auth-role').value;
      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      const name = document.getElementById('auth-name') ? document.getElementById('auth-name').value : '';
      const isRegister = tabRegister ? tabRegister.classList.contains('active') : false;

      try {
        let endpoint = 'http://localhost:5000/api/auth/login';
        let payload = { email, password };

        if (isRegister) {
          endpoint = 'http://localhost:5000/api/auth/signup';
          payload = { email, name: name || email.split('@')[0], role: selectedRole, password };
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem('aura_token', data.token);
          localStorage.setItem('aura_user', JSON.stringify(data.user));
          
          if (typeof window.showToast === 'function') {
            window.showToast(isRegister ? 'Account registered successfully!' : 'Welcome back to AuraStay!', 'success');
          } else {
            alert(isRegister ? 'Account registered successfully!' : 'Welcome back to AuraStay!');
          }
          setTimeout(() => {
            window.location.href = `dashboard.html?role=${data.user.role}&email=${data.user.email}`;
          }, 500);
        } else {
          alert(data.error || 'Authentication failed');
        }
      } catch (err) {
        console.warn("API server offline, falling back to local simulation.", err);
        
        let localUsers = localStorage.getItem('aurastay_users');
        let usersList = localUsers ? JSON.parse(localUsers) : [
          { name: "Guest User", email: "guest@aurastay.com", role: "customer" },
          { name: "Agent Staff", email: "staff@aurastay.com", role: "staff" },
          { name: "Admin Manager", email: "admin@aurastay.com", role: "admin" }
        ];

        const lowerEmail = email.trim().toLowerCase();

        if (isRegister) {
          const displayName = name || email.split('@')[0];
          if (!usersList.some(u => u.email.toLowerCase() === lowerEmail)) {
            usersList.push({ name: displayName, email: email, role: selectedRole });
            localStorage.setItem('aurastay_users', JSON.stringify(usersList));
          }
          localStorage.setItem('aura_user', JSON.stringify({ name: displayName, email: email, role: selectedRole }));
          window.location.href = `dashboard.html?role=${selectedRole}&email=${email}`;
        } else {
          const existingUser = usersList.find(u => u.email.toLowerCase() === lowerEmail);
          if (!existingUser) {
            alert('Incorrect username or password');
            return;
          }
          localStorage.setItem('aura_user', JSON.stringify(existingUser));
          window.location.href = `dashboard.html?role=${existingUser.role}&email=${existingUser.email}`;
        }
      }
    });
  }

  const forgotBtn = document.getElementById('forgot-password-btn');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = prompt("Enter your registered email address to receive a password reset link:");
      if (!email) return;

      try {
        const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (response.ok) {
          alert(data.message || 'Password reset link sent!');
        } else {
          alert(data.error || 'Failed to dispatch reset link');
        }
      } catch (err) {
        console.warn("API offline. Simulating password reset link email.");
        alert(`Password reset link simulated and sent to ${email}!`);
      }
    });
  }
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
