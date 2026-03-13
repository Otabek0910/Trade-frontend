import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios, { AxiosError } from 'axios'
import { useAuth } from '../contexts/AuthContext'


interface AuditEntry {
  id: number
  action: string
  action_label: string
  entity: string
  entity_id: number
  user_name: string
  new_values: Record<string, unknown> | null
  old_values: Record<string, unknown> | null
  is_reverted: boolean
  reverted_at: string | null
  reverted_by_name: string | null
  created_at: string
}

const ACTION_FILTERS = [
  { key: '', label: 'Все' },
  { key: 'create_sale', label: '💰 Продажи' },
  { key: 'create_receipt', label: '📥 Приёмки' },
  { key: 'create_expense', label: '💸 Расходы' },
  { key: 'create_return', label: '↩️ Возвраты' },
]

function getActionIcon(action: string) {
  const icons: Record<string, string> = {
    create_sale: '💰',
    create_receipt: '📥',
    create_expense: '💸',
    create_return: '↩️',
  }
  return icons[action] || '📋'
}

function formatDetails(entry: AuditEntry): string {
  const v = entry.new_values
  if (!v) return ''
  switch (entry.action) {
    case 'create_sale': {
      const items = (v.items as Array<{ product_name: string; quantity: number }> | undefined) || []
      const names = items.map(i => `${i.product_name} ×${i.quantity}`).join(', ')
      return `${Math.round(Number(v.total_amount)).toLocaleString('ru-RU')} сум · ${names}`
    }
    case 'create_receipt':
      return `${v.product_name} · ${v.quantity} шт · ${Math.round(Number(v.purchase_price)).toLocaleString('ru-RU')} сум/шт`
    case 'create_expense':
      return `${Math.round(Number(v.amount)).toLocaleString('ru-RU')} сум · ${v.category}${v.description ? ` · ${v.description}` : ''}`
    case 'create_return':
      return `${v.product_name} · ${v.quantity} шт · ${Math.round(Number(v.return_amount)).toLocaleString('ru-RU')} сум · из продажи #${v.sale_id}`
    default:
      return JSON.stringify(v)
  }
}

export default function AuditPage() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [hideReverted, setHideReverted] = useState(false)
  const [revertingId, setRevertingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [revertError, setRevertError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const params: Record<string, string> = {}
    if (filterAction) params.action = filterAction
    axios.get<AuditEntry[]>('/audit', { headers: { Authorization: `Bearer ${token}` }, params })
      .then(r => { if (!cancelled) { setEntries(r.data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setEntries([]); setLoading(false) } })
    return () => { cancelled = true; setLoading(true) }
  }, [token, filterAction, refreshTick])

  const handleRevert = async (id: number) => {
    setRevertingId(id); setRevertError('')
    try {
      await axios.post(`/audit/${id}/revert`, {}, { headers: { Authorization: `Bearer ${token}` } })
      setRefreshTick(t => t + 1)
      tg?.HapticFeedback?.notificationOccurred('success')
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setRevertError(e.response?.data?.detail || 'Ошибка отмены')
      tg?.HapticFeedback?.notificationOccurred('error')
    }
    setRevertingId(null)
    setConfirmId(null)
  }

  const handleHardDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await axios.delete(`/audit/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      setEntries(prev => prev.filter(e => e.id !== id))
      setConfirmDeleteId(null)
    } catch {
      // silent
    } finally {
      setDeletingId(null)
    }
  }

  const displayed = hideReverted ? entries.filter(e => !e.is_reverted) : entries

  const bg = isDark ? '#1a1a1a' : '#f0f2f5'
  const card = isDark ? '#242424' : '#ffffff'
  const text = isDark ? '#ffffff' : '#1a1a1a'
  const muted = isDark ? '#666' : '#999'
  const border = isDark ? '#333' : '#e8eaed'

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ background: card, padding: '14px 16px 12px', boxShadow: `0 1px 0 ${border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={() => navigate('/')} style={{
            background: isDark ? '#333' : '#f0f2f5', border: 'none',
            borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: 'pointer', flexShrink: 0,
          }}>←</button>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: text }}>📋 Журнал событий</div>
          <button onClick={() => setHideReverted(v => !v)} style={{
            background: hideReverted ? '#2481cc' : (isDark ? '#333' : '#f0f2f5'),
            border: 'none', borderRadius: 10, padding: '6px 10px',
            fontSize: 12, fontWeight: 600, color: hideReverted ? '#fff' : muted, cursor: 'pointer',
          }}>
            {hideReverted ? 'Скрыты ↩️' : 'Показать все'}
          </button>
        </div>

        {/* Фильтры по типу */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {ACTION_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilterAction(f.key)} style={{
              background: filterAction === f.key ? '#2481cc' : (isDark ? '#333' : '#f0f2f5'),
              border: 'none', borderRadius: 10, padding: '6px 12px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              color: filterAction === f.key ? '#fff' : muted,
              flexShrink: 0,
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Ошибка отмены */}
      {revertError && (
        <div style={{
          margin: '12px 16px 0', background: '#ff3b3015', border: '1px solid #ff3b3030',
          borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#ff3b30',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
        }}>
          <div>
            <div style={{ fontWeight: 600 }}>{revertError}</div>
            {revertError.includes('возврат') && (
              <div style={{ fontSize: 11, marginTop: 4, color: '#ff3b3099' }}>
                Порядок: сначала ↩️ Возврат → потом 💰 Продажа
              </div>
            )}
          </div>
          <button onClick={() => setRevertError('')} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Список */}
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: muted }}>Загрузка...</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ color: muted }}>Событий нет</div>
          </div>
        ) : displayed.map(entry => (
          <div key={entry.id} style={{
            background: entry.is_reverted ? (isDark ? '#1a1a1a' : '#f8f8f8') : card,
            borderRadius: 16, padding: '13px 14px',
            border: `1.5px solid ${entry.is_reverted ? (isDark ? '#2a2a2a' : '#eee') : border}`,
            opacity: entry.is_reverted ? 0.65 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

              {/* Иконка */}
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: entry.is_reverted ? (isDark ? '#2a2a2a' : '#f0f0f0') : (isDark ? '#333' : '#f0f2f5'),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>
                {entry.is_reverted ? '🚫' : getActionIcon(entry.action)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Заголовок + бейдж */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: text }}>
                    {entry.action_label} #{entry.entity_id}
                  </span>
                  {entry.is_reverted && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                      background: '#ff3b3020', color: '#ff3b30',
                    }}>ОТМЕНЕНО</span>
                  )}
                </div>

                {/* Детали */}
                <div style={{ fontSize: 12, color: muted, marginBottom: 4, lineHeight: 1.4 }}>
                  {formatDetails(entry)}
                </div>

                {/* Кто и когда */}
                <div style={{ fontSize: 11, color: isDark ? '#555' : '#bbb' }}>
                  {entry.user_name} · {entry.created_at
                    ? new Date(entry.created_at).toLocaleString('ru-RU', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : ''}
                </div>

                {/* Кто отменил */}
                {entry.is_reverted && entry.reverted_by_name && (
                  <div style={{ fontSize: 11, color: '#ff3b3099', marginTop: 2 }}>
                    Отменил: {entry.reverted_by_name} · {entry.reverted_at
                      ? new Date(entry.reverted_at).toLocaleString('ru-RU', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })
                      : ''}
                  </div>
                )}
              </div>

              {/* Кнопки отмены / удаления */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                {!entry.is_reverted && (
                  <div>
                    {confirmId === entry.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button
                          onClick={() => handleRevert(entry.id)}
                          disabled={revertingId === entry.id}
                          style={{
                            background: '#ff3b30', border: 'none', borderRadius: 10,
                            padding: '6px 10px', color: '#fff',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            minWidth: 64,
                          }}>
                          {revertingId === entry.id ? '...' : '✅ Да'}
                        </button>
                        <button onClick={() => setConfirmId(null)} style={{
                          background: 'none', border: 'none', fontSize: 11,
                          color: muted, cursor: 'pointer', padding: '4px 0',
                        }}>Нет</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setConfirmId(entry.id); setRevertError(''); setConfirmDeleteId(null) }}
                        style={{
                          background: isDark ? '#2a2a2a' : '#f8f8f8',
                          border: `1px solid ${border}`,
                          borderRadius: 10, padding: '6px 10px',
                          fontSize: 12, fontWeight: 600, color: muted, cursor: 'pointer',
                        }}>↩️ Отменить</button>
                    )}
                  </div>
                )}
                {user?.role === 'developer' && (
                  <div>
                    {confirmDeleteId === entry.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button
                          onClick={() => handleHardDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          style={{
                            background: '#7a3b8c', border: 'none', borderRadius: 10,
                            padding: '6px 10px', color: '#fff',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            minWidth: 64,
                          }}>
                          {deletingId === entry.id ? '...' : '🗑 Да'}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} style={{
                          background: 'none', border: 'none', fontSize: 11,
                          color: muted, cursor: 'pointer', padding: '4px 0',
                        }}>Нет</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setConfirmDeleteId(entry.id); setConfirmId(null); setRevertError('') }}
                        style={{
                          background: isDark ? '#2a1a2e' : '#f5f0f8',
                          border: '1px solid #7a3b8c40',
                          borderRadius: 10, padding: '6px 10px',
                          fontSize: 12, fontWeight: 600, color: '#9b4fc8', cursor: 'pointer',
                        }}>🗑 Удалить</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}