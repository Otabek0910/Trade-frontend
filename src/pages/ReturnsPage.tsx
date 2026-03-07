// src/pages/ReturnsPage.tsx

import { useEffect, useState, useCallback, useRef } from 'react'
import axios, { AxiosError } from 'axios'
import { useAuth } from '../contexts/AuthContext'

// ─── Типы ────────────────────────────────────────────────────────────────────

interface ReturnRecord {
  id: number
  sale_id: number
  product_name: string | null
  brand?: string | null
  unit?: string | null
  unit_value?: number | null
  customer_name: string | null
  quantity: number
  return_amount: number
  reason: string | null
  creator_name: string | null
  created_at: string
}

interface SaleSearchResult {
  sale_id: number
  customer_name: string
  customer_phone: string
  total_amount: number
  status: string
  created_at: string
}

interface SaleItem {
  product_id: number
  product_name: string
  brand?: string | null
  unit?: string | null
  unit_value?: number | null
  quantity: number
  selling_price: number
}

interface SaleInfo {
  sale_id: number
  customer_name: string
  customer_phone: string
  total_amount: number
  status: string
  created_at: string
  items: SaleItem[]
}

interface ApiError {
  detail?: string
}

const REASONS = ['Брак', 'Не подошёл', 'Пересорт', 'Иное']

// ─── Компонент ───────────────────────────────────────────────────────────────

export default function ReturnsPage() {
  const { token } = useAuth()

  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'

  const bg      = isDark ? '#1a1a1a' : '#f0f2f5'
  const surface = isDark ? '#242424' : '#ffffff'
  const textPri = isDark ? '#ffffff' : '#1a1a1a'
  const textSec = isDark ? '#888888' : '#666666'
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const border  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  const [returns, setReturns] = useState<ReturnRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Drawer
  const [showDrawer, setShowDrawer] = useState(false)

  // Последние продажи (показываем сразу)
  const [recentSales, setRecentSales] = useState<SaleSearchResult[]>([])
  const [recentLoading, setRecentLoading] = useState(false)

  // Шаг 1 — поиск клиента
  const [searchQ, setSearchQ]           = useState('')
  const [searchResults, setSearchResults] = useState<SaleSearchResult[]>([])
  const [searching, setSearching]       = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Шаг 2 — детали продажи
  const [saleInfo, setSaleInfo]     = useState<SaleInfo | null>(null)
  const [saleLoading, setSaleLoading] = useState(false)

  // Шаг 3 — оформление возврата
  const [selectedItem, setSelectedItem] = useState<SaleItem | null>(null)
  const [retQty, setRetQty]             = useState(1)
  const [retReason, setRetReason]       = useState(REASONS[0])
  const [retReasonOther, setRetReasonOther] = useState('')
  const [saving, setSaving]             = useState(false)

  // ─── Загрузка списка возвратов ───────────────────────────────────────────

  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` }
    setLoading(true)
    try {
      const res = await axios.get<ReturnRecord[]>('/returns', { headers })
      setReturns(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // ─── Загрузка последних продаж при открытии drawer ───────────────────────
  useEffect(() => {
    if (!showDrawer) return
    const headers = { Authorization: `Bearer ${token}` }
    setRecentLoading(true)
    axios.get<SaleSearchResult[]>('/returns/recent-sales', { headers })
      .then(r => setRecentSales(r.data))
      .catch(e => console.error(e))
      .finally(() => setRecentLoading(false))
  }, [showDrawer, token])

  // ─── Живой поиск с дебаунсом 400мс ──────────────────────────────────────

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!searchQ.trim() || searchQ.length < 2) {
      setSearchResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      const headers = { Authorization: `Bearer ${token}` }
      setSearching(true)
      try {
        const res = await axios.get<SaleSearchResult[]>('/returns/search-sales', {
          headers, params: { q: searchQ.trim() },
        })
        setSearchResults(res.data)
      } catch (e) {
        console.error(e)
      } finally {
        setSearching(false)
      }
    }, 400)
  }, [searchQ, token])

  // ─── Выбор продажи из результатов поиска ────────────────────────────────

  const handleSelectSale = async (saleId: number) => {
    const headers = { Authorization: `Bearer ${token}` }
    setSaleLoading(true)
    setSearchResults([])
    try {
      const res = await axios.get<SaleInfo>(`/returns/sale/${saleId}`, { headers })
      setSaleInfo(res.data)
      setSelectedItem(null)
      setRetQty(1)
    } catch (e) {
      const err = e as AxiosError<ApiError>
      alert(err.response?.data?.detail ?? 'Ошибка загрузки продажи')
    } finally {
      setSaleLoading(false)
    }
  }

  // ─── Оформить возврат ────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!saleInfo || !selectedItem) return
    const headers = { Authorization: `Bearer ${token}` }
    const reason = retReason === 'Иное' ? (retReasonOther || 'Иное') : retReason
    setSaving(true)
    try {
      await axios.post('/returns', {
        sale_id: saleInfo.sale_id,
        product_id: selectedItem.product_id,
        quantity: retQty,
        reason,
      }, { headers })
      tg?.HapticFeedback?.notificationOccurred('success')
      closeDrawer()
      await load()
    } catch (e) {
      const err = e as AxiosError<ApiError>
      alert(err.response?.data?.detail ?? 'Ошибка при оформлении возврата')
    } finally {
      setSaving(false)
    }
  }

  const closeDrawer = () => {
    setShowDrawer(false)
    setSearchQ('')
    setSearchResults([])
    setSaleInfo(null)
    setSelectedItem(null)
    setRetQty(1)
    setRetReason(REASONS[0])
    setRetReasonOther('')
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

  const STATUS_LABEL: Record<string, string> = {
    completed: '✅ Завершена',
    returned:  '↩️ Возвращена',
    cancelled: '❌ Отменена',
  }

  // ─── Вёрстка ─────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: bg, color: textPri, paddingBottom: 80 }}>

      {/* Шапка */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: surface, borderBottom: `1px solid ${border}`,
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => window.history.back()}
            style={{ background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textPri }}
          >←</button>
          <span style={{ fontSize: 17, fontWeight: 700 }}>↩️ Возвраты</span>
        </div>
        <button
          onClick={() => setShowDrawer(true)}
          style={{
            background: '#e08030', color: '#fff', border: 'none',
            borderRadius: 12, padding: '8px 16px', fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
          }}
        >+ Оформить</button>
      </div>

      {/* Список возвратов */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: textSec }}>Загрузка...</div>
        )}
        {!loading && returns.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: textSec }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>↩️</div>
            <div>Возвратов ещё нет</div>
          </div>
        )}
        {returns.map(ret => (
          <div key={ret.id} style={{
            background: surface, border: `1px solid ${border}`,
            borderRadius: 16, padding: '14px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {ret.brand && <span style={{ color: '#2481cc', fontSize: 13 }}>{ret.brand} </span>}
                {ret.product_name ?? `Товар #`}
              </div>
              <div style={{ fontSize: 13, color: textSec, marginTop: 2 }}>
                👤 {ret.customer_name ?? '—'} · Продажа #{ret.sale_id}
              </div>
              {ret.reason && (
                <div style={{ fontSize: 12, color: textSec, marginTop: 2 }}>
                  Причина: {ret.reason}
                </div>
              )}
              <div style={{ fontSize: 11, color: textSec, marginTop: 4 }}>
                {new Date(ret.created_at).toLocaleString('ru-RU', {
                  day: '2-digit', month: '2-digit', year: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
                {ret.creator_name ? ` · ${ret.creator_name}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ color: '#e08030', fontWeight: 700 }}>−{fmt(ret.return_amount)}</div>
              <div style={{ fontSize: 12, color: textSec, marginTop: 2 }}>{ret.quantity} шт.</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Drawer ────────────────────────────────────────────────────────── */}
      {showDrawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div
            onClick={closeDrawer}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'relative', background: surface,
            borderRadius: '24px 24px 0 0', padding: 24,
            maxHeight: '90vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{ width: 40, height: 4, background: border, borderRadius: 2, margin: '0 auto -8px' }} />
            <h2 style={{ textAlign: 'center', fontSize: 17, fontWeight: 700, margin: 0, color: textPri }}>
              Оформить возврат
            </h2>

            {/* ── Шаг 1: поиск клиента ── */}
            {!saleInfo && (
              <div>
                <label style={{ fontSize: 13, color: textSec, display: 'block', marginBottom: 6 }}>
                  Поиск по имени или телефону клиента
                </label>
                <input
                  type="text"
                  placeholder="Например: Алишер или +998901234567"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: inputBg, border: `1px solid ${border}`,
                    borderRadius: 12, padding: '12px 16px',
                    fontSize: 15, color: textPri, outline: 'none',
                  }}
                />

                {/* Последние продажи — если поиск пустой */}
                {!searchQ && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: textSec, fontWeight: 600, marginBottom: 6 }}>
                      🕐 Последние продажи
                    </div>
                    {recentLoading ? (
                      <div style={{ textAlign: 'center', padding: 12, color: textSec, fontSize: 13 }}>Загрузка...</div>
                    ) : recentSales.map(s => (
                      <button
                        key={s.sale_id}
                        onClick={() => handleSelectSale(s.sale_id)}
                        style={{
                          width: '100%', background: inputBg, border: `1px solid ${border}`,
                          borderRadius: 12, padding: '11px 14px', marginBottom: 6,
                          textAlign: 'left', cursor: 'pointer', color: textPri,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            #{s.sale_id} · {s.customer_name}
                          </div>
                          <div style={{ fontSize: 12, color: textSec }}>
                            {new Date(s.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: textSec, marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{fmt(s.total_amount)} сум</span>
                          {s.status !== 'completed' && (
                            <span style={{ color: '#e08030' }}>{STATUS_LABEL[s.status] ?? s.status}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Статус поиска */}
                {searching && (
                  <div style={{ textAlign: 'center', padding: '12px 0', color: textSec, fontSize: 13 }}>
                    Поиск...
                  </div>
                )}

                {/* Результаты */}
                {searchResults.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {searchResults.map(s => (
                      <button
                        key={s.sale_id}
                        onClick={() => handleSelectSale(s.sale_id)}
                        style={{
                          background: inputBg, border: `1px solid ${border}`,
                          borderRadius: 12, padding: '12px 14px',
                          textAlign: 'left', cursor: 'pointer', color: textPri,
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          👤 {s.customer_name}
                          <span style={{ fontWeight: 400, fontSize: 12, color: textSec, marginLeft: 8 }}>
                            {s.customer_phone}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: textSec, marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                          <span>Продажа #{s.sale_id} · {fmt(s.total_amount)} сум</span>
                          <span>{new Date(s.created_at).toLocaleDateString('ru-RU')}</span>
                        </div>
                        {s.status !== 'completed' && (
                          <div style={{ fontSize: 11, marginTop: 2, color: '#e08030' }}>
                            {STATUS_LABEL[s.status] ?? s.status}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {!searching && searchQ.length >= 2 && searchResults.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '12px 0', color: textSec, fontSize: 13 }}>
                    Ничего не найдено
                  </div>
                )}

                {saleLoading && (
                  <div style={{ textAlign: 'center', padding: '12px 0', color: textSec, fontSize: 13 }}>
                    Загрузка продажи...
                  </div>
                )}
              </div>
            )}

            {/* ── Шаг 2: детали продажи + выбор товара ── */}
            {saleInfo && (
              <>
                {/* Карточка клиента */}
                <div style={{
                  background: inputBg, borderRadius: 12, padding: '12px 14px',
                  fontSize: 13,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: textPri, fontSize: 15 }}>
                        👤 {saleInfo.customer_name}
                      </div>
                      <div style={{ color: textSec, marginTop: 2 }}>{saleInfo.customer_phone}</div>
                    </div>
                    <button
                      onClick={() => { setSaleInfo(null); setSearchQ('') }}
                      style={{ background: 'none', border: 'none', color: textSec, fontSize: 13, cursor: 'pointer' }}
                    >
                      ✕ Изменить
                    </button>
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${border}`, color: textSec }}>
                    <span>Продажа #{saleInfo.sale_id} · {fmt(saleInfo.total_amount)} сум</span>
                    <span style={{ marginLeft: 8 }}>· {new Date(saleInfo.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                  {saleInfo.status === 'returned' && (
                    <div style={{ color: '#e08030', marginTop: 6, fontWeight: 600 }}>
                      ⚠️ Эта продажа уже возвращена
                    </div>
                  )}
                </div>

                {/* Выбор товара */}
                <div>
                  <label style={{ fontSize: 13, color: textSec, display: 'block', marginBottom: 8 }}>
                    Выберите товар для возврата
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {saleInfo.items.map(item => (
                      <button
                        key={item.product_id}
                        onClick={() => { setSelectedItem(item); setRetQty(1) }}
                        style={{
                          background: selectedItem?.product_id === item.product_id ? '#e08030' : inputBg,
                          border: 'none', borderRadius: 12, padding: '12px 14px',
                          textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                          color: selectedItem?.product_id === item.product_id ? '#fff' : textPri,
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {item.brand && <span style={{ color: selectedItem?.product_id === item.product_id ? '#ffe' : '#2481cc', fontSize: 12 }}>{item.brand} </span>}
                          {item.product_name}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                          {item.quantity} {item.unit && item.unit !== 'шт' && item.unit_value
                            ? `шт (${+(item.quantity * item.unit_value).toFixed(1)} ${item.unit})`
                            : 'шт'
                          } · {fmt(item.selling_price)} сум/шт.
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Количество + причина + кнопка */}
                {selectedItem && (
                  <>
                    <div>
                      <label style={{ fontSize: 13, color: textSec, display: 'block', marginBottom: 8 }}>
                        Количество (макс. {selectedItem.quantity})
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <button
                          onClick={() => setRetQty(q => Math.max(1, q - 1))}
                          style={{ width: 44, height: 44, borderRadius: '50%', background: inputBg, border: 'none', fontSize: 22, color: textPri, cursor: 'pointer' }}
                        >−</button>
                        <span style={{ fontSize: 24, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>
                          {retQty}
                        </span>
                        <button
                          onClick={() => setRetQty(q => Math.min(selectedItem.quantity, q + 1))}
                          style={{ width: 44, height: 44, borderRadius: '50%', background: inputBg, border: 'none', fontSize: 22, color: textPri, cursor: 'pointer' }}
                        >+</button>
                        <span style={{ fontSize: 14, color: textSec }}>
                          = {fmt(retQty * selectedItem.selling_price)} сум
                        </span>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 13, color: textSec, display: 'block', marginBottom: 8 }}>
                        Причина возврата
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {REASONS.map(r => (
                          <button
                            key={r}
                            onClick={() => setRetReason(r)}
                            style={{
                              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                              fontSize: 13, fontWeight: retReason === r ? 700 : 400,
                              background: retReason === r ? '#e08030' : inputBg,
                              color: retReason === r ? '#fff' : textPri,
                            }}
                          >{r}</button>
                        ))}
                      </div>
                      {retReason === 'Иное' && (
                        <input
                          type="text"
                          placeholder="Опишите причину..."
                          value={retReasonOther}
                          onChange={e => setRetReasonOther(e.target.value)}
                          style={{
                            marginTop: 8, width: '100%', boxSizing: 'border-box',
                            background: inputBg, border: `1px solid ${border}`,
                            borderRadius: 12, padding: '10px 14px',
                            fontSize: 14, color: textPri, outline: 'none',
                          }}
                        />
                      )}
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={saving}
                      style={{
                        width: '100%', background: saving ? '#555' : '#e08030',
                        color: '#fff', border: 'none', borderRadius: 16,
                        padding: 16, fontSize: 16, fontWeight: 700,
                        cursor: saving ? 'default' : 'pointer',
                      }}
                    >
                      {saving
                        ? 'Оформление...'
                        : `↩️ Вернуть ${retQty} шт. · ${fmt(retQty * selectedItem.selling_price)} сум`
                      }
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}