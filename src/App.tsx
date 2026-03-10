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
      const res = await axios.post('https://trade-backend-k71d.onrender.com/auth/login', { init_data: initData })
      login(res.data.user, res.data.access_token)
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    } catch (err: unknown) {
      console.error('Login error:', err);
      const axiosErr = err as AxiosError<{ detail?: string }>
      const msg = axiosErr.response?.data?.detail || axiosErr.message || 'Неизвестная ошибка'
      alert(`❌ Ошибка: ${msg}`)
    }
    setLoading(false)
  }, [login])

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? '#1a1a1a' : '#f8f8f8',
      color: isDark ? '#fff' : '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'center',
      gap: 20,
      position: 'relative',
    }}>
      <div style={{ fontSize: 60, marginBottom: 8 }}>📦</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Склад и Продажи</h1>
      <p style={{ fontSize: 15, color: isDark ? '#999' : '#666', margin: 0 }}>Telegram Mini App MVP</p>

      <button
        onClick={handleLogin}
        disabled={loading || !isInTelegram}
        style={{
          background: 'var(--tg-theme-button-color, #2ea6ff)',
          color: 'var(--tg-theme-button-text-color, #fff)',
          border: 'none',
          borderRadius: 12,
          padding: '16px 32px',
          fontSize: 17,
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          opacity: loading ? 0.7 : 1,
        }}
      >
        🚀 Войти через Telegram
      </button>

      {!isInTelegram && (
        <p style={{ fontSize: 14, color: '#ff3b30', maxWidth: 280 }}>
          ⚠️ Это приложение работает только внутри Telegram. Откройте его в TG!
        </p>
      )}

      <div style={{ position: 'absolute', bottom: 20, fontSize: 11, color: isDark ? '#444' : '#bbb' }}>
        MVP для малого бизнеса • 2026
      </div>
    </div>
  )
}

// ─── Routes ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth()
  const isAuthenticated = !!user

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <LoginScreen />
      } />

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