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
  console.log('Service Worker: Sincronización en segundo plano - Tag:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('Service Worker: Ejecutando sincronización en segundo plano');
  
  try {
    // Obtener datos pendientes de IndexedDB
    const pendingData = await getPendingDataFromIndexedDB();
    console.log(`Service Worker: Encontrados ${pendingData.length} elementos pendientes`);
    
    // Procesar cada elemento pendiente
    for (const item of pendingData) {
      try {
        await retryFailedRequest(item);
        console.log(`Service Worker: Sincronizado exitosamente item ${item.id}`);
      } catch (error) {
        console.error(`Service Worker: Error sincronizando item ${item.id}:`, error);
        await updateRetryCount(item.id, (item.retryCount || 0) + 1);
      }
    }
    
    console.log('Service Worker: Sincronización completada');
  } catch (error) {
    console.error('Service Worker: Error en sincronización:', error);
  }
}

// Obtener datos pendientes de IndexedDB
async function getPendingDataFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PWA_Database', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingData'], 'readonly');
      const store = transaction.objectStore('pendingData');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const allData = getAllRequest.result;
        const pendingData = allData.filter(item => 
          item.status === 'pending' && (item.retryCount || 0) < 3
        );
        resolve(pendingData);
      };
      
      getAllRequest.onerror = () => {
        reject(getAllRequest.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Reintentar petición fallida
async function retryFailedRequest(requestData) {
  const { url, method, data } = requestData;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  // Eliminar de IndexedDB después de éxito
  await deleteFromIndexedDB(requestData.id);
  
  return result;
}

// Eliminar elemento de IndexedDB
async function deleteFromIndexedDB(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PWA_Database', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingData'], 'readwrite');
      const store = transaction.objectStore('pendingData');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => {
        console.log(`Service Worker: Eliminado de IndexedDB: ${id}`);
        resolve();
      };
      
      deleteRequest.onerror = () => {
        reject(deleteRequest.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Actualizar contador de reintentos
async function updateRetryCount(id, retryCount) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PWA_Database', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingData'], 'readwrite');
      const store = transaction.objectStore('pendingData');
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.retryCount = retryCount;
          data.lastRetry = new Date().toISOString();
          
          if (retryCount >= 3) {
            data.status = 'failed';
            data.failedAt = new Date().toISOString();
          }
          
          const updateRequest = store.put(data);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Datos no encontrados'));
        }
      };
      
      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
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