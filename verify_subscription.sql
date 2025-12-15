-- Check how many subscriptions exist for your user
SELECT 
  COUNT(*) as total_subscriptions,
  COUNT(CASE WHEN device_info = 'mobile' THEN 1 END) as mobile_count,
  COUNT(CASE WHEN device_info = 'desktop' THEN 1 END) as desktop_count,
  COUNT(CASE WHEN device_info IS NULL THEN 1 END) as unknown_count
FROM push_subscriptions
WHERE user_id = '55edcf6b-57ed-48e9-a3ee-5b2feaa7c6fd';

-- Show all subscriptions for your user with details
SELECT 
  endpoint,
  device_info,
  created_at,
  CASE 
    WHEN subscription_data LIKE '{%' THEN 'Valid JSON'
    ELSE 'Invalid format'
  END as json_check,
  LENGTH(subscription_data) as data_size
FROM push_subscriptions
WHERE user_id = '55edcf6b-57ed-48e9-a3ee-5b2feaa7c6fd'
ORDER BY created_at DESC;

-- Verify the subscription_data JSON structure
SELECT 
  endpoint,
  device_info,
  jsonb_pretty(subscription_data::jsonb) as formatted_subscription
FROM push_subscriptions
WHERE user_id = '55edcf6b-57ed-48e9-a3ee-5b2feaa7c6fd'
LIMIT 1;

