-- ====================================================================
-- FARS: Fleet Allocation & Resource Substitution (PostgreSQL Schema)
-- Designed for Supabase PostgreSQL
-- ====================================================================

-- 1. CLEANUP (Optional)
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;

-- 2. VEHICLES TABLE
CREATE TABLE vehicles (
    id TEXT PRIMARY KEY,
    registration TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    capacity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'maintenance')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DRIVERS TABLE
CREATE TABLE drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('full_time', 'part_time')),
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'unavailable', 'assigned')),
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DELIVERIES TABLE
CREATE TABLE deliveries (
    id TEXT PRIMARY KEY,
    tracking_code TEXT UNIQUE NOT NULL,
    destination TEXT NOT NULL,
    cargo_weight TEXT NOT NULL,
    cargo_description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'standard' CHECK (priority IN ('standard', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled')),
    vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ASSIGNMENTS TABLE (Audit & Tracking)
CREATE TABLE assignments (
    id TEXT PRIMARY KEY,
    delivery_id TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 6. INDEXES FOR PERFORMANCE & DOUBLE-BOOKING QUERIES
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_drivers_status ON drivers(availability_status);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_vehicle ON deliveries(vehicle_id);
CREATE INDEX idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX idx_assignments_delivery ON assignments(delivery_id);

-- 7. ATOMIC DISPATCH STORED PROCEDURE (Double-Booking Guard)
CREATE OR REPLACE FUNCTION assign_delivery(
    p_delivery_id TEXT,
    p_vehicle_id TEXT,
    p_driver_id TEXT
) RETURNS JSONB AS $$
DECLARE
    v_del deliveries%ROWTYPE;
    v_veh vehicles%ROWTYPE;
    v_drv drivers%ROWTYPE;
    v_conflict_count INT;
    v_assignment_id TEXT;
BEGIN
    -- 1. Check Delivery
    SELECT * INTO v_del FROM deliveries WHERE id = p_delivery_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DELIVERY_NOT_FOUND: Delivery % does not exist', p_delivery_id;
    END IF;

    IF v_del.status <> 'pending' THEN
        RAISE EXCEPTION 'DELIVERY_NOT_PENDING: Delivery is in status %', v_del.status;
    END IF;

    -- 2. Check Vehicle
    SELECT * INTO v_veh FROM vehicles WHERE id = p_vehicle_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'VEHICLE_NOT_FOUND: Vehicle % does not exist', p_vehicle_id;
    END IF;

    IF v_veh.status <> 'available' THEN
        RAISE EXCEPTION 'VEHICLE_UNAVAILABLE: Vehicle status is %', v_veh.status;
    END IF;

    -- 3. Check Driver
    SELECT * INTO v_drv FROM drivers WHERE id = p_driver_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DRIVER_NOT_FOUND: Driver % does not exist', p_driver_id;
    END IF;

    IF v_drv.availability_status <> 'available' OR v_drv.is_verified IS NOT TRUE THEN
        RAISE EXCEPTION 'DRIVER_UNAVAILABLE: Driver availability is % (verified: %)', v_drv.availability_status, v_drv.is_verified;
    END IF;

    -- 4. Check Active Deliveries using either vehicle or driver
    SELECT COUNT(*) INTO v_conflict_count
    FROM deliveries
    WHERE status IN ('assigned', 'in_transit')
      AND (vehicle_id = p_vehicle_id OR driver_id = p_driver_id);

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'RESOURCE_ALREADY_COMMITTED: Vehicle or Driver already assigned to an active delivery';
    END IF;

    -- 5. Atomic Update
    v_assignment_id := 'asg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);

    INSERT INTO assignments(id, delivery_id, vehicle_id, driver_id, status, assigned_at)
    VALUES (v_assignment_id, p_delivery_id, p_vehicle_id, p_driver_id, 'active', NOW());

    UPDATE vehicles
    SET status = 'assigned', updated_at = NOW()
    WHERE id = p_vehicle_id;

    UPDATE drivers
    SET availability_status = 'assigned', updated_at = NOW()
    WHERE id = p_driver_id;

    UPDATE deliveries
    SET status = 'assigned', vehicle_id = p_vehicle_id, driver_id = p_driver_id, updated_at = NOW()
    WHERE id = p_delivery_id;

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_assignment_id,
        'delivery_id', p_delivery_id,
        'vehicle_id', p_vehicle_id,
        'driver_id', p_driver_id
    );
END;
$$ LANGUAGE plpgsql;

-- 8. INITIAL SEED DATA
INSERT INTO vehicles (id, registration, type, capacity, status) VALUES
('veh-101', 'TRK-8841', 'Heavy Semi-Truck', '18,000 kg', 'available'),
('veh-102', 'VAN-2093', 'Refrigerated Lorry', '3,500 kg', 'available'),
('veh-103', 'EV-4410', 'Electric Cargo Sprinter', '2,200 kg', 'available'),
('veh-104', 'FLT-9022', 'Flatbed Carrier', '12,000 kg', 'assigned'),
('veh-105', 'MNT-0012', 'Box Truck', '6,000 kg', 'maintenance'),
('veh-106', 'VAN-5521', 'Urban Courier Van', '1,800 kg', 'available');

INSERT INTO drivers (id, name, role, is_verified, availability_status, phone) VALUES
('drv-01', 'Marcus Vance', 'full_time', TRUE, 'available', '+1 (555) 234-8901'),
('drv-02', 'Sarah Chen', 'full_time', TRUE, 'available', '+1 (555) 345-6712'),
('drv-03', 'Elena Rostova', 'part_time', TRUE, 'unavailable', '+1 (555) 890-1234'),
('drv-04', 'Jamal Davis', 'part_time', TRUE, 'available', '+1 (555) 456-7890'),
('drv-05', 'Alex Rodriguez', 'full_time', TRUE, 'assigned', '+1 (555) 678-9012'),
('drv-06', 'Leo Thorne', 'part_time', FALSE, 'available', '+1 (555) 789-0123');

INSERT INTO deliveries (id, tracking_code, destination, cargo_weight, cargo_description, priority, status, vehicle_id, driver_id) VALUES
('del-101', 'DEL-7401', 'North Gate Distribution Hub', '1,450 kg', 'Medical Vaccines & Cryo-storage', 'urgent', 'pending', NULL, NULL),
('del-102', 'DEL-7402', 'Harbor Freight Terminal 9', '8,200 kg', 'Industrial Hydraulic Pumps', 'high', 'pending', NULL, NULL),
('del-103', 'DEL-7403', 'Downtown Retail Supercenter', '2,100 kg', 'Consumer Electronics & Displays', 'standard', 'pending', NULL, NULL),
('del-104', 'DEL-7404', 'Airport Logistics Cargo East', '4,800 kg', 'Automotive Engine Spares', 'high', 'assigned', 'veh-104', 'drv-05'),
('del-105', 'DEL-7405', 'Westside Medical Center', '620 kg', 'Surgical Kits & Diagnostics', 'urgent', 'in_transit', 'veh-102', 'drv-01'),
('del-106', 'DEL-7406', 'Metropolitan Fulfillment Hub', '3,400 kg', 'Dry Packaged Food Supplies', 'standard', 'delivered', NULL, NULL);

-- Active assignment for del-104
INSERT INTO assignments (id, delivery_id, vehicle_id, driver_id, status, assigned_at) VALUES
('asg-104', 'del-104', 'veh-104', 'drv-05', 'active', NOW() - INTERVAL '45 minutes'),
('asg-105', 'del-105', 'veh-102', 'drv-01', 'active', NOW() - INTERVAL '20 minutes');
