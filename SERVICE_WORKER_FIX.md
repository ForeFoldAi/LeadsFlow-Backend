# Service Worker Error Fix

## Error
```
Error parsing push payload: SyntaxError: Failed to execute 'json' on 'PushMessageData': 
Unexpected token 'T', "Test push "... is not valid JSON
```

## Problem
Your service worker is trying to manually parse the push event data as JSON, but Firebase Cloud Messaging handles this automatically. You should use `messaging.onBackgroundMessage()` instead of manually parsing the push event.

## Solution

### Replace your current service worker with this:

**File:** `public/firebase-messaging-sw.js`

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// ✅ CORRECT: Use Firebase's onBackgroundMessage handler
// Firebase automatically parses the message - no manual JSON parsing needed
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationBody = payload.notification?.body || '';
  const notificationIcon = payload.notification?.icon || '/logo.png';
  const clickAction = payload.data?.clickAction || '/';
  
  return self.registration.showNotification(notificationTitle, {
    body: notificationBody,
    icon: notificationIcon,
    badge: '/logo.png',
    tag: payload.data?.type || 'notification',
    data: {
      ...payload.data,
      clickAction: clickAction
    },
    requireInteraction: true
  });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickAction = event.notification.data?.clickAction || '/';
  const urlToOpen = new URL(clickAction, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
```

## What Was Wrong

### ❌ WRONG (Your Current Code):
```javascript
self.addEventListener('push', (event) => {
  // Trying to manually parse JSON
  const data = event.data.json(); // ❌ This fails!
  // ...
});
```

### ✅ CORRECT:
```javascript
// Let Firebase handle it automatically
messaging.onBackgroundMessage((payload) => {
  // payload is already parsed!
  // No need to call event.data.json()
});
```

## Steps to Fix

1. **Replace your service worker file** with the code above
2. **Update Firebase config** with your actual values
3. **Unregister old service worker:**
   ```javascript
   // In browser console
   navigator.serviceWorker.getRegistrations().then(registrations => {
     registrations.forEach(registration => {
       registration.unregister();
     });
   });
   ```
4. **Refresh the page** to register the new service worker
5. **Test again** - the error should be gone

## Why This Happens

Firebase Cloud Messaging sends push notifications in a specific format. When you use `messaging.onBackgroundMessage()`, Firebase automatically:
- Receives the push event
- Parses the message data
- Provides you with a clean `payload` object

If you try to manually handle the `push` event and parse `event.data.json()`, you're trying to parse Firebase's internal format, which causes the JSON parsing error.

## Verification

After fixing, check the service worker console:
1. DevTools → Application → Service Workers
2. Click on your service worker
3. Click "Console"
4. You should see: `[SW] Received background message:` (no errors)

## Still Getting Errors?

If you still see errors:

1. **Check service worker file location:**
   - Must be at: `public/firebase-messaging-sw.js`
   - Accessible at: `https://yourdomain.com/firebase-messaging-sw.js`

2. **Check Firebase scripts are loading:**
   - Open `firebase-messaging-sw.js` in browser
   - Should see the code (not 404)

3. **Check for syntax errors:**
   - Use a JavaScript linter
   - Check browser console for errors

4. **Clear cache and re-register:**
   ```javascript
   // Clear all
   caches.delete('firebase-messaging-sw');
   navigator.serviceWorker.getRegistrations().then(regs => {
     regs.forEach(reg => reg.unregister());
   });
   // Then refresh page
   ```

