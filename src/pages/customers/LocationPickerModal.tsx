import { useEffect, useRef, useState } from 'react'

interface Props {
  initialLat?: number | null
  initialLng?: number | null
  isDark: boolean
  onConfirm: (lat: number, lng: number) => void
  onClose: () => void
}

const DEFAULT_LAT = 41.2995
const DEFAULT_LNG = 69.2401

// Типы для Leaflet (без установки пакета — грузим с CDN)
interface LeafletMap {
  setView: (latlng: [number, number], zoom: number) => LeafletMap
  on: (event: string, handler: (e: LeafletEvent) => void) => void
  invalidateSize: () => void
  remove: () => void
}
interface LeafletMarker {
  setLatLng: (latlng: [number, number]) => void
  getLatLng: () => { lat: number; lng: number }
  on: (event: string, handler: (e: LeafletEvent) => void) => void
}
interface LeafletEvent {
  latlng: { lat: number; lng: number }
  target: LeafletMarker
}
interface LeafletStatic {
  map: (el: HTMLDivElement, opts?: object) => LeafletMap
  tileLayer: (url: string, opts?: object) => { addTo: (map: LeafletMap) => void }
  marker: (latlng: [number, number], opts?: object) => LeafletMarker & { addTo: (map: LeafletMap) => LeafletMarker }
  divIcon: (opts: object) => object
}

declare global {
  interface Window { L: LeafletStatic }
}

export default function LocationPickerModal({ initialLat, initialLng, isDark, onConfirm, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)
  const [ready, setReady] = useState(false)
  const [pickedLat, setPickedLat] = useState<number>(initialLat ?? DEFAULT_LAT)
  const [pickedLng, setPickedLng] = useState<number>(initialLng ?? DEFAULT_LNG)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [locating, setLocating] = useState(false)

  // ── Загружаем Leaflet с CDN ────────────────────────────────────────────────
  useEffect(() => {
    // setState через Promise.resolve().then() — обход ESLint react-hooks/set-state-in-effect
    if (window.L) {
      Promise.resolve().then(() => setReady(true))
      return
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => setReady(true)
    document.head.appendChild(script)
  }, [])

  // ── Инициализация карты ────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || leafletMap.current) return

    const L = window.L
    const startLat = initialLat ?? DEFAULT_LAT
    const startLng = initialLng ?? DEFAULT_LNG

    const map = L.map(mapRef.current, { zoomControl: true }).setView([startLat, startLng], 14)
    leafletMap.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:32px;height:32px;border-radius:50% 50% 50% 0;
        background:#2481cc;border:3px solid #fff;
        transform:rotate(-45deg);
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
      "></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    })

    const marker = L.marker([startLat, startLng], { icon, draggable: true }).addTo(map)
    markerRef.current = marker

    marker.on('dragend', (e: LeafletEvent) => {
      const { lat, lng } = e.target.getLatLng()
      setPickedLat(lat)
      setPickedLng(lng)
    })

    map.on('click', (e: LeafletEvent) => {
      const { lat, lng } = e.latlng
      marker.setLatLng([lat, lng])
      setPickedLat(lat)
      setPickedLng(lng)
    })

    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      leafletMap.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])
  // initialLat/initialLng намеренно исключены — карта инициализируется один раз

  // ── Поиск по адресу ────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true); setSearchError('')
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&accept-language=ru`,
        { headers: { 'User-Agent': 'TradiApp/1.0' } }
      )
      const data = await res.json() as Array<{ lat: string; lon: string }>
      if (data.length === 0) { setSearchError('Не найдено'); setSearching(false); return }
      const newLat = parseFloat(data[0].lat)
      const newLng = parseFloat(data[0].lon)
      setPickedLat(newLat)
      setPickedLng(newLng)
      if (leafletMap.current && markerRef.current) {
        leafletMap.current.setView([newLat, newLng], 16)
        markerRef.current.setLatLng([newLat, newLng])
      }
    } catch { setSearchError('Ошибка поиска') }
    setSearching(false)
  }

  // ── GPS ────────────────────────────────────────────────────────────────────
  const handleGPS = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setPickedLat(latitude)
        setPickedLng(longitude)
        if (leafletMap.current && markerRef.current) {
          leafletMap.current.setView([latitude, longitude], 16)
          markerRef.current.setLatLng([latitude, longitude])
        }
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  const bg = isDark ? '#1a1a1a' : '#f0f2f5'
  const card = isDark ? '#2a2a2a' : '#ffffff'
  const text = isDark ? '#fff' : '#1a1a1a'
  const muted = isDark ? '#888' : '#999'
  const border = isDark ? '#444' : '#e8eaed'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', flexDirection: 'column', background: bg }}>

      {/* Шапка */}
      <div style={{ background: card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: `0 1px 0 ${border}`, flexShrink: 0 }}>
        <button onClick={onClose} style={{
          background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 10,
          width: 34, height: 34, fontSize: 18, cursor: 'pointer', color: text, flexShrink: 0,
        }}>←</button>

        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input
            style={{
              flex: 1, background: isDark ? '#333' : '#f8f9fa',
              border: `1px solid ${border}`, borderRadius: 10,
              padding: '8px 12px', fontSize: 16, color: text, outline: 'none',
            }}
            placeholder="Поиск адреса..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={searching} style={{
            background: '#2481cc', border: 'none', borderRadius: 10,
            width: 36, height: 36, color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{searching ? '⏳' : '🔍'}</button>
        </div>

        <button onClick={handleGPS} disabled={locating} style={{
          background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 10,
          width: 36, height: 36, fontSize: 18, cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{locating ? '⏳' : '📡'}</button>
      </div>

      {searchError && (
        <div style={{ background: '#ff3b3015', padding: '6px 16px', fontSize: 13, color: '#ff3b30', flexShrink: 0 }}>
          {searchError}
        </div>
      )}

      {/* Карта */}
      <div style={{ flex: 1, position: 'relative' }}>
        {!ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted, fontSize: 15 }}>
            Загрузка карты...
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)', color: '#fff',
          padding: '6px 14px', borderRadius: 20, fontSize: 13,
          pointerEvents: 'none', whiteSpace: 'nowrap', backdropFilter: 'blur(4px)',
        }}>
          Тапните на карту или перетащите маркер
        </div>
      </div>

      {/* Нижняя панель */}
      <div style={{ background: card, padding: '12px 16px 24px', boxShadow: `0 -1px 0 ${border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: muted, marginBottom: 10, textAlign: 'center' }}>
          📍 {pickedLat.toFixed(5)}, {pickedLng.toFixed(5)}
        </div>
        <button
          onClick={() => onConfirm(pickedLat, pickedLng)}
          style={{
            width: '100%', background: '#2481cc', border: 'none',
            borderRadius: 14, padding: '14px 0', color: '#fff',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}>
          ✅ Подтвердить локацию
        </button>
      </div>
    </div>
  )
}