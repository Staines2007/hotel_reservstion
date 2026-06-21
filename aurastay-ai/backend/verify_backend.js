const http = require('http');
const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const logFile = 'test_results.txt';
fs.writeFileSync(logFile, ''); // Clear old logs
const originalLog = console.log;
console.log = function(...args) {
  originalLog.apply(console, args);
  fs.appendFileSync(logFile, args.join(' ') + '\n');
};
const originalError = console.error;
console.error = function(...args) {
  originalError.apply(console, args);
  fs.appendFileSync(logFile, 'ERROR: ' + args.join(' ') + '\n');
};

console.log("🔄 Initializing AuraStay Backend Verification Environment...");

// 1. Setup Mock DB State
let mockUsers = [
  { email: 'guest@aurastay.com', name: 'Guest User', role: 'customer', password_hash: bcrypt.hashSync('guest', 10) },
  { email: 'staff@aurastay.com', name: 'Agent Staff', role: 'staff', password_hash: bcrypt.hashSync('staff', 10) },
  { email: 'admin@aurastay.com', name: 'Admin Manager', role: 'admin', password_hash: bcrypt.hashSync('admin', 10) }
];

let mockSettings = [
  { key: 'subscription_price', value: '3000' },
  { key: 'dynamic_pricing_enabled', value: 'true' },
  { key: 'dynamic_pricing_factor', value: '1.10' }
];

let mockRooms = [
  { id: 1, name: 'Premium Sea View Grand Deluxe', category: 'deluxe', hotel: 'Taj Mahal Palace, Mumbai', price: 24900, status: 'available' }
];

let mockReservations = [];

// 2. Mock Supabase Client methods
const mockSupabase = {
  from: (table) => {
    return {
      select: (fields) => {
        return {
          eq: (field, val) => {
            return {
              single: async () => {
                if (table === 'users') {
                  const u = mockUsers.find(x => x[field] === val);
                  return u ? { data: u, error: null } : { data: null, error: { message: 'User not found' } };
                }
                if (table === 'rooms') {
                  const r = mockRooms.find(x => x[field] === val || x[field] === parseInt(val));
                  return r ? { data: r, error: null } : { data: null, error: { message: 'Room not found' } };
                }
                if (table === 'reservations') {
                  const res = mockReservations.find(x => x[field] === val || x[field] === parseInt(val));
                  return res ? { data: res, error: null } : { data: null, error: { message: 'Reservation not found' } };
                }
                return { data: null, error: { message: 'Not found' } };
              }
            };
          },
          order: () => {
            if (table === 'settings') {
              return Promise.resolve({ data: mockSettings, error: null });
            }
            return Promise.resolve({ data: [], error: null });
          }
        };
      },
      insert: (rows) => {
        return {
          select: () => {
            return {
              single: async () => {
                const row = rows[0];
                if (table === 'users') {
                  mockUsers.push(row);
                  return { data: row, error: null };
                }
                if (table === 'reservations') {
                  row.id = mockReservations.length + 1;
                  mockReservations.push(row);
                  return { data: row, error: null };
                }
                return { data: row, error: null };
              }
            };
          }
        };
      },
      update: (fields) => {
        return {
          eq: (field, val) => {
            return {
              select: () => {
                return {
                  single: async () => {
                    if (table === 'users') {
                      const idx = mockUsers.findIndex(x => x[field] === val);
                      if (idx !== -1) {
                        mockUsers[idx] = { ...mockUsers[idx], ...fields };
                        return { data: mockUsers[idx], error: null };
                      }
                    }
                    if (table === 'rooms') {
                      const idx = mockRooms.findIndex(x => x[field] === val || x[field] === parseInt(val));
                      if (idx !== -1) {
                        mockRooms[idx] = { ...mockRooms[idx], ...fields };
                        return { data: mockRooms[idx], error: null };
                      }
                    }
                    if (table === 'reservations') {
                      const idx = mockReservations.findIndex(x => x[field] === val || x[field] === parseInt(val));
                      if (idx !== -1) {
                        mockReservations[idx] = { ...mockReservations[idx], ...fields };
                        return { data: mockReservations[idx], error: null };
                      }
                    }
                    return { data: null, error: { message: 'Not found' } };
                  }
                };
              }
            };
          }
        };
      },
      upsert: async (item) => {
        const idx = mockSettings.findIndex(x => x.key === item.key);
        if (idx !== -1) {
          mockSettings[idx] = item;
        } else {
          mockSettings.push(item);
        }
        return { data: item, error: null };
      }
    };
  }
};

// 3. Inject mock Supabase Client into require cache
require.cache[require.resolve('./supabaseClient')] = {
  exports: mockSupabase
};

// Override PORT to 5001 for testing
process.env.PORT = 5001;

// 4. Import the server
const server = require('./server.js');

// 5. Helper to make HTTP requests
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : {}
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// 6. Test Suite Runner
async function runTests() {
  // Wait a small duration for server startup seeder to finish
  await new Promise(r => setTimeout(r, 200));

  console.log("🏃 Running verification tests...");
  let exitCode = 0;

  try {
    // Test Case 1: Sign up a new user with password
    console.log("\n🧪 Test Case 1: Sign up new user with password hashing...");
    const signupRes = await request('POST', '/api/auth/signup', {
      email: 'tester@aurastay.com',
      name: 'Test User',
      password: 'testPassword123'
    });
    assert.strictEqual(signupRes.statusCode, 211, "Sign up status code should be 211");
    assert.ok(signupRes.body.token, "Signup response should contain JWT token");
    
    // Check database to ensure password hash was stored properly
    const storedUser = mockUsers.find(u => u.email === 'tester@aurastay.com');
    assert.ok(storedUser, "User should be in database");
    assert.notStrictEqual(storedUser.password_hash, 'testPassword123', "Password should not be stored in plain text");
    assert.ok(bcrypt.compareSync('testPassword123', storedUser.password_hash), "Password hash should be valid bcrypt match");
    console.log("✅ Test Case 1 passed!");

    // Test Case 2: Log in with correct password
    console.log("\n🧪 Test Case 2: Log in with correct password...");
    const loginSuccessRes = await request('POST', '/api/auth/login', {
      email: 'tester@aurastay.com',
      password: 'testPassword123'
    });
    assert.strictEqual(loginSuccessRes.statusCode, 200, "Login should return status code 200");
    assert.ok(loginSuccessRes.body.token, "Login response should contain JWT token");
    console.log("✅ Test Case 2 passed!");

    // Test Case 3: Log in with incorrect password
    console.log("\n🧪 Test Case 3: Log in with incorrect password...");
    const loginFailRes = await request('POST', '/api/auth/login', {
      email: 'tester@aurastay.com',
      password: 'wrongPassword'
    });
    assert.strictEqual(loginFailRes.statusCode, 401, "Login with wrong password should fail with 401");
    assert.strictEqual(loginFailRes.body.error, 'Invalid password', "Should return 'Invalid password' error message");
    console.log("✅ Test Case 3 passed!");

    // Test Case 4: Price Tampering Verification on booking
    console.log("\n🧪 Test Case 4: Booking suite price tampering prevention...");
    const token = loginSuccessRes.body.token;
    
    // Attempt booking standard room (Base rate: ₹24900, nights: 2, dynamic factor: 1.10)
    // Correct rate: 2 * 24900 * 1.10 = ₹54780
    const tamperRes = await request('POST', '/api/reservations', {
      roomId: 1,
      checkIn: '2026-06-20',
      checkOut: '2026-06-22',
      guests: 2,
      nights: 2,
      totalPrice: 1, // Tampered price
      sensoryProfile: {}
    }, {
      'Authorization': `Bearer ${token}`
    });

    assert.strictEqual(tamperRes.statusCode, 201, "Reservation should complete successfully");
    assert.strictEqual(tamperRes.body.total_price, 54780, "Server should calculate price dynamically and ignore tampered totalPrice = 1");
    console.log("✅ Test Case 4 passed!");

    // Test Case 5: Settings Modification and Dynamic Pricing Update
    console.log("\n🧪 Test Case 5: AI Dynamic Pricing setting updates...");
    
    // Log in as administrator
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@aurastay.com',
      password: 'admin'
    });
    const adminToken = adminLogin.body.token;

    // Change dynamic pricing factor to 1.20 (20% boost)
    const updateSettingRes = await request('PUT', '/api/settings', {
      key: 'dynamic_pricing_factor',
      value: '1.20'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(updateSettingRes.statusCode, 200, "Admin setting update should return 200");

    // Fetch settings to verify cache update
    const getSettingsRes = await request('GET', '/api/settings');
    assert.strictEqual(getSettingsRes.body.dynamic_pricing_factor, '1.20', "Setting factor should update in memory state");

    // Attempt booking with new factor (1 night * ₹24900 * 1.20 = ₹29880)
    const newBookingRes = await request('POST', '/api/reservations', {
      roomId: 1,
      checkIn: '2026-06-20',
      checkOut: '2026-06-21',
      guests: 1,
      nights: 1,
      totalPrice: 99999, // Tampered price
      sensoryProfile: {}
    }, {
      'Authorization': `Bearer ${token}`
    });
    
    assert.strictEqual(newBookingRes.statusCode, 201, "Reservation should complete");
    assert.strictEqual(newBookingRes.body.total_price, 29880, "Recalculated total price should respect updated dynamic pricing factor of 1.20");
    console.log("✅ Test Case 5 passed!");

    // Test Case 6: Log in with non-existent unregistered user
    console.log("\n🧪 Test Case 6: Log in with non-existent unregistered user...");
    const loginUnregisteredRes = await request('POST', '/api/auth/login', {
      email: 'unregistered@aurastay.com',
      password: 'somePassword'
    });
    assert.strictEqual(loginUnregisteredRes.statusCode, 401, "Login with unregistered email should fail with 401");
    assert.strictEqual(loginUnregisteredRes.body.error, 'Incorrect email address or password', "Should return 'Incorrect email address or password' error");
    console.log("✅ Test Case 6 passed!");

    console.log("\n🎉 ALL BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉");

  } catch (err) {
    console.error("\n❌ Verification Test Failed:", err);
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

runTests();
