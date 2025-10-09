import { useState, useEffect, useRef } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import apiService from './apiService.js'
import './test-sync.js' // Script de testing

function App() {
  console.log('🚀 App cargada - Lista de Tareas v1.2.0')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [cachedData, setCachedData] = useState([])
  const [newItem, setNewItem] = useState('')
  const [apiStats, setApiStats] = useState({})

  // Detectar estado de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Cargar datos desde localStorage (simulando cache)
  useEffect(() => {
    const savedData = localStorage.getItem('offlineData')
    if (savedData) {
      setCachedData(JSON.parse(savedData))
    }
    
    // Cargar estadísticas de API
    loadApiStats()
  }, [])

  // Cargar estadísticas de la API
  const loadApiStats = async () => {
    try {
      const stats = await apiService.getStats()
      setApiStats(stats)
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }


  // Guardar datos en localStorage
  const saveToCache = (data) => {
    const updatedData = [...cachedData, data]
    setCachedData(updatedData)
    localStorage.setItem('offlineData', JSON.stringify(updatedData))
  }

  // Agregar nuevo elemento
  const addItem = async () => {
    if (newItem.trim()) {
      const item = {
        id: Date.now(),
        text: newItem,
        timestamp: new Date().toLocaleString(),
        synced: false, // Siempre empezar como no sincronizado
        completed: false
      }
      
      // Intentar enviar al servidor usando la nueva API
      try {
        const response = await apiService.createTask({
          title: newItem,
          body: `Tarea: ${newItem}`,
          userId: 1,
          originalId: item.id.toString()
        })
        
        if (response.success) {
          console.log('✅ Tarea creada en el servidor:', response.data)
          item.synced = true // Marcar como sincronizado
          item.id = response.data._id // Usar ID del servidor
        }
      } catch (error) {
        console.log('❌ Error enviando al servidor, se guardó en IndexedDB:', error)
        // El apiService ya guardó en IndexedDB automáticamente
      }
      
      saveToCache(item)
      setNewItem('')
      
      // Actualizar estadísticas
      await loadApiStats()
    }
  }

  // Marcar tarea como completada
  const toggleTask = (taskId) => {
    const updatedData = cachedData.map(item => {
      if (item.id === taskId) {
        return { ...item, completed: !item.completed }
      }
      return item
    })
    
    setCachedData(updatedData)
    localStorage.setItem('offlineData', JSON.stringify(updatedData))
  }

  // Sincronización manual (botón)
  const syncData = async () => {
    if (isOnline) {
      try {
        console.log('🔄 Iniciando sincronización manual...')
        
        // Usar el nuevo método de sincronización automática
        await apiService.forceSync()
        
        // Recargar datos desde la API
        await loadTasksFromAPI()
        
        // Actualizar estadísticas
        await loadApiStats()
        
        console.log('✅ Sincronización manual completada')
      } catch (error) {
        console.error('Error en sincronización manual:', error)
        alert('Error en sincronización. Algunos datos pueden no haberse sincronizado.')
      }
    }
  }

  // Cargar tareas desde la API
  const loadTasksFromAPI = async () => {
    try {
      const response = await apiService.getTasks(1)
      if (response.success) {
        // Convertir formato de API a formato local
        const apiTasks = response.data.map(task => ({
          id: task._id,
          text: task.title,
          timestamp: new Date(task.timestamp).toLocaleString(),
          synced: true,
          completed: task.completed
        }))
        
        setCachedData(apiTasks)
        localStorage.setItem('offlineData', JSON.stringify(apiTasks))
        console.log('📥 Tareas cargadas desde la API:', apiTasks.length)
      }
    } catch (error) {
      console.error('Error cargando tareas desde API:', error)
    }
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      
      <h1>🚀 Mi PWA App</h1>
      <p className="app-description">
        Una aplicación web progresiva con splash screen, iconos de diferentes resoluciones 
        y funcionalidad offline completa.
      </p>
      
      {/* Indicador de estado de conexión */}
      <div className="connection-status">
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? '🟢 En línea' : '🔴 Sin conexión'}
        </div>
        {!isOnline && (
          <p className="offline-message">
            Estás offline. Los datos se guardarán localmente y se sincronizarán cuando vuelva la conexión.
          </p>
        )}
      </div>

      <div className="card">
        <h3>📝 Lista de Tareas Offline</h3>
        <p>
          Agrega tareas, márcalas como completadas y todo se guarda automáticamente.
          Funciona perfectamente sin conexión a internet.
        </p>
        
      </div>

      {/* Funcionalidad offline demo */}
      <div className="offline-demo">
        <h2>Demo de Funcionalidad Offline</h2>
        
        <div className="add-item">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Agregar elemento..."
            onKeyPress={(e) => e.key === 'Enter' && addItem()}
          />
          <button onClick={addItem}>Agregar</button>
        </div>

        {cachedData.length > 0 && (
          <div className="cached-items">
            <h3>Tareas guardadas {isOnline ? '(en línea)' : '(offline)'}</h3>
            <ul>
              {cachedData.map(item => (
                <li key={item.id} className={`${item.synced ? 'synced' : 'pending'} ${item.completed ? 'completed' : ''}`}>
                  <div className="task-content">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleTask(item.id)}
                      className="task-checkbox"
                    />
                    <span className={`task-text ${item.completed ? 'completed-text' : ''}`}>
                      {item.text}
                    </span>
                  </div>
                  <div className="task-meta">
                    <small>{item.timestamp}</small>
                    {!item.synced && <span className="sync-badge">Pendiente</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Botón de sincronización */}
        <div className="sync-controls">
          {isOnline && (
            <button onClick={syncData} className="sync-button">
              🔄 Sincronizar datos pendientes
            </button>
          )}
          
          {/* Estado de sincronización */}
          <div className="sync-status">
            {apiService.getSyncStatus().syncInProgress && (
              <span className="syncing">🔄 Sincronizando...</span>
            )}
            {!isOnline && (
              <span className="offline-status">📴 Modo offline</span>
            )}
            {isOnline && !apiService.getSyncStatus().syncInProgress && (
              <span className="online-status">🌐 En línea</span>
            )}
          </div>
        </div>
      </div>


      <div className="pwa-info">
        <h3>🎨 Características PWA implementadas:</h3>
        <ul>
          <li>✅ <strong>Splash Screen:</strong> Pantalla de carga con color de fondo azul (#2196F3)</li>
          <li>✅ <strong>Iconos múltiples:</strong> 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512</li>
          <li>✅ <strong>Manifest completo:</strong> Configuración para instalación en dispositivos móviles</li>
          <li>✅ <strong>Cache de APP SHELL:</strong> Rutas fijas en cache</li>
          <li>✅ <strong>Cache dinámico:</strong> Contenido nuevo se cachea automáticamente</li>
          <li>✅ <strong>Funcionalidad offline:</strong> Funciona sin conexión a internet</li>
          <li>✅ <strong>Service Worker:</strong> Activación automática para funcionalidad offline</li>
        </ul>
        
        <div className="install-instructions">
          <h4>📱 Para instalar esta PWA:</h4>
          <ol>
            <li>Busca el botón "📱 Instalar PWA" en la esquina superior derecha</li>
            <li>O usa el menú del navegador: "Agregar a pantalla de inicio"</li>
            <li>¡Disfruta de tu PWA con splash screen!</li>
          </ol>
          
          <div className="pwa-status">
            <h4>🔍 Características PWA:</h4>
            <p>✅ Manifest.json configurado</p>
            <p>✅ Service Worker activo</p>
            <p>✅ Iconos optimizados</p>
            <p>✅ Splash screen configurado</p>
            <p>✅ Funcionalidad offline</p>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
