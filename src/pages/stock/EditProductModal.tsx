import { useState, useEffect, useRef } from 'react'
import api from '../../api'
import type { AxiosError } from 'axios'

interface Supplier { id: number; name: string }

export interface Product {
  id: number
  sku: string
  name: string
  category: string | null
  brand: string | null
  unit: string
  unit_value: number | null
  supplier_id: number | null
  supplier_name: string | null
  purchase_price: number
  selling_price: number
  min_stock: number
  current_stock: number
  photo_url: string | null
  low_stock: boolean
  margin_percent: number
  // ── Валюта закупки ──
  purchase_currency: string        // 'uzs' | 'usd'
  purchase_rate: number | null     // курс на момент закупки
}

interface Props {
  product: Product
  token: string
  isDark: boolean
  role: string
  onClose: () => void
  onUpdate: (p: Product) => void
  onDelete: (id: number) => void
}

const UNITS = ['шт', 'л', 'кг', 'м', 'м²', 'уп', 'пар', 'рул']

export default function EditProductModal({ product, isDark, role, onClose, onUpdate, onDelete }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [cbuRate, setCbuRate] = useState<number | null>(null)

  const [form, setForm] = useState({
    name: product.name,
    category: product.category || '',
    brand: product.brand || '',
    unit: product.unit || 'шт',
    unit_value: product.unit_value ? String(product.unit_value) : '',
    supplier_id: product.supplier_id ? String(product.supplier_id) : '',
    purchase_price: String(product.purchase_price),
    selling_price: String(product.selling_price),
    min_stock: String(product.min_stock),
    // ── Валюта закупки ──
    purchase_currency: product.purchase_currency || 'uzs',
    purchase_rate: product.purchase_rate ? String(product.purchase_rate) : '',
  })

  const [photoUrl, setPhotoUrl] = useState<string | null>(product.photo_url)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  interface PriceRecord { id: number; quantity: number; purchase_price: number; supplier_name: string; storekeeper: string; created_at: string }
  const [priceHistory, setPriceHistory] = useState<{ items: PriceRecord[]; total: number; pages: number } | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadHistory = (page: number) => {
    setHistoryLoading(true)
    api.get(`/receipts/product/${product.id}?page=${page}&limit=10`)
      .then(r => { setPriceHistory(r.data); setHistoryPage(page) })
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }

  const toggleHistory = () => {
    if (!historyOpen && !priceHistory) loadHistory(1)
    setHistoryOpen(v => !v)
  }
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data)).catch(() => {})
    // Тянем курс ЦБУ для подсказки
    api.get('/rates/today')
      .then(r => setCbuRate(r.data.cbu_rate))
      .catch(() => {})
  }, [])

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const isUsd = form.purchase_currency === 'usd'
  const canEditPrices = role === 'developer' || product.purchase_price === 0
  const purchaseNum = parseFloat(form.purchase_price) || 0
  const sellingNum = parseFloat(form.selling_price) || 0
  const rateNum = parseFloat(form.purchase_rate) || 0
  const showUnitValue = form.unit !== 'шт'

  // Маржа с учётом валюты
  const calcMargin = () => {
    if (!purchaseNum || !sellingNum) return null
    if (isUsd) {
      if (!rateNum) return null
      const buyUzs = purchaseNum * rateNum
      const pct = Math.round((sellingNum - buyUzs) / buyUzs * 100)
      const usd = sellingNum / rateNum - purchaseNum
      return { pct, uzs: sellingNum - buyUzs, usd }
    }
    return { pct: Math.round((sellingNum - purchaseNum) / purchaseNum * 100), uzs: sellingNum - purchaseNum, usd: null }
  }
  const margin = calcMargin()

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Введите название'); return }
    if (isUsd && canEditPrices && (!form.purchase_rate || rateNum <= 0)) {
      setError('Укажите курс доллара на момент закупки')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await api.patch(`/products/${product.id}`, {
        name: form.name.trim(),
        category: form.category.trim() || null,
        brand: form.brand.trim() || null,
        unit: form.unit || 'шт',
        unit_value: showUnitValue && form.unit_value ? parseFloat(form.unit_value) : null,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
        purchase_price: parseFloat(form.purchase_price),
        selling_price: parseFloat(form.selling_price),
        min_stock: parseInt(form.min_stock) || 5,
        // ── Валюта ──
        purchase_currency: form.purchase_currency,
        purchase_rate: isUsd && form.purchase_rate ? parseFloat(form.purchase_rate) : null,
      })
      onUpdate({ ...res.data, photo_url: photoUrl })
      onClose()
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setError(e.response?.data?.detail || 'Ошибка сохранения')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/products/${product.id}`)
      onDelete(product.id)
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setError(e.response?.data?.detail || 'Ошибка удаления')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const form2 = new FormData()
    form2.append('file', file)
    try {
      const res = await api.post(`/products/${product.id}/photo`, form2)
      setPhotoUrl(res.data.photo_url)
      onUpdate({ ...product, photo_url: res.data.photo_url })
    } catch { /* silent */ }
    setUploadingPhoto(false)
    e.target.value = ''
  }

  const handleDeletePhoto = async () => {
    try {
      await api.delete(`/products/${product.id}/photo`)
      setPhotoUrl(null)
      onUpdate({ ...product, photo_url: null })
    } catch { /* silent */ }
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
    padding: '11px 14px', fontSize: 16, color: text, outline: 'none',
  }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6, display: 'block' as const }

  return (
    <>
      {lightbox && photoUrl && (
        <div onClick={() => setLightbox(false)} style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.93)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img src={photoUrl} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 16, objectFit: 'contain' }} />
          <button onClick={() => setLightbox(false)} style={{
            position: 'absolute', top: 20, right: 20,
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
            width: 40, height: 40, fontSize: 20, color: '#fff', cursor: 'pointer',
          }}>×</button>
        </div>
      )}

      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ width: '100%', background: bg, borderRadius: '24px 24px 0 0', maxHeight: '93vh', display: 'flex', flexDirection: 'column' }}>

          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: isDark ? '#555' : '#ddd' }} />
          </div>

          {/* Header */}
          <div style={{ padding: '4px 20px 16px', flexShrink: 0, borderBottom: `1px solid ${border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 18, overflow: 'hidden',
                  background: isDark ? '#333' : '#e8eaed',
                  border: `2px solid ${photoUrl ? '#1a6b3c' : border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
                }}>
                  {uploadingPhoto ? <span style={{ fontSize: 24 }}>⏳</span>
                    : photoUrl ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => setLightbox(true)} />
                    : <span onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>📦</span>}
                </div>
                <button onClick={() => fileInputRef.current?.click()} style={{
                  position: 'absolute', bottom: -4, right: -4, width: 26, height: 26,
                  background: '#1a6b3c', border: `2px solid ${bg}`, borderRadius: '50%',
                  color: '#fff', fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>📷</button>
                {photoUrl && (
                  <button onClick={handleDeletePhoto} style={{
                    position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                    background: '#ff3b30', border: 'none', borderRadius: '50%',
                    color: '#fff', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                  }}>×</button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {product.name}
                </div>
                {product.brand && (
                  <div style={{ fontSize: 12, color: '#2481cc', fontWeight: 600, marginTop: 1 }}>{product.brand}</div>
                )}
                <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>SKU: {product.sku}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                    background: product.low_stock ? '#ff3b3020' : '#34c75920',
                    color: product.low_stock ? '#ff3b30' : '#34c759',
                  }}>
                    {product.current_stock} шт
                    {product.unit_value && product.unit !== 'шт'
                      ? ` (${+(product.current_stock * product.unit_value).toFixed(1)} ${product.unit})`
                      : ''}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: isDark ? '#333' : '#f0f2f5', color: muted }}>
                    {product.margin_percent}% маржа
                  </span>
                  {/* Бейдж валюты */}
                  {product.purchase_currency === 'usd' && (
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#e0803020', color: '#e08030' }}>
                      💵 закуп в $
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: muted, cursor: 'pointer', flexShrink: 0 }}>×</button>
            </div>
          </div>

          {/* Форма */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div>
                <label style={labelStyle}>Название товара *</label>
                <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Название" />
              </div>

              <div>
                <label style={labelStyle}>Марка / Бренд</label>
                <input style={inputStyle} value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Например: Mobil 1, Shell, Castrol" />
              </div>

              <div>
                <label style={labelStyle}>Категория</label>
                <input style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)} placeholder="Например: Масла" />
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
                    style={inputStyle} type="number"
                    placeholder={`Сколько ${form.unit} в одной упаковке?`}
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
                <select style={{ ...inputStyle, appearance: 'none' as const }} value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}>
                  <option value="">— Не выбран —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* ── Валюта закупки — только developer или если цена ещё не задана ── */}
              {canEditPrices && (
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
                </div>
              )}

              {/* Цена закупки */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>
                    Цена закупки {isUsd ? '($)' : '(сум)'}
                  </label>
                  {canEditPrices ? (
                    <input style={inputStyle} type="number" value={form.purchase_price}
                      onChange={e => set('purchase_price', e.target.value)} inputMode="decimal" />
                  ) : (
                    <div style={{ ...inputStyle, background: isDark ? '#2a2a2a' : '#f0f0f0', color: isDark ? '#777' : '#aaa', cursor: 'not-allowed', display: 'flex', alignItems: 'center' }}>
                      {form.purchase_price} {isUsd ? '$' : 'сум'}
                      <span style={{ fontSize: 10, marginLeft: 6, color: isDark ? '#555' : '#bbb' }}>🔒</span>
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Цена продажи (сум)</label>
                  <input style={inputStyle} type="number" value={form.selling_price}
                    onChange={e => set('selling_price', e.target.value)} inputMode="decimal" />
                </div>
              </div>

              {/* Курс закупки — если USD */}
              {isUsd && (
                <div>
                  <label style={labelStyle}>
                    Курс на момент закупки ($)
                    {cbuRate && (
                      <span style={{ fontWeight: 400, color: '#34c759', marginLeft: 6 }}>
                        ЦБУ сегодня: {cbuRate.toLocaleString('ru-RU')} сум
                      </span>
                    )}
                  </label>
                  {canEditPrices ? (
                    <>
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
                          💱 {form.purchase_price}$ × {parseFloat(form.purchase_rate).toLocaleString('ru-RU')} ={' '}
                          {(parseFloat(form.purchase_price) * parseFloat(form.purchase_rate)).toLocaleString('ru-RU')} сум
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ ...inputStyle, background: isDark ? '#2a2a2a' : '#f0f0f0', color: isDark ? '#777' : '#aaa', cursor: 'not-allowed', display: 'flex', alignItems: 'center' }}>
                      {form.purchase_rate ? `${parseFloat(form.purchase_rate).toLocaleString('ru-RU')} сум/$` : '—'}
                      <span style={{ fontSize: 10, marginLeft: 6, color: isDark ? '#555' : '#bbb' }}>🔒</span>
                    </div>
                  )}
                </div>
              )}

              {/* Маржа */}
              {margin !== null && (
                <div style={{
                  background: margin.pct >= 0 ? '#34c75915' : '#ff3b3015',
                  border: `1px solid ${margin.pct >= 0 ? '#34c75940' : '#ff3b3040'}`,
                  borderRadius: 12, padding: '10px 14px',
                }}>
                  <span style={{ fontSize: 13, color: margin.pct >= 0 ? '#34c759' : '#ff3b30', fontWeight: 600 }}>
                    Маржа: {margin.pct}%
                    {' '}({margin.uzs >= 0 ? '+' : ''}{Math.round(margin.uzs).toLocaleString('ru-RU')} сум/шт)
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
                <input style={inputStyle} type="number" value={form.min_stock} onChange={e => set('min_stock', e.target.value)} inputMode="numeric" />
              </div>

              {error && (
                <div style={{ background: '#ff3b3015', border: '1px solid #ff3b3030', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#ff3b30' }}>
                  {error}
                </div>
              )}

              <button onClick={handleSave} disabled={saving} style={{
                width: '100%', background: saving ? '#555' : 'linear-gradient(135deg, #1a6b3c, #2d9c5c)',
                border: 'none', borderRadius: 14, padding: 15,
                color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}>
                {saving ? 'Сохранение...' : '✅ Сохранить изменения'}
              </button>

              {/* История цен закупки */}
              <div style={{ background: card, borderRadius: 16, border: `1px solid ${border}`, overflow: 'hidden' }}>
                <button onClick={toggleHistory} style={{
                  width: '100%', background: 'none', border: 'none', padding: '14px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer', color: isDark ? '#fff' : '#1a1a1a',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>📊 История цен закупки</span>
                  <span style={{ fontSize: 18, color: muted }}>{historyOpen ? '▲' : '▼'}</span>
                </button>
                {historyOpen && (
                  <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${border}` }}>
                    {historyLoading ? (
                      <div style={{ textAlign: 'center', padding: 16, color: muted, fontSize: 13 }}>Загрузка...</div>
                    ) : !priceHistory || priceHistory.items.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 16, color: muted, fontSize: 13 }}>Приёмок ещё не было</div>
                    ) : (
                      <>
                        {priceHistory.items.map((r, idx) => (
                          <div key={r.id} style={{ padding: '10px 0', borderBottom: idx < priceHistory.items.length - 1 ? `1px solid ${border}` : 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#fff' : '#1a1a1a' }}>
                                {r.purchase_price.toLocaleString('ru-RU')} сум
                              </span>
                              <span style={{ fontSize: 12, color: '#1a6b3c', fontWeight: 600 }}>+{r.quantity} шт</span>
                            </div>
                            <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>{r.supplier_name} · {r.storekeeper}</div>
                            <div style={{ fontSize: 11, color: muted }}>
                              {new Date(r.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ))}
                        {priceHistory.pages > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
                            <button onClick={() => loadHistory(historyPage - 1)} disabled={historyPage <= 1}
                              style={{ flex: 1, padding: '8px 0', background: historyPage <= 1 ? (isDark ? '#2a2a2a' : '#f0f0f0') : '#1a4b8c',
                              color: historyPage <= 1 ? muted : '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: historyPage <= 1 ? 'default' : 'pointer' }}>
                              ← Назад
                            </button>
                            <span style={{ fontSize: 12, color: muted, whiteSpace: 'nowrap' }}>{historyPage} / {priceHistory.pages}</span>
                            <button onClick={() => loadHistory(historyPage + 1)} disabled={historyPage >= priceHistory.pages}
                              style={{ flex: 1, padding: '8px 0', background: historyPage >= priceHistory.pages ? (isDark ? '#2a2a2a' : '#f0f0f0') : '#1a4b8c',
                              color: historyPage >= priceHistory.pages ? muted : '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: historyPage >= priceHistory.pages ? 'default' : 'pointer' }}>
                              Вперёд →
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
                <div style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
                  Удаление товара невозможно отменить. Товар не удалится если есть связанные продажи.
                </div>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} style={{
                    width: '100%', background: 'none', border: `1px solid #ff3b3050`,
                    borderRadius: 12, padding: 12, color: '#ff3b30',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>🗑 Удалить товар</button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 13, color: '#ff3b30', fontWeight: 700, textAlign: 'center' }}>
                      Точно удалить «{product.name}»?
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setConfirmDelete(false)} style={{
                        flex: 1, background: isDark ? '#333' : '#f0f2f5',
                        border: 'none', borderRadius: 12, padding: 12,
                        color: muted, fontWeight: 600, cursor: 'pointer',
                      }}>Отмена</button>
                      <button onClick={handleDelete} disabled={deleting} style={{
                        flex: 2, background: '#ff3b30',
                        border: 'none', borderRadius: 12, padding: 12,
                        color: '#fff', fontWeight: 700, cursor: 'pointer',
                      }}>{deleting ? 'Удаление...' : '🗑 Да, удалить'}</button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}