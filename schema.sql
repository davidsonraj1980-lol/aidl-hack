-- ==============================================================================
-- AIRPORT CAB-POOLING MVP (RouteWise)
-- Database & Spatial Query Logic for Supabase (PostgreSQL + PostGIS)
-- ==============================================================================

-- 1. Enable PostGIS Extension for geospatial calculations
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Clean up previous tables/functions if re-running
DROP FUNCTION IF EXISTS match_riders(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, UUID);
DROP TABLE IF EXISTS ride_requests CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 3. Create Users Table
-- Stores passenger profiles, trust ratings, and flight verification status
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    flight_seat TEXT,
    is_verified BOOLEAN DEFAULT true,
    rating NUMERIC(2, 1) DEFAULT 4.9,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Ride Requests Table
-- Stores requests from passengers who have landed or are landing on a specific flight
CREATE TABLE IF NOT EXISTS ride_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flight_number TEXT NOT NULL,
    destination_name TEXT NOT NULL,
    destination_coords GEOGRAPHY(Point, 4326) NOT NULL,
    fare_estimate NUMERIC(10, 2) DEFAULT 1200.00,
    status TEXT DEFAULT 'searching' CHECK (status IN ('searching', 'matched', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Performance & Spatial Indexes
-- GIST index speeds up ST_DWithin and ST_Distance calculations exponentially
CREATE INDEX IF NOT EXISTS idx_ride_requests_spatial 
ON ride_requests USING GIST (destination_coords);

-- B-Tree index for instantaneous filtering by flight number & active searching status
CREATE INDEX IF NOT EXISTS idx_ride_requests_flight_status 
ON ride_requests (flight_number, status);

-- 6. Row Level Security (RLS) Setup
-- Enable RLS on all tables as per production security best practices
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;

-- Demo/Hackathon friendly policies (Allow anon read and insert)
CREATE POLICY "Public users can view profiles" 
ON users FOR SELECT USING (true);

CREATE POLICY "Public users can create profiles" 
ON users FOR INSERT WITH CHECK (true);

CREATE POLICY "Public users can view ride requests" 
ON ride_requests FOR SELECT USING (true);

CREATE POLICY "Public users can insert ride requests" 
ON ride_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Public users can update ride requests" 
ON ride_requests FOR UPDATE USING (true);

-- 7. Supabase RPC Function: match_riders
-- Accepts flight number, passenger destination coordinates (lat, lng), and optional user_id
-- Returns up to 3 co-passengers on the EXACT SAME FLIGHT within a 5km radius (5000 meters)
CREATE OR REPLACE FUNCTION match_riders(
    p_flight_number TEXT,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    request_id UUID,
    user_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    flight_seat TEXT,
    is_verified BOOLEAN,
    rating NUMERIC,
    destination_name TEXT,
    distance_meters DOUBLE PRECISION,
    flight_number TEXT,
    status TEXT,
    fare_estimate NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    origin_point GEOGRAPHY;
BEGIN
    -- Construct PostGIS Geography Point (Longitude X, Latitude Y in WGS84 SRID 4326)
    origin_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

    RETURN QUERY
    SELECT 
        r.id AS request_id,
        u.id AS user_id,
        u.full_name,
        u.avatar_url,
        u.flight_seat,
        u.is_verified,
        u.rating,
        r.destination_name,
        ROUND(ST_Distance(r.destination_coords, origin_point)::numeric, 1)::DOUBLE PRECISION AS distance_meters,
        r.flight_number,
        r.status,
        r.fare_estimate
    FROM ride_requests r
    JOIN users u ON u.id = r.user_id
    WHERE UPPER(TRIM(r.flight_number)) = UPPER(TRIM(p_flight_number))
      AND (p_user_id IS NULL OR r.user_id != p_user_id)
      AND r.status = 'searching'
      AND ST_DWithin(r.destination_coords, origin_point, 5000) -- Exactly 5km spatial radius
    ORDER BY ST_Distance(r.destination_coords, origin_point) ASC
    LIMIT 3; -- Maximum 3 co-riders (4 total in cab)
END;
$$;

-- ==============================================================================
-- 8. Seed Data for Immediate Testing & Hackathon Demonstration
-- ==============================================================================
-- Insert mock verified passengers arriving on flight 6E-241 (DEL -> BLR)
INSERT INTO users (id, full_name, avatar_url, phone, flight_seat, is_verified, rating) VALUES
('11111111-1111-1111-1111-111111111111', 'Ananya Iyer', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', '+91 98765 43210', '8C', true, 4.95),
('22222222-2222-2222-2222-222222222222', 'Rohan Sharma', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', '+91 98123 45678', '14A', true, 4.88),
('33333333-3333-3333-3333-333333333333', 'Vikram Malhotra', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', '+91 97654 32109', '21D', true, 4.92),
('44444444-4444-4444-4444-444444444444', 'Priya Patel', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', '+91 99887 76655', '17B', true, 4.90)
ON CONFLICT (id) DO NOTHING;

-- Insert active ride requests for flight 6E-241:
-- Ananya: Domlur Flyover (~2.1 km from Indiranagar) -> MATCHES
-- Rohan: Koramangala Sony Signal (~4.7 km from Indiranagar) -> MATCHES
-- Vikram: Old Airport Road (~3.2 km from Indiranagar) -> MATCHES
-- Priya: Whitefield ITPL (~12 km away from Indiranagar) -> DOES NOT MATCH (> 5km)
INSERT INTO ride_requests (user_id, flight_number, destination_name, destination_coords, fare_estimate, status) VALUES
(
    '11111111-1111-1111-1111-111111111111', 
    '6E-241', 
    'Domlur Flyover / EGL', 
    ST_SetSRID(ST_MakePoint(77.6387, 12.9610), 4326)::geography, 
    1200.00, 
    'searching'
),
(
    '22222222-2222-2222-2222-222222222222', 
    '6E-241', 
    'Koramangala 5th Block', 
    ST_SetSRID(ST_MakePoint(77.6245, 12.9352), 4326)::geography, 
    1200.00, 
    'searching'
),
(
    '33333333-3333-3333-3333-333333333333', 
    '6E-241', 
    'Old Airport Road (HAL)', 
    ST_SetSRID(ST_MakePoint(77.6620, 12.9592), 4326)::geography, 
    1200.00, 
    'searching'
),
(
    '44444444-4444-4444-4444-444444444444', 
    '6E-241', 
    'Whitefield ITPL', 
    ST_SetSRID(ST_MakePoint(77.7340, 12.9863), 4326)::geography, 
    1200.00, 
    'searching'
);

-- ==============================================================================
-- Verification Query (Run this to verify matching logic directly in SQL Editor)
-- Example: Matching a passenger landing on flight '6E-241' going to Indiranagar 100ft Road (12.9784, 77.6408)
-- ==============================================================================
-- SELECT * FROM match_riders('6E-241', 12.9784, 77.6408, NULL);
