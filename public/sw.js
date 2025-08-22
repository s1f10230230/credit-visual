const CACHE_NAME = 'credit-visual-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-v1.0.0';

// Files to cache on install
const STATIC_FILES = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add other static assets
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /^https:\/\/api\.example\.com\/transactions/,
  /^https:\/\/api\.example\.com\/analytics/,
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('Caching static files');
      return cache.addAll(STATIC_FILES);
    }).then(() => {
      // Take control immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages
      return self.clients.claim();
    })
  );
});

// Fetch event - handle requests with cache-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else if (isAPIRequest(url)) {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  } else if (isNavigationRequest(request)) {
    event.respondWith(navigationStrategy(request));
  } else {
    event.respondWith(staleWhileRevalidateStrategy(request, DYNAMIC_CACHE));
  }
});

// Background sync for offline transactions
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'transaction-upload') {
    event.waitUntil(syncTransactions());
  } else if (event.tag === 'data-sync') {
    event.waitUntil(syncData());
  }
});

// Periodic sync for automatic updates
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic sync triggered:', event.tag);
  
  if (event.tag === 'transaction-sync') {
    event.waitUntil(periodicTransactionSync());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('Push message received');
  
  let notificationData = {
    title: 'クレジットカード支出管理',
    body: '新しい通知があります',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: {}
  };

  if (event.data) {
    try {
      notificationData = { ...notificationData, ...event.data.json() };
    } catch (error) {
      console.error('Error parsing push data:', error);
    }
  }

  const promiseChain = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      actions: [
        {
          action: 'view',
          title: '詳細を見る',
          icon: '/icons/action-view.png'
        },
        {
          action: 'dismiss',
          title: '閉じる',
          icon: '/icons/action-dismiss.png'
        }
      ],
      requireInteraction: false,
      silent: false
    }
  );

  event.waitUntil(promiseChain);
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    // Open the app to the relevant page
    const urlToOpen = new URL('/', self.location.origin);
    
    if (event.notification.data && event.notification.data.url) {
      urlToOpen.pathname = event.notification.data.url;
    }

    const promiseChain = clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      let matchingClient = null;

      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url === urlToOpen.href) {
          matchingClient = windowClient;
          break;
        }
      }

      if (matchingClient) {
        return matchingClient.focus();
      } else {
        return clients.openWindow(urlToOpen.href);
      }
    });

    event.waitUntil(promiseChain);
  }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Share target handling
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname === '/share-transaction' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
  }
});

// Caching strategies
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.error('Cache-first strategy failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(JSON.stringify({ 
      error: 'Offline',
      message: 'Data not available offline' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

async function navigationStrategy(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(STATIC_CACHE);
    return cache.match('/') || new Response('App offline', { status: 503 });
  }
}

// Background sync functions
async function syncTransactions() {
  try {
    console.log('Syncing offline transactions...');
    
    // This would normally get data from IndexedDB
    const pendingTransactions = await getStoredData('pendingTransactions');
    
    if (pendingTransactions && pendingTransactions.length > 0) {
      const response = await fetch('/api/transactions/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pendingTransactions),
      });

      if (response.ok) {
        await clearStoredData('pendingTransactions');
        console.log('Transactions synced successfully');
        
        // Notify user
        await self.registration.showNotification('同期完了', {
          body: `${pendingTransactions.length}件の取引を同期しました`,
          icon: '/icons/icon-192x192.png',
          tag: 'sync-complete'
        });
      }
    }
  } catch (error) {
    console.error('Transaction sync failed:', error);
  }
}

async function syncData() {
  try {
    console.log('Syncing application data...');
    
    // Sync latest transactions
    const response = await fetch('/api/transactions/latest');
    if (response.ok) {
      const data = await response.json();
      await storeData('latestTransactions', data);
    }
  } catch (error) {
    console.error('Data sync failed:', error);
  }
}

async function periodicTransactionSync() {
  try {
    console.log('Performing periodic transaction sync...');
    await syncData();
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('receipt');
    const title = formData.get('title');
    const text = formData.get('text');

    // Process shared files/data
    const shareData = {
      title,
      text,
      files: files.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size
      }))
    };

    // Send to main app
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SHARE_TARGET',
        payload: shareData
      });
    });

    // Return success response
    return new Response('Share received', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (error) {
    console.error('Share target handling failed:', error);
    return new Response('Share failed', { status: 500 });
  }
}

// Utility functions
function isStaticAsset(url) {
  return url.pathname.startsWith('/static/') || 
         url.pathname.includes('.js') || 
         url.pathname.includes('.css') ||
         url.pathname.includes('.png') ||
         url.pathname.includes('.jpg') ||
         url.pathname.includes('.svg');
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') ||
         API_CACHE_PATTERNS.some(pattern => pattern.test(url.href));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' && 
          request.headers.get('accept') && 
          request.headers.get('accept').includes('text/html'));
}

async function getStoredData(key) {
  // In a real app, this would use IndexedDB
  try {
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      return new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          resolve(event.data);
        };
        
        clients[0].postMessage({
          type: 'GET_STORED_DATA',
          key
        }, [channel.port2]);
      });
    }
  } catch (error) {
    console.error('Failed to get stored data:', error);
  }
  return null;
}

async function storeData(key, data) {
  try {
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      clients[0].postMessage({
        type: 'STORE_DATA',
        key,
        data
      });
    }
  } catch (error) {
    console.error('Failed to store data:', error);
  }
}

async function clearStoredData(key) {
  try {
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      clients[0].postMessage({
        type: 'CLEAR_STORED_DATA',
        key
      });
    }
  } catch (error) {
    console.error('Failed to clear stored data:', error);
  }
}