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
    brand: '',
    unit: 'шт',
    unit_value: '',
    supplier_id: '',
    purchase_price: '', selling_price: '', min_stock: '5',
    // ── Новые поля валюты ──
    purchase_currency: 'uzs',   // 'uzs' | 'usd'
    purchase_rate: '',           // курс на момент закупки (если usd)
  })

  // Курс ЦБУ для подсказки
  const [cbuRate, setCbuRate] = useState<number | null>(null)

  useEffect(() => {
    axios.get('/suppliers', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setSuppliers(r.data))

    // Тянем актуальный курс ЦБУ для подсказки
    axios.get('/rates/today', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        setCbuRate(r.data.cbu_rate)
        // Подставляем курс ЦБУ как дефолтный если поле пустое
        setForm(f => f.purchase_rate === '' ? { ...f, purchase_rate: String(r.data.cbu_rate) } : f)
      })
      .catch(() => {})
  }, [token])

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const showUnitValue = form.unit !== 'шт'
  const isUsd = form.purchase_currency === 'usd'

  // Расчёт маржи с учётом валюты
  const calcMargin = () => {
    const sell = parseFloat(form.selling_price)
    const buy = parseFloat(form.purchase_price)
    const rate = parseFloat(form.purchase_rate)
    if (!sell || !buy || buy <= 0) return null

    if (isUsd) {
      // Закупка в USD → переводим в сумы по указанному курсу
      if (!rate || rate <= 0) return null
      const buyInUzs = buy * rate
      const marginUzs = sell - buyInUzs
      const marginPct = Math.round(marginUzs / buyInUzs * 100)
      const marginUsd = sell / rate - buy
      return { uzs: marginUzs, pct: marginPct, usd: marginUsd }
    } else {
      const marginUzs = sell - buy
      const marginPct = Math.round(marginUzs / buy * 100)
      return { uzs: marginUzs, pct: marginPct, usd: null }
    }
  }

  const margin = calcMargin()

  const handleSubmit = async () => {
    if (!form.sku || !form.name || !form.purchase_price || !form.selling_price) {
      setError('Заполните обязательные поля')
      return
    }
    if (isUsd && (!form.purchase_rate || parseFloat(form.purchase_rate) <= 0)) {
      setError('Укажите курс доллара на момент закупки')
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
        // ── Новые поля ──
        purchase_currency: form.purchase_currency,
        purchase_rate: isUsd && form.purchase_rate ? parseFloat(form.purchase_rate) : null,
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

            <div>
              <label style={labelStyle}>Марка / Бренд</label>
              <input style={inputStyle} placeholder="Например: Mobil 1, Shell, Castrol" value={form.brand} onChange={e => set('brand', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Категория</label>
              <input style={inputStyle} placeholder="Например: Масла" value={form.category} onChange={e => set('category', e.target.value)} />
            </div>

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

            {/* ── Цена закупки + валюта ── */}
            <div>
              <label style={labelStyle}>Валюта закупки</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {(['uzs', 'usd'] as const).map(cur => (
                  <button key={cur} onClick={() => set('purchase_currency', cur)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 10,
                    border: `1.5px solid ${form.purchase_currency === cur ? (cur === 'usd' ? '#e08030' : '#2481cc') : border}`,
                    background: form.purchase_currency === cur
                      ? (cur === 'usd' ? '#e0803020' : '#2481cc20')
                      : (isDark ? '#333' : '#f8f9fa'),
                    color: form.purchase_currency === cur ? (cur === 'usd' ? '#e08030' : '#2481cc') : muted,
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}>
                    {cur === 'uzs' ? '🇺🇿 Сумы' : '🇺🇸 Доллары'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isUsd ? '1fr 1fr' : '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>
                    Цена закупки * {isUsd ? '($)' : '(сум)'}
                  </label>
                  <input
                    style={inputStyle} type="number"
                    placeholder={isUsd ? 'Напр. 10.50' : '0'}
                    value={form.purchase_price}
                    onChange={e => set('purchase_price', e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Цена продажи * (сум)</label>
                  <input
                    style={inputStyle} type="number" placeholder="0"
                    value={form.selling_price}
                    onChange={e => set('selling_price', e.target.value)}
                    inputMode="decimal"
                  />
                </div>
              </div>

              {/* Курс закупки — только если USD */}
              {isUsd && (
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>
                    Курс доллара на момент закупки *
                    {cbuRate && (
                      <span style={{ fontWeight: 400, color: '#34c759', marginLeft: 6 }}>
                        ЦБУ сегодня: {cbuRate.toLocaleString('ru-RU')} сум
                      </span>
                    )}
                  </label>
                  <input
                    style={{ ...inputStyle, borderColor: '#e0803060' }}
                    type="number"
                    placeholder={cbuRate ? String(cbuRate) : 'Напр. 12800'}
                    value={form.purchase_rate}
                    onChange={e => set('purchase_rate', e.target.value)}
                    inputMode="decimal"
                  />
                  {form.purchase_price && form.purchase_rate && (
                    <div style={{ fontSize: 12, color: '#e08030', marginTop: 4 }}>
                      💱 {form.purchase_price}$ × {parseFloat(form.purchase_rate).toLocaleString('ru-RU')} = {' '}
                      {(parseFloat(form.purchase_price) * parseFloat(form.purchase_rate)).toLocaleString('ru-RU')} сум
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Маржа */}
            {margin !== null && (
              <div style={{
                background: margin.pct >= 0 ? '#34c75920' : '#ff3b3020',
                border: `1px solid ${margin.pct >= 0 ? '#34c75940' : '#ff3b3040'}`,
                borderRadius: 12, padding: '10px 14px',
              }}>
                <span style={{ fontSize: 13, color: margin.pct >= 0 ? '#34c759' : '#ff3b30', fontWeight: 600 }}>
                  Маржа: {margin.pct}%
                  {' '}({margin.uzs >= 0 ? '+' : ''}{Math.round(margin.uzs).toLocaleString()} сум)
                  {margin.usd !== null && (
                    <span style={{ marginLeft: 8, opacity: 0.8 }}>
                      / {margin.usd >= 0 ? '+' : ''}{margin.usd.toFixed(2)}$
                    </span>
                  )}
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