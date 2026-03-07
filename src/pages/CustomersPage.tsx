import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import CustomerDetailModal from './customers/CustomerDetailModal'
import AddCustomerModal from './customers/AddCustomerModal'

export interface Customer {
  id: number
  name: string
  phone: string
  address: string | null
  photo_url: string | null
  lat: number | null
  lng: number | null
  total_purchases: number
  total_debt: number
  is_active: boolean
  created_at: string
}

export default function CustomersPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [filterDebt, setFilterDebt] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (filterDebt) params.has_debt = 'true'
    if (showInactive) params.show_inactive = 'true'
    axios.get('/customers', {
      headers: { Authorization: `Bearer ${token}` }, params,
    }).then(r => {
      if (!cancelled) { setCustomers(r.data); setLoading(false) }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [search, filterDebt, showInactive, token])

  const totalDebt = customers.reduce((s, c) => s + c.total_debt, 0)
  const debtorsCount = customers.filter(c => c.total_debt > 0).length

  const bg = isDark ? '#1a1a1a' : '#f0f2f5'
  const card = isDark ? '#242424' : '#ffffff'
  const text = isDark ? '#ffffff' : '#1a1a1a'
  const muted = isDark ? '#666' : '#999'
  const border = isDark ? '#333' : '#e8eaed'

  const fmt = (n: number) => n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}М`
    : n >= 1_000 ? `${(n / 1_000).toFixed(0)}К` : String(Math.round(n))

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ background: card, padding: '14px 16px 10px', boxShadow: `0 1px 0 ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={() => navigate('/')}
            style={{ background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: text }}>👥 Клиенты</div>
          {debtorsCount > 0 && (
            <div style={{ background: '#ff3b30', borderRadius: 10, padding: '3px 8px', fontSize: 12, color: '#fff', fontWeight: 700 }}>
              ⏳ {debtorsCount}
            </div>
          )}
        </div>

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Имя или телефон..."
            style={{ flex: 1, background: isDark ? '#333' : '#f8f9fa', border: `1px solid ${border}`, borderRadius: 12, padding: '9px 14px', fontSize: 14, color: text, outline: 'none' }}
          />
          <button onClick={() => setFilterDebt(!filterDebt)} style={{
            background: filterDebt ? '#ff3b30' : (isDark ? '#333' : '#f8f9fa'),
            border: `1px solid ${filterDebt ? '#ff3b30' : border}`,
            borderRadius: 12, padding: '9px 12px', fontSize: 13,
            color: filterDebt ? '#fff' : muted, cursor: 'pointer', fontWeight: 600,
          }}>⏳</button>
          <button onClick={() => setShowInactive(!showInactive)} style={{
            background: showInactive ? '#8c5a1a' : (isDark ? '#333' : '#f8f9fa'),
            border: `1px solid ${showInactive ? '#8c5a1a' : border}`,
            borderRadius: 12, padding: '9px 12px', fontSize: 13,
            color: showInactive ? '#fff' : muted, cursor: 'pointer', fontWeight: 600,
          }} title="Показать скрытых клиентов">🗂️</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px' }}>
        {[
          { label: 'Всего', value: customers.length, color: '#2481cc' },
          { label: 'Должники', value: debtorsCount, color: '#ff3b30' },
          { label: 'Долгов', value: `${fmt(totalDebt)} сум`, color: '#ff3b30' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: card, borderRadius: 12, padding: '10px 8px', textAlign: 'center', border: `1px solid ${border}` }}>
            <div style={{ fontSize: s.label === 'Долгов' ? 14 : 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Customer list */}
      <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: muted }}>Загрузка...</div>
        ) : customers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
            <div style={{ color: muted }}>Клиентов нет</div>
          </div>
        ) : customers.map(c => (
          <button key={c.id} onClick={() => setSelected(c)} style={{
            background: !c.is_active ? (isDark ? '#1e1e1e' : '#f5f5f5') : c.total_debt > 0 ? (isDark ? '#2a1a1a' : '#fff8f8') : card,
            borderRadius: 16, padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
            border: `1.5px solid ${!c.is_active ? (isDark ? '#2a2a2a' : '#ddd') : c.total_debt > 0 ? '#ff3b3040' : border}`,
            display: 'flex', alignItems: 'center', gap: 12,
            opacity: c.is_active ? 1 : 0.6,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: !c.is_active ? (isDark ? '#333' : '#e0e0e0') : c.total_debt > 0 ? '#ff3b3020' : '#2481cc20',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, overflow: 'hidden',
              border: c.photo_url ? `2px solid #2481cc40` : 'none',
            }}>
              {c.photo_url
                ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : !c.is_active ? '🚫' : c.total_debt > 0 ? '⏳' : '👤'
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: !c.is_active ? muted : text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </span>
                {c.lat && <span style={{ fontSize: 11 }}>📍</span>}
                {!c.is_active && <span style={{ fontSize: 10, background: isDark ? '#333' : '#e0e0e0', color: muted, borderRadius: 5, padding: '1px 5px', fontWeight: 600 }}>скрыт</span>}
              </div>
              <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{c.phone}</div>
              {c.total_purchases > 0 && (
                <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>
                  Покупки: {fmt(c.total_purchases)} сум
                </div>
              )}
            </div>
            {c.total_debt > 0 && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#ff3b30' }}>
                  {fmt(c.total_debt)} сум
                </div>
                <div style={{ fontSize: 10, color: '#ff3b30' }}>долг</div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Add button */}
      <div style={{ padding: '16px 16px 0' }}>
        <button onClick={() => setShowAdd(true)} style={{
          width: '100%', background: 'linear-gradient(135deg, #7a3b8c, #9d4eb5)',
          border: 'none', borderRadius: 16, padding: 15, color: '#fff',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(122,59,140,0.35)',
        }}>
          + Добавить клиента
        </button>
      </div>

      {selected && (
        <CustomerDetailModal
          customer={selected} token={token!} isDark={isDark}
          onClose={() => setSelected(null)}
          onUpdate={(updated) => {
            setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c))
            setSelected(updated)
          }}
          onDelete={(id) => {
            setCustomers(prev => prev.filter(c => c.id !== id))
            setSelected(null)
          }}
        />
      )}

      {showAdd && (
        <AddCustomerModal token={token!} isDark={isDark}
          onClose={() => setShowAdd(false)}
          onSuccess={(newCustomer) => {
            setCustomers(prev => [newCustomer, ...prev])
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}