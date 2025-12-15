-- Check all subscriptions for debugging
SELECT 
  endpoint,
  user_id,
  device_info,
  LENGTH(subscription_data) as data_length,
  created_at,
  updated_at,
  LEFT(subscription_data, 100) as subscription_preview
FROM push_subscriptions
ORDER BY created_at DESC;

-- Check subscriptions for a specific user (replace with your user_id)
-- SELECT 
--   endpoint,
--   user_id,
--   device_info,
--   created_at
-- FROM push_subscriptions
-- WHERE user_id = '55edcf6b-57ed-48e9-a3ee-5b2feaa7c6fd';

-- Verify subscription_data JSON is valid
SELECT 
  endpoint,
  user_id,
  device_info,
  CASE 
    WHEN subscription_data::text IS NOT NULL THEN 'Valid JSON'
    ELSE 'Invalid JSON'
  END as json_status
FROM push_subscriptions;

