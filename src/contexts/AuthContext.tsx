import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export interface TelegramUser {
  telegram_id: number
  full_name: string
  role: 'developer' | 'owner_business' | 'seller' | 'storekeeper'
}

interface AuthState {
  user: TelegramUser | null
  token: string | null
}

interface AuthContextType extends AuthState {
  login: (user: TelegramUser, token: string) => void
  logout: () => void
  hasRole: (...roles: TelegramUser['role'][]) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function loadAuth(): AuthState {
  try {
    const token = localStorage.getItem('access_token')
    const userRaw = localStorage.getItem('tg_user')
    if (token && userRaw) return { token, user: JSON.parse(userRaw) }
  } catch {
    return { user: null, token: null }
  }
  return { user: null, token: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadAuth)

  const login = (user: TelegramUser, token: string) => {
    localStorage.setItem('access_token', token)
    localStorage.setItem('tg_user', JSON.stringify(user))
    setAuth({ user, token })
  }
  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('tg_user')
    setAuth({ user: null, token: null })
  }

  const hasRole = (...roles: TelegramUser['role'][]) => {
    if (!auth.user) return false
    if (auth.user.role === 'developer' || auth.user.role === 'owner_business') return true
    return roles.includes(auth.user.role)
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}