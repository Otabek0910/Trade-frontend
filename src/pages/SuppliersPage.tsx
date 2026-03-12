import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../contexts/AuthContext'
import SupplierDetailModal from './suppliers/SupplierDetailModal'
import AddSupplierModal from './suppliers/AddSupplierModal'

export interface Supplier {
  id: number
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  photo_url: string | null
  lat: number | null
  lng: number | null
  products_count: number
  total_receipts: number
  total_purchased: number
  created_at: string
}

export default function SuppliersPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get('/suppliers')
      .then(r => { if (!cancelled) { setSuppliers(r.data); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  const bg = isDark ? '#1a1a1a' : '#f0f2f5'
  const card = isDark ? '#242424' : '#ffffff'
  const text = isDark ? '#ffffff' : '#1a1a1a'
  const muted = isDark ? '#666' : '#999'
  const border = isDark ? '#333' : '#e8eaed'

  const fmt = (n: number) => n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}М`
    : n >= 1_000 ? `${(n / 1_000).toFixed(0)}К` : String(Math.round(n))

  const totalPurchased = suppliers.reduce((s, p) => s + p.total_purchased, 0)

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ background: card, padding: '14px 16px 12px', boxShadow: `0 1px 0 ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/')}
            style={{ background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: text }}>🚚 Поставщики</div>
          <div style={{ fontSize: 12, color: muted }}>{suppliers.length} шт</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px' }}>
        {[
          { label: 'Поставщиков', value: suppliers.length, color: '#2481cc' },
          { label: 'Товаров', value: suppliers.reduce((s, p) => s + p.products_count, 0), color: '#1a6b3c' },
          { label: 'Закуплено', value: `${fmt(totalPurchased)} сум`, color: '#7a3b8c' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: card, borderRadius: 12, padding: '10px 8px', textAlign: 'center', border: `1px solid ${border}` }}>
            <div style={{ fontSize: s.label === 'Закуплено' ? 13 : 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: muted }}>Загрузка...</div>
        ) : suppliers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚚</div>
            <div style={{ color: muted }}>Поставщиков нет</div>
          </div>
        ) : suppliers.map(s => (
          <button key={s.id} onClick={() => setSelected(s)} style={{
            background: card, borderRadius: 16, padding: '12px 16px',
            border: `1px solid ${border}`, cursor: 'pointer', textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: '#7a3b8c20',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, overflow: 'hidden',
              border: s.photo_url ? `2px solid #7a3b8c40` : 'none',
            }}>
              {s.photo_url
                ? <img src={s.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : '🏪'
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>
                {s.lat && <span style={{ fontSize: 11 }}>📍</span>}
              </div>
              <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                {s.phone || 'Телефон не указан'} · {s.products_count} товаров
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7a3b8c' }}>
                {fmt(s.total_purchased)} сум
              </div>
              <div style={{ fontSize: 10, color: muted }}>{s.total_receipts} приёмок</div>
            </div>
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
          + Добавить поставщика
        </button>
      </div>

      {selected && (
        <SupplierDetailModal
          supplierId={selected.id} token={token!} isDark={isDark}
          onClose={() => setSelected(null)}
          onUpdate={(updated) => setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s))}
          onDelete={(id) => { setSuppliers(prev => prev.filter(s => s.id !== id)); setSelected(null) }}
        />
      )}

      {showAdd && (
        <AddSupplierModal isDark={isDark}
          onClose={() => setShowAdd(false)}
          onSuccess={(s) => { setSuppliers(prev => [...prev, s]); setShowAdd(false) }}
        />
      )}
    </div>
  )
}