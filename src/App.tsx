import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import axios, { AxiosError } from 'axios'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import MainMenu from './pages/MainMenu'
import StockPage from './pages/StockPage'
import SalesPage from './pages/SalesPage'
import CustomersPage from './pages/CustomersPage'
import DashboardPage from './pages/DashboardPage'
import SuppliersPage from './pages/SuppliersPage'
import UsersPage from './pages/UsersPage'
import ProtectedRoute from './components/ProtectedRoute'
import ExpensesPage from './pages/ExpensesPage'
import ReturnsPage from './pages/ReturnsPage'
import AuditPage from './pages/AuditPage'

// ─── Login Screen ────────────────────────────────────────────────────────────
function LoginScreen() {
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)

  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'
  const isInTelegram = !!tg

  useEffect(() => {
    const tgApp = window.Telegram?.WebApp
    if (tgApp) {
      tgApp.ready()
      tgApp.expand()
      if (tgApp.colorScheme === 'dark') document.documentElement.classList.add('tg-dark')
    }
  }, []) // intentionally once on mount

  const handleLogin = useCallback(async () => {
    const initData = window.Telegram?.WebApp?.initData
    if (!initData) {
      alert('Откройте приложение внутри Telegram!')
      return
    }
    setLoading(true)
    try {
      const res = await axios.post('/auth/login', { init_data: initData })
      login(res.data.user, res.data.access_token)
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      const msg = axiosErr.response?.data?.detail || axiosErr.message || 'Неизвестная ошибка'
      alert(`❌ Ошибка: ${msg}`)
    }
    setLoading(false)
  }, [login])

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? '#1a1a1a' : '#f0f2f5',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 320, width: '100%' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: isDark ? '#fff' : '#1a1a1a', margin: '0 0 8px' }}>
          Склад и Продажи
        </h1>
        <p style={{ fontSize: 15, color: isDark ? '#666' : '#999', marginBottom: 40 }}>
          Telegram Mini App MVP
        </p>

        <button onClick={handleLogin} disabled={loading} style={{
          width: '100%', background: loading ? '#555' : '#2481cc', color: '#fff',
          border: 'none', borderRadius: 16, padding: '16px 24px',
          fontSize: 16, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          transition: 'all 0.15s', boxShadow: '0 4px 20px rgba(36,129,204,0.4)',
        }}>
          {loading ? 'Проверка доступа...' : '🚀 Войти через Telegram'}
        </button>

        {!isInTelegram && (
          <div style={{
            marginTop: 24, padding: 16,
            background: isDark ? '#242424' : '#fff',
            borderRadius: 12, fontSize: 13, color: isDark ? '#666' : '#999',
          }}>
            🔧 Откройте в Telegram для полной работы
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 24, fontSize: 11, color: isDark ? '#333' : '#ccc' }}>
        MVP для одного бизнеса • 2026
      </div>
    </div>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginScreen />} />

      <Route path="/" element={
        <ProtectedRoute><MainMenu /></ProtectedRoute>
      } />

      <Route path="/stock" element={
        <ProtectedRoute roles={['storekeeper', 'owner_business', 'developer']}>
          <StockPage />
        </ProtectedRoute>
      } />

      <Route path="/sales" element={
        <ProtectedRoute roles={['seller', 'storekeeper', 'owner_business', 'developer']}>
          <SalesPage />
        </ProtectedRoute>
      } />

      <Route path="/customers" element={
        <ProtectedRoute roles={['seller', 'owner_business', 'developer']}>
          <CustomersPage />
        </ProtectedRoute>
      } />

      <Route path="/dashboard" element={
        <ProtectedRoute roles={['owner_business', 'developer']}>
          <DashboardPage />
        </ProtectedRoute>
      } />

      <Route path="/suppliers" element={
        <ProtectedRoute roles={['storekeeper', 'owner_business', 'developer']}>
          <SuppliersPage />
        </ProtectedRoute>
      } />

      <Route path="/users" element={
        <ProtectedRoute roles={['owner_business', 'developer']}>
          <UsersPage />
        </ProtectedRoute>
      } />
     <Route path="/expenses" element={
        <ProtectedRoute roles={['owner_business', 'developer']}>
          <ExpensesPage />
        </ProtectedRoute>
      } />

      <Route path="/returns" element={
        <ProtectedRoute roles={['owner_business', 'developer', 'seller']}>
          <ReturnsPage />
        </ProtectedRoute>
      } />

      <Route path="/audit" element={
        <ProtectedRoute roles={['owner_business', 'developer']}>
          <AuditPage />
        </ProtectedRoute>
      } />
    
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}