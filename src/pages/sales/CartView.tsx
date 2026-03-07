import { useState } from 'react'
import axios, { AxiosError } from 'axios'
import type { CartItem, Customer } from '../SalesPage'
import { unitSubtitle } from './unitHelpers'
import CustomerSelectModal from './CustomerSelectModal'

type PaymentType = 'cash' | 'card' | 'transfer'

interface Props {
  cart: CartItem[]
  customer: Customer | null
  token: string
  isDark: boolean
  onBack: () => void
  onRemove: (id: number) => void
  onUpdateQty: (id: number, qty: number) => void
  onUpdatePrice: (id: number, price: number) => void
  onSelectCustomer: () => void
  onSuccess: () => void
  showCustomerSelect: boolean
  onCloseCustomerSelect: () => void
  onCustomerSelected: (c: Customer) => void
}

export default function CartView({
  cart, customer, token, isDark, onBack, onRemove,
  onUpdateQty, onUpdatePrice, onSelectCustomer, onSuccess,
  showCustomerSelect, onCloseCustomerSelect, onCustomerSelected,
}: Props) {
  const [paymentType, setPaymentType] = useState<PaymentType>('cash')
  const [discount, setDiscount] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Ввод количества вручную
  const [editingQtyId, setEditingQtyId] = useState<number | null>(null)
  const [editingQtyVal, setEditingQtyVal] = useState('')

  const subtotal = cart.reduce((s, i) => s + i.selling_price * i.quantity, 0)
  const discountVal = discount ? subtotal * (parseFloat(discount) / 100) : 0
  const total = subtotal - discountVal
  const paid = paidAmount ? parseFloat(paidAmount) : total
  const debt = Math.max(0, total - paid)

  const bg = isDark ? '#1a1a1a' : '#f0f2f5'
  const card = isDark ? '#242424' : '#ffffff'
  const text = isDark ? '#ffffff' : '#1a1a1a'
  const muted = isDark ? '#666' : '#999'
  const border = isDark ? '#333' : '#e8eaed'

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    background: isDark ? '#333' : '#f8f9fa',
    border: `1px solid ${border}`, borderRadius: 12,
    padding: '11px 14px', fontSize: 15, color: text, outline: 'none',
  }

  const handleConfirm = async () => {
    if (cart.length === 0) return
    setLoading(true)
    setError('')
    try {
      const res = await axios.post('/sales', {
        customer_id: customer?.id ?? null,
        items: cart.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          selling_price: i.selling_price,
        })),
        payment_type: paymentType,
        discount_percent: parseFloat(discount) || 0,
        paid_amount: paid,
      }, { headers: { Authorization: `Bearer ${token}` } })

      setSuccess(res.data.message)
      setTimeout(onSuccess, 1500)
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setError(e.response?.data?.detail || 'Ошибка при оформлении продажи')
    }
    setLoading(false)
  }

  const commitQtyEdit = (productId: number, maxStock: number) => {
    const val = parseInt(editingQtyVal)
    if (!isNaN(val) && val > 0) {
      onUpdateQty(productId, Math.min(val, maxStock))
    }
    setEditingQtyId(null)
    setEditingQtyVal('')
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ background: card, padding: '14px 16px', boxShadow: `0 1px 0 ${border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack}
          style={{ background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: 'pointer' }}>
          ←
        </button>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: text }}>🛒 Оформление</div>
        <div style={{ fontSize: 13, color: muted }}>{cart.reduce((s, i) => s + i.quantity, 0)} шт</div>
      </div>

      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Cart items */}
        <div style={{ background: card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${border}` }}>
          <div style={{ padding: '12px 14px 8px', fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Товары
          </div>
          {cart.map((item, i) => {
            const hasVolume = item.unit !== 'шт' && item.unit_value && item.unit_value !== 1
            return (
              <div key={item.product_id} style={{
                padding: '10px 14px',
                borderTop: i > 0 ? `1px solid ${border}` : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{item.name}</div>
                    {/* Марка и единица */}
                    {unitSubtitle(item.unit, item.unit_value, item.brand) && (
                      <div style={{ fontSize: 11, color: '#2481cc', fontWeight: 600, marginTop: 1 }}>
                        {unitSubtitle(item.unit, item.unit_value, item.brand)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => onRemove(item.product_id)}
                    style={{ background: 'none', border: 'none', fontSize: 16, color: '#ff3b30', cursor: 'pointer', padding: '0 0 0 8px' }}>×</button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Qty с возможностью ввода вручную */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => onUpdateQty(item.product_id, item.quantity - 1)}
                      style={{ width: 28, height: 28, borderRadius: 7, background: isDark ? '#333' : '#f0f2f5', border: 'none', color: text, fontSize: 16, cursor: 'pointer' }}>−</button>

                    {editingQtyId === item.product_id ? (
                      <input
                        autoFocus
                        type="number"
                        value={editingQtyVal}
                        onChange={e => setEditingQtyVal(e.target.value)}
                        onBlur={() => commitQtyEdit(item.product_id, item.max_stock)}
                        onKeyDown={e => { if (e.key === 'Enter') commitQtyEdit(item.product_id, item.max_stock) }}
                        style={{ width: 48, textAlign: 'center', background: isDark ? '#444' : '#fff', border: `1.5px solid #2481cc`, borderRadius: 7, fontSize: 14, fontWeight: 700, color: text, outline: 'none', padding: '2px 4px' }}
                      />
                    ) : (
                      <div
                        onClick={() => { setEditingQtyId(item.product_id); setEditingQtyVal(String(item.quantity)) }}
                        style={{ cursor: 'pointer', textAlign: 'center', minWidth: 28 }}
                        title="Нажмите чтобы ввести вручную"
                      >
                        <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{item.quantity}</div>
                        {/* Итоговый объём */}
                        {hasVolume && (
                          <div style={{ fontSize: 10, color: '#2481cc', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {+(item.quantity * item.unit_value!).toFixed(2)} {item.unit}
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={() => onUpdateQty(item.product_id, item.quantity + 1)}
                      style={{ width: 28, height: 28, borderRadius: 7, background: isDark ? '#333' : '#f0f2f5', border: 'none', color: text, fontSize: 16, cursor: 'pointer' }}>+</button>
                  </div>
                  <div style={{ fontSize: 12, color: muted }}>×</div>
                  {/* Price editable */}
                  <input
                    type="number"
                    value={item.selling_price}
                    onChange={e => onUpdatePrice(item.product_id, parseFloat(e.target.value) || 0)}
                    style={{ ...inputStyle, width: 110, padding: '5px 10px', fontSize: 13 }}
                  />
                  <div style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: text, flexShrink: 0 }}>
                    {(item.selling_price * item.quantity).toLocaleString()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Customer */}
        <button onClick={onSelectCustomer} style={{
          width: '100%', background: customer ? '#2481cc15' : card,
          border: `1.5px dashed ${customer ? '#2481cc' : border}`,
          borderRadius: 14, padding: '12px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        }}>
          <span style={{ fontSize: 20 }}>{customer ? '👤' : '➕'}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: customer ? '#2481cc' : muted }}>
              {customer ? customer.name : 'Выбрать клиента'}
            </div>
            {customer && <div style={{ fontSize: 11, color: muted }}>{customer.phone}</div>}
          </div>
        </button>

        {/* Payment type */}
        <div style={{ background: card, borderRadius: 16, padding: '14px', border: `1px solid ${border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Способ оплаты</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {([['cash', '💵 Наличные'], ['card', '💳 Карта'], ['transfer', '📲 Перевод']] as [PaymentType, string][]).map(([type, label]) => (
              <button key={type} onClick={() => setPaymentType(type)} style={{
                flex: 1, border: `1.5px solid ${paymentType === type ? '#2481cc' : border}`,
                borderRadius: 10, padding: '8px 4px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: paymentType === type ? '#2481cc20' : 'transparent',
                color: paymentType === type ? '#2481cc' : muted,
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Discount */}
        <div style={{ background: card, borderRadius: 16, padding: '14px', border: `1px solid ${border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Скидка</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" min="0" max="100" placeholder="0"
              value={discount} onChange={e => setDiscount(e.target.value)}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ color: muted, fontSize: 14 }}>%</span>
            {discountVal > 0 && <span style={{ color: '#ff3b30', fontSize: 13, fontWeight: 600 }}>− {discountVal.toLocaleString()} сум</span>}
          </div>
        </div>

        {/* Total & paid */}
        <div style={{ background: card, borderRadius: 16, padding: '14px', border: `1px solid ${border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Итого</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: muted, fontSize: 14 }}>Сумма</span>
            <span style={{ color: text, fontWeight: 700, fontSize: 14 }}>{subtotal.toLocaleString()} сум</span>
          </div>
          {discountVal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: muted, fontSize: 14 }}>Скидка {discount}%</span>
              <span style={{ color: '#ff3b30', fontWeight: 700, fontSize: 14 }}>− {discountVal.toLocaleString()} сум</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${border}`, marginBottom: 12 }}>
            <span style={{ color: text, fontWeight: 800, fontSize: 16 }}>К оплате</span>
            <span style={{ color: '#1a4b8c', fontWeight: 800, fontSize: 18 }}>{total.toLocaleString()} сум</span>
          </div>

          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, color: muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Принято (оставьте пустым если полная оплата)</label>
            <input type="number" placeholder={total.toFixed(0)}
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)}
              onBlur={e => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val) && val > total) setPaidAmount(String(total))
              }}
              style={inputStyle}
            />
          </div>

          {debt > 0 && (
            <div style={{ marginTop: 10, background: '#ff3b3015', border: '1px solid #ff3b3030', borderRadius: 10, padding: '10px 12px' }}>
              <span style={{ color: '#ff3b30', fontWeight: 700, fontSize: 14 }}>
                ⚠️ Долг клиента: {debt.toLocaleString()} сум
              </span>
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: '#ff3b3015', border: '1px solid #ff3b3030', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#ff3b30' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#34c75920', border: '1px solid #34c75940', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#34c759', fontWeight: 700 }}>
            {success}
          </div>
        )}

        {/* Confirm */}
        <button onClick={handleConfirm} disabled={loading || !!success} style={{
          width: '100%', background: success ? '#34c759' : loading ? '#555' : 'linear-gradient(135deg, #1a4b8c, #2d6fd4)',
          border: 'none', borderRadius: 16, padding: 16, color: '#fff',
          fontSize: 17, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(26,75,140,0.4)',
        }}>
          {success ? '✅ Продажа оформлена!' : loading ? 'Оформление...' : `✅ Оформить продажу · ${total.toLocaleString()} сум`}
        </button>
      </div>

      {showCustomerSelect && (
        <CustomerSelectModal token={token} isDark={isDark}
          onClose={onCloseCustomerSelect}
          onSelect={onCustomerSelected} />
      )}
    </div>
  )
}