-- Migration: Create push_subscriptions table to support multiple devices per user
-- This allows users to receive notifications on both mobile and desktop devices

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint VARCHAR(500) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  subscription_data TEXT NOT NULL,
  device_info VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Add foreign key constraint (optional, if you want referential integrity)
-- Note: This assumes your users table has a user_id column that matches
-- ALTER TABLE push_subscriptions 
-- ADD CONSTRAINT fk_push_subscriptions_user 
-- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMENT ON TABLE push_subscriptions IS 'Stores Web Push subscriptions for multiple devices per user';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Unique endpoint URL from browser push subscription';
COMMENT ON COLUMN push_subscriptions.user_id IS 'User ID who owns this subscription';
COMMENT ON COLUMN push_subscriptions.subscription_data IS 'JSON string containing full push subscription object';
COMMENT ON COLUMN push_subscriptions.device_info IS 'Optional device identifier (mobile, desktop, etc.)';

