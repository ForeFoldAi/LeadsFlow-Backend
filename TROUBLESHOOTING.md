# Troubleshooting Multi-Device Push Notifications

## Step 1: Run Database Migration

**CRITICAL**: You must create the new `push_subscriptions` table first!

```bash
# Connect to your PostgreSQL database and run:
psql -d your_database_name -f create_push_subscriptions_table.sql

# Or manually run the SQL:
```

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint VARCHAR(500) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  subscription_data TEXT NOT NULL,
  device_info VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
```

## Step 2: Verify Backend is Running

1. Check that the backend server is running
2. Check logs for any errors when subscribing
3. Verify the `PushSubscription` entity is registered in `app.module.ts`

## Step 3: Test Backend Endpoints

### Test Subscribe Endpoint
```bash
curl -X POST http://localhost:3000/notifications/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "BASE64_KEY",
      "auth": "BASE64_KEY"
    },
    "deviceInfo": "desktop"
  }'
```

### Test Status Endpoint
```bash
curl -X GET http://localhost:3000/notifications/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response should include:
```json
{
  "userId": "1",
  "webPushInitialized": true,
  "hasNotificationSettings": true,
  "browserPushEnabled": true,
  "hasPushSubscription": true,
  "subscriptionCount": 2,
  "issues": []
}
```

## Step 4: Check Common Issues

### Issue: "Table push_subscriptions does not exist"
**Solution**: Run the migration SQL file (Step 1)

### Issue: "Cannot enable browser notifications without a push subscription"
**Solution**: Make sure you're calling `/notifications/subscribe` BEFORE enabling browser notifications in settings

### Issue: Notifications only work on one device
**Solution**: 
1. Make sure each device calls `/notifications/subscribe` separately
2. Check that each device has a different endpoint
3. Verify both subscriptions exist in the database:
   ```sql
   SELECT endpoint, user_id, device_info FROM push_subscriptions WHERE user_id = 'YOUR_USER_ID';
   ```

### Issue: Test notification from mobile goes to desktop
**Solution**: This was the original bug - it should now be fixed. Make sure:
1. Database migration is run
2. Both devices have subscribed separately
3. Backend code is updated and restarted

## Step 5: Frontend Checklist

- [ ] Frontend calls `/notifications/subscribe` when user enables notifications
- [ ] Frontend optionally sends `deviceInfo` ('mobile' or 'desktop')
- [ ] Frontend stores the subscription endpoint (for unsubscribe)
- [ ] Frontend calls `/notifications/unsubscribe` with endpoint when disabling on specific device

## Step 6: Verify in Database

Check that subscriptions are being saved:
```sql
-- See all subscriptions for a user
SELECT 
  endpoint, 
  device_info, 
  created_at,
  LENGTH(subscription_data) as data_length
FROM push_subscriptions 
WHERE user_id = 'YOUR_USER_ID';

-- Should show multiple rows if you have multiple devices
```

## Debug Logs

Check backend console logs for:
- `💾 [PUSH SUBSCRIPTION] Saving Web Push subscription for user...`
- `Creating new subscription for endpoint` or `Updating existing subscription for endpoint`
- `✅ [PUSH SUBSCRIPTION] Push subscription saved successfully`
- `🔔 [PUSH NOTIFICATION] Found X subscription(s) for user...`

If you see errors, check:
1. Database connection
2. Table exists
3. User ID format matches (string vs number)

