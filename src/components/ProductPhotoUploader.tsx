// src/components/ProductPhotoUploader.tsx
import { useRef, useState } from 'react'
import axios, { AxiosError } from 'axios'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  productId: number
  currentPhotoUrl: string | null
  onUpdated: (newUrl: string | null) => void
  size?: number
  editable?: boolean
}

interface ApiError { detail?: string }

export default function ProductPhotoUploader({
  productId, currentPhotoUrl, onUpdated, size = 80, editable = true,
}: Props) {
  const { token } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'
  const placeholderBg = isDark ? '#2a2a2a' : '#f0f0f0'
  const mutedColor    = isDark ? '#555' : '#ccc'

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    setUploading(true)
    try {
      const res = await axios.post<{ photo_url: string }>(
        `/products/${productId}/photo`, formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      )
      onUpdated(res.data.photo_url)
      tg?.HapticFeedback?.notificationOccurred('success')
    } catch (e) {
      const err = e as AxiosError<ApiError>
      alert(err.response?.data?.detail ?? 'Ошибка загрузки фото')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async (ev: React.MouseEvent) => {
    ev.stopPropagation()
    setDeleting(true)
    try {
      await axios.delete(`/products/${productId}/photo`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      onUpdated(null)
    } catch (e) {
      const err = e as AxiosError<ApiError>
      alert(err.response?.data?.detail ?? 'Ошибка удаления')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Фото / плейсхолдер */}
      <div
        onClick={() => editable && inputRef.current?.click()}
        style={{
          width: size, height: size,
          borderRadius: size * 0.18,
          background: placeholderBg,
          overflow: 'hidden',
          cursor: editable ? 'pointer' : 'default',
          border: `2px dashed ${currentPhotoUrl ? 'transparent' : mutedColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
      >
        {currentPhotoUrl ? (
          <img src={currentPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: size * 0.35, opacity: 0.5 }}>📷</span>
        )}

        {/* Оверлей загрузки */}
        {(uploading || deleting) && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18 }}>⏳</span>
          </div>
        )}

        {/* Кнопка редактирования */}
        {editable && currentPhotoUrl && !uploading && !deleting && (
          <div style={{
            position: 'absolute', bottom: 4, right: 4,
            background: 'rgba(0,0,0,0.6)', borderRadius: 6,
            padding: '2px 5px', fontSize: 11,
          }}>✏️</div>
        )}
      </div>

      {/* Кнопка удаления */}
      {editable && currentPhotoUrl && !uploading && !deleting && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute', top: -8, right: -8,
            width: 22, height: 22, borderRadius: '50%',
            background: '#e05555', border: 'none',
            color: '#fff', fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}
        >×</button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}