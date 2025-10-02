// Configuración de versiones de cache
const CACHE_VERSION = 'v1.1.0';
const APP_SHELL_CACHE = `appShell_${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic_${CACHE_VERSION}`;

// Rutas fijas del APP SHELL que se cachearán inmediatamente
const APP_SHELL_ROUTES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/index-B1Iv3R_X.js',
  '/assets/index-ydvwJqSB.css',
  '/assets/react-CHdo91hT.svg'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => {
        console.log('Service Worker: Cacheando APP SHELL...');
        return cache.addAll(APP_SHELL_ROUTES);
      })
      .then(() => {
        console.log('Service Worker: APP SHELL cacheado exitosamente');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Error cacheando APP SHELL:', error);
        // No fallar la instalación por errores de cache
        return self.skipWaiting();
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Eliminar caches viejas
            if (cacheName !== APP_SHELL_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Eliminando cache vieja:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activado y listo');
        return self.clients.claim();
      })
  );
});

// Interceptar peticiones
self.addEventListener('fetch', event => {
  // Solo manejar peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Estrategia simple: Network First
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // Si falla la red, intentar desde cache
        return caches.match(event.request);
      })
  );
});


// Manejar sincronización en segundo plano
self.addEventListener('sync', event => {
  console.log('Service Worker: Sincronización en segundo plano');
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('Service Worker: Ejecutando sincronización en segundo plano');
  // Aquí puedes implementar lógica para sincronizar datos cuando vuelva la conexión
}

// Manejar notificaciones push
self.addEventListener('push', event => {
  console.log('Service Worker: Notificación push recibida');
  
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación',
    icon: '/vite.svg',
    badge: '/vite.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('PWA App', options)
  );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notificación clickeada');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});