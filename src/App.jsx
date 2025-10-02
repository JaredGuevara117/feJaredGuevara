import { useState, useEffect, useRef } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  console.log('🚀 App cargada - Lista de Tareas v1.2.0')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [cachedData, setCachedData] = useState([])
  const [newItem, setNewItem] = useState('')

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
  }, [])

  // Guardar datos en localStorage
  const saveToCache = (data) => {
    const updatedData = [...cachedData, data]
    setCachedData(updatedData)
    localStorage.setItem('offlineData', JSON.stringify(updatedData))
  }

  // Agregar nuevo elemento
  const addItem = () => {
    if (newItem.trim()) {
      const item = {
        id: Date.now(),
        text: newItem,
        timestamp: new Date().toLocaleString(),
        synced: isOnline, // Si estás online, se marca como sincronizado
        completed: false
      }
      saveToCache(item)
      setNewItem('')
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

  // Simular sincronización cuando vuelve la conexión
  const syncData = async () => {
    if (isOnline) {
      // Simular envío de datos al servidor
      console.log('Sincronizando datos:', cachedData)
      
      // Marcar todos los datos como sincronizados
      const syncedData = cachedData.map(item => ({
        ...item,
        synced: true
      }))
      
      setCachedData(syncedData)
      localStorage.setItem('offlineData', JSON.stringify(syncedData))
      
      alert('Datos sincronizados con el servidor!')
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

        {isOnline && cachedData.some(item => !item.synced) && (
          <button onClick={syncData} className="sync-button">
            Sincronizar datos pendientes
          </button>
        )}
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
