# Frontend Changes Required for Multi-Device Push Notifications

## Overview
The backend now supports multiple push subscriptions per user (one per device). This allows users to receive notifications on both mobile and desktop devices simultaneously.

## Required Frontend Changes

### 1. **Subscribe to Push Notifications** (`POST /notifications/subscribe`)

**Current Request (should still work):**
```javascript
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidPublicKey
});

await fetch('/api/notifications/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
      auth: arrayBufferToBase64(subscription.getKey('auth'))
    }
  })
});
```

**Recommended Update (with device detection):**
```javascript
// Detect device type
const deviceInfo = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) 
  ? 'mobile' 
  : 'desktop';

const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidPublicKey
});

await fetch('/api/notifications/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
      auth: arrayBufferToBase64(subscription.getKey('auth'))
    },
    deviceInfo: deviceInfo  // NEW: Optional but recommended
  })
});
```

### 2. **Unsubscribe from Push Notifications** (`DELETE /notifications/unsubscribe`)

**Option A: Unsubscribe current device only (recommended)**
```javascript
const subscription = await registration.pushManager.getSubscription();
if (subscription) {
  await fetch('/api/notifications/unsubscribe', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint  // NEW: Specify which device to unsubscribe
    })
  });
  
  // Also unsubscribe from browser
  await subscription.unsubscribe();
}
```

**Option B: Unsubscribe all devices**
```javascript
await fetch('/api/notifications/unsubscribe', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  }
  // No body = unsubscribe all devices
});
```

### 3. **Check Notification Status** (`GET /notifications/status`)

The response now includes `subscriptionCount`:
```javascript
const response = await fetch('/api/notifications/status', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const data = await response.json();
console.log(`You have ${data.subscriptionCount} device(s) subscribed`);
// data.subscriptionCount will show how many devices are subscribed
```

## Important Notes

1. **No Breaking Changes**: The existing frontend code should still work. The `deviceInfo` field is optional.

2. **Multiple Devices**: Each device (mobile, desktop) will create its own subscription. When you send a notification, it goes to ALL subscribed devices.

3. **Database Migration**: Make sure to run the SQL migration file `create_push_subscriptions_table.sql` to create the new table.

4. **Device Detection**: While optional, sending `deviceInfo` helps with debugging and future features.

## Testing

1. **Test on Desktop**: Subscribe from desktop browser
2. **Test on Mobile**: Subscribe from mobile browser (or PWA)
3. **Send Test Notification**: Should receive on both devices
4. **Unsubscribe One Device**: Should only unsubscribe that specific device
5. **Check Status**: Should show correct subscription count

## Helper Functions

```javascript
// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Detect device type
function getDeviceType() {
  const ua = navigator.userAgent;
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}
```

