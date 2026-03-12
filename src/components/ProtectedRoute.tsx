import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { TelegramUser } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: TelegramUser['role'][]
  strict?: boolean  // если true — isAdmin не обходит проверку ролей
}

export default function ProtectedRoute({ children, roles, strict = false }: ProtectedRouteProps) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  const isAdmin = !strict && (user.role === 'developer' || user.role === 'owner_business')
  if (roles && !isAdmin && !roles.includes(user.role)) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        padding: 32,
        textAlign: 'center',
        background: '#1a1a1a',
        color: '#fff',
      }}>
        <div style={{ fontSize: 48 }}>🚫</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Нет доступа</div>
        <div style={{ fontSize: 14, color: '#888' }}>
          У вашей роли нет доступа к этому разделу
        </div>
      </div>
    )
  }

  return <>{children}</>
}