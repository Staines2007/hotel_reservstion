/**
 * ==========================================================================
 * AURASTAY AI - CORE DASHBOARD WORKSPACE CONTROLLER
 * ==========================================================================
 */

// Local Databases mock variables (Fallback local syncs)
let ROOMS_DB = [
  { id: 1, name: "Premium Sea View Grand Deluxe", category: "deluxe", hotel: "Taj Mahal Palace, Mumbai", price: 24900, status: "available" },
  { id: 2, name: "Royal Club Studio Room 08", category: "standard", hotel: "The Leela Palace, New Delhi", price: 14900, status: "available" },
  { id: 3, name: "Wellness Penthouse Suite", category: "suite", hotel: "Wildflower Hall, Shimla", price: 37500, status: "available" },
  { id: 4, name: "Premier Lake View Pavilion", category: "suite", hotel: "The Oberoi Udaivilas, Udaipur", price: 45000, status: "available" },
  { id: 5, name: "Historical Royal Heritage Room", category: "deluxe", hotel: "Rambagh Palace, Jaipur", price: 38000, status: "available" },
  { id: 6, name: "Executive Towers Club Room", category: "standard", hotel: "ITC Grand Chola, Chennai", price: 12000, status: "available" },
  { id: 7, name: "Heritage Meandering Pool Villa", category: "suite", hotel: "Kumarakom Lake Resort, Kerala", price: 28000, status: "available" },
  { id: 8, name: "Luxury Lake View Royal Suite", category: "suite", hotel: "Taj Lake Palace, Udaipur", price: 55000, status: "available" },
  { id: 9, name: "Club Room Race Course Road", category: "deluxe", hotel: "Welcomhotel by ITC Hotels, Coimbatore", price: 7500, status: "available" },
  { id: 10, name: "Superior Room Avinashi Road", category: "standard", hotel: "Vivanta, Coimbatore", price: 8200, status: "available" },
  { id: 11, name: "Premium Business Suite", category: "suite", hotel: "Radisson Blu, Coimbatore", price: 11500, status: "available" },
  { id: 12, name: "Deluxe Heritage Suite", category: "deluxe", hotel: "The Residency Towers, Coimbatore", price: 9000, status: "available" }
];

let RESERVATIONS_DB = [];
let REVIEWS_DB = [];
let USERS_DB = [
  { name: "Guest User", email: "guest@aurastay.com", role: "customer" },
  { name: "Agent Staff", email: "staff@aurastay.com", role: "staff" },
  { name: "Admin Manager", email: "admin@aurastay.com", role: "admin" }
];

let currentSelectedRoom = null;
let dynamicPricingFactor = 1.10; // default 10% AI boost
let currentUserRole = 'customer';
let currentUserEmail = 'guest@aurastay.com';

let currentSensorySelection = {
  circadianPreset: 'sunset',
  circadianPresetColors: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  temp: 21.5,
  mattress: 5,
  acoustics: 'Silence Shield',
  scent: 'Vanilla & Sandalwood',
  lockSync: true
};

const API_BASE_URL = 'http://localhost:5000/api';

async function fetchAPIState() {
  const token = localStorage.getItem('aura_token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    // 1. Fetch Rooms
    const roomsRes = await fetch(`${API_BASE_URL}/rooms`);
    if (roomsRes.ok) {
      ROOMS_DB = await roomsRes.json();
    }

    // 2. Fetch Reservations
    if (token) {
      const resRes = await fetch(`${API_BASE_URL}/reservations`, { headers });
      if (resRes.ok) {
        const dbReservations = await resRes.json();
        RESERVATIONS_DB = dbReservations.map(res => {
          const room = ROOMS_DB.find(r => r.id === Number(res.room_id));
          return {
            id: Number(res.id),
            userEmail: res.user_email,
            userName: res.user_email ? res.user_email.split('@')[0] : 'Guest',
            roomId: Number(res.room_id),
            roomName: room ? room.name : `Room #${res.room_id}`,
            hotelLocation: room ? room.hotel : 'Unknown Resort',
            checkIn: res.check_in,
            checkOut: res.check_out,
            guests: res.guests,
            nights: res.nights,
            totalPrice: res.total_price,
            paymentStatus: res.payment_status,
            status: res.status,
            paymentOrderId: res.payment_order_id,
            sensoryProfile: res.sensory_profile || {}
          };
        });
      }
    }

    // 3. Fetch Reviews
    const reviewsRes = await fetch(`${API_BASE_URL}/reviews`);
    if (reviewsRes.ok) {
      REVIEWS_DB = await reviewsRes.json();
    }

    // 4. Fetch Users (if Admin)
    if (token && currentUserRole === 'admin') {
      const usersRes = await fetch(`${API_BASE_URL}/users`, { headers });
      if (usersRes.ok) {
        USERS_DB = await usersRes.json();
      }
    }

    // Cache online state locally for fallback consistency
    saveLocalState();

  } catch (err) {
    console.warn("⚠️ API server is offline. Using local simulation (localStorage) database fallback.", err);
  }
}

async function initDashboard() {
  loadLocalState();

  // Read URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  currentUserRole = urlParams.get('role') || 'customer';
  currentUserEmail = urlParams.get('email') || 'guest@aurastay.com';

  // Initialize features
  initThemeToggle();
  initSidebarNavigation();
  initDatesInput();
  initDashboardCursor();
  initLogoutHandler();
  initRoomFilters();
  initPaymentActions();
  initStaffActions();
  initAdminActions();
  loadAdminSettings();
  initAdminSettingsSave();

  // Initialize SVG pricing chart
  const pricingRange = document.getElementById('dynamic-pricing-range');
  if (pricingRange) {
    drawSparkline(pricingRange.value);
  }

  // Initialize Sensory modal
  initSensoryModal();

  // Route Views & Display Menu Items
  routeViews(currentUserRole, currentUserEmail);

  // Sync state from API
  await fetchAPIState();

  // Render lists & metrics
  renderCustomerRooms();
  renderCustomerBookings();
  renderStaffReservations();
  renderStaffInventory();
  renderAdminUsers();
  recalculateMetrics();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    initDashboard();
  });
} else {
  initDashboard();
}

// ==========================================================================
// THEME & CORE UTILS
// ==========================================================================
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

// ==========================================================================
// DB LOAD & SYNC
// ==========================================================================
function saveLocalState() {
  localStorage.setItem('aurastay_rooms', JSON.stringify(ROOMS_DB));
  localStorage.setItem('aurastay_reservations', JSON.stringify(RESERVATIONS_DB));
  localStorage.setItem('aurastay_reviews', JSON.stringify(REVIEWS_DB));
  localStorage.setItem('aurastay_users', JSON.stringify(USERS_DB));
}

function loadLocalState() {
  const rooms = localStorage.getItem('aurastay_rooms');
  const reservations = localStorage.getItem('aurastay_reservations');
  const reviews = localStorage.getItem('aurastay_reviews');
  const users = localStorage.getItem('aurastay_users');

  if (rooms) {
    const loadedRooms = JSON.parse(rooms);
    if (loadedRooms.length >= ROOMS_DB.length) {
      ROOMS_DB = loadedRooms;
    } else {
      localStorage.setItem('aurastay_rooms', JSON.stringify(ROOMS_DB));
    }
  }
  if (reservations) RESERVATIONS_DB = JSON.parse(reservations);
  if (reviews) REVIEWS_DB = JSON.parse(reviews);
  if (users) USERS_DB = JSON.parse(users);
}

function initDatesInput() {
  const checkIn = document.getElementById('stay-check-in');
  const checkOut = document.getElementById('stay-check-out');
  if (!checkIn || !checkOut) return;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  checkIn.min = formatDate(today);
  checkIn.value = formatDate(today);
  checkOut.min = formatDate(tomorrow);
  checkOut.value = formatDate(tomorrow);

  checkIn.addEventListener('change', () => {
    const selectedIn = new Date(checkIn.value);
    const minOut = new Date(selectedIn);
    minOut.setDate(minOut.getDate() + 1);
    checkOut.min = formatDate(minOut);
    if (new Date(checkOut.value) <= selectedIn) {
      checkOut.value = formatDate(minOut);
    }
  });
}

function formatDate(date) {
  const yyyy = date.getFullYear();
  let mm = date.getMonth() + 1;
  let dd = date.getDate();
  if (mm < 10) mm = `0${mm}`;
  if (dd < 10) dd = `0${dd}`;
  return `${yyyy}-${mm}-${dd}`;
}

// ==========================================================================
// VIEWS & SIDEBAR MANAGER
// ==========================================================================
function initSidebarNavigation() {
  const navLinks = document.querySelectorAll('#sidebar-menu a');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      const targetId = link.getAttribute('data-target');
      if (!targetId) return;

      switchView(targetId);
      
      // Update active class
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

function switchView(targetId) {
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.add('hide'));

  const activeSec = document.getElementById(targetId);
  if (activeSec) activeSec.classList.remove('hide');
}

function routeViews(role, email) {
  const roleTag = document.getElementById('dashboard-role-tag');
  const greeting = document.getElementById('dashboard-greeting-txt');

  // Hide all role nav items
  document.getElementById('side-nav-discover').classList.add('hide');
  document.getElementById('side-nav-ledger').classList.add('hide');
  document.getElementById('side-nav-staff-rooms').classList.add('hide');
  document.getElementById('side-nav-staff-bookings').classList.add('hide');
  document.getElementById('side-nav-admin-users').classList.add('hide');
  document.getElementById('side-nav-admin-ai').classList.add('hide');

  if (role === 'customer') {
    // Show Customer views
    document.getElementById('side-nav-discover').classList.remove('hide');
    document.getElementById('side-nav-ledger').classList.remove('hide');
    
    document.getElementById('side-nav-discover').classList.add('active');
    switchView('discover-view');

    if (roleTag) roleTag.textContent = 'GUEST PROFILE';
    if (greeting && email) {
      const storedUser = localStorage.getItem('aura_user') ? JSON.parse(localStorage.getItem('aura_user')) : null;
      const displayName = (storedUser && storedUser.name) ? storedUser.name : email.split('@')[0];
      greeting.textContent = `Welcome Back, ${displayName}`;
    }
  } else if (role === 'staff') {
    // Show Staff views
    document.getElementById('side-nav-staff-bookings').classList.remove('hide');
    document.getElementById('side-nav-staff-rooms').classList.remove('hide');
    
    document.getElementById('side-nav-staff-bookings').classList.add('active');
    switchView('staff-bookings-view');

    if (roleTag) roleTag.textContent = 'STAFF PORTAL';
    if (greeting) greeting.textContent = 'Operations Control Console';
  } else if (role === 'admin') {
    // Show Admin views
    document.getElementById('side-nav-admin-users').classList.remove('hide');
    document.getElementById('side-nav-admin-ai').classList.remove('hide');
    
    document.getElementById('side-nav-admin-users').classList.add('active');
    switchView('admin-users-view');

    if (roleTag) roleTag.textContent = 'SYSTEM CONSOLE';
    if (greeting) greeting.textContent = 'Administration Hub';
  }
}

function initLogoutHandler() {
  const logoutButtons = document.querySelectorAll('.logout-btn');
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = "index.html";
    });
  });

  // Profile update event listener (Profile Management)
  const editProfileBtn = document.getElementById('edit-profile-btn');
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', async () => {
      const currentUserName = currentUserEmail.split('@')[0];
      const newName = prompt("Enter your new profile name:", currentUserName);
      if (!newName || newName.trim() === '') return;

      const token = localStorage.getItem('aura_token');
      try {
        if (!token) throw new Error("Offline mode");
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: newName })
        });
        if (!response.ok) throw new Error("Failed to update user profile");

        window.showToast("Profile name updated in Supabase!", "success");
        await fetchAPIState();
        
        // Update header greeting text
        const greeting = document.getElementById('dashboard-greeting-txt');
        if (greeting) greeting.textContent = `Welcome Back, ${newName}`;
      } catch (err) {
        console.warn("API profile update failed, using local fallback.", err);
        window.showToast("Profile updated locally!", "success");
        const greeting = document.getElementById('dashboard-greeting-txt');
        if (greeting) greeting.textContent = `Welcome Back, ${newName}`;
      }
    });
  }
}

// ==========================================================================
// CUSTOMER SUITES RENDER (Discover Rooms)
// ==========================================================================
function initRoomFilters() {
  const form = document.getElementById('search-stays-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      renderCustomerRooms();
    });
  }

  const range = document.getElementById('price-range');
  const val = document.getElementById('price-val');
  if (range && val) {
    range.addEventListener('input', () => {
      val.textContent = `₹${range.value}`;
    });
  }
}

window.renderCustomerRooms = function() {
  const grid = document.getElementById('customer-rooms-grid');
  const countSpan = document.getElementById('rooms-count-span');
  if (!grid) return;

  const locVal = document.getElementById('search-location') ? document.getElementById('search-location').value.toLowerCase() : '';
  const typeVal = document.getElementById('stay-type') ? document.getElementById('stay-type').value : 'all';
  const priceMax = document.getElementById('price-range') ? parseInt(document.getElementById('price-range').value) : 100000;

  const filtered = ROOMS_DB.filter(room => {
    const matchesLoc = locVal === '' || room.hotel.toLowerCase().includes(locVal);
    const matchesType = typeVal === 'all' || room.category === typeVal;
    
    const price = getDynamicRate(room.price);
    const matchesPrice = price <= priceMax;
    const matchesAvail = room.status === 'available';

    return matchesLoc && matchesType && matchesPrice && matchesAvail;
  });

  countSpan.textContent = filtered.length;
  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="text-muted text-center mt-4">No suites match your search filters.</p>`;
    return;
  }

  filtered.forEach(room => {
    const rate = getDynamicRate(room.price);
    
    // Assign local generated image asset
    let imgPath = 'assets/room_standard.png';
    if (room.category === 'deluxe') imgPath = 'assets/room_deluxe.png';
    if (room.category === 'suite') imgPath = 'assets/room_suite.png';

    const card = document.createElement('div');
    card.className = 'room-card';
    card.innerHTML = `
      <div class="room-card-visual">
        <img src="${imgPath}" alt="${room.name}">
        <span class="img-lbl">${room.category.toUpperCase()}</span>
      </div>
      <div class="room-card-content">
        <div class="room-card-tags">
          <span class="badge badge-primary">${room.hotel}</span>
          <span class="badge badge-accent">★ 4.9</span>
        </div>
        <h4>${room.name}</h4>
        <p class="room-card-desc">Sleek visual layout featuring premium smart locking controls and circadian lighting sync.</p>
      </div>
      <div class="room-card-pricing">
        <div class="price">₹${rate}<span>/ night</span></div>
        <button class="btn btn-sm" onclick="triggerCheckout(${room.id})">Book Suite</button>
      </div>
    `;
    grid.appendChild(card);
  });
};

function getDynamicRate(basePrice) {
  const isEnabled = localStorage.getItem('aurastay_dyn_enabled') !== 'false';
  if (isEnabled) {
    return Math.round(basePrice * dynamicPricingFactor);
  }
  return basePrice;
}

function renderCustomerBookings() {
  const ledger = document.getElementById('customer-bookings-ledger');
  if (!ledger) return;

  const userBookings = RESERVATIONS_DB.filter(r => r.userEmail === currentUserEmail);
  if (userBookings.length === 0) {
    ledger.innerHTML = `<p class="text-muted">No reservations found. Start exploring Discover Rooms above!</p>`;
    return;
  }

  ledger.innerHTML = '';
  userBookings.forEach(res => {
    const card = document.createElement('div');
    card.className = 'booked-item-card';

    let statusClass = 'badge-primary';
    if (res.status === 'checked-in') statusClass = 'status confirmed';
    if (res.status === 'checked-out') statusClass = 'status cancelled';

    card.innerHTML = `
      <div class="booked-item-info">
        <h5>${res.roomName}</h5>
        <p>${res.hotelLocation} | ${res.checkIn} to ${res.checkOut} (${res.nights} Nights)</p>
        <span class="badge ${statusClass}">${res.status.toUpperCase()} (${res.paymentStatus.toUpperCase()})</span>
      </div>
      <div class="booked-card-actions">
        <button class="btn secondary btn-sm" onclick="triggerInvoice(${res.id})"><i class="fa-solid fa-file-invoice" style="margin-right:0.25rem;"></i> Invoice</button>
        ${res.status === 'paid' ? `
          <button class="btn btn-sm secondary" onclick="modifyReservation(${res.id})"><i class="fa-solid fa-calendar-days"></i> Modify</button>
          <button class="btn btn-sm text-danger secondary" onclick="cancelReservation(${res.id})">Cancel</button>
        ` : ''}
        ${res.status === 'checked-out' ? `<button class="btn btn-sm" onclick="promptReview(${res.id})">Write Review</button>` : ''}
      </div>
    `;
    ledger.appendChild(card);
  });
}

// ==========================================================================
// PAYMENTS & INVOICES
// ==========================================================================

function showPMSSyncConsole(hotelName, sensoryData, callback) {
  const consoleWrapper = document.getElementById('checkout-step-console-wrapper');
  const actionsDiv = document.getElementById('checkout-step-actions');

  if (!consoleWrapper) return callback();

  // Hide action buttons during sync
  if (actionsDiv) actionsDiv.style.display = 'none';
  
  // Show console wrapper
  consoleWrapper.classList.remove('hide');
  consoleWrapper.innerHTML = `
    <div class="pms-sync-console" style="background: rgba(0,0,0,0.3); border: 1px solid var(--line); border-radius: 12px; padding: 1.25rem; font-family: monospace; font-size: 0.82rem; line-height: 1.6; color: #a5f3fc; max-height: 250px; overflow-y: auto; text-align: left;">
      <div id="pms-log-container"></div>
      <div id="pms-loader-row" style="display: flex; align-items: center; gap: 8px; margin-top: 10px; color: var(--brand-teal);">
        <i class="fa-solid fa-spinner fa-spin"></i> <span style="font-style: italic;">Transmitting parameters...</span>
      </div>
    </div>
  `;

  const logContainer = document.getElementById('pms-log-container');
  
  const logs = [
    { text: `📡 Connecting to ${hotelName} PMS gateway...`, delay: 300 },
    { text: `🔑 Handshaking security credentials... SUCCESS`, delay: 600 },
    { text: `💾 Injecting guest details & room reservation parameters... SUCCESS`, delay: 900 },
    { text: `💨 IoT trigger: Dispensing ${sensoryData.scent.toUpperCase()} scent profile (diffuser)... ACTIVE`, delay: 1200 },
    { text: `🌡️ IoT climate command: Cooling ambient temperature to ${sensoryData.temp}°C... SET`, delay: 1500 },
    { text: `🛏️ IoT orthopedic stiffness index: Aligning mattress comfort index to Level ${sensoryData.mattress}... ADJUSTED`, delay: 1800 },
    { text: `🔇 IoT acoustics command: Sound shield configured to: ${sensoryData.acoustics}... ARMED`, delay: 2100 },
    { text: `🔓 Smart Lock: Syncing digital mobile key to guest account... PROVISIONED`, delay: 2400 },
    { text: `🎉 Automated check-in setup complete! PMS synchronized successfully.`, delay: 2700 }
  ];

  logs.forEach((log) => {
    setTimeout(() => {
      const row = document.createElement('div');
      row.style.marginBottom = '6px';
      if (log.text.includes('SUCCESS') || log.text.includes('ACTIVE') || log.text.includes('SET') || log.text.includes('ADJUSTED') || log.text.includes('ARMED') || log.text.includes('PROVISIONED') || log.text.includes('complete!')) {
        row.innerHTML = `<span style="color: #4ade80;">✔</span> ${log.text}`;
      } else {
        row.innerHTML = `<span style="color: var(--brand-teal);">⚡</span> ${log.text}`;
      }
      if (logContainer) {
        logContainer.appendChild(row);
        logContainer.scrollTop = logContainer.scrollHeight;
      }

      if (log.delay === 2700) {
        // Last log, remove loader
        const loader = document.getElementById('pms-loader-row');
        if (loader) loader.style.display = 'none';
        
        setTimeout(() => {
          // Reset styling for next time
          if (actionsDiv) actionsDiv.style.display = 'flex';
          consoleWrapper.classList.add('hide');
          callback();
        }, 800);
      }
    }, log.delay);
  });
}

function initPaymentActions() {
  const confirmPaymentBtn = document.getElementById('step-confirm-payment-btn');

  if (confirmPaymentBtn) {
    confirmPaymentBtn.addEventListener('click', async () => {
      if (!currentSelectedRoom) return;

      const checkInVal = document.getElementById('stay-check-in').value;
      const checkOutVal = document.getElementById('stay-check-out').value;
      const guests = document.getElementById('stay-guests').value;

      const dIn = new Date(checkInVal);
      const dOut = new Date(checkOutVal);
      const diffTime = Math.abs(dOut - dIn);
      const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const rate = getDynamicRate(currentSelectedRoom.price);
      const total = rate * nights;

      const token = localStorage.getItem('aura_token');

      // 1. Fetch Razorpay Order from Backend
      let orderData = { realOrder: false };
      try {
        if (token) {
          const orderRes = await fetch(`${API_BASE_URL}/payments/order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ roomId: currentSelectedRoom.id, nights })
          });
          if (orderRes.ok) {
            orderData = await orderRes.json();
          }
        }
      } catch (err) {
        console.warn("Could not create Razorpay order on backend, using simulation mode.", err);
      }

      const executePostPaymentFlow = (razorpayPaymentId = '', razorpayOrderId = '', razorpaySignature = '') => {
        showPMSSyncConsole(currentSelectedRoom.hotel, currentSensorySelection, async () => {
          const token = localStorage.getItem('aura_token');

          // Create payload matching database
          const payload = {
            roomId: currentSelectedRoom.id,
            checkIn: checkInVal,
            checkOut: checkOutVal,
            guests: parseInt(guests),
            nights: nights,
            totalPrice: total,
            sensoryProfile: { ...currentSensorySelection },
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySignature
          };

          try {
            if (!token) throw new Error("Offline mode or not authenticated");

            const response = await fetch(`${API_BASE_URL}/reservations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || 'Failed to complete booking');
            }

            // Successfully created in DB, let's sync locally
            await fetchAPIState();
            window.showToast("Payment success & smart key generated in database!", "success");
            switchView('discover-view');
            currentSelectedRoom = null;

            renderCustomerRooms();
            renderCustomerBookings();
            renderStaffReservations();
            renderStaffInventory();
            recalculateMetrics();

            setTimeout(() => {
              triggerInvoice(data.id);
            }, 300);

          } catch (err) {
            console.warn("API booking failed, using local fallback.", err);
            // Fallback local logic
            const res = {
              id: Date.now(),
              userEmail: currentUserEmail,
              userName: currentUserEmail.split('@')[0],
              roomId: currentSelectedRoom.id,
              roomName: currentSelectedRoom.name,
              hotelLocation: currentSelectedRoom.hotel,
              checkIn: checkInVal,
              checkOut: checkOutVal,
              guests: guests,
              nights: nights,
              totalPrice: total,
              paymentStatus: "paid",
              status: "paid",
              paymentOrderId: razorpayPaymentId || `pay_${Math.random().toString(36).substring(2, 11)}`,
              sensoryProfile: { ...currentSensorySelection }
            };

            currentSelectedRoom.status = 'occupied';
            RESERVATIONS_DB.push(res);
            saveLocalState();

            switchView('discover-view');
            const selectedId = res.id;
            currentSelectedRoom = null;

            renderCustomerRooms();
            renderCustomerBookings();
            renderStaffReservations();
            renderStaffInventory();
            recalculateMetrics();

            window.showToast("Payment success & smart key generated! (Local)", "success");

            setTimeout(() => {
              triggerInvoice(selectedId);
            }, 300);
          }
        });
      };

      if (orderData.realOrder && window.Razorpay) {
        // Initialize Real Razorpay Checkout integration
        const rzpOptions = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "AuraStay AI Portal",
          description: `Booking ${orderData.roomName} - ${orderData.hotelLocation}`,
          order_id: orderData.orderId,
          handler: function (response) {
            executePostPaymentFlow(
              response.razorpay_payment_id,
              response.razorpay_order_id,
              response.razorpay_signature
            );
          },
          modal: {
            ondismiss: function () {
              window.showToast("Payment interface closed.", "info");
            }
          },
          prefill: {
            email: currentUserEmail
          },
          theme: {
            color: "#14b8a6"
          }
        };
        const rzp = new Razorpay(rzpOptions);
        rzp.open();
      } else {
        // Local simulation fallback
        executePostPaymentFlow();
      }
    });
  }
}

window.cancelCheckoutStep = function() {
  switchView('sensory-step-view');
};

window.triggerCheckout = function(roomId) {
  const room = ROOMS_DB.find(r => r.id === roomId);
  if (!room) return;

  const checkInVal = document.getElementById('stay-check-in').value;
  const checkOutVal = document.getElementById('stay-check-out').value;
  const alertBox = document.getElementById('booking-alert-box');
  const alertMsg = document.getElementById('booking-alert-msg');

  if (!checkInVal || !checkOutVal) {
    alertMsg.textContent = "Please select check-in and check-out dates.";
    alertBox.classList.remove('hide');
    window.showToast("Please enter check-in/out dates", "error");
    return;
  }

  const dIn = new Date(checkInVal);
  const dOut = new Date(checkOutVal);
  if (dOut <= dIn) {
    alertMsg.textContent = "Checkout must be after check-in.";
    alertBox.classList.remove('hide');
    window.showToast("Checkout must be after check-in", "error");
    return;
  }

  alertBox.classList.add('hide');
  currentSelectedRoom = room;

  // Load details into the dedicated sensory wizard view
  const nameEl = document.getElementById('sensory-step-room-name');
  const hotelEl = document.getElementById('sensory-step-hotel-name');
  const priceEl = document.getElementById('sensory-step-price');

  if (nameEl) nameEl.textContent = room.name;
  if (hotelEl) hotelEl.textContent = room.hotel;
  
  const dynamicRate = getDynamicRate(room.price);
  if (priceEl) priceEl.textContent = `₹${dynamicRate}/night`;

  // Transition to the sensory tuning wizard view page
  switchView('sensory-step-view');
  window.showToast("Booking step 2: Customise your sensory preference profiles", "info");
};

window.cancelSensoryStep = function() {
  currentSelectedRoom = null;
  switchView('discover-view');
};

window.confirmSensoryStep = function() {
  if (!currentSelectedRoom) return;

  // Collect sensory configurations from wizard view
  const scent = document.getElementById('step-sensory-scent').value;
  const temp = parseFloat(document.getElementById('step-sensory-temp').value);
  const mattress = parseInt(document.getElementById('step-sensory-mattress').value);
  const acoustics = document.getElementById('step-sensory-acoustics').value;
  const lockSync = document.getElementById('step-sensory-lock-sync').checked;

  currentSensorySelection.scent = scent;
  currentSensorySelection.temp = temp;
  currentSensorySelection.mattress = mattress;
  currentSensorySelection.acoustics = acoustics;
  currentSensorySelection.lockSync = lockSync;

  window.showToast("Sensory presets aligned! Opening checkout payments...", "success");

  // Open checkout details payments card
  openCheckoutDetails();
};

function openCheckoutDetails() {
  if (!currentSelectedRoom) return;

  const checkInVal = document.getElementById('stay-check-in').value;
  const checkOutVal = document.getElementById('stay-check-out').value;
  const dIn = new Date(checkInVal);
  const dOut = new Date(checkOutVal);
  const diffTime = Math.abs(dOut - dIn);
  const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const rate = getDynamicRate(currentSelectedRoom.price);
  const total = rate * nights;

  const body = document.getElementById('step-checkout-summary-body');
  if (body) {
    body.innerHTML = `
      <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--line);">
        <span style="color: var(--muted);">Room:</span>
        <span class="font-semibold text-accent" style="color: var(--brand-teal); font-weight: 600;">${currentSelectedRoom.name}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--line);">
        <span style="color: var(--muted);">Stay Period:</span>
        <span style="font-weight: 500;">${checkInVal} to ${checkOutVal} (${nights} Nights)</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--line);">
        <span style="color: var(--muted);">Sensory Configuration:</span>
        <span style="font-size: 0.82rem; color: var(--text); text-align: right; line-height: 1.5;">
          <b>Scent:</b> ${currentSensorySelection.scent}<br>
          <b>Climate:</b> ${currentSensorySelection.temp}°C | <b>Mattress stiffness:</b> Level ${currentSensorySelection.mattress}<br>
          <b>Acoustics:</b> ${currentSensorySelection.acoustics}
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 1.25rem 0 0.5rem 0; font-size: 1.15rem; font-weight: 700;">
        <span>Secure Total Pay:</span>
        <span class="text-gradient" style="font-weight: 800; font-size: 1.45rem; color: var(--brand-teal); background: linear-gradient(135deg, var(--brand-teal), #0ea5e9); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">₹${total.toLocaleString('en-IN')}.00</span>
      </div>
    `;
  }

  switchView('checkout-step-view');
}

window.triggerInvoice = function(resId) {
  const res = RESERVATIONS_DB.find(r => String(r.id) === String(resId));
  if (!res) {
    console.warn("⚠️ Invoice request failed: Reservation not found for ID:", resId);
    window.showToast("Invoice not found in reservation list.", "error");
    return;
  }

  const body = document.getElementById('invoice-step-body');
  if (body) {
    const transactionDate = res.id > 1000000000000 ? new Date(Number(res.id)) : new Date();
    body.innerHTML = `
============================================================
                    AURASTAY AI SYSTEMS                     
                 INTELLIGENT HOTEL RECEIPT                  
============================================================
Transaction ID:  ${(res.paymentOrderId || 'pay_simulated_gateway_key').toUpperCase()}
Timestamp:       ${transactionDate.toLocaleString()}
Customer Email:  ${res.userEmail || 'guest@aurastay.com'}
Customer Name:   ${res.userName || 'Guest User'}

------------------------------------------------------------
Stay Details:
------------------------------------------------------------
Hotel Room:      ${res.roomName || 'Premium Room'}
Location:        ${res.hotelLocation || 'India Resort'}
Check In:        ${res.checkIn || 'N/A'}
Check Out:       ${res.checkOut || 'N/A'}
Total Duration:  ${res.nights || 1} Night(s)

------------------------------------------------------------
Billing Breakdown:
------------------------------------------------------------
Net Stay cost:   ₹${(res.totalPrice || 0).toLocaleString('en-IN')}.00
Tax / Platform:  ₹0.00 (Flat Tariff rule)
Final Paid:      ₹${(res.totalPrice || 0).toLocaleString('en-IN')}.00

Payment Gateway: Razorpay Secure Verification
Payment Status:  SUCCESS / VERIFIED
Smart Lock:      ACTIVATE v1.4 SYNCED
============================================================
    `;
  }

  switchView('invoice-step-view');
};

window.closeInvoiceStep = function() {
  const activeLink = document.querySelector('#sidebar-menu a.active');
  if (activeLink) {
    const target = activeLink.getAttribute('data-target');
    switchView(target);
  } else {
    switchView('discover-view');
  }
};

window.cancelReservation = async function(id) {
  const token = localStorage.getItem('aura_token');
  try {
    if (!token) throw new Error("Offline mode");
    const response = await fetch(`${API_BASE_URL}/reservations/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to cancel booking');
    }
    window.showToast("Reservation cancelled in Supabase!", "success");
    await fetchAPIState();
  } catch (err) {
    console.warn("API cancel failed, using local simulation.", err);
    const index = RESERVATIONS_DB.findIndex(r => r.id === id);
    if (index !== -1) {
      const res = RESERVATIONS_DB[index];
      const room = ROOMS_DB.find(r => r.id === res.roomId);
      if (room) room.status = 'available';

      RESERVATIONS_DB.splice(index, 1);
      saveLocalState();
    }
  }
  renderCustomerRooms();
  renderCustomerBookings();
  renderStaffReservations();
  renderStaffInventory();
};

window.modifyReservation = async function(id) {
  const res = RESERVATIONS_DB.find(r => r.id === id);
  if (!res) return;

  const newCheckIn = prompt("Enter new Check-In Date (YYYY-MM-DD):", res.checkIn);
  if (!newCheckIn) return;
  const newCheckOut = prompt("Enter new Check-Out Date (YYYY-MM-DD):", res.checkOut);
  if (!newCheckOut) return;

  const dIn = new Date(newCheckIn);
  const dOut = new Date(newCheckOut);
  if (isNaN(dIn) || isNaN(dOut) || dOut <= dIn) {
    alert("Invalid check-in/out dates selected.");
    return;
  }

  const diffTime = Math.abs(dOut - dIn);
  const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  
  const room = ROOMS_DB.find(r => r.id === res.room_id || r.id === res.roomId);
  const basePrice = room ? room.price : 15000;
  const rate = getDynamicRate(basePrice);
  const totalPrice = rate * nights;

  const token = localStorage.getItem('aura_token');
  try {
    if (!token) throw new Error("Offline mode");
    const response = await fetch(`${API_BASE_URL}/reservations/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        guests: res.guests,
        nights,
        totalPrice
      })
    });

    if (!response.ok) throw new Error("Failed to modify booking details");

    window.showToast("Booking modified in Supabase! Confirmation email sent.", "success");
    await fetchAPIState();
  } catch (err) {
    console.warn("API modification failed, using local simulation.", err);
    res.checkIn = newCheckIn;
    res.checkOut = newCheckOut;
    res.nights = nights;
    res.totalPrice = totalPrice;
    saveLocalState();
    window.showToast("Booking modified locally!", "success");
  }

  renderCustomerBookings();
  recalculateMetrics();
};

window.promptReview = async function(id) {
  const res = RESERVATIONS_DB.find(r => r.id === id);
  if (!res) return;

  const comment = prompt("Enter hotel review comment:");
  const rating = parseFloat(prompt("Enter star rating (1 to 5):", "5"));

  if (comment && rating) {
    const token = localStorage.getItem('aura_token');
    try {
      if (!token) throw new Error("Offline mode");
      const response = await fetch(`${API_BASE_URL}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hotelName: res.hotelLocation || 'Taj Mahal Palace, Mumbai',
          comment,
          rating
        })
      });
      if (!response.ok) throw new Error("Failed to post review");
      
      window.showToast("Review submitted to Supabase!", "success");
      await fetchAPIState();
    } catch (err) {
      console.warn("API review submit failed, using local simulation.", err);
      REVIEWS_DB.push({
        id: Date.now(),
        userEmail: currentUserEmail,
        hotelName: res.hotelLocation || 'Taj Mahal Palace, Mumbai',
        comment,
        rating
      });
      saveLocalState();
    }
    renderCustomerBookings();
  }
};

function initStaffActions() {
  const form = document.getElementById('staff-room-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const editId = document.getElementById('staff-room-id').value;
      const name = document.getElementById('room-name-input').value;
      const category = document.getElementById('room-category-select').value;
      const price = parseInt(document.getElementById('room-price-input').value);
      const hotel = document.getElementById('room-hotel-input').value;
      const status = document.getElementById('room-status-select').value;

      const token = localStorage.getItem('aura_token');

      try {
        if (!token) throw new Error("Offline mode");
        
        let response;
        if (editId) {
          response = await fetch(`${API_BASE_URL}/rooms/${editId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, category, price, hotel, status })
          });
        } else {
          response = await fetch(`${API_BASE_URL}/rooms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, category, price, hotel, status })
          });
        }

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to save room details');
        }

        window.showToast(editId ? "Room updated in Supabase!" : "Room created in Supabase!", "success");
        await fetchAPIState();

        // Reset form controls
        if (editId) {
          document.getElementById('staff-form-title').textContent = 'Add Room Inventory';
          document.getElementById('staff-room-submit-btn').textContent = 'Add Room';
          document.getElementById('staff-cancel-edit-btn').classList.add('hide');
        }

      } catch (err) {
        console.warn("API staff CRUD action failed, using local simulation.", err);
        // Fallback local logic
        if (editId) {
          const room = ROOMS_DB.find(r => r.id === parseInt(editId));
          if (room) {
            room.name = name;
            room.category = category;
            room.price = price;
            room.hotel = hotel;
            room.status = status;
          }
          document.getElementById('staff-form-title').textContent = 'Add Room Inventory';
          document.getElementById('staff-room-submit-btn').textContent = 'Add Room';
          document.getElementById('staff-cancel-edit-btn').classList.add('hide');
        } else {
          ROOMS_DB.push({
            id: Date.now(),
            name, category, price, hotel, status
          });
        }
        saveLocalState();
      }

      form.reset();
      document.getElementById('staff-room-id').value = '';

      renderCustomerRooms();
      renderStaffReservations();
      renderStaffInventory();
      recalculateMetrics();
    });

    document.getElementById('staff-cancel-edit-btn').addEventListener('click', () => {
      form.reset();
      document.getElementById('staff-room-id').value = '';
      document.getElementById('staff-form-title').textContent = 'Add Room Inventory';
      document.getElementById('staff-room-submit-btn').textContent = 'Add Room';
      document.getElementById('staff-cancel-edit-btn').classList.add('hide');
    });
  }
}

function renderStaffReservations() {
  const tbody = document.getElementById('staff-reservations-list');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (RESERVATIONS_DB.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No reservations booked.</td></tr>`;
    return;
  }

  RESERVATIONS_DB.forEach(res => {
    const tr = document.createElement('tr');
    
    let btnHtml = '';
    if (res.status === 'paid') {
      btnHtml = `<button class="btn btn-sm" onclick="toggleCheckIn(${res.id}, 'checked-in')">Check In</button>`;
    } else if (res.status === 'checked-in') {
      btnHtml = `<button class="btn btn-outline btn-sm text-gold" onclick="toggleCheckIn(${res.id}, 'checked-out')">Check Out</button>`;
    } else {
      btnHtml = `<span class="text-muted">Settled</span>`;
    }

    tr.innerHTML = `
      <td><b>${res.userName}</b></td>
      <td>${res.roomName}<br><span class="text-xs text-muted">${res.hotelLocation}</span></td>
      <td>${res.checkIn} to ${res.checkOut}</td>
      <td><span class="badge ${res.status === 'checked-in' ? 'badge-primary' : 'badge-accent'}">${res.status.toUpperCase()}</span></td>
      <td>${btnHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderStaffInventory() {
  const tbody = document.getElementById('staff-inventory-list');
  if (!tbody) return;

  tbody.innerHTML = '';
  ROOMS_DB.forEach(room => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${room.name}</b><br><span class="text-xs text-muted">${room.hotel}</span></td>
      <td><span class="badge badge-accent">${room.category.toUpperCase()}</span></td>
      <td><b>₹${room.price}</b></td>
      <td><span class="badge ${room.status === 'available' ? 'badge-primary' : 'badge-accent'}">${room.status.toUpperCase()}</span></td>
      <td>
        <button class="btn secondary btn-sm" onclick="editRoom(${room.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn secondary btn-sm text-danger" onclick="deleteRoom(${room.id})"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.editRoom = function(id) {
  const room = ROOMS_DB.find(r => r.id === id);
  if (!room) return;

  document.getElementById('staff-room-id').value = room.id;
  document.getElementById('room-name-input').value = room.name;
  document.getElementById('room-category-select').value = room.category;
  document.getElementById('room-price-input').value = room.price;
  document.getElementById('room-hotel-input').value = room.hotel;
  document.getElementById('room-status-select').value = room.status;

  document.getElementById('staff-form-title').textContent = 'Edit Room Inventory';
  document.getElementById('staff-room-submit-btn').textContent = 'Save Changes';
  document.getElementById('staff-cancel-edit-btn').classList.remove('hide');
};

window.deleteRoom = async function(id) {
  if (confirm("Are you sure you want to delete this room from the database?")) {
    const token = localStorage.getItem('aura_token');
    try {
      if (!token) throw new Error("Offline mode");
      const response = await fetch(`${API_BASE_URL}/rooms/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to delete room");
      
      window.showToast("Room deleted in Supabase!", "success");
      await fetchAPIState();
    } catch (err) {
      console.warn("API room deletion failed, using local simulation.", err);
      ROOMS_DB = ROOMS_DB.filter(r => r.id !== id);
      saveLocalState();
    }
    renderCustomerRooms();
    renderStaffInventory();
    recalculateMetrics();
  }
};

window.toggleCheckIn = async function(resId, nextStatus) {
  const token = localStorage.getItem('aura_token');
  try {
    if (!token) throw new Error("Offline mode");
    const response = await fetch(`${API_BASE_URL}/reservations/${resId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ nextStatus })
    });
    if (!response.ok) throw new Error("Failed to update check-in status");
    
    window.showToast(`Guest status updated to ${nextStatus.toUpperCase()}!`, "success");
    await fetchAPIState();
  } catch (err) {
    console.warn("API check-in status change failed, using local simulation.", err);
    const res = RESERVATIONS_DB.find(r => r.id === resId);
    if (res) {
      res.status = nextStatus;
      const room = ROOMS_DB.find(r => r.id === res.roomId);
      if (room) {
        if (nextStatus === 'checked-out') room.status = 'available';
        else room.status = 'occupied';
      }
      saveLocalState();
    }
  }
  renderStaffReservations();
  renderStaffInventory();
  renderCustomerBookings();
  renderCustomerRooms();
  recalculateMetrics();
};

// ==========================================================================
// ADMIN CONFIGURATIONS (System Admin Dashboard)
// ==========================================================================
async function saveSetting(key, value) {
  const token = localStorage.getItem('aura_token');
  try {
    if (!token) throw new Error("Offline mode");
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ key, value: String(value) })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to update setting');
    }
    console.log(`Setting ${key} saved to backend.`);
  } catch (err) {
    console.warn(`API settings update failed for ${key}, saved locally.`, err);
  }
}

function initAdminActions() {
  const range = document.getElementById('dynamic-pricing-range');
  const val = document.getElementById('dynamic-pricing-val');
  const toggle = document.getElementById('toggle-dynamic-pricing');

  if (range && val) {
    range.addEventListener('input', () => {
      val.textContent = `+${range.value}%`;
      dynamicPricingFactor = 1 + (range.value / 100);
      
      const factorText = document.getElementById('staff-pricing-factor-txt');
      if (factorText) factorText.textContent = `+${range.value}%`;

      // Draw the glowing sparkline dynamic curve
      drawSparkline(range.value);

      renderCustomerRooms();
    });

    range.addEventListener('change', async () => {
      const factorVal = (1 + (range.value / 100)).toFixed(2);
      localStorage.setItem('aurastay_dyn_factor', factorVal);
      await saveSetting('dynamic_pricing_factor', factorVal);
    });
  }

  if (toggle) {
    toggle.addEventListener('click', async () => {
      let isEnabled = 'true';
      if (toggle.textContent === 'ENABLED') {
        toggle.textContent = 'DISABLED';
        toggle.style.background = 'rgba(255, 255, 255, 0.08)';
        window.showToast('AI Dynamic Pricing disabled', 'info');
        isEnabled = 'false';
      } else {
        toggle.textContent = 'ENABLED';
        toggle.style.background = ''; // reset to default gradient
        window.showToast('AI Dynamic Pricing enabled', 'success');
        isEnabled = 'true';
      }
      localStorage.setItem('aurastay_dyn_enabled', isEnabled);
      await saveSetting('dynamic_pricing_enabled', isEnabled);
      renderCustomerRooms();
    });
  }
}

// Fetch settings from API or local storage fallback
async function loadAdminSettings() {
  const priceInput = document.getElementById('admin-subscription-price');
  const range = document.getElementById('dynamic-pricing-range');
  const val = document.getElementById('dynamic-pricing-val');
  const toggle = document.getElementById('toggle-dynamic-pricing');
  const factorText = document.getElementById('staff-pricing-factor-txt');

  let price = localStorage.getItem('aurastay_sub_price') || '3000';
  let dynEnabled = localStorage.getItem('aurastay_dyn_enabled') || 'true';
  let dynFactor = localStorage.getItem('aurastay_dyn_factor') || '1.10';

  if (priceInput) priceInput.value = price;
  
  if (range) {
    const percent = Math.round((parseFloat(dynFactor) - 1) * 100);
    range.value = percent;
    if (val) val.textContent = `+${percent}%`;
    if (factorText) factorText.textContent = `+${percent}%`;
    drawSparkline(percent);
  }
  if (toggle) {
    if (dynEnabled === 'true') {
      toggle.textContent = 'ENABLED';
      toggle.style.background = '';
    } else {
      toggle.textContent = 'DISABLED';
      toggle.style.background = 'rgba(255, 255, 255, 0.08)';
    }
  }

  dynamicPricingFactor = parseFloat(dynFactor);

  try {
    const res = await fetch(`${API_BASE_URL}/settings`);
    if (res.ok) {
      const settings = await res.json();
      if (settings) {
        if (settings.subscription_price) {
          price = settings.subscription_price;
          localStorage.setItem('aurastay_sub_price', price);
          if (priceInput) priceInput.value = price;
        }
        if (settings.dynamic_pricing_enabled !== undefined) {
          dynEnabled = settings.dynamic_pricing_enabled;
          localStorage.setItem('aurastay_dyn_enabled', dynEnabled);
          if (toggle) {
            if (dynEnabled === 'true') {
              toggle.textContent = 'ENABLED';
              toggle.style.background = '';
            } else {
              toggle.textContent = 'DISABLED';
              toggle.style.background = 'rgba(255, 255, 255, 0.08)';
            }
          }
        }
        if (settings.dynamic_pricing_factor !== undefined) {
          dynFactor = settings.dynamic_pricing_factor;
          localStorage.setItem('aurastay_dyn_factor', dynFactor);
          dynamicPricingFactor = parseFloat(dynFactor);
          if (range) {
            const percent = Math.round((parseFloat(dynFactor) - 1) * 100);
            range.value = percent;
            if (val) val.textContent = `+${percent}%`;
            if (factorText) factorText.textContent = `+${percent}%`;
            drawSparkline(percent);
          }
        }
        renderCustomerRooms();
      }
    }
  } catch (err) {
    console.warn("API settings fetch failed, using local settings cache.", err);
  }
}

function initAdminSettingsSave() {
  const saveBtn = document.getElementById('save-subscription-price-btn');
  const priceInput = document.getElementById('admin-subscription-price');
  if (!saveBtn || !priceInput) return;

  saveBtn.addEventListener('click', async () => {
    const newPrice = priceInput.value.trim();
    if (!newPrice || isNaN(newPrice) || parseInt(newPrice) < 0) {
      window.showToast("Please enter a valid subscription price.", "error");
      return;
    }

    localStorage.setItem('aurastay_sub_price', newPrice);
    await saveSetting('subscription_price', newPrice);
    window.showToast("Subscription price saved!", "success");
  });
}

function renderAdminUsers() {
  const tbody = document.getElementById('admin-users-list');
  if (!tbody) return;

  tbody.innerHTML = '';
  USERS_DB.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${u.name}</b></td>
      <td>${u.email}</td>
      <td><span class="badge badge-accent">${u.role.toUpperCase()}</span></td>
      <td>
        <select class="form-control" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; width: 140px; min-height: 32px;" onchange="updateRole('${u.email}', this.value)">
          <option value="customer" ${u.role === 'customer' ? 'selected' : ''}>Customer</option>
          <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.updateRole = async function(email, role) {
  const token = localStorage.getItem('aura_token');
  try {
    if (!token) throw new Error("Offline mode");
    const response = await fetch(`${API_BASE_URL}/users/${email}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role })
    });
    if (!response.ok) throw new Error("Failed to update user role");

    window.showToast("User role updated in Supabase!", "success");
    await fetchAPIState();

    if (currentUserEmail === email) {
      currentUserRole = role;
      routeViews(role, email);
    }
  } catch (err) {
    console.warn("API role update failed, using local simulation.", err);
    const user = USERS_DB.find(u => u.email === email);
    if (user) {
      user.role = role;
      saveLocalState();
      
      if (currentUserEmail === email) {
        currentUserRole = role;
        routeViews(role, email);
      }
    }
  }
  renderAdminUsers();
  recalculateMetrics();
};

function recalculateMetrics() {
  // Staff capacity
  const checkedIn = RESERVATIONS_DB.filter(r => r.status === 'checked-in').length;
  const pct = ROOMS_DB.length > 0 ? Math.round((checkedIn / ROOMS_DB.length) * 100) : 0;
  
  const capVal = document.getElementById('staff-occupancy-txt');
  const capSub = document.getElementById('staff-occupancy-sub');
  if (capVal) capVal.textContent = `${pct}%`;
  if (capSub) capSub.textContent = `${checkedIn} of ${ROOMS_DB.length} rooms checked-in`;

  // Admin stats
  const rev = RESERVATIONS_DB.reduce((sum, r) => sum + r.totalPrice, 0);
  const revVal = document.getElementById('admin-revenue-txt');
  const usersVal = document.getElementById('admin-users-txt');
  const bookingsVal = document.getElementById('admin-bookings-txt');

  if (revVal) revVal.textContent = `₹${rev.toLocaleString()}.00`;
  if (usersVal) usersVal.textContent = USERS_DB.length;
  if (bookingsVal) bookingsVal.textContent = RESERVATIONS_DB.length;

  // AI recommendations
  const recommender = document.getElementById('ai-recommender-insight-txt');
  if (recommender) {
    if (RESERVATIONS_DB.length > 0) {
      recommender.innerHTML = `🌟 <b>AI Recommendation Profile:</b> High demand detected. Standard/Suite rooms are matching your circadian profiles.`;
    } else {
      recommender.textContent = `Select dates to receive automated preference matching profiles based on seasonal demand.`;
    }
  }
}

// ==========================================================================
// CURSOR MATH
// ==========================================================================
function initDashboardCursor() {
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

// Glassmorphic Toast Notification Engine
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-xmark';

  toast.innerHTML = `
    <i class="fa-solid ${icon} toast-icon"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Automatically clean up toast after animation completes
  setTimeout(() => {
    toast.remove();
  }, 4000);
};

// Smart Sensory Tuning Modal Initializer
function initSensoryModal() {
  // Temperature slider change
  const tempInput = document.getElementById('step-sensory-temp');
  const tempLabel = document.getElementById('step-temp-val-lbl');
  if (tempInput && tempLabel) {
    tempInput.addEventListener('input', () => {
      const val = parseFloat(tempInput.value);
      currentSensorySelection.temp = val;
      
      let label = 'Cool Breeze';
      if (val < 20) label = 'Crisp Arctic';
      else if (val > 23) label = 'Cozy Hearth';

      tempLabel.textContent = `${val.toFixed(1)}°C (${label})`;
    });
  }

  // Mattress slider change
  const mattressInput = document.getElementById('step-sensory-mattress');
  const mattressLabel = document.getElementById('step-mattress-val-lbl');
  if (mattressInput && mattressLabel) {
    mattressInput.addEventListener('input', () => {
      const val = parseInt(mattressInput.value);
      currentSensorySelection.mattress = val;

      let comfort = 'Medium';
      if (val <= 3) comfort = 'Plush Cloud';
      else if (val >= 8) comfort = 'Orthopedic Support';

      mattressLabel.textContent = `${comfort} (Level ${val})`;
    });
  }
}

// Glowing SVG Sparkline Graph Drawer
function drawSparkline(percent) {
  const path = document.getElementById('chart-path');
  const area = document.getElementById('chart-area');
  if (!path || !area) return;

  const value = parseInt(percent) || 0;
  
  // Set chart curve nodes influenced by the pricing multiplier
  const points = [
    { x: 0, y: 55 },
    { x: 50, y: 50 - (value * 0.5) },
    { x: 100, y: 60 - (value * 0.2) },
    { x: 150, y: 40 - (value * 0.8) },
    { x: 200, y: 50 - (value * 0.4) },
    { x: 250, y: 35 - (value * 1.1) },
    { x: 300, y: 25 - (value * 1.3) }
  ];

  // Map coordinates to cubic bezier curve
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const cpX1 = points[i].x + 25;
    const cpY1 = points[i].y;
    const cpX2 = points[i+1].x - 25;
    const cpY2 = points[i+1].y;
    d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i+1].x} ${points[i+1].y}`;
  }

  path.setAttribute('d', d);

  // Close the area path to draw the neon under-glow fill
  const areaD = d + ` L 300 70 L 0 70 Z`;
  area.setAttribute('d', areaD);

  const liveValLbl = document.getElementById('chart-live-val');
  if (liveValLbl) {
    liveValLbl.textContent = `+${value}% Demand`;
  }
}
