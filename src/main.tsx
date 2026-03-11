import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.tsx'
import './index.css'

// Глобальный baseURL — чинит все relative axios-запросы в компонентах
axios.defaults.baseURL = 'https://trade-backend-k71d.onrender.com'

// Глобальный интерцептор — автоматически добавляет токен из localStorage
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)