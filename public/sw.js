// Service Worker for IXXXI Protocol PWA
// Handles caching, offline support, and background sync

const CACHE_NAME = 'ixxxi-v1.1.0';
const STATIC_CACHE = 'ixxxi-static-v1';
const AUDIO_CACHE = 'ixxxi-audio-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/discover',
  '/charts',
  '/manifest.json',
  '/offline.html',
];

// Cache strategies
const CACHE_STRATEGIES = {
  static: 'cache-first',
  api: 'network-first',
  audio: 'cache-first',
  images: 'stale-while-revalidate',
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== AUDIO_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handle requests with caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests
  if (!url.origin.includes(self.location.origin)) return;

  // Determine caching strategy based on request type
  if (url.pathname.startsWith('/api/stream')) {
    // Audio streaming - cache for offline playback (premium feature)
    event.respondWith(handleAudioRequest(request));
  } else if (url.pathname.startsWith('/api/')) {
    // API requests - network first with cache fallback
    event.respondWith(handleApiRequest(request));
  } else if (request.destination === 'image') {
    // Images - stale while revalidate
    event.respondWith(handleImageRequest(request));
  } else {
    // Static assets - cache first
    event.respondWith(handleStaticRequest(request));
  }
});

// Audio caching (for premium offline downloads)
async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    console.log('[SW] Serving cached audio:', request.url);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse.ok) {
      // Check if user has download permission (header from API)
      const canCache = networkResponse.headers.get('X-Can-Cache') === 'true';
      if (canCache) {
        cache.put(request, networkResponse.clone());
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Audio fetch failed:', error);
    // Return offline audio placeholder or error
    return new Response('Audio not available offline', { status: 503 });
  }
}

// API requests - network first
async function handleApiRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    
    // Cache successful GET requests
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API
    return new Response(
      JSON.stringify({ error: 'Offline', cached: false }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Image requests - stale while revalidate
async function handleImageRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cachedResponse || networkPromise || new Response('', { status: 404 });
}

// Static assets - cache first
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return cache.match('/offline.html');
    }
    throw error;
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      ...data.data,
    },
    actions: data.actions || [],
    tag: data.tag || 'ixxxi-notification',
    renotify: data.renotify || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-plays') {
    event.waitUntil(syncOfflinePlays());
  } else if (event.tag === 'sync-likes') {
    event.waitUntil(syncOfflineLikes());
  }
});

// Sync offline play records
async function syncOfflinePlays() {
  const db = await openIndexedDB();
  const plays = await getOfflinePlays(db);

  for (const play of plays) {
    try {
      await fetch('/api/track/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(play),
      });
      await removeOfflinePlay(db, play.id);
    } catch (error) {
      console.error('[SW] Failed to sync play:', error);
    }
  }
}

// Sync offline likes
async function syncOfflineLikes() {
  const db = await openIndexedDB();
  const likes = await getOfflineLikes(db);

  for (const like of likes) {
    try {
      await fetch('/api/social/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(like),
      });
      await removeOfflineLike(db, like.id);
    } catch (error) {
      console.error('[SW] Failed to sync like:', error);
    }
  }
}

// IndexedDB helpers for offline storage
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ixxxi-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('plays')) {
        db.createObjectStore('plays', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('likes')) {
        db.createObjectStore('likes', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getOfflinePlays(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('plays', 'readonly');
    const store = tx.objectStore('plays');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function removeOfflinePlay(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('plays', 'readwrite');
    const store = tx.objectStore('plays');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

function getOfflineLikes(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('likes', 'readonly');
    const store = tx.objectStore('likes');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function removeOfflineLike(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('likes', 'readwrite');
    const store = tx.objectStore('likes');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

console.log('[SW] Service Worker loaded - IXXXI v1.1.0');
