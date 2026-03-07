import { useState, useEffect } from 'react'
import axios, { AxiosError } from 'axios'

interface Supplier { id: number; name: string }

interface Props {
  token: string
  isDark: boolean
  onClose: () => void
  onSuccess: () => void
}

const UNITS = ['шт', 'л', 'кг', 'м', 'м²', 'уп', 'пар', 'рул']

export default function AddProductModal({ token, isDark, onClose, onSuccess }: Props) {
  const headers = { Authorization: `Bearer ${token}` }
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    sku: '', name: '', category: '',
    brand: '',          // Марка
    unit: 'шт',        // Единица измерения
    unit_value: '',    // Объём упаковки (напр. 3 для канистры 3л)
    supplier_id: '',
    purchase_price: '', selling_price: '', min_stock: '5',
  })

  useEffect(() => {
    axios.get('/suppliers', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setSuppliers(r.data))
  }, [token])

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  // Показываем поле unit_value только когда единица не "шт"
  const showUnitValue = form.unit !== 'шт'

  const handleSubmit = async () => {
    if (!form.sku || !form.name || !form.purchase_price || !form.selling_price) {
      setError('Заполните обязательные поля')
      return
    }
    setLoading(true)
    setError('')
    try {
      await axios.post('/products', {
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: form.category.trim() || null,
        brand: form.brand.trim() || null,
        unit: form.unit || 'шт',
        unit_value: showUnitValue && form.unit_value ? parseFloat(form.unit_value) : null,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
        purchase_price: parseFloat(form.purchase_price),
        selling_price: parseFloat(form.selling_price),
        min_stock: parseInt(form.min_stock) || 5,
      }, { headers })
      onSuccess()
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setError(e.response?.data?.detail || 'Ошибка при создании товара')
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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', background: bg, borderRadius: '24px 24px 0 0',
        maxHeight: '92vh', overflowY: 'auto', paddingBottom: 32,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: isDark ? '#555' : '#ddd' }} />
        </div>

        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: text }}>Новый товар</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: muted, cursor: 'pointer' }}>×</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={labelStyle}>SKU (артикул) *</label>
              <input style={inputStyle} placeholder="Например: OIL-MOB-3L" value={form.sku} onChange={e => set('sku', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Название товара *</label>
              <input style={inputStyle} placeholder="Например: Масло моторное" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>

            {/* Марка */}
            <div>
              <label style={labelStyle}>Марка / Бренд</label>
              <input style={inputStyle} placeholder="Например: Mobil 1, Shell, Castrol" value={form.brand} onChange={e => set('brand', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Категория</label>
              <input style={inputStyle} placeholder="Например: Масла" value={form.category} onChange={e => set('category', e.target.value)} />
            </div>

            {/* Единица измерения + объём упаковки */}
            <div>
              <label style={labelStyle}>Единица измерения</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {UNITS.map(u => (
                  <button key={u} onClick={() => set('unit', u)} style={{
                    padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${form.unit === u ? '#2481cc' : border}`,
                    background: form.unit === u ? '#2481cc20' : (isDark ? '#333' : '#f8f9fa'),
                    color: form.unit === u ? '#2481cc' : muted,
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}>{u}</button>
                ))}
              </div>
            </div>

            {/* Объём упаковки — только если не шт */}
            {showUnitValue && (
              <div>
                <label style={labelStyle}>
                  Объём / количество в упаковке ({form.unit})
                  <span style={{ fontWeight: 400, marginLeft: 4 }}>— напр. 3 для канистры 3{form.unit}</span>
                </label>
                <input
                  style={inputStyle} type="number" placeholder={`Сколько ${form.unit} в одной упаковке?`}
                  value={form.unit_value} onChange={e => set('unit_value', e.target.value)}
                  inputMode="decimal"
                />
                {form.unit_value && (
                  <div style={{ fontSize: 12, color: '#2481cc', marginTop: 4 }}>
                    📦 1 шт = {form.unit_value} {form.unit} · 10 шт = {+(parseFloat(form.unit_value) * 10).toFixed(2)} {form.unit}
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={labelStyle}>Поставщик</label>
              <select style={{ ...inputStyle, appearance: 'none' }} value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
                <option value="">— Не выбран —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Цена закупки *</label>
                <input style={inputStyle} type="number" placeholder="0" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Цена продажи *</label>
                <input style={inputStyle} type="number" placeholder="0" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} />
              </div>
            </div>

            {form.purchase_price && form.selling_price && parseFloat(form.purchase_price) > 0 && (
              <div style={{ background: '#34c75920', border: '1px solid #34c75940', borderRadius: 12, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, color: '#34c759', fontWeight: 600 }}>
                  Маржа: {Math.round((parseFloat(form.selling_price) - parseFloat(form.purchase_price)) / parseFloat(form.purchase_price) * 100)}%
                  {' '}(+{(parseFloat(form.selling_price) - parseFloat(form.purchase_price)).toLocaleString()} сум)
                </span>
              </div>
            )}

            <div>
              <label style={labelStyle}>Минимальный остаток (шт)</label>
              <input style={inputStyle} type="number" placeholder="5" value={form.min_stock} onChange={e => set('min_stock', e.target.value)} />
            </div>

            {error && (
              <div style={{ background: '#ff3b3020', border: '1px solid #ff3b3040', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#ff3b30' }}>
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading} style={{
              background: loading ? '#555' : 'linear-gradient(135deg, #1a6b3c, #2d9c5c)',
              border: 'none', borderRadius: 14, padding: 15, color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 4,
            }}>
              {loading ? 'Сохранение...' : '✅ Создать товар'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}