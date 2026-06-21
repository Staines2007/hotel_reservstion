/**
 * ==========================================================================
 * AURASTAY AI - AI CONCIERGE CHATBOT STATE CONTROLLER
 * ==========================================================================
 */

window.toggleChat = function(forceState) {
  const chatFab = document.getElementById('chat-fab-btn');
  const chatPanel = document.getElementById('chatbot-widget');
  if (!chatFab || !chatPanel) return;

  if (typeof forceState === 'boolean') {
    if (forceState) {
      chatPanel.classList.add('open');
      chatFab.classList.add('hide');
    } else {
      chatPanel.classList.remove('open');
      chatFab.classList.remove('hide');
    }
  } else {
    chatPanel.classList.toggle('open');
    chatFab.classList.toggle('hide');
  }
};

window.chatbotSendMessage = function(text) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.value = text;
  handleChatSubmit();
};

let isListening = false;

function initChatbot() {
  const chatFab = document.getElementById('chat-fab-btn');
  const chatPanel = document.getElementById('chatbot-widget');
  const chatClose = document.getElementById('chat-close-btn');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatInput = document.getElementById('chat-input');
  const voiceSearchBtn = document.getElementById('voice-search-btn');
  const chatMicBtn = document.getElementById('chat-mic-btn');
  const voiceIndicator = document.getElementById('voice-active-indicator');
  const chatBody = document.getElementById('chat-body-messages');

  if (!chatFab || !chatPanel) return;

  // Toggle open
  chatFab.addEventListener('click', () => {
    toggleChat(true);
  });

  // Toggle close
  if (chatClose) {
    chatClose.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleChat(false);
    });
  }

  if (chatSendBtn) chatSendBtn.addEventListener('click', handleChatSubmit);
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleChatSubmit();
    });
  }

  // Simulated voice button
  if (chatMicBtn) {
    chatMicBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      simulateVoiceInput();
    });
  }

  // Fallback for old voiceSearchBtn if present
  if (voiceSearchBtn) {
    voiceSearchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleChat(true);
      simulateVoiceInput();
    });
  }

  function simulateVoiceInput() {
    if (isListening) return;
    isListening = true;
    if (chatMicBtn) chatMicBtn.classList.add('listening');
    if (voiceIndicator) voiceIndicator.classList.remove('hide');

    const voiceCommands = [
      "Book the Wellness Penthouse Suite",
      "Show me deluxe suites",
      "Change theme to light mode",
      "Show me discount codes"
    ];
    const cmd = voiceCommands[Math.floor(Math.random() * voiceCommands.length)];

    setTimeout(() => {
      if (chatInput) chatInput.value = cmd;
      isListening = false;
      if (chatMicBtn) chatMicBtn.classList.remove('listening');
      if (voiceIndicator) voiceIndicator.classList.add('hide');

      if (typeof window.showToast === 'function') {
        window.showToast(`Voice command recognized: "${cmd}"`, 'success');
      }

      setTimeout(handleChatSubmit, 500);
    }, 2000);
  }
}

function handleChatSubmit() {
  const chatInput = document.getElementById('chat-input');
  const chatBody = document.getElementById('chat-body-messages');
  if (!chatInput) return;

  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage(text, 'user');
  chatInput.value = '';

  const typing = appendTypingBubble();
  chatBody.scrollTop = chatBody.scrollHeight;

  setTimeout(() => {
    typing.remove();
    const reply = parseChatbotLogic(text);
    appendMessage(reply, 'bot');
    chatBody.scrollTop = chatBody.scrollHeight;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, 1000);
}

function appendMessage(text, sender) {
  const chatBody = document.getElementById('chat-body-messages');
  if (!chatBody) return;

  const div = document.createElement('div');
  div.className = `chat-msg ${sender} chat-message`;

  let avatarHtml = '';
  if (sender === 'bot') {
    avatarHtml = `<div class="ai-avatar" style="width:28px; height:28px; font-size: 0.75rem; flex-shrink: 0;"><i class="fa-solid fa-microchip"></i></div>`;
  } else {
    avatarHtml = `<div class="ai-avatar" style="width:28px; height:28px; font-size: 0.75rem; flex-shrink: 0; background:linear-gradient(135deg, #14b8a6, #0ea5e9);"><i class="fa-regular fa-user"></i></div>`;
  }

  div.innerHTML = `
    ${sender === 'bot' ? avatarHtml : ''}
    <p>${text}</p>
    ${sender === 'user' ? avatarHtml : ''}
  `;

  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function appendTypingBubble() {
  const chatBody = document.getElementById('chat-body-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot chat-message typing-indicator-bubble';
  div.innerHTML = `
    <div class="ai-avatar" style="width:28px; height:28px; font-size: 0.75rem; flex-shrink: 0;"><i class="fa-solid fa-microchip"></i></div>
    <p><span>.</span><span>.</span><span>.</span></p>
  `;
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;
  return div;
}

function parseChatbotLogic(input) {
  const text = input.toLowerCase();

  // Mode toggles
  if (text.includes('light theme') || text.includes('light mode') || text.includes('white theme')) {
    setTimeout(() => {
      document.documentElement.classList.add('no-transitions');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
      window.getComputedStyle(document.documentElement).opacity;
      setTimeout(() => {
        document.documentElement.classList.remove('no-transitions');
      }, 50);
    }, 200);
    return 'Optimizing display settings. Themes transitioned to <b>Light Mode</b>.';
  }

  if (text.includes('dark theme') || text.includes('dark mode') || text.includes('black theme')) {
    setTimeout(() => {
      document.documentElement.classList.add('no-transitions');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      window.getComputedStyle(document.documentElement).opacity;
      setTimeout(() => {
        document.documentElement.classList.remove('no-transitions');
      }, 50);
    }, 200);
    return 'Optimizing display settings. Themes transitioned to <b>Dark Mode</b>.';
  }

  // Room filters
  if (text.includes('deluxe')) {
    triggerStayFilter('deluxe');
    return 'Filtering suites... isolated the <b>Premium Sea View Deluxe</b> room.';
  }

  if (text.includes('suite') || text.includes('penthouse') || text.includes('wellness')) {
    triggerStayFilter('suite');
    return 'Filtering suites... isolated the <b>Wellness Penthouse Suite</b>.';
  }

  if (text.includes('standard') || text.includes('creator') || text.includes('studio')) {
    triggerStayFilter('standard');
    return 'Filtering suites... loaded the <b>Creator Studio Room 08</b>.';
  }

  if (text.includes('show all') || text.includes('all rooms') || text.includes('reset')) {
    triggerStayFilter('all');
    return 'Resetting room filters. Showing all available rooms in the directory.';
  }

  // Payments / Discounts
  if (text.includes('discount') || text.includes('promo') || text.includes('code') || text.includes('coupon')) {
    return 'Promotion loaded! Use coupon code <b>AURA2026</b> during checkout to redeem a <b>15% dynamic pricing offset</b>.';
  }

  // Bookings triggers
  if (text.includes('book wellness') || text.includes('reserve wellness')) {
    triggerRoomCheckoutTrigger(3); // Wellness Suite ID is 3
    return 'Booking sequence initiated... Wellness Penthouse Suite selected!';
  }

  if (text.includes('book deluxe') || text.includes('reserve deluxe')) {
    triggerRoomCheckoutTrigger(1); // Sea View Deluxe ID is 1
    return 'Booking sequence initiated... Sea View Deluxe selected!';
  }

  if (text.includes('book standard') || text.includes('reserve standard') || text.includes('book creator')) {
    triggerRoomCheckoutTrigger(2); // Creator Studio ID is 2
    return 'Booking sequence initiated... Creator Studio selected!';
  }

  if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
    return 'Hello! I am Aura, your digital AI Concierge. I can help search rooms ("show deluxe suites"), switch themes ("white theme"), or request checkouts ("book luxury suite"). How may I assist you?';
  }

  return 'Interesting request. Try typing: <b>"Show me deluxe suites"</b> or <b>"Switch to light theme"</b>.';
}

function triggerStayFilter(category) {
  const select = document.getElementById('stay-type');
  if (select) {
    select.value = category;
    if (typeof window.renderCustomerRooms === 'function') {
      window.renderCustomerRooms();
    }
  }
}

function triggerRoomCheckoutTrigger(roomId) {
  if (typeof window.triggerCheckout === 'function') {
    window.triggerCheckout(roomId);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initChatbot);
} else {
  initChatbot();
}
