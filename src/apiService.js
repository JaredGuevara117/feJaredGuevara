// Servicio para manejar peticiones HTTP con fallback a IndexedDB
import dbManager from './database.js';

class ApiService {
  constructor() {
    // Cambiar a tu API local
    this.baseURL = 'http://localhost:3000/api'; // Tu API local
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 segundo
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    
    // Configurar listeners de conexión
    this.setupConnectionListeners();
  }

  // Método principal para hacer peticiones POST
  async post(endpoint, data) {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      console.log('Intentando POST a:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('POST exitoso:', result);
      return result;

    } catch (error) {
      console.error('Error en POST, guardando en IndexedDB:', error);
      
      // Guardar en IndexedDB para sincronización posterior
      await this.saveToIndexedDB({
        url,
        method: 'POST',
        data,
        endpoint,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      // Registrar tarea de sincronización
      await this.registerSyncTask();

      throw error;
    }
  }

  // Método para obtener tareas
  async getTasks(userId = 1) {
    try {
      const response = await fetch(`${this.baseURL}/tasks?userId=${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo tareas:', error);
      throw error;
    }
  }

  // Método para crear tarea
  async createTask(taskData) {
    return await this.post('/tasks', taskData);
  }

  // Método para actualizar tarea
  async updateTask(id, taskData) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error actualizando tarea:', error);
      throw error;
    }
  }

  // Método para toggle completar tarea
  async toggleTask(id) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${id}/toggle`, {
        method: 'PATCH'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error toggleando tarea:', error);
      throw error;
    }
  }

  // Método para eliminar tarea
  async deleteTask(id) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error eliminando tarea:', error);
      throw error;
    }
  }

  // Método para sincronizar datos pendientes
  async syncPendingData(pendingData) {
    try {
      const response = await fetch(`${this.baseURL}/sync/pending`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pendingData })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sincronizando datos pendientes:', error);
      throw error;
    }
  }

  // Método para obtener estadísticas
  async getStats() {
    try {
      const response = await fetch(`${this.baseURL}/sync/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      // Retornar estadísticas locales si falla
      return await dbManager.getStats();
    }
  }

  // Guardar datos en IndexedDB
  async saveToIndexedDB(requestData) {
    try {
      console.log('💾 Guardando en IndexedDB:', requestData);
      await dbManager.init();
      const id = await dbManager.savePendingData(requestData);
      console.log('✅ Datos guardados en IndexedDB con ID:', id);
      return id;
    } catch (error) {
      console.error('❌ Error guardando en IndexedDB:', error);
      throw error;
    }
  }

  // Registrar tarea de sincronización en background
  async registerSyncTask() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync');
        console.log('Tarea de sincronización registrada');
      } catch (error) {
        console.error('Error registrando tarea de sincronización:', error);
      }
    } else {
      console.warn('Background Sync no está disponible');
    }
  }

  // Método para reintentar peticiones fallidas
  async retryFailedRequests() {
    try {
      const pendingData = await dbManager.getAllPendingData();
      const failedRequests = pendingData.filter(item => 
        item.status === 'pending' && item.retryCount < this.maxRetries
      );

      console.log(`Reintentando ${failedRequests.length} peticiones fallidas`);

      // Si hay datos pendientes, intentar sincronizar con la API
      if (failedRequests.length > 0) {
        try {
          const result = await this.syncPendingData(failedRequests);
          console.log('Sincronización exitosa:', result);
          
          // Eliminar datos sincronizados de IndexedDB
          for (const request of failedRequests) {
            if (result.data.synced.some(synced => synced.originalId === request.id)) {
              await dbManager.deletePendingData(request.id);
            }
          }
        } catch (error) {
          console.error('Error en sincronización masiva, reintentando individualmente:', error);
          
          // Si falla la sincronización masiva, reintentar individualmente
          for (const request of failedRequests) {
            try {
              await this.retryRequest(request);
            } catch (error) {
              console.error('Error reintentando petición:', error);
              await this.handleRetryFailure(request, error);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error en retryFailedRequests:', error);
    }
  }

  // Reintentar una petición específica
  async retryRequest(requestData) {
    const { url, method, data } = requestData;
    
    try {
      console.log(`Reintentando ${method} a:`, url);
      
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
      console.log('Reintento exitoso:', result);
      
      // Eliminar de IndexedDB después de éxito
      await dbManager.deletePendingData(requestData.id);
      
      return result;

    } catch (error) {
      console.error('Error en reintento:', error);
      throw error;
    }
  }

  // Manejar fallo en reintento
  async handleRetryFailure(requestData, error) {
    const newRetryCount = (requestData.retryCount || 0) + 1;
    
    if (newRetryCount >= this.maxRetries) {
      // Marcar como fallido definitivamente
      await this.markAsFailed(requestData.id);
      console.log('Petición marcada como fallida definitivamente:', requestData.id);
    } else {
      // Actualizar contador de reintentos
      await dbManager.updateRetryCount(requestData.id, newRetryCount);
      console.log(`Petición ${requestData.id} actualizada, reintentos: ${newRetryCount}`);
    }
  }

  // Marcar petición como fallida
  async markAsFailed(id) {
    try {
      const transaction = dbManager.db.transaction([dbManager.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(dbManager.STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.status = 'failed';
          data.failedAt = new Date().toISOString();
          
          const updateRequest = store.put(data);
          updateRequest.onsuccess = () => {
            console.log('Petición marcada como fallida:', id);
          };
        }
      };
    } catch (error) {
      console.error('Error marcando como fallida:', error);
    }
  }

  // Obtener estadísticas de peticiones
  async getStats() {
    return await dbManager.getStats();
  }

  // Limpiar datos fallidos (para testing)
  async clearFailedData() {
    try {
      const pendingData = await dbManager.getAllPendingData();
      const failedData = pendingData.filter(item => item.status === 'failed');
      
      for (const item of failedData) {
        await dbManager.deletePendingData(item.id);
      }
      
      console.log(`Eliminados ${failedData.length} elementos fallidos`);
    } catch (error) {
      console.error('Error limpiando datos fallidos:', error);
    }
  }

  // Configurar listeners de conexión
  setupConnectionListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Conexión detectada - Iniciando sincronización...');
      this.isOnline = true;
      this.autoSync();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Sin conexión');
      this.isOnline = false;
    });
  }

  // Verificar conexión a internet
  async checkConnection() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/health`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.log('❌ Sin conexión a la API:', error.message);
      return false;
    }
  }

  // Sincronización automática
  async autoSync() {
    if (this.syncInProgress) {
      console.log('🔄 Sincronización ya en progreso...');
      return;
    }

    this.syncInProgress = true;
    console.log('🚀 Iniciando sincronización automática...');

    try {
      // Verificar conexión
      const isConnected = await this.checkConnection();
      if (!isConnected) {
        console.log('❌ No hay conexión a la API');
        this.syncInProgress = false;
        return;
      }

      // Obtener datos pendientes de IndexedDB
      const pendingData = await dbManager.getAllPendingData();
      console.log(`📦 Encontrados ${pendingData.length} elementos pendientes`);

      if (pendingData.length === 0) {
        console.log('✅ No hay datos pendientes para sincronizar');
        this.syncInProgress = false;
        return;
      }

      // Preparar datos para sincronización
      const dataToSync = pendingData.map(item => ({
        url: item.url,
        method: item.method,
        endpoint: item.endpoint,
        data: item.data,
        id: item.id
      }));

      console.log('📤 Enviando datos a la API...');
      
      // Sincronizar con la API
      const result = await this.syncPendingData(dataToSync);
      
      if (result.success) {
        console.log('✅ Sincronización exitosa:', result.message);
        
        // Eliminar datos sincronizados de IndexedDB
        const syncedIds = result.data.synced.map(item => item.originalId);
        let deletedCount = 0;
        
        for (const id of syncedIds) {
          try {
            await dbManager.deletePendingData(id);
            deletedCount++;
          } catch (error) {
            console.error('Error eliminando dato de IndexedDB:', error);
          }
        }
        
        console.log(`🗑️ Eliminados ${deletedCount} elementos de IndexedDB`);
        
        // Mostrar notificación al usuario
        this.showSyncNotification(result.data.synced.length, result.data.errors.length);
        
      } else {
        console.error('❌ Error en sincronización:', result.message);
      }

    } catch (error) {
      console.error('❌ Error en sincronización automática:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Forzar sincronización manual
  async forceSync() {
    console.log('🔄 Forzando sincronización...');
    await this.autoSync();
  }

  // Mostrar notificación de sincronización
  showSyncNotification(syncedCount, errorCount) {
    if (syncedCount > 0) {
      const message = `✅ ${syncedCount} tareas sincronizadas${errorCount > 0 ? `, ${errorCount} errores` : ''}`;
      console.log(message);
      
      // Crear notificación visual
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('PWA Sync', {
          body: message,
          icon: '/icons/icon-192x192.png'
        });
      }
      
      // Mostrar alerta si no hay notificaciones
      if (Notification.permission !== 'granted') {
        alert(message);
      }
    }
  }

  // Obtener estado de sincronización
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress
    };
  }
}

// Instancia singleton
const apiService = new ApiService();

export default apiService;
