import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../contexts/AuthContext'
import type { TelegramUser } from '../contexts/AuthContext'

const ROLE_LABELS: Record<string, string> = {
  developer: '👨‍💻 Разработчик',
  owner_business: '👑 Владелец',
  seller: '🛒 Продавец',
  storekeeper: '📦 Кладовщик',
}

interface MenuItem {
  id: string
  icon: string
  label: string
  sublabel: string
  path: string
  roles: TelegramUser['role'][]
  color: string
  colorDark: string
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'stock',
    icon: '📦',
    label: 'Склад',
    sublabel: 'Товары и остатки',
    path: '/stock',
    roles: ['developer', 'owner_business', 'storekeeper'],
    color: '#1a6b3c',
    colorDark: '#0f3d22',
  },
  {
    id: 'sales',
    icon: '💰',
    label: 'Продажи',
    sublabel: 'Новая продажа',
    path: '/sales',
    roles: ['developer', 'owner_business', 'seller', 'storekeeper'],
    color: '#1a4b8c',
    colorDark: '#0f2b52',
  },
  {
    id: 'customers',
    icon: '👥',
    label: 'Клиенты',
    sublabel: 'Долги и история',
    path: '/customers',
    roles: ['developer', 'owner_business', 'seller'],
    color: '#7a3b8c',
    colorDark: '#47235a',
  },
  {
    id: 'dashboard',
    icon: '📊',
    label: 'Дашборд',
    sublabel: 'Аналитика и отчёты',
    path: '/dashboard',
    roles: ['developer', 'owner_business'],
    color: '#8c4a1a',
    colorDark: '#522b0f',
  },
  {
    id: 'suppliers',
    icon: '🚚',
    label: 'Поставщики',
    sublabel: 'Управление',
    path: '/suppliers',
    roles: ['developer', 'owner_business', 'storekeeper'],
    color: '#2c6b8c',
    colorDark: '#1a3d52',
  },
  {
    id: 'users',
    icon: '🧑‍💼',
    label: 'Сотрудники',
    sublabel: 'Роли и доступ',
    path: '/users',
    roles: ['developer', 'owner_business'],
    color: '#5a5a8c',
    colorDark: '#333352',
  },
  {
    id: 'expenses',
    icon: '💸',
    label: 'Расходы',
    sublabel: 'Учёт затрат',
    path: '/expenses',
    roles: ['developer', 'owner_business'],
    color: '#8c2a2a',
    colorDark: '#521a1a',
  },
  {
  id: 'returns', icon: '↩️', label: 'Возвраты', sublabel: 'Оформить возврат',
  path: '/returns', roles: ['developer', 'owner_business', 'seller'],
  color: '#8c5a1a', colorDark: '#523410',
  },
  
  {
  id: 'audit', icon: '📋', label: 'Журнал', sublabel: 'История событий',
  path: '/audit', roles: ['developer'],
  color: '#4a6b8c', colorDark: '#2a3d52',
  },


]

export default function MainMenu() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'

  const [quickStats, setQuickStats] = useState<{
    today_revenue: number; today_sales: number; total_debt: number; low_stock_count: number
  } | null>(null)

  useEffect(() => {
    if (!token) return
    api.get('/dashboard/quick-stats')
      .then(r => setQuickStats(r.data))
      .catch(() => {})
  }, [token])

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}М` :
    n >= 1_000 ? `${(n / 1_000).toFixed(0)}К` : String(Math.round(n))

  const availableItems = MENU_ITEMS.filter(item => user?.role && item.roles.includes(user.role as typeof item.roles[number]))

  const handleTap = (item: MenuItem) => {
    tg?.HapticFeedback?.impactOccurred('light')
    navigate(item.path)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? '#1a1a1a' : '#f0f2f5',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: isDark ? '#242424' : '#ffffff',
        padding: '16px 20px 12px',
        boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>
              {ROLE_LABELS[user?.role ?? '']}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: isDark ? '#fff' : '#000' }}>
              {user?.full_name}
            </div>
          </div>
          <div style={{ fontSize: 32 }}>📦</div>
        </div>
      </div>

      {/* Title */}
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: isDark ? '#fff' : '#1a1a1a', letterSpacing: '-0.5px' }}>
          Главное меню
        </div>
        <div style={{ fontSize: 13, color: isDark ? '#666' : '#999', marginTop: 2 }}>
          Склад и Продажи MVP
        </div>
      </div>

      {/* Menu Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '12px 20px', flex: 1 }}>
        {availableItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleTap(item)}
            style={{
              background: isDark
                ? `linear-gradient(135deg, ${item.colorDark} 0%, ${item.color} 100%)`
                : `linear-gradient(135deg, ${item.color} 0%, ${item.color}cc 100%)`,
              border: 'none', borderRadius: 20, padding: '22px 18px',
              cursor: 'pointer', textAlign: 'left', transition: 'transform 0.1s',
              minHeight: 130, display: 'flex', flexDirection: 'column',
              justifyContent: 'space-between', boxShadow: `0 4px 20px ${item.color}40`,
            }}
            onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.96)')}
            onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <div style={{ fontSize: 36, lineHeight: 1 }}>{item.icon}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{item.sublabel}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick Stats */}
      <div style={{ margin: '0 20px 16px', background: isDark ? '#2a2a2a' : '#fff', borderRadius: 16, padding: '14px 18px', display: 'flex', justifyContent: 'space-around' }}>
        {[
          {
            label: user?.role === 'seller' ? 'Мои продажи' : 'Сегодня',
            value: quickStats ? fmt(quickStats.today_revenue) : '—',
            icon: '📈',
            color: '#1a6b3c',
          },
          {
            label: 'Товары',
            value: quickStats ? (quickStats.low_stock_count > 0 ? `⚠️${quickStats.low_stock_count}` : '✓') : '—',
            icon: '🗂️',
            color: quickStats && quickStats.low_stock_count > 0 ? '#ff3b30' : '#34c759',
          },
          {
            label: user?.role === 'seller' ? 'Мой долг' : 'Долги',
            value: quickStats ? (quickStats.total_debt > 0 ? fmt(quickStats.total_debt) : '0') : '—',
            icon: '⏳',
            color: quickStats && quickStats.total_debt > 0 ? '#ff3b30' : '#34c759',
          },
        ].map(stat => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>{stat.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: stat.color ?? (isDark ? '#fff' : '#1a1a1a') }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: isDark ? '#666' : '#999' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 20px 24px', textAlign: 'center', fontSize: 11, color: isDark ? '#444' : '#bbb' }}>
        MVP для бизнеса • 2026
      </div>
    </div>
  )
}