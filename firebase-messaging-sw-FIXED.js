// firebase-messaging-sw.js - FIXED VERSION
// Place this file in your public folder (public/firebase-messaging-sw.js)

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in service worker
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

// Handle background messages - THIS IS THE CORRECT WAY
// Firebase automatically parses the message, so we don't need to manually parse JSON
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  // Extract notification data
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationBody = payload.notification?.body || payload.data?.body || 'You have a new notification';
  const notificationIcon = payload.notification?.icon || payload.data?.icon || '/logo.png';
  const clickAction = payload.data?.clickAction || payload.fcmOptions?.link || '/';
  
  const notificationOptions = {
    body: notificationBody,
    icon: notificationIcon,
    badge: '/logo.png',
    tag: payload.data?.type || 'lead-notification',
    data: {
      ...payload.data,
      clickAction: clickAction
    },
    requireInteraction: true,
    // Add actions if needed
    actions: []
  };

  console.log('[firebase-messaging-sw.js] Showing notification:', notificationTitle);
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  
  event.notification.close();

  // Get the click action from notification data
  const clickAction = event.notification.data?.clickAction || '/';
  const urlToOpen = new URL(clickAction, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
      // Check if there's already a window/tab open with this URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Optional: Handle push event directly (if needed for debugging)
// But Firebase's onBackgroundMessage should handle everything
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received');
  
  // Firebase messaging handles this automatically via onBackgroundMessage
  // Only add this if you need custom handling
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[firebase-messaging-sw.js] Push data:', data);
    } catch (error) {
      console.log('[firebase-messaging-sw.js] Push data is not JSON, Firebase will handle it');
    }
  }
});

