import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../contexts/AuthContext'
import AddProductModal from './stock/AddProductModal'
import ReceiptModal from './stock/ReceiptModal'
import EditProductModal from './stock/EditProductModal'

export interface Product {
  id: number
  sku: string
  name: string
  category: string | null
  supplier_id: number | null
  supplier_name: string | null
  purchase_price: number
  selling_price: number
  min_stock: number
  current_stock: number
  photo_url: string | null
  low_stock: boolean
  margin_percent: number
  brand: string | null
  unit: string
  unit_value: number | null
  purchase_currency: string        // 'uzs' | 'usd'
  purchase_rate: number | null     // курс на момент закупки
}

export default function StockPage() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'

  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [filterLow, setFilterLow] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [receiptProduct, setReceiptProduct] = useState<Product | null>(null)
  const [tab, setTab] = useState<'list' | 'history'>('list')
  const [refreshKey, setRefreshKey] = useState(0)
  const [page, setPage] = useState(1)

  useEffect(() => {
    Promise.resolve().then(() => setLoading(true))
  }, [search, filterLow, refreshKey])

  useEffect(() => {
    let cancelled = false
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (filterLow) params.low_stock = 'true'

    api
      .get<{ items: Product[] }>('/products', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      })
      .then(res => { if (!cancelled) setProducts(res.data.items) })
      .catch(() => { if (!cancelled) setProducts([]) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
    setPage(1)
  }, [token, search, filterLow, refreshKey])

  const refresh = () => setRefreshKey(k => k + 1)

  const handleProductUpdated = (updated: Product) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
    // Обновляем и в editProduct чтобы модал не сбросился
    setEditProduct(prev => prev?.id === updated.id ? updated : prev)
  }

  const handleProductDeleted = (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id))
    setEditProduct(null)
  }

  const lowStockCount = products.filter(p => p.low_stock).length
  const PSIZE = 4
  const totalPages = Math.ceil(products.length / PSIZE)
  const pagedProducts = products.slice((page - 1) * PSIZE, page * PSIZE)

  const bg     = isDark ? '#1a1a1a' : '#f0f2f5'
  const card   = isDark ? '#242424' : '#ffffff'
  const text   = isDark ? '#ffffff' : '#1a1a1a'
  const muted  = isDark ? '#666'    : '#999'
  const border = isDark ? '#333'    : '#e8eaed'

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ background: card, padding: '14px 16px 10px', boxShadow: `0 1px 0 ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={() => navigate('/')}
            style={{ background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: text }}>📦 Склад</div>
          {lowStockCount > 0 && (
            <div style={{ background: '#ff3b30', borderRadius: 10, padding: '3px 8px', fontSize: 12, color: '#fff', fontWeight: 700 }}>
              ⚠️ {lowStockCount}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, background: isDark ? '#333' : '#f0f2f5', borderRadius: 10, padding: 3 }}>
          {(['list', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, border: 'none', borderRadius: 8, padding: '7px 0',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: tab === t ? card : 'transparent',
              color: tab === t ? text : muted,
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.15s',
            }}>
              {t === 'list' ? '📋 Товары' : '📥 История'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'list' ? (
        <>
          <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Поиск по названию или SKU..."
              style={{ flex: 1, background: card, border: `1px solid ${border}`, borderRadius: 12, padding: '10px 14px', fontSize: 16, color: text, outline: 'none' }}
            />
            <button onClick={() => setFilterLow(v => !v)} style={{
              background: filterLow ? '#ff3b30' : card,
              border: `1px solid ${filterLow ? '#ff3b30' : border}`,
              borderRadius: 12, padding: '10px 12px', fontSize: 13,
              color: filterLow ? '#fff' : muted, cursor: 'pointer', fontWeight: 600,
            }}>⚠️</button>
          </div>

          <div style={{ display: 'flex', gap: 8, padding: '10px 16px' }}>
            {[
              { label: 'Всего',  value: products.length,                 color: '#2481cc' },
              { label: 'Мало',   value: lowStockCount,                   color: '#ff3b30' },
              { label: 'Норма',  value: products.length - lowStockCount, color: '#34c759' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: card, borderRadius: 12, padding: '10px 0', textAlign: 'center', border: `1px solid ${border}` }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: muted }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 48, color: muted }}>Загрузка...</div>
            ) : products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ color: muted, fontSize: 15 }}>Товаров нет</div>
              </div>
            ) : pagedProducts.map(p => (
              <div
                key={p.id}
                onClick={() => setEditProduct(p)}
                style={{
                  background: p.low_stock ? (isDark ? '#2a1a1a' : '#fff8f8') : card,
                  borderRadius: 16, padding: '14px 16px',
                  border: `1.5px solid ${p.low_stock ? '#ff3b3050' : border}`,
                  cursor: 'pointer',
                  transition: 'opacity 0.1s',
                }}
                onTouchStart={e => (e.currentTarget.style.opacity = '0.7')}
                onTouchEnd={e => (e.currentTarget.style.opacity = '1')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

                  {/* Фото / аватарка */}
                  <div style={{
                    width: 64, height: 64, borderRadius: 14, flexShrink: 0,
                    overflow: 'hidden',
                    background: isDark ? '#333' : '#e8eaed',
                    border: `1.5px solid ${p.photo_url ? '#1a6b3c40' : border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28,
                  }}>
                    {p.photo_url
                      ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '📦'
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                        {p.low_stock && <span style={{ flexShrink: 0 }}>⚠️</span>}
                        <div style={{ fontSize: 15, fontWeight: 700, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </div>
                      </div>

                      {/* Кнопка приёмки — отдельный обработчик чтобы не открывало edit */}
                      <button
                        onClick={e => { e.stopPropagation(); setReceiptProduct(p); setShowReceipt(true) }}
                        style={{
                          background: '#1a6b3c', border: 'none', borderRadius: 12,
                          width: 36, height: 36, color: '#fff', fontSize: 22,
                          cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>+</button>
                    </div>

                    {p.brand && (
                      <div style={{ fontSize: 12, color: '#2481cc', fontWeight: 600, marginBottom: 1 }}>{p.brand}</div>
                    )}
                    <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>
                      {p.sku}{p.category ? ` · ${p.category}` : ''}{p.supplier_name ? ` · ${p.supplier_name}` : ''}
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: muted, marginBottom: 1 }}>Остаток</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: p.low_stock ? '#ff3b30' : '#34c759' }}>
                          {p.current_stock} шт
                          {p.unit && p.unit !== 'шт' && p.unit_value
                            ? <span style={{ fontSize: 12, fontWeight: 600, color: muted }}> ({+(p.current_stock * p.unit_value).toFixed(1)} {p.unit})</span>
                            : null}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: muted, marginBottom: 1 }}>Цена</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: text }}>
                          {p.selling_price.toLocaleString('ru-RU')}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: muted, marginBottom: 1 }}>Маржа</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#34c759' }}>
                          {p.margin_percent}%
                        </div>
                      </div>
                    </div>

                    {p.low_stock && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#ff3b30', fontWeight: 600 }}>
                        Мин. {p.min_stock} шт — нужно пополнить!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Пагинация товаров */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 0 4px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: page <= 1 ? (isDark ? '#2a2a2a' : '#f0f0f0') : '#1a6b3c', color: page <= 1 ? muted : '#fff', fontWeight: 700, fontSize: 14, cursor: page <= 1 ? 'default' : 'pointer' }}>←</button>
              <span style={{ fontSize: 13, color: muted, fontWeight: 600 }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: page >= totalPages ? (isDark ? '#2a2a2a' : '#f0f0f0') : '#1a6b3c', color: page >= totalPages ? muted : '#fff', fontWeight: 700, fontSize: 14, cursor: page >= totalPages ? 'default' : 'pointer' }}>→</button>
            </div>
          )}

          {/* Отступ снизу чтобы список не перекрывался фиксированной кнопкой */}
          <div style={{ height: 80 }} />
        </>
      ) : (
        <ReceiptHistoryTab token={token!} isDark={isDark} card={card} text={text} muted={muted} border={border} />
      )}

      {/* Фиксированная кнопка "+ Добавить товар" */}
      {tab === 'list' && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: isDark ? 'rgba(26,26,26,0.95)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', zIndex: 40, borderTop: `1px solid ${border}` }}>
          <button onClick={() => setShowAddProduct(true)} style={{
            width: '100%', background: 'linear-gradient(135deg, #1a6b3c, #2d9c5c)',
            border: 'none', borderRadius: 16, padding: 15, color: '#fff',
            fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(26,107,60,0.35)',
          }}>
            + Добавить товар
          </button>
        </div>
      )}

      {showAddProduct && (
        <AddProductModal
          token={token!} isDark={isDark}
          onClose={() => setShowAddProduct(false)}
          onSuccess={() => { setShowAddProduct(false); refresh() }}
        />
      )}


      {showReceipt && receiptProduct && (
        <ReceiptModal
          token={token!} role={user?.role ?? ''} product={receiptProduct} isDark={isDark}
          onClose={() => { setShowReceipt(false); setReceiptProduct(null) }}
          onSuccess={() => { setShowReceipt(false); setReceiptProduct(null); refresh() }}
        />
      )}

      {editProduct && (
        <EditProductModal
          product={editProduct}
          token={token!}
          role={user?.role ?? ''}
          isDark={isDark}
          onClose={() => setEditProduct(null)}
          onUpdate={handleProductUpdated}
          onDelete={handleProductDeleted}
        />
      )}
    </div>
  )
}

// ─── История приёмок ──────────────────────────────────────────────────────────
function ReceiptHistoryTab({ token, card, text, muted, border, isDark }: {
  token: string; isDark: boolean; card: string; text: string; muted: string; border: string
}) {
  const [history, setHistory] = useState<Array<{
    id: number; product_name: string; supplier_name: string
    quantity: number; purchase_price: number; storekeeper: string; created_at: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [rPage, setRPage] = useState(1)
  const RSIZE = 6
  const rTotalPages = Math.ceil(history.length / RSIZE)
  const pagedHistory = history.slice((rPage - 1) * RSIZE, rPage * RSIZE)

  useEffect(() => {
    let cancelled = false
    api.get('/receipts')
      .then(r => { if (!cancelled) setHistory(r.data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: muted }}>Загрузка...</div>

  return (
    <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ color: muted }}>Приёмок ещё не было</div>
        </div>
      ) : pagedHistory.map(r => (
        <div key={r.id} style={{ background: card, borderRadius: 14, padding: '12px 14px', border: `1px solid ${border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{r.product_name}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#34c759' }}>+{r.quantity} шт</div>
          </div>
          <div style={{ fontSize: 12, color: muted }}>
            {r.supplier_name} · {r.purchase_price.toLocaleString('ru-RU')} сум/шт
          </div>
          <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
            {r.storekeeper} · {new Date(r.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ))}
      {rTotalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 8 }}>
          <button onClick={() => setRPage(p => Math.max(1, p - 1))} disabled={rPage <= 1}
            style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: rPage <= 1 ? (isDark ? '#2a2a2a' : '#f0f0f0') : '#1a6b3c', color: rPage <= 1 ? muted : '#fff', fontWeight: 700, fontSize: 14, cursor: rPage <= 1 ? 'default' : 'pointer' }}>←</button>
          <span style={{ fontSize: 13, color: muted, fontWeight: 600 }}>{rPage} / {rTotalPages}</span>
          <button onClick={() => setRPage(p => Math.min(rTotalPages, p + 1))} disabled={rPage >= rTotalPages}
            style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: rPage >= rTotalPages ? (isDark ? '#2a2a2a' : '#f0f0f0') : '#1a6b3c', color: rPage >= rTotalPages ? muted : '#fff', fontWeight: 700, fontSize: 14, cursor: rPage >= rTotalPages ? 'default' : 'pointer' }}>→</button>
        </div>
      )}
    </div>
  )
}