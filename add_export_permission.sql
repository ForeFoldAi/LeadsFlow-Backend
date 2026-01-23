-- Migration: Add can_export_leads column to user_permissions table
ALTER TABLE user_permissions ADD COLUMN can_export_leads BOOLEAN DEFAULT false;

-- Optional: Update existing records if needed
UPDATE user_permissions SET can_export_leads = false WHERE can_export_leads IS NULL;
