// sw.js - Service Worker for feecent PWA (With Error Handling)

const CACHE_NAME = "feecent-v2";
const urlsToCache = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/login.html",
  "/register.html",
];

// Cache only essential files, skip optional ones
const optionalUrls = [
  "/admin.html",
  "/admin-ledger.html",
  "/css/main.css",
  "/css/dashboard.css",
  "/css/admin.css",
  "/css/mobile.css",
  "/js/main.js",
  "/js/dashboard.js",
  "/js/admin.js",
  "/js/admin-ledger.js",
  "/js/constants.js",
  "/js/pull-to-refresh.js",
  "/icons/icon-192x192.png",
  "/icons/badge-72x72.png",
];

// Install event - cache essential files only
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        // Try to cache essential files
        for (const url of urlsToCache) {
          try {
            const response = await fetch(url);
            if (response && response.ok) {
              await cache.put(url, response);
              console.log(`Cached: ${url}`);
            } else {
              console.log(`Skipped (not found): ${url}`);
            }
          } catch (error) {
            console.log(`Failed to cache ${url}:`, error.message);
          }
        }

        // Try optional files but don't fail if they don't exist
        for (const url of optionalUrls) {
          try {
            const response = await fetch(url);
            if (response && response.ok) {
              await cache.put(url, response);
              console.log(`Cached: ${url}`);
            }
          } catch (error) {
            // Silently skip optional files
            console.log(`Optional file not cached: ${url}`);
          }
        }

        console.log("Cache setup complete");
      })
      .catch((err) => {
        console.error("Cache setup error:", err);
      }),
  );

  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );

  return self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip API calls
  if (event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for HTML and CSS/JS
        if (
          response &&
          response.status === 200 &&
          (event.request.url.includes(".html") ||
            event.request.url.includes(".css") ||
            event.request.url.includes(".js"))
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // For navigation requests, return index.html
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
          return new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
      }),
  );
});

// Push notification event
self.addEventListener("push", (event) => {
  console.log("Push notification received", event);
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: "feecent",
        body: event.data.text(),
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-72x72.png",
      };
    }
  }

  const options = {
    body: data.body || "You have a new notification",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/badge-72x72.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/dashboard.html",
      notificationId: data.notificationId,
    },
    actions: [
      {
        action: "open",
        title: "View",
      },
      {
        action: "close",
        title: "Dismiss",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "feecent", options),
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked", event);
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/dashboard.html";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (let client of windowClients) {
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});
