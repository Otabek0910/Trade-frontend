import { useState, useEffect, useRef } from 'react'
import axios, { AxiosError } from 'axios'
import type { Supplier } from '../SuppliersPage'
import LocationPickerModal from './LocationPickerModal'
import { unitDisplay } from '../sales/unitHelpers'

interface Product { id: number; name: string; sku: string; current_stock: number; purchase_price: number; selling_price: number; unit: string; unit_value: number | null }
interface Receipt { id: number; product_name: string; quantity: number; purchase_price: number; total: number; paid_amount: number; debt: number; created_at: string; unit: string; unit_value: number | null }
interface DebtPayment { id: number; amount: number; note: string | null; user_name: string; created_at: string }
interface NominatimResult { display_name: string; lat: string; lon: string }

interface DetailData extends Supplier {
  products: Product[]
  recent_receipts: Receipt[]
  debt_payments: DebtPayment[]
  total_debt: number
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
  const [tab, setTab] = useState<'info' | 'products' | 'receipts' | 'debt'>('info')
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

  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [locMode, setLocMode] = useState<'idle' | 'menu' | 'search' | 'manual'>('idle')
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')

  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    axios.get(`/suppliers/${supplierId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        setData(r.data); setEditName(r.data.name); setEditPhone(r.data.phone || '')
        setEditAddress(r.data.address || ''); setEditNotes(r.data.notes || '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [supplierId, token])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await axios.patch(`/suppliers/${supplierId}`,
        { name: editName, phone: editPhone || null, address: editAddress || null, notes: editNotes || null }, { headers })
      setData(prev => prev ? { ...prev, ...res.data } : prev)
      onUpdate(res.data); setEditing(false)
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

  const openMap = () => {
    if (data?.lat && data?.lng)
      window.open(`https://yandex.ru/maps/?ll=${data.lng},${data.lat}&z=16&pt=${data.lng},${data.lat},pm2rdm`, '_blank')
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
              <div style={{ padding: '4px 20px 12px', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
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
                  </div>
                  <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: muted, cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {[
                    { label: 'Товаров', value: data.products_count, color: '#2481cc' },
                    { label: 'Приёмок', value: data.total_receipts, color: '#1a6b3c' },
                    { label: 'Долг', value: data.total_debt > 0 ? `${(data.total_debt / 1000).toFixed(0)}К` : '—', color: data.total_debt > 0 ? '#ff3b30' : muted },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: isDark ? '#333' : '#f8f9fa', borderRadius: 12, padding: '8px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: muted }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 4, background: isDark ? '#333' : '#f0f2f5', borderRadius: 10, padding: 3, marginTop: 12 }}>
                  {([['info', '📋 Инфо'], ['products', '📦 Товары'], ['receipts', '📥 Приёмки'], ['debt', '💳 Долг']] as const).map(([t, label]) => (
                    <button key={t} onClick={() => setTab(t)} style={{
                      flex: 1, border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: tab === t ? card : 'transparent', color: tab === t ? (t === 'debt' && data.total_debt > 0 ? '#ff3b30' : text) : muted,
                      boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                    }}>{label}{t === 'debt' && data.total_debt > 0 ? ' 🔴' : ''}</button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 32px' }}>
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

                    {/* ── Локация ── */}
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

                    <div style={{ background: '#ff3b3010', border: '1px solid #ff3b3030', borderRadius: 16, padding: '14px 16px' }}>
                      <div style={{ fontSize: 13, color: muted, marginBottom: 10 }}>Удаление возможно только если у поставщика нет товаров</div>
                      {deleteError && <div style={{ color: '#ff3b30', fontSize: 13, marginBottom: 8 }}>{deleteError}</div>}
                      <button onClick={handleDelete} disabled={deleting} style={{ width: '100%', background: '#ff3b30', border: 'none', borderRadius: 12, padding: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                        {deleting ? 'Удаление...' : '🗑 Удалить поставщика'}
                      </button>
                    </div>
                  </div>
                )}

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

                {tab === 'debt' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Текущий долг */}
                    <div style={{ background: data.total_debt > 0 ? '#ff3b3015' : '#34c75915', border: `1px solid ${data.total_debt > 0 ? '#ff3b3040' : '#34c75940'}`, borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: data.total_debt > 0 ? '#ff3b30' : '#34c759' }}>
                        {fmt(data.total_debt)} сум
                      </div>
                      <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
                        {data.total_debt > 0 ? 'Текущий долг поставщику' : '✅ Долгов нет'}
                      </div>
                    </div>

                    {/* Форма оплаты */}
                    {data.total_debt > 0 && (
                      <div style={{ background: card, borderRadius: 14, padding: '14px 16px', border: `1px solid ${border}` }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 12 }}>💳 Оплатить долг</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <input
                            style={{ width: '100%', boxSizing: 'border-box' as const, background: isDark ? '#333' : '#f8f9fa', border: `1px solid ${border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: text, outline: 'none' }}
                            type="number" placeholder={`Макс: ${fmt(data.total_debt)} сум`}
                            value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                          <input
                            style={{ width: '100%', boxSizing: 'border-box' as const, background: isDark ? '#333' : '#f8f9fa', border: `1px solid ${border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: text, outline: 'none' }}
                            type="text" placeholder="Заметка (необязательно)"
                            value={payNote} onChange={e => setPayNote(e.target.value)} />
                          {payError && <div style={{ fontSize: 12, color: '#ff3b30' }}>{payError}</div>}
                          {paySuccess && <div style={{ fontSize: 12, color: '#34c759', fontWeight: 600 }}>{paySuccess}</div>}
                          <button
                            disabled={paying || !payAmount}
                            onClick={async () => {
                              if (!payAmount) return
                              setPaying(true); setPayError(''); setPaySuccess('')
                              try {
                                const res = await axios.post(`/suppliers/${supplierId}/pay-debt`,
                                  { amount: parseFloat(payAmount), note: payNote || null },
                                  { headers }
                                )
                                setPaySuccess(res.data.message)
                                setPayAmount(''); setPayNote('')
                                setData(d => d ? { ...d, total_debt: res.data.total_debt } : d)
                              } catch (e) {
                                const err = e as AxiosError<{ detail?: string }>
                                setPayError(err.response?.data?.detail || 'Ошибка')
                              }
                              setPaying(false)
                            }}
                            style={{ background: paying ? '#555' : 'linear-gradient(135deg, #1a6b3c, #2d9c5c)', border: 'none', borderRadius: 12, padding: 13, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                            {paying ? 'Оплата...' : '✅ Оплатить'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* История платежей */}
                    {data.debt_payments?.length > 0 && (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: muted, marginTop: 4 }}>История оплат</div>
                        {data.debt_payments.map(p => (
                          <div key={p.id} style={{ background: card, borderRadius: 12, padding: '10px 14px', border: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#34c759' }}>+ {fmt(p.amount)} сум</div>
                              <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                                {p.user_name} · {p.created_at ? new Date(p.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                              </div>
                              {p.note && <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{p.note}</div>}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
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