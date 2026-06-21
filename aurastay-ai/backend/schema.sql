-- ==========================================
-- AURASTAY AI - DATABASE SCHEMA (SUPABASE POSTGRES)
-- ==========================================

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('standard', 'deluxe', 'suite')),
    hotel TEXT NOT NULL,
    price INTEGER NOT NULL, -- Price in INR (₹)
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Reservations Table
CREATE TABLE IF NOT EXISTS public.reservations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_email TEXT REFERENCES public.users(email) ON DELETE CASCADE,
    room_id BIGINT REFERENCES public.rooms(id) ON DELETE SET NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    guests INTEGER NOT NULL,
    nights INTEGER NOT NULL,
    total_price INTEGER NOT NULL, -- Total in INR (₹)
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'checked-in', 'checked-out')),
    payment_order_id TEXT UNIQUE,
    sensory_profile JSONB, -- Stores circadian settings, temp, bed rigidity, acoustics
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_email TEXT REFERENCES public.users(email) ON DELETE CASCADE,
    hotel_name TEXT NOT NULL,
    comment TEXT NOT NULL,
    rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- SEED DATA SETUP
-- ==========================================

-- Seed Rooms
INSERT INTO public.rooms (name, category, hotel, price, status) 
VALUES 
('Premium Sea View Grand Deluxe', 'deluxe', 'Taj Mahal Palace, Mumbai', 24900, 'available'),
('Royal Club Studio Room 08', 'standard', 'The Leela Palace, New Delhi', 14900, 'available'),
('Wellness Penthouse Suite', 'suite', 'Wildflower Hall, Shimla', 37500, 'available'),
('Premier Lake View Pavilion', 'suite', 'The Oberoi Udaivilas, Udaipur', 45000, 'available'),
('Historical Royal Heritage Room', 'deluxe', 'Rambagh Palace, Jaipur', 38000, 'available'),
('Executive Towers Club Room', 'standard', 'ITC Grand Chola, Chennai', 12000, 'available'),
('Heritage Meandering Pool Villa', 'suite', 'Kumarakom Lake Resort, Kerala', 28000, 'available'),
('Luxury Lake View Royal Suite', 'suite', 'Taj Lake Palace, Udaipur', 55000, 'available'),
('Club Room Race Course Road', 'deluxe', 'Welcomhotel by ITC Hotels, Coimbatore', 7500, 'available'),
('Superior Room Avinashi Road', 'standard', 'Vivanta, Coimbatore', 8200, 'available'),
('Premium Business Suite', 'suite', 'Radisson Blu, Coimbatore', 11500, 'available'),
('Deluxe Heritage Suite', 'deluxe', 'The Residency Towers, Coimbatore', 9000, 'available')
ON CONFLICT DO NOTHING;

-- Seed Default Profiles for Auth verification (Optional default records)
INSERT INTO public.users (email, name, role) 
VALUES 
('guest@aurastay.com', 'Guest User', 'customer'),
('staff@aurastay.com', 'Agent Staff', 'staff'),
('admin@aurastay.com', 'Admin Manager', 'admin')
ON CONFLICT DO NOTHING;

-- 5. Create Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Seed initial settings
INSERT INTO public.settings (key, value) 
VALUES 
('subscription_price', '3000'),
('dynamic_pricing_enabled', 'true'),
('dynamic_pricing_factor', '1.10')
ON CONFLICT (key) DO NOTHING;
