import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../contexts/AuthContext'
import CartView from './sales/CartView'
import CustomerSelectModal from './sales/CustomerSelectModal'
import { unitDisplay, unitSubtitle } from './sales/unitHelpers'

interface Product {
  id: number; sku: string; name: string; category: string | null
  brand: string | null          // ← Марка
  unit: string                  // ← Единица (шт/л/кг/м/уп...)
  unit_value: number | null     // ← Объём упаковки (3 для канистры 3л)
  purchase_price: number; selling_price: number; current_stock: number; low_stock: boolean
  purchase_currency: string; purchase_rate: number | null
}
export interface CartItem {
  product_id: number
  name: string
  brand: string | null
  unit: string
  unit_value: number | null
  quantity: number
  selling_price: number
  purchase_price: number
  max_stock: number
  purchase_currency: string       // 'uzs' | 'usd'
  purchase_rate: number | null    // курс на момент закупки
}
export interface Customer {
  id: number; name: string; phone: string; total_debt: number
}
interface SaleHistory {
  id: number; customer: string; seller: string
  total_amount: number; paid_amount: number; debt: number
  returned_amount: number; is_partial_return: boolean
  payment_type: string; discount_percent: number; status: string
  items_count: number
  items: { product_name: string; quantity: number; selling_price: number }[]
  created_at: string
}

const PAYMENT_ICONS: Record<string, string> = { cash: '💵', card: '💳', transfer: '📲' }
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  completed: { label: 'Выполнена', color: '#34c759' },
  cancelled:  { label: 'Отменена',  color: '#ff3b30' },
  returned:   { label: 'Возврат',   color: '#e08030' },
}

type Tab = 'products' | 'history'
type ViewMode = 'products' | 'cart'

export default function SalesPage() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'

  const [tab, setTab] = useState<Tab>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [view, setView] = useState<ViewMode>('products')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerSelect, setShowCustomerSelect] = useState(false)

  const [history, setHistory] = useState<SaleHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [prodPage, setProdPage] = useState(1)
  const [histPage, setHistPage] = useState(1)
  const [hideCancelled, setHideCancelled] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => setLoading(true))
    const params: Record<string, string> = {}
    if (search) params.search = search
    api.get('/products', { headers: { Authorization: `Bearer ${token}` }, params })
      .then(r => { if (!cancelled) { setProducts(r.data.items.filter((p: Product) => p.current_stock > 0)); setProdPage(1) } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [search, token])

  useEffect(() => {
    if (tab !== 'history') return
    Promise.resolve().then(() => setHistoryLoading(true))
    api.get('/dashboard/sales-history?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setHistory(r.data.items))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [tab, token])

  const addToCart = (product: Product) => {
    tg?.HapticFeedback?.impactOccurred('light')
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        if (existing.quantity >= product.current_stock) return prev
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        unit: product.unit || 'шт',
        unit_value: product.unit_value,
        quantity: 1,
        selling_price: product.selling_price,
        purchase_price: product.purchase_price,
        max_stock: product.current_stock,
        purchase_currency: product.purchase_currency || 'uzs',
        purchase_rate: product.purchase_rate ?? null,
      }]
    })
  }
  const removeFromCart = (product_id: number) => setCart(prev => prev.filter(i => i.product_id !== product_id))
  const updateQty = (product_id: number, qty: number) => {
    if (qty <= 0) { removeFromCart(product_id); return }
    setCart(prev => prev.map(i => i.product_id === product_id ? { ...i, quantity: Math.min(qty, i.max_stock) } : i))
  }
  const updatePrice = (product_id: number, price: number) =>
    setCart(prev => prev.map(i => i.product_id === product_id ? { ...i, selling_price: price } : i))

  const cartTotal = cart.reduce((s, i) => s + i.selling_price * i.quantity, 0)
  const SP = 6
  const prodTotalPages = Math.ceil(products.length / SP)
  const pagedProducts = products.slice((prodPage - 1) * SP, prodPage * SP)
  const filteredHistory = hideCancelled ? history.filter(s => s.status !== 'cancelled') : history
  const histTotalPages = Math.ceil(filteredHistory.length / SP)
  const pagedHistory = filteredHistory.slice((histPage - 1) * SP, histPage * SP)

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU')

  const bg = isDark ? '#1a1a1a' : '#f0f2f5'
  const card = isDark ? '#242424' : '#ffffff'
  const text = isDark ? '#ffffff' : '#1a1a1a'
  const muted = isDark ? '#666' : '#999'
  const border = isDark ? '#333' : '#e8eaed'

  if (view === 'cart') {
    return (
      <CartView
        cart={cart} customer={selectedCustomer} token={token!} role={user?.role ?? ''} isDark={isDark}
        onBack={() => setView('products')} onRemove={removeFromCart}
        onUpdateQty={updateQty} onUpdatePrice={updatePrice}
        onSelectCustomer={() => setShowCustomerSelect(true)}
        onSuccess={() => { setCart([]); setView('products'); navigate('/') }}
        showCustomerSelect={showCustomerSelect}
        onCloseCustomerSelect={() => setShowCustomerSelect(false)}
        onCustomerSelected={(c) => { setSelectedCustomer(c); setShowCustomerSelect(false) }}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', paddingBottom: 100 }}>
      <div style={{ background: card, padding: '14px 16px 10px', boxShadow: `0 1px 0 ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={() => navigate('/')} style={{ background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>←</button>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: text }}>💰 Продажи</div>
          {selectedCustomer && tab === 'products' && (
            <div style={{ fontSize: 12, color: '#2481cc', fontWeight: 600 }}>{selectedCustomer.name}</div>
          )}
        </div>
        <div style={{ display: 'flex', background: isDark ? '#333' : '#f0f2f5', borderRadius: 12, padding: 3, gap: 3 }}>
          {([['products', '🛍 Товары'], ['history', '📋 История']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, border: 'none', borderRadius: 10, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: tab === t ? card : 'transparent', color: tab === t ? text : muted,
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'products' && (
        <>
          <div style={{ padding: '10px 16px 0' }}>
            <button onClick={() => setShowCustomerSelect(true)} style={{ width: '100%', background: selectedCustomer ? '#2481cc20' : card, border: `1.5px dashed ${selectedCustomer ? '#2481cc' : border}`, borderRadius: 14, padding: '11px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
              <span style={{ fontSize: 20 }}>{selectedCustomer ? '👤' : '➕'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: selectedCustomer ? '#2481cc' : muted }}>{selectedCustomer ? selectedCustomer.name : 'Выбрать клиента (необязательно)'}</div>
                {selectedCustomer && <div style={{ fontSize: 11, color: muted }}>{selectedCustomer.phone}{selectedCustomer.total_debt > 0 ? ` · Долг: ${selectedCustomer.total_debt.toLocaleString()} сум` : ''}</div>}
              </div>
              {selectedCustomer && <button onClick={e => { e.stopPropagation(); setSelectedCustomer(null) }} style={{ background: 'none', border: 'none', fontSize: 18, color: muted, cursor: 'pointer' }}>×</button>}
            </button>
          </div>

          <div style={{ padding: '10px 16px 0' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск товара, марки..."
              style={{ width: '100%', boxSizing: 'border-box', background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '10px 14px', fontSize: 16, color: text, outline: 'none' }} />
          </div>

          <div style={{ flex: 1, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: muted }}>Загрузка...</div>
              : products.length === 0 ? <div style={{ textAlign: 'center', padding: 40 }}><div style={{ fontSize: 36, marginBottom: 8 }}>📭</div><div style={{ color: muted }}>Нет товаров в наличии</div></div>
              : pagedProducts.map(p => {
                const inCart = cart.find(i => i.product_id === p.id)
                const subtitle = unitSubtitle(p.unit, p.unit_value, p.brand)
                const stockLabel = unitDisplay(p.unit, p.unit_value, p.current_stock)
                return (
                  <div key={p.id} style={{ background: card, borderRadius: 14, padding: '12px 14px', border: `1px solid ${inCart ? '#2481cc50' : border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      {/* Марка и единица */}
                      {subtitle && (
                        <div style={{ fontSize: 11, color: '#2481cc', fontWeight: 600, marginTop: 1 }}>{subtitle}</div>
                      )}
                      <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                        {p.selling_price.toLocaleString()} сум · {stockLabel}
                      </div>
                    </div>
                    {inCart ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => updateQty(p.id, inCart.quantity - 1)} style={{ width: 30, height: 30, borderRadius: 8, background: '#ff3b3020', border: '1px solid #ff3b3040', color: '#ff3b30', fontSize: 18, cursor: 'pointer' }}>−</button>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: text, minWidth: 24 }}>{inCart.quantity}</div>
                          {/* Итоговый объём под количеством */}
                          {p.unit !== 'шт' && p.unit_value && p.unit_value !== 1 && (
                            <div style={{ fontSize: 10, color: '#2481cc', fontWeight: 600 }}>
                              {+(inCart.quantity * p.unit_value).toFixed(2)} {p.unit}
                            </div>
                          )}
                        </div>
                        <button onClick={() => addToCart(p)} style={{ width: 30, height: 30, borderRadius: 8, background: '#34c75920', border: '1px solid #34c75940', color: '#34c759', fontSize: 18, cursor: 'pointer' }}>+</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(p)} style={{ background: '#2481cc', border: 'none', borderRadius: 10, width: 34, height: 34, color: '#fff', fontSize: 20, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    )}
                  </div>
                )
              })}
          </div>

          {prodTotalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 16px' }}>
              <button onClick={() => setProdPage(p => Math.max(1, p - 1))} disabled={prodPage <= 1}
                style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: prodPage <= 1 ? '#2a2a2a' : '#1a4b8c', color: prodPage <= 1 ? '#555' : '#fff', fontWeight: 700, fontSize: 14, cursor: prodPage <= 1 ? 'default' : 'pointer' }}>←</button>
              <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>{prodPage} / {prodTotalPages}</span>
              <button onClick={() => setProdPage(p => Math.min(prodTotalPages, p + 1))} disabled={prodPage >= prodTotalPages}
                style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: prodPage >= prodTotalPages ? '#2a2a2a' : '#1a4b8c', color: prodPage >= prodTotalPages ? '#555' : '#fff', fontWeight: 700, fontSize: 14, cursor: prodPage >= prodTotalPages ? 'default' : 'pointer' }}>→</button>
            </div>
          )}

          {cart.length > 0 && (
            <div style={{ position: 'fixed', bottom: 24, left: 16, right: 16, zIndex: 50 }}>
              <button onClick={() => setView('cart')} style={{ width: '100%', background: 'linear-gradient(135deg, #1a4b8c, #2d6fd4)', border: 'none', borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', cursor: 'pointer', boxShadow: '0 6px 24px rgba(26,75,140,0.5)' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '3px 10px', fontSize: 14, fontWeight: 700 }}>{cartCount} шт</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>🛒 К оплате</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{cartTotal.toLocaleString()} сум</div>
              </button>
            </div>
          )}

          {showCustomerSelect && (
            <CustomerSelectModal token={token!} isDark={isDark} onClose={() => setShowCustomerSelect(false)} onSelect={(c) => { setSelectedCustomer(c); setShowCustomerSelect(false) }} />
          )}
        </>
      )}

      {tab === 'history' && (
        <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Фильтр отменённых */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => { setHideCancelled(h => !h); setHistPage(1) }} style={{
              background: hideCancelled ? (isDark ? '#2a2a2a' : '#f0f0f0') : '#ff3b3015',
              border: `1px solid ${hideCancelled ? border : '#ff3b3040'}`,
              borderRadius: 10, padding: '5px 12px', fontSize: 12, fontWeight: 600,
              color: hideCancelled ? muted : '#ff3b30', cursor: 'pointer',
            }}>
              {hideCancelled ? '🚫 Скрыты отменённые' : '👁 Показать все'}
            </button>
          </div>
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: muted }}>Загрузка...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ color: muted }}>Продаж нет</div>
            </div>
          ) : pagedHistory.map(s => {
            const st = STATUS_LABEL[s.status] ?? { label: s.status, color: muted }
            const isExpanded = expandedId === s.id
            return (
              <div key={s.id} style={{
                background: s.status === 'cancelled' ? (isDark ? '#1e1414' : '#fff8f8') : card,
                borderRadius: 14,
                border: `1.5px solid ${s.status === 'cancelled' ? '#ff3b3030' : s.status === 'returned' ? '#e0803030' : border}`,
                overflow: 'hidden',
              }}>
                <div onClick={() => setExpandedId(isExpanded ? null : s.id)} style={{ padding: '12px 14px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#2481cc', background: isDark ? '#1a2a3a' : '#e8f0ff', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>#{s.id}</span>
                    <span style={{ fontSize: 14 }}>{PAYMENT_ICONS[s.payment_type]}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.customer}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${st.color}20`, color: st.color, flexShrink: 0 }}>{st.label}</span>
                    {s.is_partial_return && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#e0803020', color: '#e08030', flexShrink: 0 }}>частичный возврат</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 11, color: muted }}>{s.items_count} поз · {s.seller} · </span>
                      <span style={{ fontSize: 11, color: muted }}>{new Date(s.created_at).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: text }}>{fmt(s.total_amount)} сум</div>
                      {s.debt > 0 && <div style={{ fontSize: 11, color: '#ff3b30', fontWeight: 600 }}>долг {fmt(s.debt)}</div>}
                      {s.returned_amount > 0 && <div style={{ fontSize: 11, color: '#e08030', fontWeight: 600 }}>возврат {fmt(s.returned_amount)}</div>}
                      {s.discount_percent > 0 && <div style={{ fontSize: 11, color: '#34c759' }}>скидка {s.discount_percent}%</div>}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${border}`, padding: '10px 14px', background: isDark ? '#1a1a1a' : '#f8f9fa' }}>
                    {s.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingTop: i > 0 ? 5 : 0 }}>
                        <span style={{ color: text }}>{item.product_name} × {item.quantity}</span>
                        <span style={{ color: muted }}>{fmt(item.selling_price * item.quantity)} сум</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: muted }}>Получено</span>
                      <span style={{ fontWeight: 700, color: '#34c759' }}>{fmt(s.paid_amount)} сум</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {histTotalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 8, paddingBottom: 16 }}>
              <button onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage <= 1}
                style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: histPage <= 1 ? (isDark ? '#2a2a2a' : '#f0f0f0') : '#1a4b8c', color: histPage <= 1 ? '#888' : '#fff', fontWeight: 700, fontSize: 14, cursor: histPage <= 1 ? 'default' : 'pointer' }}>←</button>
              <span style={{ fontSize: 13, color: muted, fontWeight: 600 }}>{histPage} / {histTotalPages}</span>
              <button onClick={() => setHistPage(p => Math.min(histTotalPages, p + 1))} disabled={histPage >= histTotalPages}
                style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: histPage >= histTotalPages ? (isDark ? '#2a2a2a' : '#f0f0f0') : '#1a4b8c', color: histPage >= histTotalPages ? '#888' : '#fff', fontWeight: 700, fontSize: 14, cursor: histPage >= histTotalPages ? 'default' : 'pointer' }}>→</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}