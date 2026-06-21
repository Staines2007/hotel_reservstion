const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const https = require('https');
const crypto = require('crypto');
const supabase = require('./supabaseClient');

// Load environment configurations
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'aurastay_ai_secret_jwt_key_2026';

// Global System Settings in Memory
let MEMORY_SETTINGS = {
  subscription_price: '3000',
  dynamic_pricing_enabled: 'true',
  dynamic_pricing_factor: '1.10',
  razorpay_key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key_id',
  razorpay_key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret_key',
  resend_api_key: process.env.RESEND_API_KEY || ''
};

// Native HTTPS Razorpay Order Generator
function createRazorpayOrder(amount, currency, receipt, keyId, keySecret) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const postData = JSON.stringify({
      amount: Math.round(amount * 100), // convert INR to paise
      currency,
      receipt
    });
    
    const options = {
      hostname: 'api.razorpay.com',
      path: '/v1/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(data.error ? data.error.description : 'Razorpay order creation failed'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

// Native HTTPS Resend Email Delivery Engine
async function sendRealEmail(to, subject, textBody, htmlBody) {
  const apiKey = MEMORY_SETTINGS.resend_api_key;
  if (!apiKey || apiKey.includes('placeholder') || apiKey.trim() === '') {
    console.log(`[EMAIL SENDER SIMULATION] To: ${to} | Subject: ${subject} | Body: ${textBody}`);
    return;
  }

  try {
    const postData = JSON.stringify({
      from: 'AuraStay AI <reservations@resend.dev>',
      to: [to],
      subject: subject,
      text: textBody,
      html: htmlBody || `<p>${textBody}</p>`
    });

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`[EMAIL SENDER API] Email sent to ${to}. Code: ${res.statusCode}.`);
      });
    });

    req.on('error', (e) => console.error("Email send failed:", e));
    req.write(postData);
    req.end();
  } catch (err) {
    console.error("Email sending exception:", err);
  }
}

// Middleware Setup
app.use(cors());
app.use(express.json());

// Global Activity Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const authHeader = req.headers['authorization'];
  const userIndicator = authHeader ? 'JWT-Auth' : 'Anonymous';
  console.log(`[ACTIVITY LOG] ${timestamp} | IP: ${req.ip} | Method: ${req.method} | Route: ${req.url} | Auth: ${userIndicator}`);
  next();
});

// ==========================================
// AUTH MIDDLEWARE (JWT VALIDATOR)
// ==========================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token is invalid or expired' });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// 1. AUTH ROUTES
// ==========================================

// User Login (Checks public.users schema)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Lookup user in Supabase public.users
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Incorrect email address or password' });
    }

    // Compare bcrypt passwords
    if (user.password_hash) {
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    } else {
      // Fallback for user without password hash (e.g. seeded previously)
      const passwordHash = await bcrypt.hash(password, 10);
      await supabase.from('users').update({ password_hash: passwordHash }).eq('email', user.email);
      console.log(`[AUTH] Initialized password hash for existing passwordless user: ${user.email}`);
    }

    // Issue JWT
    const token = jwt.sign({ email: user.email, name: user.name, role: user.role }, JWT_SECRET);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// User Registration
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, name, role, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ 
        email: email.trim().toLowerCase(), 
        name: name.trim(), 
        role: role || 'customer',
        password_hash: passwordHash
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Profile with this email already exists' });
      }
      return res.status(500).json({ error: error.message });
    }

    const token = jwt.sign({ email: newUser.email, name: newUser.name, role: newUser.role }, JWT_SECRET);
    res.status(211).json({ token, user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Mock Password Reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    
    // Check if user exists
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'No profile found with this email' });
    }

    console.log(`[EMAIL SENDER] Password reset link sent to ${email}`);
    res.json({ message: 'A secure password reset link has been dispatched to your email inbox.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Profile Management (Update name)
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Profile name is required' });
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ name })
      .eq('email', req.user.email)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    console.log(`[ACTIVITY LOG] User profile updated for ${req.user.email}`);
    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 2. ROOM INVENTORY ROUTES
// ==========================================

// Get Rooms (Supports filters: hotel location, category category, max price)
app.get('/api/rooms', async (req, res) => {
  try {
    const { hotel, category, priceMax } = req.query;

    let query = supabase.from('rooms').select('*');

    if (hotel) {
      query = query.ilike('hotel', `%${hotel}%`);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data: rooms, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Filter by dynamic rate calculated client-side/server-side if required
    let finalRooms = rooms || [];
    if (priceMax) {
      finalRooms = finalRooms.filter(r => r.price <= parseInt(priceMax));
    }

    res.json(finalRooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create Room (Staff / Admin CRUD)
app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Restricted permissions: Staff/Admin access required.' });
    }

    const { name, category, price, hotel, status } = req.body;
    if (!name || !category || !price || !hotel) {
      return res.status(400).json({ error: 'Required attributes: name, category, price, hotel.' });
    }

    const { data: newRoom, error } = await supabase
      .from('rooms')
      .insert([{ name, category, price: parseInt(price), hotel, status: status || 'available' }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(newRoom);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Edit Room Details (Staff / Admin CRUD)
app.put('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Restricted permissions: Staff/Admin access required.' });
    }

    const { id } = req.params;
    const { name, category, price, hotel, status } = req.body;

    const { data: updatedRoom, error } = await supabase
      .from('rooms')
      .update({ name, category, price: parseInt(price), hotel, status })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(updatedRoom);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete Room Inventory (Staff / Admin CRUD)
app.delete('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Restricted permissions: Staff/Admin access required.' });
    }

    const { id } = req.params;
    const { error } = await supabase.from('rooms').delete().eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Room inventory deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 3. BOOKINGS & RESERVATIONS ROUTES
// ==========================================

// Get Guest Reservations (Filters based on JWT roles)
app.get('/api/reservations', authenticateToken, async (req, res) => {
  try {
    let query = supabase.from('reservations').select('*');

    // Customer only sees their reservations
    if (req.user.role === 'customer') {
      query = query.eq('user_email', req.user.email);
    }

    const { data: bookings, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    
    res.json(bookings || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Book Room (Payment settlement & sensory configuration)
app.post('/api/reservations', authenticateToken, async (req, res) => {
  try {
    const { roomId, checkIn, checkOut, guests, nights, totalPrice, sensoryProfile, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    if (!roomId || !checkIn || !checkOut || !guests || !nights || !totalPrice) {
      return res.status(400).json({ error: 'Incomplete checkout parameters.' });
    }

    // Verify room availability
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Suite inventory record not found.' });
    }

    if (room.status !== 'available') {
      return res.status(400).json({ error: 'This suite is currently occupied or undergoing maintenance.' });
    }

    // Server-side price calculation
    const isDynamic = MEMORY_SETTINGS.dynamic_pricing_enabled === 'true';
    const factor = isDynamic ? parseFloat(MEMORY_SETTINGS.dynamic_pricing_factor || '1.10') : 1.0;
    const verifiedTotalPrice = Math.round(parseInt(nights) * room.price * factor);

    if (parseInt(totalPrice) !== verifiedTotalPrice) {
      console.warn(`[PRICE TAMPER WARNING] Client submitted price ₹${totalPrice} but server verified price ₹${verifiedTotalPrice}. Overwriting with server price.`);
    }

    // Verify Razorpay signature if key credentials are set
    const keyId = MEMORY_SETTINGS.razorpay_key_id;
    const keySecret = MEMORY_SETTINGS.razorpay_key_secret;
    const isRealRazorpay = keyId && keySecret && !keyId.includes('placeholder') && keyId.trim() !== '' && keyId !== 'rzp_test_placeholder_key_id';

    let orderId = razorpayOrderId || `pay_${Math.random().toString(36).substring(2, 11)}`;

    if (isRealRazorpay) {
      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        return res.status(400).json({ error: 'Razorpay checkout parameters missing.' });
      }

      const hmac = crypto.createHmac('sha256', keySecret);
      hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpaySignature) {
        console.error('[SECURITY ALERT] Razorpay Signature verification failed!');
        return res.status(400).json({ error: 'Razorpay payment signature mismatch. Transaction aborted.' });
      }
      orderId = razorpayPaymentId;
    }

    // Insert reservation
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .insert([{
        user_email: req.user.email,
        room_id: roomId,
        check_in: checkIn,
        check_out: checkOut,
        guests: parseInt(guests),
        nights: parseInt(nights),
        total_price: verifiedTotalPrice,
        payment_status: 'paid',
        status: 'paid',
        payment_order_id: orderId,
        sensory_profile: sensoryProfile || {}
      }])
      .select()
      .single();

    if (resError) return res.status(500).json({ error: resError.message });

    // Mark room as occupied
    await supabase.from('rooms').update({ status: 'occupied' }).eq('id', roomId);

    // Send real confirmation email
    const emailSubject = `Booking Confirmed: AuraStay AI | ${room.name}`;
    const emailBodyText = `Congratulations! Your stay at ${room.name} (${room.hotel}) is confirmed from ${checkIn} to ${checkOut} for ${guests} guest(s). Total Paid: ₹${verifiedTotalPrice}.00.`;
    const emailBodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #0f172a; color: #f8fafc; margin: 0 auto;">
        <h2 style="color: #14b8a6; border-bottom: 2px solid #14b8a6; padding-bottom: 12px; margin-top: 0;">AuraStay AI - Booking Confirmation</h2>
        <p>Hello Guest,</p>
        <p>Your luxury reservation has been confirmed and synchronized with our PMS gateway. Here are your booking details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #334155;"><td style="padding: 10px 0; font-weight: bold; color: #94a3b8;">Hotel Resort:</td><td style="padding: 10px 0; color: #f8fafc;">${room.hotel}</td></tr>
          <tr style="border-bottom: 1px solid #334155;"><td style="padding: 10px 0; font-weight: bold; color: #94a3b8;">Room Type:</td><td style="padding: 10px 0; color: #f8fafc;">${room.name}</td></tr>
          <tr style="border-bottom: 1px solid #334155;"><td style="padding: 10px 0; font-weight: bold; color: #94a3b8;">Stay Dates:</td><td style="padding: 10px 0; color: #f8fafc;">${checkIn} to ${checkOut} (${nights} Nights)</td></tr>
          <tr style="border-bottom: 1px solid #334155;"><td style="padding: 10px 0; font-weight: bold; color: #94a3b8;">Total Tariff Paid:</td><td style="padding: 10px 0; color: #34d399; font-weight: bold; font-size: 1.1rem;">₹${verifiedTotalPrice}.00</td></tr>
        </table>
        <p style="margin-top: 20px; font-size: 0.85rem; color: #64748b; text-align: center;">A digital smart lock key has been provisioned to your profile.</p>
      </div>
    `;
    sendRealEmail(req.user.email, emailSubject, emailBodyText, emailBodyHtml);

    res.status(201).json(reservation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Modify Booking Reservation dates/guests
app.put('/api/reservations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, guests, nights, totalPrice } = req.body;

    if (!checkIn || !checkOut || !guests || !nights || !totalPrice) {
      return res.status(400).json({ error: 'Incomplete parameters for modification.' });
    }

    // Get reservation to locate room ID
    const { data: booking, error: getError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !booking) {
      return res.status(404).json({ error: 'Reservation record not found.' });
    }

    // Fetch the room to resolve base rate
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', booking.room_id)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Associated room record not found.' });
    }

    // Server-side price calculation for modifications
    const isDynamic = MEMORY_SETTINGS.dynamic_pricing_enabled === 'true';
    const factor = isDynamic ? parseFloat(MEMORY_SETTINGS.dynamic_pricing_factor || '1.10') : 1.0;
    const verifiedTotalPrice = Math.round(parseInt(nights) * room.price * factor);

    if (parseInt(totalPrice) !== verifiedTotalPrice) {
      console.warn(`[PRICE TAMPER WARNING] Client submitted modification price ₹${totalPrice} but server verified price ₹${verifiedTotalPrice}. Overwriting with server price.`);
    }

    // Update reservation in Supabase
    const { data: updatedBooking, error } = await supabase
      .from('reservations')
      .update({
        check_in: checkIn,
        check_out: checkOut,
        guests: parseInt(guests),
        nights: parseInt(nights),
        total_price: verifiedTotalPrice
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    console.log(`[EMAIL SENDER] Booking modification email notification dispatched to ${req.user.email}`);
    res.json(updatedBooking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update Booking Status (Check-In / Check-Out CRUD for Staff)
app.put('/api/reservations/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Restricted permissions: Staff/Admin access required.' });
    }

    const { id } = req.params;
    const { nextStatus } = req.body; // checked-in or checked-out

    if (!nextStatus || (nextStatus !== 'checked-in' && nextStatus !== 'checked-out')) {
      return res.status(400).json({ error: 'Invalid check-in state target.' });
    }

    // Get booking to locate room ID
    const { data: booking, error: getError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !booking) {
      return res.status(404).json({ error: 'Reservation record not found.' });
    }

    // Update status
    const { data: updatedBooking, error: updateError } = await supabase
      .from('reservations')
      .update({ status: nextStatus })
      .eq('id', id)
      .select()
      .single();

    if (updateError) return res.status(500).json({ error: updateError.message });

    // Update room status accordingly
    if (nextStatus === 'checked-out') {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', booking.room_id);
      console.log(`[EMAIL SENDER] Guest checked-out email notification sent to ${booking.user_email}`);
    } else {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', booking.room_id);
      console.log(`[EMAIL SENDER] Guest check-in confirmation / key activated email sent to ${booking.user_email}`);
    }

    res.json(updatedBooking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Cancel Reservation (Deletes and releases room)
app.delete('/api/reservations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get reservation
    const { data: booking, error: getError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !booking) {
      return res.status(404).json({ error: 'Reservation record not found.' });
    }

    // Check ownership
    if (req.user.role === 'customer' && booking.user_email !== req.user.email) {
      return res.status(403).json({ error: 'Restricted permissions: Cannot cancel other user reservations.' });
    }

    // Delete reservation
    const { error: delError } = await supabase.from('reservations').delete().eq('id', id);
    if (delError) return res.status(500).json({ error: delError.message });

    // Release room back to available
    await supabase.from('rooms').update({ status: 'available' }).eq('id', booking.room_id);

    console.log(`[EMAIL SENDER] Booking cancellation alert email sent to ${booking.user_email}`);
    res.json({ message: 'Reservation cancelled successfully and suite released.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 3.5. PAYMENTS ROUTES
// ==========================================

// Create Razorpay Order
app.post('/api/payments/order', authenticateToken, async (req, res) => {
  try {
    const { roomId, nights } = req.body;
    if (!roomId || !nights) {
      return res.status(400).json({ error: 'Required attributes: roomId, nights.' });
    }

    // Fetch room from DB
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    // Server-side price calculation
    const isDynamic = MEMORY_SETTINGS.dynamic_pricing_enabled === 'true';
    const factor = isDynamic ? parseFloat(MEMORY_SETTINGS.dynamic_pricing_factor || '1.10') : 1.0;
    const amount = Math.round(parseInt(nights) * room.price * factor);

    const keyId = MEMORY_SETTINGS.razorpay_key_id;
    const keySecret = MEMORY_SETTINGS.razorpay_key_secret;

    if (keyId && keySecret && !keyId.includes('placeholder') && keyId.trim() !== '' && keyId !== 'rzp_test_placeholder_key_id') {
      // Create real Razorpay order
      const receipt = `rcpt_room_${roomId}_${Date.now()}`;
      try {
        const order = await createRazorpayOrder(amount, 'INR', receipt, keyId, keySecret);
        res.json({
          realOrder: true,
          keyId: keyId,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          roomName: room.name,
          hotelLocation: room.hotel
        });
      } catch (err) {
        console.error("Razorpay order creation failed:", err);
        res.status(500).json({ error: 'Failed to initiate payment gateway.' });
      }
    } else {
      // Mock order for sandbox
      res.json({
        realOrder: false,
        keyId: 'mock_key_id',
        orderId: `order_${Math.random().toString(36).substring(2, 11)}`,
        amount: amount,
        currency: 'INR',
        roomName: room.name,
        hotelLocation: room.hotel
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 4. REVIEWS ROUTES
// ==========================================

// Get all reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const { data: reviews, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(reviews || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Post review
app.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const { hotelName, comment, rating } = req.body;
    if (!hotelName || !comment || !rating) {
      return res.status(400).json({ error: 'Required attributes: hotelName, comment, rating.' });
    }

    const { data: newReview, error } = await supabase
      .from('reviews')
      .insert([{
        user_email: req.user.email,
        hotel_name: hotelName,
        comment,
        rating: parseFloat(rating)
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(newReview);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 5. ADMIN RBAC & USERS LOGS
// ==========================================

// List users (Admin RBAC dashboard)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Restricted permissions: Admin access required.' });
    }

    const { data: users, error } = await supabase.from('users').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(users || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update User Role (Admin RBAC update role)
app.put('/api/users/:email/role', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Restricted permissions: Admin access required.' });
    }

    const { email } = req.params;
    const { role } = req.body;

    if (!role || (role !== 'customer' && role !== 'staff' && role !== 'admin')) {
      return res.status(400).json({ error: 'Invalid target role configuration.' });
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ role })
      .eq('email', email.toLowerCase())
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 6. SYSTEM SETTINGS ROUTES
// ==========================================

// In-memory settings fallback state is initialized at the top of the file.


// Get settings
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('settings').select('*');
    if (!error && data) {
      data.forEach(item => {
        MEMORY_SETTINGS[item.key] = item.value;
      });
    }
  } catch (err) {
    console.warn("Supabase settings fetch failed, using memory state.", err);
  }
  res.json(MEMORY_SETTINGS);
});

// Update setting (Admin only)
app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Restricted permissions: Admin access required.' });
    }
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Required attributes: key, value.' });
    }

    MEMORY_SETTINGS[key] = String(value);

    try {
      await supabase.from('settings').upsert({ key, value: String(value) });
    } catch (dbErr) {
      console.warn("Supabase settings save failed, saved in memory.", dbErr);
    }

    res.json({ key, value: String(value), message: 'Setting updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Async helper to seed default user passwords if they don't have them
async function seedDefaultUserPasswords() {
  const defaultUsers = [
    { email: 'guest@aurastay.com', password: 'guest', name: 'Guest User', role: 'customer' },
    { email: 'staff@aurastay.com', password: 'staff', name: 'Agent Staff', role: 'staff' },
    { email: 'admin@aurastay.com', password: 'admin', name: 'Admin Manager', role: 'admin' }
  ];

  for (const defaultUser of defaultUsers) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', defaultUser.email)
        .single();

      const hash = await bcrypt.hash(defaultUser.password, 10);

      if (!user) {
        // Insert if missing
        await supabase.from('users').insert([{
          email: defaultUser.email,
          name: defaultUser.name,
          role: defaultUser.role,
          password_hash: hash
        }]);
        console.log(`[SEED] Pre-seeded default user: ${defaultUser.email}`);
      } else if (!user.password_hash) {
        // Update if password hash is empty
        await supabase.from('users')
          .update({ password_hash: hash })
          .eq('email', defaultUser.email);
        console.log(`[SEED] Updated password hash for default user: ${defaultUser.email}`);
      }
    } catch (err) {
      console.warn(`[SEED] Failed to seed default user password for ${defaultUser.email}:`, err.message);
    }
  }
}

// Boot listening server
app.listen(PORT, () => {
  console.log(`🚀 AuraStay AI Backend operational at http://localhost:${PORT}`);
  seedDefaultUserPasswords();
});
