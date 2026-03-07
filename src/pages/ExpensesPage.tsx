// src/pages/ExpensesPage.tsx
import { useEffect, useState, useCallback } from 'react'
import axios, { AxiosError } from 'axios'
import { useAuth } from '../contexts/AuthContext'

// ─── Типы ───────────────────────────────────────────────────────────────────

interface Expense {
  id: number
  amount: number
  category: string
  description: string | null
  date: string
  creator_name: string | null
}

interface Summary {
  year: number
  month: number
  total: number
  by_category: { category: string; amount: number }[]
}

interface ApiError {
  detail?: string
}

const CATEGORIES = [
  'Аренда', 'Зарплата', 'Налоги', 'Коммунальные',
  'Транспорт', 'Реклама', 'Оборудование', 'Прочее',
]

const CATEGORY_EMOJI: Record<string, string> = {
  'Аренда': '🏠', 'Зарплата': '👥', 'Налоги': '🏛️',
  'Коммунальные': '💡', 'Транспорт': '🚗', 'Реклама': '📣',
  'Оборудование': '🔧', 'Прочее': '📦',
}

const MONTH_NAMES = [
  '', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

// ─── Компонент ──────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { token } = useAuth()

  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'

  // Цвета темы
  const bg        = isDark ? '#1a1a1a' : '#f0f2f5'
  const surface   = isDark ? '#242424' : '#ffffff'
  const textPri   = isDark ? '#ffffff' : '#1a1a1a'
  const textSec   = isDark ? '#888888' : '#666666'
  const inputBg   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const border    = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year]  = useState(now.getFullYear())

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary]   = useState<Summary | null>(null)
  const [loading, setLoading]   = useState(false)
  const [filterCat, setFilterCat] = useState('')

  // Форма
  const [showForm, setShowForm]         = useState(false)
  const [formAmount, setFormAmount]     = useState('')
  const [formCategory, setFormCategory] = useState(CATEGORIES[0])
  const [formDesc, setFormDesc]         = useState('')
  const [formDate, setFormDate]         = useState(now.toISOString().split('T')[0])
  const [saving, setSaving]             = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  // ─── Загрузка ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` }
    setLoading(true)
    try {
      const params: Record<string, string | number> = { month, year }
      if (filterCat) params.category = filterCat

      const [listRes, sumRes] = await Promise.all([
        axios.get<Expense[]>('/expenses', { headers, params }),
        axios.get<Summary>('/expenses/summary', { headers, params: { month, year } }),
      ])
      setExpenses(listRes.data)
      setSummary(sumRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [month, year, filterCat, token])

  useEffect(() => { load() }, [load])

  // ─── Создание ─────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    const headers = { Authorization: `Bearer ${token}` }
    if (!formAmount || parseFloat(formAmount) <= 0) return
    setSaving(true)
    try {
      await axios.post('/expenses', {
        amount: parseFloat(formAmount),
        category: formCategory,
        description: formDesc || null,
        date: formDate,
      }, { headers })
      setShowForm(false)
      setFormAmount('')
      setFormDesc('')
      await load()
    } catch (e) {
      const err = e as AxiosError<ApiError>
      alert(err.response?.data?.detail ?? 'Ошибка при сохранении')
    }
    setSaving(false)
  }

  // ─── Удаление ─────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    const headers = { Authorization: `Bearer ${token}` }
    try {
      await axios.delete(`/expenses/${id}`, { headers })
      setConfirmDelete(null)
      await load()
    } catch (e) {
      const err = e as AxiosError<ApiError>
      alert(err.response?.data?.detail ?? 'Ошибка при удалении')
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

  const maxAmount = summary?.by_category[0]?.amount ?? 1

  // ─── Вёрстка ──────────────────────────────────────────────────────────────

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
            style={{ background: 'none', border: 'none', fontSize: 24, color: textPri, cursor: 'pointer', padding: 0 }}
          >‹</button>
          <span style={{ fontSize: 17, fontWeight: 700 }}>💸 Расходы</span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: '#2481cc', color: '#fff', border: 'none',
            borderRadius: 12, padding: '8px 16px', fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
          }}
        >+ Добавить</button>
      </div>

      {/* Переключатель месяца */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '16px 16px 8px' }}>
        <button
          onClick={() => setMonth(m => m === 1 ? 12 : m - 1)}
          style={{ width: 36, height: 36, borderRadius: '50%', background: inputBg, border: 'none', fontSize: 20, color: textPri, cursor: 'pointer' }}
        >‹</button>
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 130, textAlign: 'center' }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={() => setMonth(m => m === 12 ? 1 : m + 1)}
          style={{ width: 36, height: 36, borderRadius: '50%', background: inputBg, border: 'none', fontSize: 20, color: textPri, cursor: 'pointer' }}
        >›</button>
      </div>

      {/* Карточка итого */}
      {summary && (
        <div style={{
          margin: '8px 16px', padding: 16,
          background: isDark ? 'rgba(220,50,50,0.15)' : 'rgba(220,50,50,0.08)',
          border: '1px solid rgba(220,50,50,0.3)', borderRadius: 20,
        }}>
          <p style={{ fontSize: 13, color: textSec, marginBottom: 4 }}>Итого за месяц</p>
          <p style={{ fontSize: 30, fontWeight: 800, color: '#e05555', margin: 0 }}>{fmt(summary.total)} сум</p>

          {summary.by_category.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {summary.by_category.map(item => (
                <div key={item.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, color: textSec }}>
                    <span>{CATEGORY_EMOJI[item.category] ?? '📌'} {item.category}</span>
                    <span>{fmt(item.amount)}</span>
                  </div>
                  <div style={{ height: 6, background: border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, background: '#e05555',
                      width: `${(item.amount / maxAmount) * 100}%`,
                      transition: 'width 0.5s',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Фильтр по категории */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 4px', overflowX: 'auto' }}>
        {['', ...CATEGORIES].map(cat => (
          <button
            key={cat || 'all'}
            onClick={() => setFilterCat(cat)}
            style={{
              flexShrink: 0, fontSize: 13, padding: '6px 14px', borderRadius: 20, border: 'none',
              cursor: 'pointer', fontWeight: filterCat === cat ? 700 : 400,
              background: filterCat === cat ? '#2481cc' : inputBg,
              color: filterCat === cat ? '#fff' : textPri,
            }}
          >
            {cat ? `${CATEGORY_EMOJI[cat]} ${cat}` : 'Все'}
          </button>
        ))}
      </div>

      {/* Список */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: textSec }}>Загрузка...</div>
        )}
        {!loading && expenses.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: textSec }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💸</div>
            <div>Расходов нет</div>
          </div>
        )}
        {expenses.map(exp => (
          <div key={exp.id} style={{
            background: surface, border: `1px solid ${border}`,
            borderRadius: 16, padding: '14px 16px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 28 }}>{CATEGORY_EMOJI[exp.category] ?? '📌'}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{exp.category}</div>
                {exp.description && (
                  <div style={{ fontSize: 13, color: textSec, marginTop: 2 }}>{exp.description}</div>
                )}
                <div style={{ fontSize: 11, color: textSec, marginTop: 4 }}>
                  {new Date(exp.date).toLocaleDateString('ru-RU')}
                  {exp.creator_name ? ` · ${exp.creator_name}` : ''}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, color: '#e05555' }}>−{fmt(exp.amount)}</div>
              <button
                onClick={() => setConfirmDelete(exp.id)}
                style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', marginTop: 4, opacity: 0.4 }}
              >🗑</button>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Drawer: форма добавления ───────────────────────────────────── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {/* Затемнение */}
          <div
            onClick={() => setShowForm(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          />
          {/* Панель */}
          <div style={{
            position: 'relative', background: surface,
            borderRadius: '24px 24px 0 0', padding: 24,
            display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
          }}>
            {/* Ручка */}
            <div style={{ width: 40, height: 4, background: border, borderRadius: 2, margin: '0 auto -8px' }} />
            <h2 style={{ textAlign: 'center', fontSize: 17, fontWeight: 700, margin: 0, color: textPri }}>
              Новый расход
            </h2>

            {/* Сумма */}
            <div>
              <label style={{ fontSize: 13, color: textSec, display: 'block', marginBottom: 6 }}>Сумма (сум)</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: inputBg, border: `1px solid ${border}`,
                  borderRadius: 12, padding: '12px 16px',
                  fontSize: 20, fontWeight: 700, color: textPri,
                  outline: 'none',
                }}
              />
            </div>

            {/* Категория */}
            <div>
              <label style={{ fontSize: 13, color: textSec, display: 'block', marginBottom: 8 }}>Категория</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFormCategory(cat)}
                    style={{
                      padding: '10px 4px', borderRadius: 12, border: 'none',
                      cursor: 'pointer', textAlign: 'center', fontSize: 11,
                      fontWeight: formCategory === cat ? 700 : 400,
                      background: formCategory === cat ? '#2481cc' : inputBg,
                      color: formCategory === cat ? '#fff' : textPri,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{CATEGORY_EMOJI[cat]}</div>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Комментарий */}
            <div>
              <label style={{ fontSize: 13, color: textSec, display: 'block', marginBottom: 6 }}>Комментарий (необязательно)</label>
              <input
                type="text"
                placeholder="Например: Аренда за март"
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: inputBg, border: `1px solid ${border}`,
                  borderRadius: 12, padding: '12px 16px',
                  fontSize: 15, color: textPri, outline: 'none',
                }}
              />
            </div>

            {/* Дата */}
            <div>
              <label style={{ fontSize: 13, color: textSec, display: 'block', marginBottom: 6 }}>Дата</label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: inputBg, border: `1px solid ${border}`,
                  borderRadius: 12, padding: '12px 16px',
                  fontSize: 15, color: textPri, outline: 'none',
                }}
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={saving || !formAmount}
              style={{
                width: '100%', background: saving || !formAmount ? '#555' : '#2481cc',
                color: '#fff', border: 'none', borderRadius: 16,
                padding: '16px', fontSize: 16, fontWeight: 700,
                cursor: saving || !formAmount ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Сохранение...' : '💾 Сохранить'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Модалка удаления ───────────────────────────────────────────── */}
      {confirmDelete !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div
            onClick={() => setConfirmDelete(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'relative', background: surface,
            borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🗑️</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: textPri, marginBottom: 6 }}>Удалить расход?</div>
            <div style={{ fontSize: 13, color: textSec, marginBottom: 20 }}>Это действие нельзя отменить</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, background: inputBg, border: 'none', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, color: textPri, cursor: 'pointer' }}
              >Отмена</button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                style={{ flex: 1, background: '#cc3333', border: 'none', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
              >Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}