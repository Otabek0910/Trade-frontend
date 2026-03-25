import { useState, useEffect } from 'react'
import type { AxiosError } from 'axios'
import api from '../../api'

interface Product {
  id: number; name: string; sku: string
  current_stock: number; purchase_price: number
  purchase_currency: string        // 'uzs' | 'usd'
  purchase_rate: number | null     // курс на момент последней закупки
}
interface Supplier { id: number; name: string }

interface Props {
  token: string
  role: string
  product: Product
  isDark: boolean
  onClose: () => void
  onSuccess: () => void
}

// Читаем курс ЦБУ из кэша MainMenu
function readCbuRate(): number | null {
  try {
    const raw = localStorage.getItem('cbu_rate_cache')
    if (!raw) return null
    const cached = JSON.parse(raw)
    const today = new Date().toISOString().slice(0, 10)
    if (cached.date !== today) return null
    return typeof cached.rate === 'number' ? cached.rate : null
  } catch { return null }
}

function initRateState(product: Product): { cbuRate: number | null; purchaseRate: string } {
  const cached = readCbuRate()
  const rate = cached ?? product.purchase_rate ?? null
  return {
    cbuRate: cached,
    purchaseRate: rate ? String(rate) : '',
  }
}

export default function ReceiptModal({ token, role, product, isDark, onClose, onSuccess }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isUsd = product.purchase_currency === 'usd'

  const [form, setForm] = useState({
    supplier_id: '',
    quantity: '',
    purchase_price: String(product.purchase_price),
    paid_amount: '',
  })

  // Курс — инициализируем из кэша сразу
  const [rateState, setRateState] = useState(() => initRateState(product))
  const cbuRate = rateState.cbuRate
  const purchaseRate = rateState.purchaseRate
  const setPurchaseRate = (val: string) => setRateState(s => ({ ...s, purchaseRate: val }))

  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data))

    // Если кэша нет — тянем с бэка
    if (!rateState.cbuRate) {
      api.get('/rates/today')
        .then(r => {
          const rate = r.data.cbu_rate
          setRateState(s => ({
            cbuRate: rate,
            purchaseRate: s.purchaseRate || String(rate),
          }))
        })
        .catch(() => {})
    }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const rateNum = parseFloat(purchaseRate) || 0
  const priceNum = parseFloat(form.purchase_price) || 0
  const qtyNum = parseInt(form.quantity) || 0

  // Если USD — цена в $, итого тоже в $ и в сумах
  const totalUsd   = isUsd ? priceNum * qtyNum : 0
  const totalUzs   = isUsd ? totalUsd * rateNum : priceNum * qtyNum
  const totalCost  = totalUzs  // для расчёта долга всегда в сумах

  const paidNum = form.paid_amount !== '' ? parseFloat(form.paid_amount) : totalCost
  const debtNum = totalCost > 0 ? Math.max(0, totalCost - paidNum) : 0

  const handleSubmit = async () => {
    if (!form.supplier_id || !form.quantity || !form.purchase_price) {
      setError('Заполните все поля')
      return
    }
    if (isUsd && (!purchaseRate || rateNum <= 0)) {
      setError('Укажите курс доллара на момент закупки')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/receipts', {
        product_id: product.id,
        supplier_id: parseInt(form.supplier_id),
        quantity: qtyNum,
        purchase_price: priceNum,
        paid_amount: form.paid_amount !== '' ? parseFloat(form.paid_amount) : null,
        // Курс — только для USD товаров
        purchase_rate: isUsd ? rateNum : null,
      })
      setSuccess(res.data.message)
      setTimeout(onSuccess, 1400)
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: text }}>📥 Приёмка товара</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: muted, cursor: 'pointer' }}>×</button>
          </div>

          {/* Product info */}
          <div style={{ background: isDark ? '#333' : '#f8f9fa', borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: text }}>{product.name}</div>
              {isUsd && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 7,
                  background: '#e0803020', color: '#e08030',
                }}>💵 USD</span>
              )}
            </div>
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
                <label style={labelStyle}>Количество *</label>
                <input style={inputStyle} type="number" min="1" placeholder="0"
                  value={form.quantity} onChange={e => set('quantity', e.target.value)}
                  inputMode="numeric" />
              </div>
              <div>
                <label style={labelStyle}>
                  Цена закупки * {isUsd ? '($)' : '(сум)'}
                  {product.purchase_price > 0 && (role === 'owner_business' || role === 'developer') && (
                    <span style={{ fontWeight: 400, color: '#f59e0b', marginLeft: 6 }}>⚠️ изменение отразится в истории</span>
                  )}
                </label>
                {product.purchase_price > 0 && role !== 'developer' && role !== 'owner_business' ? (
                  <div style={{ ...inputStyle, background: isDark ? '#2a2a2a' : '#f0f0f0', color: isDark ? '#777' : '#aaa', cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{form.purchase_price} {isUsd ? '$' : ''}</span>
                    <span style={{ fontSize: 12 }}>🔒</span>
                  </div>
                ) : (
                  <input style={inputStyle} type="number" placeholder={isUsd ? 'Напр. 10.50' : '0'}
                    value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)}
                    inputMode="decimal" />
                )}
              </div>
            </div>

            {/* Курс — только для USD товаров */}
            {isUsd && (
              <div style={{ background: isDark ? '#1a1a0a' : '#fffbf0', borderRadius: 14, padding: '12px 14px', border: '1.5px solid #e0803040' }}>
                <label style={{ ...labelStyle, color: '#e08030' }}>
                  💵 Курс доллара на момент закупки *
                  {cbuRate && (
                    <span style={{ fontWeight: 400, color: '#34c759', marginLeft: 6 }}>
                      ЦБУ сегодня: {cbuRate.toLocaleString('ru-RU')} сум
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...inputStyle, borderColor: '#e0803060', flex: 1 }}
                    type="number"
                    placeholder={cbuRate ? String(cbuRate) : 'Напр. 12800'}
                    value={purchaseRate}
                    onChange={e => setPurchaseRate(e.target.value)}
                    inputMode="decimal"
                  />
                  {cbuRate && parseFloat(purchaseRate) !== cbuRate && (
                    <button
                      onClick={() => setPurchaseRate(String(cbuRate))}
                      style={{
                        background: isDark ? '#333' : '#f0f2f5', border: `1px solid ${border}`,
                        borderRadius: 10, padding: '10px 12px', fontSize: 12, color: muted,
                        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >= ЦБУ</button>
                  )}
                </div>
                {priceNum > 0 && rateNum > 0 && (
                  <div style={{ fontSize: 12, color: '#e08030', marginTop: 6 }}>
                    💱 {form.purchase_price}$ × {rateNum.toLocaleString('ru-RU')} = {(priceNum * rateNum).toLocaleString('ru-RU')} сум
                  </div>
                )}
              </div>
            )}

            {/* Итого */}
            {totalCost > 0 && (
              <div style={{ background: '#2481cc15', border: '1px solid #2481cc30', borderRadius: 12, padding: '10px 14px' }}>
                {isUsd && rateNum > 0 ? (
                  <div>
                    <span style={{ fontSize: 13, color: '#2481cc', fontWeight: 600 }}>
                      Итого: {totalUsd.toFixed(2)}$ = {totalUzs.toLocaleString('ru-RU')} сум
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: '#2481cc', fontWeight: 600 }}>
                    Итого: {totalCost.toLocaleString()} сум
                  </span>
                )}
              </div>
            )}

            {/* Оплата */}
            <div>
              <label style={labelStyle}>Оплачено сейчас (пусто = полная оплата)</label>
              <input style={inputStyle} type="number" min="0"
                placeholder={totalCost > 0 ? `${totalCost.toLocaleString()} сум` : '0'}
                value={form.paid_amount}
                onChange={e => set('paid_amount', e.target.value)}
                inputMode="decimal" />
            </div>

            {/* Долг */}
            {debtNum > 0 && (
              <div style={{ background: '#ff3b3015', border: '1px solid #ff3b3040', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#ff3b30', fontWeight: 700 }}>
                  ⚠️ Долг поставщику: {debtNum.toLocaleString()} сум
                </span>
                <span style={{ fontSize: 11, color: muted }}>
                  Оплачено: {paidNum.toLocaleString()}
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