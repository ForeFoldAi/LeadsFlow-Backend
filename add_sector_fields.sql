-- Migration: Add sector fields to leads table and create custom_sectors table
-- Date: 2024

-- Step 1: Add sector column to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS sector VARCHAR(50) NULL;

-- Step 2: Add custom_sector column to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS custom_sector VARCHAR(255) NULL;

-- Step 3: Create custom_sectors table
CREATE TABLE IF NOT EXISTS custom_sectors (
    id SERIAL PRIMARY KEY,
    sector VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create index on sector column in custom_sectors table for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_sectors_sector ON custom_sectors(sector);

-- Step 5: Create a trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_sectors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_update_custom_sectors_updated_at
    BEFORE UPDATE ON custom_sectors
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_sectors_updated_at();

