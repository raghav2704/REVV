
-- ============================================================
-- REVV VEHICLE LISTING V2
-- Migration 004: Vehicle Specifications
--
-- Additive migration.
-- Existing vehicles, accounts and photos are preserved.
-- ============================================================

BEGIN;

-- ============================================================
-- VEHICLE IDENTITY
-- ============================================================

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS variant VARCHAR(150);

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS registration_plate VARCHAR(20);

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS vin VARCHAR(17);


-- ============================================================
-- BODY AND APPEARANCE
-- ============================================================

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS body_type VARCHAR(50);

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS exterior_colour VARCHAR(50);

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS seats INTEGER;


-- ============================================================
-- MECHANICAL SPECIFICATIONS
-- ============================================================

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(50);

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS transmission VARCHAR(50);

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS drivetrain VARCHAR(50);

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS engine_cc INTEGER;


-- ============================================================
-- CONDITION AND VEHICLE ORIGIN
-- ============================================================

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS condition VARCHAR(30);

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS vehicle_origin VARCHAR(30);


-- ============================================================
-- COMPLIANCE
-- ============================================================

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS wof_expiry DATE;

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS registration_expiry DATE;


-- ============================================================
-- LISTING INFORMATION
-- ============================================================

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS listing_status VARCHAR(30);

-- Existing listings remain available by default.
ALTER TABLE vehicles
    ALTER COLUMN listing_status SET DEFAULT 'active';

UPDATE vehicles
SET listing_status = 'active'
WHERE listing_status IS NULL;


-- ============================================================
-- INDEXES FOR MARKETPLACE FILTERING
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_vehicles_body_type
    ON vehicles(body_type);

CREATE INDEX IF NOT EXISTS idx_vehicles_fuel_type
    ON vehicles(fuel_type);

CREATE INDEX IF NOT EXISTS idx_vehicles_transmission
    ON vehicles(transmission);

CREATE INDEX IF NOT EXISTS idx_vehicles_condition
    ON vehicles(condition);

CREATE INDEX IF NOT EXISTS idx_vehicles_listing_status
    ON vehicles(listing_status);


COMMIT;
