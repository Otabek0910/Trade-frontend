import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import type { AxiosError } from 'axios'
import { useAuth } from '../contexts/AuthContext'

interface AppUser {
  id: number
  telegram_id: number
  username: string | null
  full_name: string
  role: string
  status: 'pending' | 'active' | 'blocked'
  created_at: string
  notify?: boolean
}

const ROLE_LABELS: Record<string, string> = {
  developer: '👨‍💻 Разработчик',
  owner_business: '👑 Владелец',
  seller: '🛒 Продавец',
  storekeeper: '📦 Кладовщик',
}

const ROLE_COLORS: Record<string, string> = {
  developer: '#7a3b8c',
  owner_business: '#f59e0b',
  seller: '#2481cc',
  storekeeper: '#1a6b3c',
}

const ALL_ROLES = ['owner_business', 'seller', 'storekeeper']

export default function UsersPage() {
  const { token, user: currentUser } = useAuth()
  const navigate = useNavigate()
  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'

  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [error, setError] = useState<Record<number, string>>({})

  useEffect(() => {
    let cancelled = false
    api.get('/users')
      .then(r => { if (!cancelled) { setUsers(r.data); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  const handleNotify = async (userId: number) => {
    try {
      const res = await api.patch(`/users/${userId}/notify`)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, notify: res.data.notify } : u))
    } catch { /* silent */ }
  }

  const handleUpdate = async (userId: number, patch: { role?: string; status?: string }) => {
    setSaving(true)
    setError(prev => ({ ...prev, [userId]: '' }))
    try {
      const res = await api.patch(`/users/${userId}`, patch)
      setUsers(prev => prev.map(u => u.id === userId ? res.data : u))
      setEditingId(null)
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setError(prev => ({ ...prev, [userId]: e.response?.data?.detail || 'Ошибка' }))
    }
    setSaving(false)
  }

  const handleApprove = async (userId: number) => {
    setApprovingId(userId)
    try {
      const res = await api.post(`/users/${userId}/approve`, {})
      setUsers(prev => prev.map(u => u.id === userId ? res.data : u))
      tg?.HapticFeedback?.notificationOccurred('success')
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setError(prev => ({ ...prev, [userId]: e.response?.data?.detail || 'Ошибка' }))
    }
    setApprovingId(null)
  }

  const handleReject = async (userId: number) => {
    setApprovingId(userId)
    try {
      await api.post(`/users/${userId}/reject`, {})
      setUsers(prev => prev.filter(u => u.id !== userId))
      tg?.HapticFeedback?.notificationOccurred('warning')
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setError(prev => ({ ...prev, [userId]: e.response?.data?.detail || 'Ошибка' }))
    }
    setApprovingId(null)
  }

  const handleDelete = async (userId: number) => {
    try {
      await api.delete(`/users/${userId}`)
      setUsers(prev => prev.filter(u => u.id !== userId))
      setConfirmDeleteId(null)
      tg?.HapticFeedback?.notificationOccurred('success')
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>
      setError(prev => ({ ...prev, [userId]: e.response?.data?.detail || 'Ошибка удаления' }))
      setConfirmDeleteId(null)
    }
  }

  const bg = isDark ? '#1a1a1a' : '#f0f2f5'
  const card = isDark ? '#242424' : '#ffffff'
  const text = isDark ? '#ffffff' : '#1a1a1a'
  const muted = isDark ? '#666' : '#999'
  const border = isDark ? '#333' : '#e8eaed'

  const pendingUsers = users.filter(u => u.status === 'pending')
  const activeUsers = users.filter(u => u.status === 'active')
  const blockedUsers = users.filter(u => u.status === 'blocked')

  const renderUser = (u: AppUser) => {
    const isEditing = editingId === u.id
    const isDeveloper = u.role === 'developer'
    const isOwner = u.role === 'owner_business'
    const canManage = currentUser?.role === 'developer' || !isOwner
    const isPending = u.status === 'pending'
    const isBlocked = u.status === 'blocked'
    const isApproving = approvingId === u.id

    return (
      <div key={u.id} style={{
        background: isPending ? (isDark ? '#1a1a10' : '#fffbf0')
          : isBlocked ? (isDark ? '#1e1a1a' : '#fff8f8')
          : card,
        borderRadius: 16, padding: '14px 16px',
        border: `1.5px solid ${isPending ? '#f59e0b40' : isBlocked ? '#ff3b3040' : border}`,
        opacity: isBlocked ? 0.8 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: (isEditing || isPending) ? 14 : 0 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
            background: isPending ? '#f59e0b20' : isDeveloper ? '#7a3b8c20' : '#2481cc20',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            {isPending ? '⏳' : isDeveloper ? '👨‍💻' : u.role === 'owner_business' ? '👑' : u.role === 'seller' ? '🛒' : '📦'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.full_name}
            </div>
            <div style={{ fontSize: 12, color: muted, marginTop: 1 }}>
              {u.username ? `@${u.username}` : `ID: ${u.telegram_id}`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {!isPending && (
              <div style={{
                fontSize: 11, fontWeight: 700, borderRadius: 8, padding: '3px 8px',
                background: `${ROLE_COLORS[u.role]}20`,
                color: ROLE_COLORS[u.role],
              }}>
                {ROLE_LABELS[u.role] || u.role}
              </div>
            )}
            {isPending && <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, background: '#f59e0b15', borderRadius: 8, padding: '3px 8px' }}>ОЖИДАЕТ</div>}
            {isBlocked && <div style={{ fontSize: 10, color: '#ff3b30', fontWeight: 600 }}>ЗАБЛОКИРОВАН</div>}
          </div>
        </div>

        {/* Pending — кнопки одобрить/отклонить */}
        {isPending && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: muted }}>
              Запрашивает доступ к системе. Назначьте роль и одобрите.
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {ALL_ROLES.map(role => (
                <button key={role} onClick={() => handleUpdate(u.id, { role })} disabled={saving} style={{
                  flex: 1, border: `1.5px solid ${u.role === role ? ROLE_COLORS[role] : border}`,
                  borderRadius: 10, padding: '6px 4px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  background: u.role === role ? `${ROLE_COLORS[role]}20` : 'transparent',
                  color: u.role === role ? ROLE_COLORS[role] : muted,
                }}>
                  {role === 'owner_business' ? '👑' : role === 'seller' ? '🛒' : '📦'}{' '}
                  {role === 'owner_business' ? 'Владелец' : role === 'seller' ? 'Продавец' : 'Кладовщик'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleReject(u.id)} disabled={isApproving} style={{
                flex: 1, background: '#ff3b3015', border: '1px solid #ff3b3040',
                borderRadius: 10, padding: 10, color: '#ff3b30',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
                {isApproving ? '...' : '✕ Отклонить'}
              </button>
              <button onClick={() => handleApprove(u.id)} disabled={isApproving} style={{
                flex: 2, background: 'linear-gradient(135deg, #34c759, #28a745)',
                border: 'none', borderRadius: 10, padding: 10, color: '#fff',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
                {isApproving ? '⏳...' : '✓ Одобрить'}
              </button>
            </div>
            {error[u.id] && <div style={{ fontSize: 12, color: '#ff3b30' }}>{error[u.id]}</div>}
          </div>
        )}

        {/* Active/Blocked — управление */}
        {!isPending && !isDeveloper && canManage && (
          <>
            {!isEditing ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => setEditingId(u.id)} style={{
                  flex: 1, background: 'transparent',
                  border: `1px solid ${border}`, borderRadius: 10, padding: '7px 0',
                  fontSize: 13, color: '#2481cc', fontWeight: 600, cursor: 'pointer',
                }}>
                  Управление
                </button>
                <button onClick={() => handleNotify(u.id)} title={u.notify ? 'Выключить уведомления' : 'Включить уведомления'} style={{
                  background: u.notify ? '#f59e0b20' : 'transparent',
                  border: `1px solid ${u.notify ? '#f59e0b' : border}`,
                  borderRadius: 10, padding: '7px 12px',
                  fontSize: 16, cursor: 'pointer',
                }}>
                  {u.notify ? '🔔' : '🔕'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600 }}>Роль</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {ALL_ROLES.map(role => (
                      <button key={role} onClick={() => handleUpdate(u.id, { role })} disabled={saving} style={{
                        flex: 1, border: `1.5px solid ${u.role === role ? ROLE_COLORS[role] : border}`,
                        borderRadius: 10, padding: '7px 4px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        background: u.role === role ? `${ROLE_COLORS[role]}20` : 'transparent',
                        color: u.role === role ? ROLE_COLORS[role] : muted,
                      }}>
                        {role === 'owner_business' ? '👑 Владелец' : role === 'seller' ? '🛒 Продавец' : '📦 Кладовщик'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditingId(null)} style={{
                    flex: 1, background: isDark ? '#333' : '#f0f2f5', border: 'none',
                    borderRadius: 10, padding: 10, color: muted, fontWeight: 600, cursor: 'pointer', fontSize: 13,
                  }}>Закрыть</button>
                  <button onClick={() => handleUpdate(u.id, { status: isBlocked ? 'active' : 'blocked' })} disabled={saving} style={{
                    flex: 1, background: isBlocked ? '#34c75915' : '#ff3b3015',
                    border: `1px solid ${isBlocked ? '#34c75940' : '#ff3b3040'}`,
                    borderRadius: 10, padding: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    color: isBlocked ? '#34c759' : '#ff3b30',
                  }}>
                    {saving ? '...' : isBlocked ? '✅ Разблок.' : '🚫 Заблок.'}
                  </button>
                  <button onClick={() => setConfirmDeleteId(u.id)} style={{
                    background: '#ff3b3015', border: '1px solid #ff3b3030',
                    borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontSize: 14, color: '#ff3b30',
                  }}>🗑</button>
                </div>

                {confirmDeleteId === u.id && (
                  <div style={{ background: '#ff3b3010', border: '1px solid #ff3b3030', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ff3b30', marginBottom: 4 }}>Удалить сотрудника?</div>
                    <div style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
                      Если есть история продаж — удаление невозможно, только блокировка.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setConfirmDeleteId(null)} style={{
                        flex: 1, background: isDark ? '#333' : '#f0f2f5', border: 'none',
                        borderRadius: 10, padding: 10, color: muted, fontWeight: 600, cursor: 'pointer',
                      }}>Отмена</button>
                      <button onClick={() => handleDelete(u.id)} style={{
                        flex: 2, background: '#ff3b30', border: 'none',
                        borderRadius: 10, padding: 10, color: '#fff', fontWeight: 700, cursor: 'pointer',
                      }}>🗑 Удалить</button>
                    </div>
                  </div>
                )}
                {error[u.id] && <div style={{ fontSize: 12, color: '#ff3b30' }}>{error[u.id]}</div>}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ background: card, padding: '14px 16px 12px', boxShadow: `0 1px 0 ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/')}
            style={{ background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: text }}>👥 Сотрудники</div>
          {pendingUsers.length > 0 && (
            <div style={{ background: '#f59e0b', borderRadius: 10, padding: '3px 10px', fontSize: 12, color: '#fff', fontWeight: 700 }}>
              ⏳ {pendingUsers.length}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px' }}>
        {[
          { label: 'Активных', value: activeUsers.length, color: '#34c759' },
          { label: 'Ожидают', value: pendingUsers.length, color: '#f59e0b' },
          { label: 'Заблокировано', value: blockedUsers.length, color: '#ff3b30' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: card, borderRadius: 12, padding: '10px 8px', textAlign: 'center', border: `1px solid ${border}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: muted }}>Загрузка...</div>
        ) : (
          <>
            {/* Ожидают одобрения */}
            {pendingUsers.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.5, paddingLeft: 4, marginTop: 4 }}>
                  ⏳ Ожидают одобрения
                </div>
                {pendingUsers.map(renderUser)}
              </>
            )}

            {/* Активные */}
            {activeUsers.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, paddingLeft: 4, marginTop: pendingUsers.length > 0 ? 8 : 4 }}>
                  ✅ Активные
                </div>
                {activeUsers.map(renderUser)}
              </>
            )}

            {/* Заблокированные */}
            {blockedUsers.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, paddingLeft: 4, marginTop: 8 }}>
                  🚫 Заблокированные
                </div>
                {blockedUsers.map(renderUser)}
              </>
            )}
          </>
        )}
      </div>

      <div style={{ padding: '16px 16px 0', fontSize: 12, color: muted, textAlign: 'center' }}>
        Новые сотрудники попадают в список ожидания и требуют одобрения
      </div>
    </div>
  )
}