-- ============================================
-- DigiGate Master Schema
-- ============================================
-- This table lives in the default 'public' schema.
-- It is the catalog of all registered institutes.
-- Each institute's data lives in its own PostgreSQL schema.
-- ============================================

CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    institute_name VARCHAR(100) NOT NULL,
    domain VARCHAR(50) UNIQUE NOT NULL,       -- e.g., 'iiitdmj' (subdomain identifier)
    schema_name VARCHAR(50) UNIQUE NOT NULL,  -- e.g., 'iiitdmj' (PostgreSQL schema name)
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);
