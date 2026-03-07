import { useState, useEffect, useRef } from 'react'
import axios, { AxiosError } from 'axios'
import type { Customer } from '../CustomersPage'
import LocationPickerModal from './LocationPickerModal'

interface SaleItem { product_name: string; quantity: number; selling_price: number; total: number; brand?: string | null; unit?: string | null; unit_value?: number | null }
interface Sale {
  id: number; total_amount: number; paid_amount: number; debt: number
  payment_type: string; discount_percent: number; status: string; items: SaleItem[]; created_at: string
}
interface ReturnItem {
  id: number; sale_id: number; product_name: string
  quantity: number; return_amount: number; reason: string | null; created_at: string
}
interface NominatimResult { display_name: string; lat: string; lon: string }
interface DebtPayment { id: number; amount: number; note: string | null; paid_by: string; created_at: string }

interface Props {
  customer: Customer
  token: string
  isDark: boolean
  onClose: () => void
  onUpdate: (c: Customer) => void
  onDelete: (id: number) => void
}

const PAYMENT_ICONS: Record<string, string> = { cash: '💵', card: '💳', transfer: '📲' }

export default function CustomerDetailModal({ customer, token, isDark, onClose, onUpdate, onDelete }: Props) {
  const [sales, setSales] = useState<Sale[]>([])
  const [returns, setReturns] = useState<ReturnItem[]>([])
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [tab, setTab] = useState<'info' | 'history'>('info')

  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [paySuccess, setPaySuccess] = useState('')

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(customer.name)
  const [editPhone, setEditPhone] = useState(customer.phone)
  const [editAddress, setEditAddress] = useState(customer.address || '')
  const [saving, setSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Photo
  const [photoUrl, setPhotoUrl] = useState<string | null>(customer.photo_url || null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Location
  const [lat, setLat] = useState<number | null>(customer.lat || null)
  const [lng, setLng] = useState<number | null>(customer.lng || null)
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
    axios.get(`/customers/${customer.id}/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { setSales(r.data.sales); setReturns(r.data.returns || []); setDebtPayments(r.data.debt_payments || []); setLoadingHistory(false) })
      .catch(() => setLoadingHistory(false))
  }, [customer.id, token])

  const handlePayDebt = async () => {
    if (!payAmount) { setPayError('Введите сумму'); return }
    setPaying(true); setPayError(''); setPaySuccess('')
    try {
      const res = await axios.post(`/customers/${customer.id}/pay-debt`,
        { amount: parseFloat(payAmount) }, { headers })
      setPaySuccess(res.data.message)
      setPayAmount('')
      onUpdate({ ...customer, total_debt: res.data.remaining_debt, photo_url: photoUrl, lat, lng })
      setTimeout(() => setPaySuccess(''), 3000)
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setPayError(e.response?.data?.detail || 'Ошибка')
    }
    setPaying(false)
  }

  const handleDelete = async () => {
    setDeleting(true); setDeleteError('')
    try {
      const res = await axios.delete(`/customers/${customer.id}`, { headers })
      if (res.data.deactivated) {
        // Мягкое удаление — обновляем в списке
        onUpdate({ ...customer, is_active: false })
      }
      onDelete(customer.id)
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setDeleteError(e.response?.data?.detail || 'Ошибка удаления')
      setConfirmDelete(false)
    }
    setDeleting(false)
  }

  const handleRestore = async () => {
    try {
      const res = await axios.post(`/customers/${customer.id}/restore`, {}, { headers })
      onUpdate(res.data)
    } catch { /* silent */ }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await axios.patch(`/customers/${customer.id}`,
        { name: editName, phone: editPhone, address: editAddress || null }, { headers })
      onUpdate({ ...res.data, photo_url: photoUrl, lat, lng })
      setEditing(false)
    } catch { /* silent */ }
    setSaving(false)
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await axios.post(`/customers/${customer.id}/photo`, form, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      })
      setPhotoUrl(res.data.photo_url)
      onUpdate({ ...customer, photo_url: res.data.photo_url, lat, lng })
    } catch { /* silent */ }
    setUploadingPhoto(false)
    e.target.value = ''
  }

  const handleDeletePhoto = async () => {
    try {
      await axios.delete(`/customers/${customer.id}/photo`, { headers })
      setPhotoUrl(null)
      onUpdate({ ...customer, photo_url: null, lat, lng })
    } catch { /* silent */ }
  }

  const saveLocation = async (newLat: number, newLng: number) => {
    try {
      await axios.post(`/customers/${customer.id}/location`, { lat: newLat, lng: newLng }, { headers })
      setLat(newLat); setLng(newLng)
      onUpdate({ ...customer, photo_url: photoUrl, lat: newLat, lng: newLng })
      setLocMode('idle'); setLocError(''); setSearchQuery(''); setSearchResults([])
    } catch { setLocError('Не удалось сохранить') }
  }

  const handleDeleteLocation = async () => {
    try {
      await axios.delete(`/customers/${customer.id}/location`, { headers })
      setLat(null); setLng(null)
      onUpdate({ ...customer, photo_url: photoUrl, lat: null, lng: null })
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
      const data: NominatimResult[] = await res.json()
      setSearchResults(data)
      if (data.length === 0) setLocError('Ничего не найдено')
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
    if (lat && lng) window.open(`https://yandex.ru/maps/?ll=${lng},${lat}&z=16&pt=${lng},${lat},pm2rdm`, '_blank')
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
      {/* Карта-пикер */}
      {showMapPicker && (
        <LocationPickerModal
          initialLat={lat}
          initialLng={lng}
          isDark={isDark}
          onClose={() => setShowMapPicker(false)}
          onConfirm={async (newLat, newLng) => {
            setShowMapPicker(false)
            setLocMode('idle')
            await saveLocation(newLat, newLng)
          }}
        />
      )}

      {/* Lightbox */}
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
        <div style={{ width: '100%', background: bg, borderRadius: '24px 24px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: isDark ? '#555' : '#ddd' }} />
          </div>

          <div style={{ padding: '4px 20px 12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', overflow: 'hidden',
                  background: isDark ? '#333' : '#e8eaed',
                  border: `2px solid ${photoUrl ? '#2481cc' : border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>
                  {uploadingPhoto ? <span>⏳</span>
                    : photoUrl
                      ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => setLightbox(true)} />
                      : <span onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>👤</span>
                  }
                </div>
                <button onClick={() => fileInputRef.current?.click()} style={{
                  position: 'absolute', bottom: -2, right: -2, width: 22, height: 22,
                  background: '#2481cc', border: `2px solid ${bg}`, borderRadius: '50%',
                  color: '#fff', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>📷</button>
                {photoUrl && (
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
                <div style={{ fontSize: 19, fontWeight: 800, color: text }}>{customer.name}</div>
                <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{customer.phone}</div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: muted, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <div style={{ flex: 1, background: '#2481cc15', borderRadius: 12, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#2481cc' }}>{fmt(customer.total_purchases)}</div>
                <div style={{ fontSize: 10, color: muted }}>Покупок, сум</div>
              </div>
              <div style={{ flex: 1, background: customer.total_debt > 0 ? '#ff3b3015' : '#34c75915', borderRadius: 12, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: customer.total_debt > 0 ? '#ff3b30' : '#34c759' }}>{fmt(customer.total_debt)}</div>
                <div style={{ fontSize: 10, color: muted }}>Долг, сум</div>
              </div>
              <div style={{ flex: 1, background: isDark ? '#333' : '#f8f9fa', borderRadius: 12, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: text }}>{sales.length}</div>
                <div style={{ fontSize: 10, color: muted }}>Продаж</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4, background: isDark ? '#333' : '#f0f2f5', borderRadius: 10, padding: 3, marginTop: 12 }}>
              {(['info', 'history'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: tab === t ? card : 'transparent', color: tab === t ? text : muted,
                  boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                }}>
                  {t === 'info' ? '👤 Инфо' : '🧾 История'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 32px' }}>
            {tab === 'info' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {customer.total_debt > 0 && (
                  <div style={{ background: '#ff3b3015', border: '1px solid #ff3b3030', borderRadius: 16, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ff3b30', marginBottom: 10 }}>
                      ⏳ Принять оплату долга ({fmt(customer.total_debt)} сум)
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" placeholder="Сумма" value={payAmount}
                        onChange={e => setPayAmount(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={handlePayDebt} disabled={paying} style={{
                        background: '#ff3b30', border: 'none', borderRadius: 12, padding: '10px 16px',
                        color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', flexShrink: 0,
                      }}>{paying ? '...' : '✅'}</button>
                    </div>
                    {payError && <div style={{ color: '#ff3b30', fontSize: 12, marginTop: 6 }}>{payError}</div>}
                    {paySuccess && <div style={{ color: '#34c759', fontSize: 12, fontWeight: 600, marginTop: 6 }}>{paySuccess}</div>}
                  </div>
                )}

                {!editing ? (
                  <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Данные</div>
                      <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', fontSize: 13, color: '#2481cc', cursor: 'pointer', fontWeight: 600 }}>
                        Редактировать
                      </button>
                    </div>
                    {[['Имя', customer.name], ['Телефон', customer.phone], ['Адрес', customer.address || '—']].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${border}` }}>
                        <span style={{ fontSize: 13, color: muted }}>{label}</span>
                        <span style={{ fontSize: 13, color: text, fontWeight: 600 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Редактирование</div>
                    <input style={inputStyle} placeholder="Имя" value={editName} onChange={e => setEditName(e.target.value)} />
                    <input style={inputStyle} placeholder="Телефон" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                    <input style={inputStyle} placeholder="Адрес" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditing(false)} style={{ flex: 1, background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 12, padding: 12, color: muted, fontWeight: 600, cursor: 'pointer' }}>
                        Отмена
                      </button>
                      <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: '#2481cc', border: 'none', borderRadius: 12, padding: 12, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                        {saving ? 'Сохранение...' : '✅ Сохранить'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Локация ── */}
                <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                    📍 Локация
                  </div>

                  {/* Сохранённая */}
                  {lat && lng && locMode === 'idle' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12, color: muted }}>{lat.toFixed(5)}, {lng.toFixed(5)}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={openMap} style={{
                          flex: 2, background: '#2481cc15', border: `1px solid #2481cc40`,
                          borderRadius: 12, padding: '9px 0', color: '#2481cc', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        }}>🗺 Открыть на карте</button>
                        <button onClick={() => { setLocMode('menu'); setLocError('') }} style={{
                          flex: 1, background: isDark ? '#333' : '#f0f2f5', border: 'none',
                          borderRadius: 12, padding: '9px 0', color: muted, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                        }}>✏️</button>
                        <button onClick={handleDeleteLocation} style={{
                          flex: 1, background: '#ff3b3010', border: `1px solid #ff3b3030`,
                          borderRadius: 12, padding: '9px 0', color: '#ff3b30', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        }}>🗑</button>
                      </div>
                    </div>
                  )}

                  {!lat && locMode === 'idle' && (
                    <button onClick={() => { setLocMode('menu'); setLocError('') }} style={{
                      width: '100%', background: '#34c75915', border: `1px solid #34c75940`,
                      borderRadius: 12, padding: '11px 0', color: '#34c759', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}>📍 Добавить локацию</button>
                  )}

                  {/* Меню способов */}
                  {locMode === 'menu' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* ★ Главная кнопка — карта */}
                      <button onClick={() => { setLocMode('idle'); setShowMapPicker(true) }} style={{
                        width: '100%', background: 'linear-gradient(135deg, #2481cc, #1a6b3c)',
                        border: 'none', borderRadius: 12, padding: '13px 0',
                        color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                      }}>🗺 Выбрать на карте</button>

                      <button onClick={handleGPS} disabled={locating} style={{
                        width: '100%', background: '#2481cc15', border: `1px solid #2481cc30`,
                        borderRadius: 12, padding: '11px 0', color: '#2481cc', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                      }}>{locating ? '⏳ Определяем...' : '📡 Моё текущее местоположение'}</button>

                      <button onClick={() => { setLocMode('search'); setLocError('') }} style={{
                        width: '100%', background: isDark ? '#333' : '#f0f2f5', border: 'none',
                        borderRadius: 12, padding: '11px 0', color: muted, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                      }}>🔍 Поиск по адресу</button>

                      <button onClick={() => {
                        setLocMode('manual'); setLocError('')
                        setManualLat(lat ? String(lat) : '')
                        setManualLng(lng ? String(lng) : '')
                      }} style={{
                        width: '100%', background: 'none', border: `1px solid ${border}`,
                        borderRadius: 12, padding: '11px 0', color: muted, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                      }}>✍️ Ввести координаты вручную</button>

                      <button onClick={() => { setLocMode('idle'); setLocError('') }} style={{
                        background: 'none', border: 'none', padding: '6px 0', color: muted, fontSize: 13, cursor: 'pointer',
                      }}>Отмена</button>
                      {locError && <div style={{ fontSize: 12, color: '#ff3b30' }}>{locError}</div>}
                    </div>
                  )}

                  {locMode === 'search' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input style={{ ...inputStyle, flex: 1 }} placeholder="Ташкент, ул. Навои 12..."
                          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddressSearch()} />
                        <button onClick={handleAddressSearch} disabled={searching} style={{
                          background: '#2481cc', border: 'none', borderRadius: 12,
                          padding: '10px 14px', color: '#fff', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                        }}>{searching ? '⏳' : '🔍'}</button>
                      </div>
                      {searchResults.map((r, i) => (
                        <button key={i} onClick={() => saveLocation(parseFloat(r.lat), parseFloat(r.lon))} style={{
                          width: '100%', background: isDark ? '#333' : '#f8f9fa',
                          border: `1px solid ${border}`, borderRadius: 12,
                          padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                          fontSize: 13, color: text, lineHeight: 1.4,
                        }}>📍 {r.display_name}</button>
                      ))}
                      {locError && <div style={{ fontSize: 12, color: '#ff3b30' }}>{locError}</div>}
                      <button onClick={() => { setLocMode('menu'); setSearchResults([]); setLocError('') }} style={{
                        background: 'none', border: 'none', padding: '6px 0', color: muted, fontSize: 13, cursor: 'pointer',
                      }}>← Назад</button>
                    </div>
                  )}

                  {locMode === 'manual' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12, color: muted }}>
                        Скопируйте из Google/Яндекс.Карт: правый клик → «Что здесь?»
                      </div>
                      <input style={inputStyle} placeholder="Широта, напр: 41.29950"
                        value={manualLat} onChange={e => setManualLat(e.target.value)} inputMode="decimal" />
                      <input style={inputStyle} placeholder="Долгота, напр: 69.24007"
                        value={manualLng} onChange={e => setManualLng(e.target.value)} inputMode="decimal" />
                      {locError && <div style={{ fontSize: 12, color: '#ff3b30' }}>{locError}</div>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setLocMode('menu'); setLocError('') }} style={{
                          flex: 1, background: isDark ? '#333' : '#f0f2f5', border: 'none',
                          borderRadius: 12, padding: 12, color: muted, fontWeight: 600, cursor: 'pointer',
                        }}>← Назад</button>
                        <button onClick={handleManualSave} style={{
                          flex: 2, background: '#2481cc', border: 'none', borderRadius: 12,
                          padding: 12, color: '#fff', fontWeight: 700, cursor: 'pointer',
                        }}>✅ Сохранить</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Удаление / Восстановление ── */}
                {deleteError && (
                  <div style={{ background: '#ff3b3015', border: '1px solid #ff3b3030', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#ff3b30' }}>
                    {deleteError}
                  </div>
                )}

                {!customer.is_active ? (
                  <button onClick={handleRestore} style={{
                    width: '100%', background: '#34c75915', border: '1px solid #34c75940',
                    borderRadius: 14, padding: 13, color: '#34c759',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}>♻️ Восстановить клиента</button>
                ) : !confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} style={{
                    width: '100%', background: 'none', border: `1px solid #ff3b3030`,
                    borderRadius: 14, padding: 13, color: '#ff3b30',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>🗑 Удалить клиента</button>
                ) : (
                  <div style={{ background: '#ff3b3010', border: '1px solid #ff3b3030', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ff3b30', marginBottom: 6 }}>
                      Удалить клиента?
                    </div>
                    <div style={{ fontSize: 12, color: muted, marginBottom: 12 }}>
                      {customer.total_purchases > 0
                        ? 'Есть история продаж — клиент будет скрыт из списков, отчёты сохранятся.'
                        : 'История продаж отсутствует — клиент будет удалён безвозвратно.'}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setConfirmDelete(false)} style={{
                        flex: 1, background: isDark ? '#333' : '#f0f2f5', border: 'none',
                        borderRadius: 10, padding: 11, color: muted, fontWeight: 600, cursor: 'pointer',
                      }}>Отмена</button>
                      <button onClick={handleDelete} disabled={deleting} style={{
                        flex: 2, background: '#ff3b30', border: 'none',
                        borderRadius: 10, padding: 11, color: '#fff', fontWeight: 700, cursor: 'pointer',
                      }}>{deleting ? '⏳...' : customer.total_purchases > 0 ? '🚫 Скрыть' : '🗑 Удалить'}</button>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loadingHistory ? (
                  <div style={{ textAlign: 'center', padding: 32, color: muted }}>Загрузка...</div>
                ) : sales.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                    <div style={{ color: muted }}>Продаж нет</div>
                  </div>
                ) : sales.map(s => {
                  const isReturned = s.status === 'returned'
                  return (
                  <div key={s.id} style={{ background: isReturned ? (isDark ? '#1e1810' : '#fff9f0') : card, borderRadius: 14, padding: '12px 14px', border: `1px solid ${isReturned ? '#e0803030' : border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{PAYMENT_ICONS[s.payment_type]}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{fmt(s.total_amount)} сум</span>
                        {s.discount_percent > 0 && (
                          <span style={{ fontSize: 11, background: '#34c75920', color: '#34c759', borderRadius: 6, padding: '1px 6px', fontWeight: 600 }}>-{s.discount_percent}%</span>
                        )}
                        {isReturned && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: '#e0803020', color: '#e08030' }}>↩️ Возврат</span>}
                      </div>
                      {s.debt > 0 && <span style={{ fontSize: 12, color: '#ff3b30', fontWeight: 700 }}>долг {fmt(s.debt)}</span>}
                    </div>
                    {s.items.map((item, i) => {
                      const unitStr = item.unit && item.unit !== 'шт' && item.unit_value
                        ? ` (${+(item.quantity * item.unit_value).toFixed(1)} ${item.unit})`
                        : ` шт`
                      return (
                      <div key={i} style={{ fontSize: 12, color: muted, display: 'flex', justifyContent: 'space-between', paddingTop: 3 }}>
                        <span>
                          {item.brand && <span style={{ color: '#2481cc', fontWeight: 600 }}>{item.brand} </span>}
                          {item.product_name} × {item.quantity}{unitStr}
                        </span>
                        <span>{fmt(item.total)}</span>
                      </div>
                      )
                    })}
                    <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
                      {s.created_at ? new Date(s.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                  )
                })}
                {returns.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, paddingLeft: 2 }}>↩️ Возвраты</div>
                    {returns.map(r => (
                      <div key={r.id} style={{ background: isDark ? '#1e1810' : '#fff9f0', borderRadius: 12, padding: '10px 12px', border: '1px solid #e0803030', marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: text }}>{r.product_name} × {r.quantity}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#e08030' }}>−{fmt(r.return_amount)}</span>
                        </div>
                        {r.reason && <div style={{ fontSize: 11, color: muted }}>Причина: {r.reason}</div>}
                        <div style={{ fontSize: 11, color: muted }}>{new Date(r.created_at).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</div>
                      </div>
                    ))}
                  </div>
                )}
                {debtPayments.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, paddingLeft: 2 }}>💰 Погашения долга</div>
                    {debtPayments.map(dp => (
                      <div key={dp.id} style={{ background: isDark ? '#0f1f14' : '#f0fdf4', borderRadius: 12, padding: '10px 12px', border: '1px solid #16a34a30', marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>+{fmt(dp.amount)} сум</span>
                          <span style={{ fontSize: 11, color: muted }}>{new Date(dp.created_at).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                        </div>
                        <div style={{ fontSize: 11, color: muted }}>{dp.paid_by}{dp.note ? ` · ${dp.note}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}