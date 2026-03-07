import { useState, useEffect } from 'react'
import axios, { AxiosError } from 'axios'

interface Product {
  id: number; name: string; sku: string
  current_stock: number; purchase_price: number
}
interface Supplier { id: number; name: string }

interface Props {
  token: string
  product: Product
  isDark: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ReceiptModal({ token, product, isDark, onClose, onSuccess }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    supplier_id: '',
    quantity: '',
    purchase_price: String(product.purchase_price),
  })

  useEffect(() => {
    axios.get('/suppliers', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setSuppliers(r.data))
  }, [token])

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async () => {
    if (!form.supplier_id || !form.quantity || !form.purchase_price) {
      setError('Заполните все поля')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await axios.post('/receipts', {
        product_id: product.id,
        supplier_id: parseInt(form.supplier_id),
        quantity: parseInt(form.quantity),
        purchase_price: parseFloat(form.purchase_price),
      }, { headers: { Authorization: `Bearer ${token}` } })
      setSuccess(res.data.message)
      setTimeout(onSuccess, 1200)
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setError(e.response?.data?.detail || 'Ошибка при приёмке')
    }
    setLoading(false)
  }

  const text = isDark ? '#fff' : '#1a1a1a'
  const muted = isDark ? '#888' : '#999'
  const border = isDark ? '#444' : '#e8eaed'
  const bg = isDark ? '#1a1a1a' : '#f0f2f5'

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    background: isDark ? '#333' : '#f8f9fa',
    border: `1px solid ${border}`, borderRadius: 12,
    padding: '11px 14px', fontSize: 15, color: text, outline: 'none',
  }
  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: muted,
    marginBottom: 6, display: 'block' as const,
  }

  const totalCost = form.quantity && form.purchase_price
    ? (parseInt(form.quantity) * parseFloat(form.purchase_price)).toLocaleString()
    : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', background: bg, borderRadius: '24px 24px 0 0',
        maxHeight: '88vh', overflowY: 'auto', paddingBottom: 32,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: isDark ? '#555' : '#ddd' }} />
        </div>

        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: text }}>📥 Приёмка товара</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: muted, cursor: 'pointer' }}>×</button>
          </div>

          {/* Product info */}
          <div style={{ background: isDark ? '#333' : '#f8f9fa', borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: text }}>{product.name}</div>
            <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>
              SKU: {product.sku} · Текущий остаток: {product.current_stock} шт
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Поставщик *</label>
              <select style={{ ...inputStyle, appearance: 'none' }} value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
                <option value="">— Выберите поставщика —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Количество (шт) *</label>
                <input style={inputStyle} type="number" min="1" placeholder="0"
                  value={form.quantity} onChange={e => set('quantity', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Цена закупки *</label>
                <input style={inputStyle} type="number" placeholder="0"
                  value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} />
              </div>
            </div>

            {totalCost && (
              <div style={{ background: '#2481cc20', border: '1px solid #2481cc40', borderRadius: 12, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, color: '#2481cc', fontWeight: 600 }}>
                  Итого к оплате: {totalCost} сум
                </span>
              </div>
            )}

            {error && (
              <div style={{ background: '#ff3b3020', border: '1px solid #ff3b3040', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#ff3b30' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: '#34c75920', border: '1px solid #34c75940', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#34c759', fontWeight: 600 }}>
                {success}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading || !!success} style={{
              background: success ? '#34c759' : loading ? '#555' : 'linear-gradient(135deg, #1a6b3c, #2d9c5c)',
              border: 'none', borderRadius: 14, padding: 15, color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}>
              {success ? '✅ Принято!' : loading ? 'Сохранение...' : '📥 Принять товар'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}