import { useState, useEffect } from 'react'
import axios, { AxiosError } from 'axios'
import type { Customer } from '../SalesPage'

interface Props {
  token: string
  isDark: boolean
  onClose: () => void
  onSelect: (customer: Customer) => void
}

export default function CustomerSelectModal({ token, isDark, onClose, onSelect }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Загрузка клиентов — без setState в теле эффекта
  useEffect(() => {
    let cancelled = false
    axios.get('/customers', {
      headers: { Authorization: `Bearer ${token}` },
      params: search ? { search } : {},
    }).then(r => {
      if (!cancelled) {
        setCustomers(r.data)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [search, token])

  const handleCreate = async () => {
    if (!newName || !newPhone) { setCreateError('Заполните имя и телефон'); return }
    setCreating(true)
    setCreateError('')
    try {
      const res = await axios.post('/customers',
        { name: newName, phone: newPhone },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      onSelect({ id: res.data.id, name: res.data.name, phone: res.data.phone, total_debt: 0 })
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setCreateError(e.response?.data?.detail || 'Ошибка')
    }
    setCreating(false)
  }

  const bg = isDark ? '#1a1a1a' : '#f0f2f5'
  const card = isDark ? '#2a2a2a' : '#ffffff'
  const text = isDark ? '#fff' : '#1a1a1a'
  const muted = isDark ? '#888' : '#999'
  const border = isDark ? '#444' : '#e8eaed'
  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    background: isDark ? '#333' : '#f8f9fa',
    border: `1px solid ${border}`, borderRadius: 12,
    padding: '11px 14px', fontSize: 15, color: text, outline: 'none',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', background: bg, borderRadius: '24px 24px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: isDark ? '#555' : '#ddd' }} />
        </div>

        <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: text }}>👥 Выбор клиента</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: muted, cursor: 'pointer' }}>×</button>
          </div>

          {!showCreate ? (
            <>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Поиск по имени или телефону..."
                style={{ ...inputStyle, marginBottom: 12, flexShrink: 0 }}
              />
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 24, color: muted }}>Загрузка...</div>
                ) : customers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: muted }}>Клиентов не найдено</div>
                ) : customers.map(c => (
                  <button key={c.id} onClick={() => onSelect(c)} style={{
                    background: card, border: `1px solid ${border}`, borderRadius: 14,
                    padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexShrink: 0,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{c.phone}</div>
                    </div>
                    {c.total_debt > 0 && (
                      <div style={{ fontSize: 12, color: '#ff3b30', fontWeight: 700 }}>
                        Долг: {c.total_debt.toLocaleString()}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowCreate(true)} style={{
                width: '100%', margin: '12px 0', background: 'transparent',
                border: `1.5px dashed ${border}`, borderRadius: 14, padding: 13,
                color: '#2481cc', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              }}>
                + Новый клиент
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 4 }}>Новый клиент</div>
              <input style={inputStyle} placeholder="Имя *" value={newName} onChange={e => setNewName(e.target.value)} />
              <input style={inputStyle} placeholder="Телефон * (+998...)" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              {createError && <div style={{ color: '#ff3b30', fontSize: 13 }}>{createError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowCreate(false)} style={{
                  flex: 1, background: isDark ? '#333' : '#f0f2f5', border: 'none',
                  borderRadius: 12, padding: 13, color: muted, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>Назад</button>
                <button onClick={handleCreate} disabled={creating} style={{
                  flex: 2, background: '#2481cc', border: 'none',
                  borderRadius: 12, padding: 13, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>{creating ? 'Создание...' : '✅ Создать'}</button>
              </div>
              <div style={{ height: 24 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}