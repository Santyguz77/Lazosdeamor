const CACHE_NAME = 'lazosdeamor-v20-splash-screen';
const urlsToCache = [
  '/',
  '/index.html',
  '/catalogo.html',
  '/login.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/assets/banner-principal.jpg'
];

// Instalación del service worker
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker Lazos de Amor v8...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Guardando archivos en caché...');
        return cache.addAll(urlsToCache).catch(err => {
          console.error('[SW] Error al cachear archivos:', err);
          // Continuar de todos modos
        });
      })
      .then(() => {
        console.log('[SW] Service Worker instalado, activando...');
        return self.skipWaiting();
      })
  );
});

// Activación y limpieza de caché antiguo
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia: Network First, fallback a Cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clonar respuesta para guardar en caché
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar desde caché
        return caches.match(event.request);
      })
  );
});

// Escuchar mensajes para mostrar notificaciones
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    
    self.registration.showNotification(title, options);
  }
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  // Abrir o enfocar la ventana de la aplicación
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Si hay una ventana abierta, enfocarla
        for (let client of clientList) {
          if (client.url.includes('index.html') && 'focus' in client) {
            return client.focus().then(client => {
              // Enviar mensaje para mostrar la sección de pedidos
              client.postMessage({
                type: 'NAVIGATE_TO_ORDERS'
              });
              return client;
            });
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow('/index.html');
        }
      })
  );
});
