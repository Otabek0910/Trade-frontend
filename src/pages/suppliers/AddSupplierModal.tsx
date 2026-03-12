import { useState } from 'react'
import type { AxiosError } from 'axios'
import api from '../../api'
import type { Supplier } from '../SuppliersPage'

interface Props {
  isDark: boolean
  onClose: () => void
  onSuccess: (s: Supplier) => void
}

export default function AddSupplierModal({ isDark, onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name) { setError('Введите название'); return }
    setLoading(true); setError('')
    try {
      const res = await api.post('/suppliers',
        { name, phone: phone || null, address: address || null, notes: notes || null }
      )
      onSuccess(res.data)
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setError(e.response?.data?.detail || 'Ошибка при создании')
    }
    setLoading(false)
  }

  const bg = isDark ? '#1a1a1a' : '#f0f2f5'
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
      <div style={{ width: '100%', background: bg, borderRadius: '24px 24px 0 0', paddingBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: isDark ? '#555' : '#ddd' }} />
        </div>
        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: text }}>Новый поставщик</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: muted, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input style={inputStyle} placeholder="Название *" value={name} onChange={e => setName(e.target.value)} />
            <input style={inputStyle} placeholder="Телефон" value={phone} onChange={e => setPhone(e.target.value)} />
            <input style={inputStyle} placeholder="Адрес" value={address} onChange={e => setAddress(e.target.value)} />
            <textarea style={{ ...inputStyle, height: 72, resize: 'none' }} placeholder="Заметки" value={notes} onChange={e => setNotes(e.target.value)} />
            {error && <div style={{ color: '#ff3b30', fontSize: 13 }}>{error}</div>}
            <button onClick={handleSubmit} disabled={loading} style={{
              background: loading ? '#555' : 'linear-gradient(135deg, #7a3b8c, #9d4eb5)',
              border: 'none', borderRadius: 14, padding: 15, color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 4,
            }}>
              {loading ? 'Создание...' : '✅ Добавить поставщика'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}