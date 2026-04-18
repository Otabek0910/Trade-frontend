import { useState, useEffect, useRef } from 'react'
import axios, { AxiosError } from 'axios'
import type { Supplier } from '../SuppliersPage'
import LocationPickerModal from './LocationPickerModal'
import { unitDisplay } from '../sales/unitHelpers'

interface Product {
  id: number
  name: string
  sku: string
  current_stock: number
  purchase_price: number
  selling_price: number
  unit: string
  unit_value: number | null
}
interface Receipt {
  id: number
  product_name: string
  quantity: number
  purchase_price: number
  total: number
  paid_amount: number
  debt: number
  created_at: string
  unit: string
  unit_value: number | null
}
interface DebtPayment {
  id: number
  amount: number
  note: string | null
  user_name: string
  created_at: string
}
interface SupplierReturnRecord {
  id: number
  product_name: string
  unit: string
  unit_value: number | null
  quantity: number
  purchase_price: number
  return_amount: number
  debt_reduced: number
  credit_added: number
  reason: string | null
  creator_name: string
  created_at: string
}
interface NominatimResult { display_name: string; lat: string; lon: string }

interface DetailData extends Supplier {
  products: Product[]
  recent_receipts: Receipt[]
  debt_payments: DebtPayment[]
  total_debt: number
  total_credit: number
}

interface Props {
  supplierId: number
  token: string
  isDark: boolean
  onClose: () => void
  onUpdate: (s: Supplier) => void
  onDelete: (id: number) => void
}

export default function SupplierDetailModal({ supplierId, token, isDark, onClose, onUpdate, onDelete }: Props) {
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'products' | 'receipts' | 'debt' | 'returns'>('info')

  // Редактирование
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Оплата долга
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [paySuccess, setPaySuccess] = useState('')

  // Получение кредита от поставщика
  const [payCreditAmount, setPayCreditAmount] = useState('')
  const [payCreditNote, setPayCreditNote] = useState('')
  const [payingCredit, setPayingCredit] = useState(false)
  const [payCreditError, setPayCreditError] = useState('')
  const [payCreditSuccess, setPayCreditSuccess] = useState('')

  // Фото
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Локация
  const [locMode, setLocMode] = useState<'idle' | 'menu' | 'search' | 'manual'>('idle')
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')

  // Возвраты поставщику
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturnRecord[]>([])
  const [returnsLoading, setReturnsLoading] = useState(false)
  const [showReturnForm, setShowReturnForm] = useState(false)
  const [retProductId, setRetProductId] = useState<number | null>(null)
  const [retQty, setRetQty] = useState(1)
  const [retPrice, setRetPrice] = useState('')
  const [retReason, setRetReason] = useState('')
  const [retLoading, setRetLoading] = useState(false)
  const [retError, setRetError] = useState('')
  const [retSuccess, setRetSuccess] = useState('')

  const headers = { Authorization: `Bearer ${token}` }

// ─── Загрузка данных поставщика ───────────────────────────────────────────
  useEffect(() => {
    const h = { headers: { Authorization: `Bearer ${token}` } }

    // Основные данные поставщика
    axios.get(`/suppliers/${supplierId}`, h)
      .then(r => {
        setData(r.data)
        setEditName(r.data.name)
        setEditPhone(r.data.phone || '')
        setEditAddress(r.data.address || '')
        setEditNotes(r.data.notes || '')
        setLoading(false)
      })
      .catch(() => setLoading(false))

    // Возвраты — грузим сразу, чтобы счётчик в шапке работал
    axios.get(`/supplier-returns/supplier/${supplierId}`, h)
      .then(r => setSupplierReturns(r.data))
      .catch(() => {})
  }, [supplierId, token])

  // ─── Обновление возвратов при переходе на таб (для свежих данных) ──────────
  useEffect(() => {
    if (tab !== 'returns') return
    const load = async () => {
      setReturnsLoading(true)
      try {
        const r = await axios.get(`/supplier-returns/supplier/${supplierId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setSupplierReturns(r.data)
      } catch { /* silent */ }
      setReturnsLoading(false)
    }
    void load()
  }, [tab, supplierId, token])

  // ─── Загрузка возвратов при переходе на таб ───────────────────────────────
  useEffect(() => {
    if (tab !== 'returns') return
    const load = async () => {
      setReturnsLoading(true)
      try {
        const r = await axios.get(`/supplier-returns/supplier/${supplierId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setSupplierReturns(r.data)
      } catch { /* silent */ }
      setReturnsLoading(false)
    }
    void load()
  }, [tab, supplierId, token])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await axios.patch(`/suppliers/${supplierId}`,
        { name: editName, phone: editPhone || null, address: editAddress || null, notes: editNotes || null },
        { headers }
      )
      setData(prev => prev ? { ...prev, ...res.data } : prev)
      onUpdate(res.data)
      setEditing(false)
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true); setDeleteError('')
    try {
      await axios.delete(`/suppliers/${supplierId}`, { headers })
      onDelete(supplierId)
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setDeleteError(e.response?.data?.detail || 'Ошибка удаления')
    }
    setDeleting(false)
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !data) return
    setUploadingPhoto(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await axios.post(`/suppliers/${supplierId}/photo`, form, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      })
      setData(prev => prev ? { ...prev, photo_url: res.data.photo_url } : prev)
      onUpdate({ ...data, photo_url: res.data.photo_url })
    } catch { /* silent */ }
    setUploadingPhoto(false); e.target.value = ''
  }

  const handleDeletePhoto = async () => {
    if (!data) return
    try {
      await axios.delete(`/suppliers/${supplierId}/photo`, { headers })
      setData(prev => prev ? { ...prev, photo_url: null } : prev)
      onUpdate({ ...data, photo_url: null })
    } catch { /* silent */ }
  }

  const saveLocation = async (newLat: number, newLng: number) => {
    if (!data) return
    try {
      await axios.post(`/suppliers/${supplierId}/location`, { lat: newLat, lng: newLng }, { headers })
      setData(prev => prev ? { ...prev, lat: newLat, lng: newLng } : prev)
      onUpdate({ ...data, lat: newLat, lng: newLng })
      setLocMode('idle'); setLocError(''); setSearchQuery(''); setSearchResults([])
    } catch { setLocError('Не удалось сохранить') }
  }

  const handleDeleteLocation = async () => {
    if (!data) return
    try {
      await axios.delete(`/suppliers/${supplierId}/location`, { headers })
      setData(prev => prev ? { ...prev, lat: null, lng: null } : prev)
      onUpdate({ ...data, lat: null, lng: null })
    } catch { /* silent */ }
  }

  const handleGPS = () => {
    setLocating(true); setLocError('')
    navigator.geolocation.getCurrentPosition(
      async pos => { await saveLocation(pos.coords.latitude, pos.coords.longitude); setLocating(false) },
      () => { setLocError('Нет доступа к геолокации'); setLocating(false) },
      { timeout: 10000 }
    )
  }

  const handleAddressSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true); setSearchResults([]); setLocError('')
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=4&accept-language=ru`,
        { headers: { 'User-Agent': 'TradiApp/1.0' } }
      )
      const d: NominatimResult[] = await res.json()
      setSearchResults(d)
      if (d.length === 0) setLocError('Ничего не найдено')
    } catch { setLocError('Ошибка поиска') }
    setSearching(false)
  }

  const handleManualSave = async () => {
    const la = parseFloat(manualLat.replace(',', '.'))
    const lo = parseFloat(manualLng.replace(',', '.'))
    if (isNaN(la) || isNaN(lo)) { setLocError('Введите корректные координаты'); return }
    if (la < -90 || la > 90 || lo < -180 || lo > 180) { setLocError('Координаты вне диапазона'); return }
    await saveLocation(la, lo)
  }

  // ─── Оплата долга поставщику ─────────────────────────────────────────────
  const handlePayDebt = async () => {
    if (!payAmount || !data) return
    setPaying(true); setPayError(''); setPaySuccess('')
    try {
      const res = await axios.post(`/suppliers/${supplierId}/pay-debt`,
        { amount: parseFloat(payAmount), note: payNote || null },
        { headers }
      )
      setPaySuccess(res.data.message)
      setPayAmount(''); setPayNote('')
      setData(d => d ? { ...d, total_debt: res.data.total_debt } : d)
      onUpdate({ ...data, total_debt: res.data.total_debt })
    } catch (e) {
      const err = e as AxiosError<{ detail?: string }>
      setPayError(err.response?.data?.detail || 'Ошибка')
    }
    setPaying(false)
  }

  // ─── Получение кредита от поставщика ─────────────────────────────────────
  const handleReceiveCredit = async () => {
    if (!payCreditAmount || !data) return
    setPayingCredit(true); setPayCreditError(''); setPayCreditSuccess('')
    try {
      const res = await axios.post(`/suppliers/${supplierId}/pay-credit`,
        { amount: parseFloat(payCreditAmount), note: payCreditNote || null },
        { headers }
      )
      setPayCreditSuccess(res.data.message)
      setPayCreditAmount(''); setPayCreditNote('')
      setData(d => d ? { ...d, total_credit: res.data.total_credit } : d)
      onUpdate({ ...data, total_credit: res.data.total_credit })
    } catch (e) {
      const err = e as AxiosError<{ detail?: string }>
      setPayCreditError(err.response?.data?.detail || 'Ошибка')
    }
    setPayingCredit(false)
  }

  // ─── Создание возврата поставщику ─────────────────────────────────────────
  const handleCreateReturn = async () => {
    if (!retProductId || !retPrice || !data) return
    setRetLoading(true); setRetError(''); setRetSuccess('')
    try {
      const res = await axios.post('/supplier-returns', {
        supplier_id: supplierId,
        product_id: retProductId,
        quantity: retQty,
        purchase_price: parseFloat(retPrice),
        reason: retReason || null,
      }, { headers })

      setRetSuccess(res.data.message)
      // Обновляем локальный стейт
      setData(d => d ? {
        ...d,
        total_debt:   res.data.new_total_debt,
        total_credit: res.data.new_total_credit,
        products: d.products.map(p =>
          p.id === retProductId
            ? { ...p, current_stock: res.data.new_stock }
            : p
        ),
      } : d)
      onUpdate({ ...data, total_debt: res.data.new_total_debt, total_credit: res.data.new_total_credit })

      // Обновляем список возвратов
      const returnsRes = await axios.get(`/supplier-returns/supplier/${supplierId}`, { headers })
      setSupplierReturns(returnsRes.data)

      setTimeout(() => {
        setShowReturnForm(false)
        setRetProductId(null)
        setRetQty(1)
        setRetPrice('')
        setRetReason('')
        setRetSuccess('')
      }, 2000)
    } catch (e) {
      const err = e as AxiosError<{ detail?: string }>
      setRetError(err.response?.data?.detail || 'Ошибка при возврате')
    }
    setRetLoading(false)
  }

  const openMap = () => {
    if (data?.lat && data?.lng)
      window.open(`https://yandex.ru/maps/?ll=${data.lng},${data.lat}&z=16&pt=${data.lng},${data.lat},pm2rdm`, '_blank')
  }

  // ── Выбор товара в форме возврата ─────────────────────────────────────────
  const selectedRetProduct = data?.products.find(p => p.id === retProductId) ?? null
  const retAmount = selectedRetProduct && retQty > 0 && parseFloat(retPrice) > 0
    ? retQty * parseFloat(retPrice)
    : 0
  const currentDebt = data?.total_debt ?? 0
  const previewDebtReduced = Math.min(retAmount, currentDebt)
  const previewCreditAdded = Math.max(0, retAmount - currentDebt)

  // ─── Стили ───────────────────────────────────────────────────────────────
  const bg     = isDark ? '#1a1a1a' : '#f0f2f5'
  const card   = isDark ? '#2a2a2a' : '#ffffff'
  const text   = isDark ? '#fff'    : '#1a1a1a'
  const muted  = isDark ? '#888'    : '#999'
  const border = isDark ? '#444'    : '#e8eaed'
  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    background: isDark ? '#333' : '#f8f9fa',
    border: `1px solid ${border}`, borderRadius: 12,
    padding: '10px 14px', fontSize: 16, color: text, outline: 'none',
  }
  const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU')

  return (
    <>
      {showMapPicker && data && (
        <LocationPickerModal
          initialLat={data.lat} initialLng={data.lng} isDark={isDark}
          onClose={() => setShowMapPicker(false)}
          onConfirm={async (newLat, newLng) => { setShowMapPicker(false); await saveLocation(newLat, newLng) }}
        />
      )}

      {lightbox && data?.photo_url && (
        <div onClick={() => setLightbox(false)} style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.93)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img src={data.photo_url} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 16, objectFit: 'contain' }} />
          <button onClick={() => setLightbox(false)} style={{
            position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)',
            border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 20, color: '#fff', cursor: 'pointer',
          }}>×</button>
        </div>
      )}

      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ width: '100%', background: bg, borderRadius: '24px 24px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: isDark ? '#555' : '#ddd' }} />
          </div>

          {loading || !data ? (
            <div style={{ textAlign: 'center', padding: 48, color: muted }}>Загрузка...</div>
          ) : (
            <>
              {/* ── Шапка карточки ── */}
              <div style={{ padding: '4px 20px 12px', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  {/* Фото */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 16, overflow: 'hidden',
                      background: isDark ? '#333' : '#e8eaed',
                      border: `2px solid ${data.photo_url ? '#1a6b3c' : border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                    }}>
                      {uploadingPhoto ? <span>⏳</span>
                        : data.photo_url
                          ? <img src={data.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => setLightbox(true)} />
                          : <span onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>🏪</span>
                      }
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} style={{
                      position: 'absolute', bottom: -2, right: -2, width: 22, height: 22,
                      background: '#1a6b3c', border: `2px solid ${bg}`, borderRadius: '50%',
                      color: '#fff', fontSize: 11, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>📷</button>
                    {data.photo_url && (
                      <button onClick={handleDeletePhoto} style={{
                        position: 'absolute', top: -4, right: -4, width: 18, height: 18,
                        background: '#ff3b30', border: 'none', borderRadius: '50%',
                        color: '#fff', fontSize: 11, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                      }}>×</button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 19, fontWeight: 800, color: text }}>{data.name}</div>
                    <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{data.phone || 'Без телефона'}</div>
                    {/* Бейджи долга/кредита */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {data.total_debt > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#ff3b3015', color: '#ff3b30', border: '1px solid #ff3b3030' }}>
                          🔴 Долг: {fmt(data.total_debt)} сум
                        </span>
                      )}
                      {data.total_credit > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#34c75915', color: '#34c759', border: '1px solid #34c75930' }}>
                          💚 Кредит: {fmt(data.total_credit)} сум
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: muted, cursor: 'pointer' }}>×</button>
                </div>

                {/* Статистика */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {[
                    { label: 'Товаров',   value: data.products_count,  color: '#2481cc' },
                    { label: 'Приёмок',   value: data.total_receipts,  color: '#1a6b3c' },
                    { label: 'Возвратов', value: supplierReturns.length || '—', color: '#e08030' },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: isDark ? '#333' : '#f8f9fa', borderRadius: 12, padding: '8px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: muted }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Табы */}
                <div style={{ display: 'flex', gap: 3, background: isDark ? '#333' : '#f0f2f5', borderRadius: 10, padding: 3, marginTop: 12 }}>
                  {([
                    ['info',     '📋 Инфо'],
                    ['products', '📦'],
                    ['receipts', '📥'],
                    ['debt',     '💳 Долг'],
                    ['returns',  '↩️ Возврат'],
                  ] as const).map(([t, label]) => (
                    <button key={t} onClick={() => setTab(t)} style={{
                      flex: 1, border: 'none', borderRadius: 8, padding: '7px 2px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: tab === t ? card : 'transparent',
                      color: tab === t
                        ? (t === 'debt' && data.total_debt > 0 ? '#ff3b30'
                          : t === 'returns' && supplierReturns.length > 0 ? '#e08030'
                          : text)
                        : muted,
                      boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                    }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* ── Контент таба ── */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 32px' }}>

                {/* ── ТАБ: Инфо ── */}
                {tab === 'info' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {!editing ? (
                      <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Данные</div>
                          <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', fontSize: 13, color: '#2481cc', cursor: 'pointer', fontWeight: 600 }}>Редактировать</button>
                        </div>
                        {[['Название', data.name], ['Телефон', data.phone || '—'], ['Адрес', data.address || '—'], ['Заметки', data.notes || '—']].map(([label, value]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: `1px solid ${border}` }}>
                            <span style={{ fontSize: 13, color: muted }}>{label}</span>
                            <span style={{ fontSize: 13, color: text, fontWeight: 600, maxWidth: '60%', textAlign: 'right' }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Редактирование</div>
                        <input style={inputStyle} placeholder="Название *" value={editName} onChange={e => setEditName(e.target.value)} />
                        <input style={inputStyle} placeholder="Телефон" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                        <input style={inputStyle} placeholder="Адрес" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
                        <textarea style={{ ...inputStyle, height: 72, resize: 'none' }} placeholder="Заметки" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setEditing(false)} style={{ flex: 1, background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 12, padding: 12, color: muted, fontWeight: 600, cursor: 'pointer' }}>Отмена</button>
                          <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: '#2481cc', border: 'none', borderRadius: 12, padding: 12, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Сохранение...' : '✅ Сохранить'}</button>
                        </div>
                      </div>
                    )}

                    {/* Локация */}
                    <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>📍 Локация</div>
                      {data.lat && data.lng && locMode === 'idle' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 12, color: muted }}>{data.lat.toFixed(5)}, {data.lng.toFixed(5)}</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={openMap} style={{ flex: 2, background: '#2481cc15', border: `1px solid #2481cc40`, borderRadius: 12, padding: '9px 0', color: '#2481cc', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🗺 Открыть на карте</button>
                            <button onClick={() => { setLocMode('menu'); setLocError('') }} style={{ flex: 1, background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 12, padding: '9px 0', color: muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>✏️</button>
                            <button onClick={handleDeleteLocation} style={{ flex: 1, background: '#ff3b3010', border: `1px solid #ff3b3030`, borderRadius: 12, padding: '9px 0', color: '#ff3b30', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🗑</button>
                          </div>
                        </div>
                      )}
                      {!data.lat && locMode === 'idle' && (
                        <button onClick={() => { setLocMode('menu'); setLocError('') }} style={{ width: '100%', background: '#34c75915', border: `1px solid #34c75940`, borderRadius: 12, padding: '11px 0', color: '#34c759', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>📍 Добавить локацию</button>
                      )}
                      {locMode === 'menu' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button onClick={() => { setLocMode('idle'); setShowMapPicker(true) }} style={{ width: '100%', background: 'linear-gradient(135deg, #2481cc, #1a6b3c)', border: 'none', borderRadius: 12, padding: '13px 0', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>🗺 Выбрать на карте</button>
                          <button onClick={handleGPS} disabled={locating} style={{ width: '100%', background: '#2481cc15', border: `1px solid #2481cc30`, borderRadius: 12, padding: '11px 0', color: '#2481cc', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{locating ? '⏳ Определяем...' : '📡 Моё текущее местоположение'}</button>
                          <button onClick={() => { setLocMode('search'); setLocError('') }} style={{ width: '100%', background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 12, padding: '11px 0', color: muted, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>🔍 Поиск по адресу</button>
                          <button onClick={() => { setLocMode('manual'); setLocError(''); setManualLat(data.lat ? String(data.lat) : ''); setManualLng(data.lng ? String(data.lng) : '') }} style={{ width: '100%', background: 'none', border: `1px solid ${border}`, borderRadius: 12, padding: '11px 0', color: muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>✍️ Ввести координаты вручную</button>
                          <button onClick={() => { setLocMode('idle'); setLocError('') }} style={{ background: 'none', border: 'none', padding: '6px 0', color: muted, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
                          {locError && <div style={{ fontSize: 12, color: '#ff3b30' }}>{locError}</div>}
                        </div>
                      )}
                      {locMode === 'search' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input style={{ ...inputStyle, flex: 1 }} placeholder="Ташкент, ул. Навои 12..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddressSearch()} />
                            <button onClick={handleAddressSearch} disabled={searching} style={{ background: '#2481cc', border: 'none', borderRadius: 12, padding: '10px 14px', color: '#fff', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>{searching ? '⏳' : '🔍'}</button>
                          </div>
                          {searchResults.map((r, i) => (
                            <button key={i} onClick={() => saveLocation(parseFloat(r.lat), parseFloat(r.lon))} style={{ width: '100%', background: isDark ? '#333' : '#f8f9fa', border: `1px solid ${border}`, borderRadius: 12, padding: '10px 12px', textAlign: 'left', cursor: 'pointer', fontSize: 13, color: text, lineHeight: 1.4 }}>📍 {r.display_name}</button>
                          ))}
                          {locError && <div style={{ fontSize: 12, color: '#ff3b30' }}>{locError}</div>}
                          <button onClick={() => { setLocMode('menu'); setSearchResults([]); setLocError('') }} style={{ background: 'none', border: 'none', padding: '6px 0', color: muted, fontSize: 13, cursor: 'pointer' }}>← Назад</button>
                        </div>
                      )}
                      {locMode === 'manual' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 12, color: muted }}>Скопируйте из Google/Яндекс.Карт: правый клик → «Что здесь?»</div>
                          <input style={inputStyle} placeholder="Широта, напр: 41.29950" value={manualLat} onChange={e => setManualLat(e.target.value)} inputMode="decimal" />
                          <input style={inputStyle} placeholder="Долгота, напр: 69.24007" value={manualLng} onChange={e => setManualLng(e.target.value)} inputMode="decimal" />
                          {locError && <div style={{ fontSize: 12, color: '#ff3b30' }}>{locError}</div>}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => { setLocMode('menu'); setLocError('') }} style={{ flex: 1, background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 12, padding: 12, color: muted, fontWeight: 600, cursor: 'pointer' }}>← Назад</button>
                            <button onClick={handleManualSave} style={{ flex: 2, background: '#2481cc', border: 'none', borderRadius: 12, padding: 12, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>✅ Сохранить</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Удаление */}
                    <div style={{ background: '#ff3b3010', border: '1px solid #ff3b3030', borderRadius: 16, padding: '14px 16px' }}>
                      <div style={{ fontSize: 13, color: muted, marginBottom: 10 }}>Удаление возможно только если у поставщика нет товаров</div>
                      {deleteError && <div style={{ color: '#ff3b30', fontSize: 13, marginBottom: 8 }}>{deleteError}</div>}
                      <button onClick={handleDelete} disabled={deleting} style={{ width: '100%', background: '#ff3b30', border: 'none', borderRadius: 12, padding: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                        {deleting ? 'Удаление...' : '🗑 Удалить поставщика'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── ТАБ: Товары ── */}
                {tab === 'products' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.products.length === 0
                      ? <div style={{ textAlign: 'center', padding: 32, color: muted }}>Товаров нет</div>
                      : data.products.map(p => (
                        <div key={p.id} style={{ background: card, borderRadius: 14, padding: '12px 14px', border: `1px solid ${border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: p.current_stock <= 5 ? '#ff3b30' : muted, fontWeight: 600 }}>{unitDisplay(p.unit, p.unit_value, p.current_stock)}</div>
                          </div>
                          <div style={{ fontSize: 12, color: muted }}>SKU: {p.sku} · Закупка: {fmt(p.purchase_price)} · Продажа: {fmt(p.selling_price)}</div>
                        </div>
                      ))}
                  </div>
                )}

                {/* ── ТАБ: Приёмки ── */}
                {tab === 'receipts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.recent_receipts.length === 0
                      ? <div style={{ textAlign: 'center', padding: 32, color: muted }}>Приёмок нет</div>
                      : data.recent_receipts.map(r => (
                        <div key={r.id} style={{ background: card, borderRadius: 14, padding: '12px 14px', border: `1px solid ${border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{r.product_name}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a6b3c' }}>{fmt(r.total)} сум</div>
                          </div>
                          <div style={{ fontSize: 12, color: muted }}>
                            {unitDisplay(r.unit, r.unit_value, r.quantity)} × {fmt(r.purchase_price)} сум · {r.created_at ? new Date(r.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                          {r.debt > 0 && (
                            <div style={{ marginTop: 6, fontSize: 12, color: '#ff3b30', fontWeight: 600 }}>
                              ⚠️ Долг: {fmt(r.debt)} сум · Оплачено: {fmt(r.paid_amount)}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {/* ── ТАБ: Долг ── */}
                {tab === 'debt' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Наш долг поставщику */}
                    <div style={{
                      background: data.total_debt > 0 ? '#ff3b3015' : '#34c75915',
                      border: `1px solid ${data.total_debt > 0 ? '#ff3b3040' : '#34c75940'}`,
                      borderRadius: 14, padding: '14px 16px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>Наш долг поставщику</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: data.total_debt > 0 ? '#ff3b30' : '#34c759' }}>
                        {fmt(data.total_debt)} сум
                      </div>
                      <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
                        {data.total_debt > 0 ? 'Нужно оплатить' : '✅ Долгов нет'}
                      </div>
                    </div>

                    {/* Форма оплаты долга */}
                    {data.total_debt > 0 && (
                      <div style={{ background: card, borderRadius: 14, padding: '14px 16px', border: `1px solid ${border}` }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 12 }}>💳 Оплатить долг поставщику</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <input style={inputStyle} type="number" placeholder={`Макс: ${fmt(data.total_debt)} сум`} value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                          <input style={inputStyle} type="text" placeholder="Заметка (необязательно)" value={payNote} onChange={e => setPayNote(e.target.value)} />
                          {payError && <div style={{ fontSize: 12, color: '#ff3b30' }}>{payError}</div>}
                          {paySuccess && <div style={{ fontSize: 12, color: '#34c759', fontWeight: 600 }}>{paySuccess}</div>}
                          <button disabled={paying || !payAmount} onClick={handlePayDebt}
                            style={{ background: paying ? '#555' : 'linear-gradient(135deg, #1a6b3c, #2d9c5c)', border: 'none', borderRadius: 12, padding: 13, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                            {paying ? 'Оплата...' : '✅ Оплатить'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Кредит: поставщик должен нам */}
                    {data.total_credit > 0 && (
                      <div style={{ background: '#34c75915', border: '1.5px solid #34c75940', borderRadius: 14, padding: '14px 16px' }}>
                        <div style={{ textAlign: 'center', marginBottom: 14 }}>
                          <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>💚 Поставщик должен вам</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#34c759' }}>
                            {fmt(data.total_credit)} сум
                          </div>
                          <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
                            Возникло из-за возврата товара сверх долга
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <input style={inputStyle} type="number" placeholder={`Получить (макс: ${fmt(data.total_credit)} сум)`} value={payCreditAmount} onChange={e => setPayCreditAmount(e.target.value)} />
                          <input style={inputStyle} type="text" placeholder="Заметка (необязательно)" value={payCreditNote} onChange={e => setPayCreditNote(e.target.value)} />
                          {payCreditError && <div style={{ fontSize: 12, color: '#ff3b30' }}>{payCreditError}</div>}
                          {payCreditSuccess && <div style={{ fontSize: 12, color: '#34c759', fontWeight: 600 }}>{payCreditSuccess}</div>}
                          <button disabled={payingCredit || !payCreditAmount} onClick={handleReceiveCredit}
                            style={{ background: payingCredit ? '#555' : 'linear-gradient(135deg, #1a6b3c, #2d9c5c)', border: 'none', borderRadius: 12, padding: 13, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                            {payingCredit ? 'Обработка...' : '💚 Получить от поставщика'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* История платежей */}
                    {data.debt_payments?.length > 0 && (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: muted, marginTop: 4 }}>История оплат</div>
                        {data.debt_payments.map(p => (
                          <div key={p.id} style={{ background: card, borderRadius: 12, padding: '10px 14px', border: `1px solid ${border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: p.note?.includes('💚') ? '#34c759' : '#2481cc' }}>
                                  {p.note?.includes('💚') ? '💚' : '💳'} {fmt(p.amount)} сум
                                </div>
                                <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                                  {p.user_name} · {p.created_at ? new Date(p.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                                </div>
                                {p.note && <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{p.note}</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* ── ТАБ: Возвраты поставщику ── */}
                {tab === 'returns' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Кнопка создания возврата */}
                    {!showReturnForm ? (
                      <button onClick={() => setShowReturnForm(true)} style={{
                        width: '100%', background: 'linear-gradient(135deg, #e08030, #c06020)',
                        border: 'none', borderRadius: 14, padding: 14, color: '#fff',
                        fontSize: 15, fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(224,128,48,0.35)',
                      }}>
                        ↩️ Вернуть товар поставщику
                      </button>
                    ) : (
                      /* ── Форма возврата ── */
                      <div style={{ background: card, borderRadius: 16, padding: '16px', border: `1.5px solid #e0803040` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: text }}>↩️ Возврат поставщику</div>
                          <button onClick={() => { setShowReturnForm(false); setRetError(''); setRetSuccess('') }}
                            style={{ background: 'none', border: 'none', fontSize: 20, color: muted, cursor: 'pointer' }}>×</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Выбор товара */}
                          <div>
                            <div style={{ fontSize: 12, color: muted, fontWeight: 600, marginBottom: 6 }}>Товар *</div>
                            <select
                              style={{ ...inputStyle, appearance: 'none' as const }}
                              value={retProductId ?? ''}
                              onChange={e => {
                                const id = parseInt(e.target.value)
                                setRetProductId(id || null)
                                const prod = data.products.find(p => p.id === id)
                                if (prod) { setRetPrice(String(prod.purchase_price)); setRetQty(1) }
                              }}
                            >
                              <option value="">— Выберите товар —</option>
                              {data.products.map(p => (
                                <option key={p.id} value={p.id} disabled={p.current_stock === 0}>
                                  {p.name} (на складе: {p.current_stock} шт)
                                </option>
                              ))}
                            </select>
                          </div>

                          {selectedRetProduct && (
                            <>
                              {/* Количество */}
                              <div>
                                <div style={{ fontSize: 12, color: muted, fontWeight: 600, marginBottom: 6 }}>
                                  Количество * (макс: {selectedRetProduct.current_stock} шт)
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <button onClick={() => setRetQty(q => Math.max(1, q - 1))}
                                    style={{ width: 36, height: 36, borderRadius: '50%', background: isDark ? '#333' : '#f0f2f5', border: 'none', fontSize: 20, color: text, cursor: 'pointer' }}>−</button>
                                  <span style={{ fontSize: 20, fontWeight: 700, minWidth: 32, textAlign: 'center', color: text }}>{retQty}</span>
                                  <button onClick={() => setRetQty(q => Math.min(selectedRetProduct.current_stock, q + 1))}
                                    style={{ width: 36, height: 36, borderRadius: '50%', background: isDark ? '#333' : '#f0f2f5', border: 'none', fontSize: 20, color: text, cursor: 'pointer' }}>+</button>
                                </div>
                              </div>

                              {/* Цена за единицу */}
                              <div>
                                <div style={{ fontSize: 12, color: muted, fontWeight: 600, marginBottom: 6 }}>Цена закупки за шт (сум) *</div>
                                <input style={inputStyle} type="number" value={retPrice} onChange={e => setRetPrice(e.target.value)} inputMode="decimal" />
                              </div>

                              {/* Предварительный расчёт */}
                              {retAmount > 0 && (
                                <div style={{
                                  background: isDark ? '#1a1a1a' : '#f8f9fa',
                                  borderRadius: 12, padding: '12px 14px',
                                  border: `1px solid ${border}`,
                                  display: 'flex', flexDirection: 'column', gap: 6,
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                    <span style={{ color: muted }}>Сумма возврата</span>
                                    <span style={{ fontWeight: 700, color: text }}>{fmt(retAmount)} сум</span>
                                  </div>
                                  {previewDebtReduced > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                      <span style={{ color: muted }}>Наш долг уменьшится на</span>
                                      <span style={{ fontWeight: 700, color: '#2481cc' }}>−{fmt(previewDebtReduced)} сум</span>
                                    </div>
                                  )}
                                  {previewCreditAdded > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                      <span style={{ color: muted }}>Поставщик будет должен</span>
                                      <span style={{ fontWeight: 700, color: '#34c759' }}>+{fmt(previewCreditAdded)} сум</span>
                                    </div>
                                  )}
                                  <div style={{ paddingTop: 6, borderTop: `1px solid ${border}`, fontSize: 12, color: muted }}>
                                    Остаток на складе: {selectedRetProduct.current_stock} → {selectedRetProduct.current_stock - retQty} шт
                                  </div>
                                </div>
                              )}

                              {/* Причина */}
                              <div>
                                <div style={{ fontSize: 12, color: muted, fontWeight: 600, marginBottom: 6 }}>Причина (необязательно)</div>
                                <input style={inputStyle} placeholder="Брак, пересорт, излишек..." value={retReason} onChange={e => setRetReason(e.target.value)} />
                              </div>
                            </>
                          )}

                          {retError && (
                            <div style={{ background: '#ff3b3015', border: '1px solid #ff3b3030', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ff3b30' }}>
                              {retError}
                            </div>
                          )}
                          {retSuccess && (
                            <div style={{ background: '#34c75915', border: '1px solid #34c75930', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#34c759', fontWeight: 600 }}>
                              {retSuccess}
                            </div>
                          )}

                          <button
                            onClick={handleCreateReturn}
                            disabled={retLoading || !retProductId || !retPrice || retQty <= 0 || !!retSuccess}
                            style={{
                              background: retLoading || !retProductId || !retPrice ? '#555' : 'linear-gradient(135deg, #e08030, #c06020)',
                              border: 'none', borderRadius: 14, padding: 14, color: '#fff',
                              fontSize: 15, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            {retLoading ? '⏳ Обработка...' : `↩️ Вернуть ${retQty} шт · ${fmt(retAmount)} сум`}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Разделитель */}
                    {supplierReturns.length > 0 && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, paddingLeft: 2 }}>
                        История возвратов
                      </div>
                    )}

                    {/* Список возвратов */}
                    {returnsLoading ? (
                      <div style={{ textAlign: 'center', padding: 32, color: muted }}>Загрузка...</div>
                    ) : supplierReturns.length === 0 && !showReturnForm ? (
                      <div style={{ textAlign: 'center', padding: 32 }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>↩️</div>
                        <div style={{ color: muted }}>Возвратов ещё не было</div>
                      </div>
                    ) : supplierReturns.map(r => (
                      <div key={r.id} style={{
                        background: card, borderRadius: 14, padding: '12px 14px',
                        border: `1px solid ${border}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{r.product_name}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#e08030' }}>
                            {fmt(r.return_amount)} сум
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>
                          {unitDisplay(r.unit, r.unit_value, r.quantity)} · {fmt(r.purchase_price)} сум/шт
                        </div>
                        {/* Эффект на баланс */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                          {r.debt_reduced > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#2481cc15', color: '#2481cc' }}>
                              Долг −{fmt(r.debt_reduced)} сум
                            </span>
                          )}
                          {r.credit_added > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#34c75915', color: '#34c759' }}>
                              💚 Кредит +{fmt(r.credit_added)} сум
                            </span>
                          )}
                        </div>
                        {r.reason && <div style={{ fontSize: 11, color: muted }}>Причина: {r.reason}</div>}
                        <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                          {r.creator_name} · {new Date(r.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}