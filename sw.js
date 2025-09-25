// Configuración de versiones de cache
const CACHE_VERSION = 'v1.1.0';
const APP_SHELL_CACHE = `appShell_${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic_${CACHE_VERSION}`;

// Rutas fijas del APP SHELL que se cachearán inmediatamente
const APP_SHELL_ROUTES = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/App.css',
  '/src/index.css',
  '/src/assets/react.svg',
  '/vite.svg',
  '/manifest.json'
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

  // Estrategia: Cache First para APP SHELL, Network First para contenido dinámico
  event.respondWith(
    handleRequest(event.request)
  );
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Verificar si es una ruta del APP SHELL
  const isAppShellRoute = APP_SHELL_ROUTES.some(route => 
    url.pathname === route || url.pathname.endsWith(route)
  );

  if (isAppShellRoute) {
    // Estrategia Cache First para APP SHELL
    return cacheFirst(request, APP_SHELL_CACHE);
  } else {
    // Estrategia Network First para contenido dinámico
    return networkFirst(request, DYNAMIC_CACHE);
  }
}

// Estrategia Cache First
async function cacheFirst(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('Service Worker: Sirviendo desde cache:', request.url);
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Error en cache first:', error);
    return new Response('Contenido no disponible offline', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Estrategia Network First
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      console.log('Service Worker: Cacheando dinámicamente:', request.url);
    }
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Red no disponible, buscando en cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Sirviendo desde cache dinámico:', request.url);
      return cachedResponse;
    }

    // Si no hay cache y no hay red, devolver página offline
    if (request.destination === 'document') {
      return caches.match('/index.html');
    }

    return new Response('Contenido no disponible offline', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

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