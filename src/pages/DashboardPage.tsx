import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../contexts/AuthContext'
import { unitDisplay } from './sales/unitHelpers'

interface PeriodStats {
  sales_count: number; revenue: number; paid: number
  debt_new: number; margin: number; margin_percent: number
  expenses: number; returns: number; net_profit: number
}
interface DashboardData {
  today: PeriodStats; week: PeriodStats; month: PeriodStats
  top_products: { name: string; total_qty: number; total_revenue: number; unit: string; unit_value: number | null }[]
  top_debtors: { id: number; name: string; phone: string; total_debt: number; total_purchases: number }[]
  low_stock_count: number
  low_stock_items: { name: string; current_stock: number; min_stock: number; unit: string; unit_value: number | null }[]
  expenses_by_category: { category: string; total: number }[]
  recent_returns: { id: number; product_name: string; customer_name: string; quantity: number; return_amount: number; reason: string | null; created_at: string; unit: string; unit_value: number | null }[]
  seller_stats: { name: string; sales_count: number; revenue: number; paid: number; debt: number }[]
  cash_by_type: Record<string, { total: number; count: number }>
  returns_month_total: number
  cash_alltime: number
  total_customer_debt: number
  stock_value: number
}
type Period = 'today' | 'week' | 'month'

const PAYMENT_LABELS: Record<string, string> = { cash: '💵 Наличные', card: '💳 Карта', transfer: '📲 Перевод' }
const PAYMENT_COLORS: Record<string, string> = { cash: '#34c759', card: '#2481cc', transfer: '#7a3b8c' }
const EXPENSE_COLORS = ['#e05555','#e08030','#e0a030','#7a3b8c','#2481cc','#1a6b3c','#888','#bbb']

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}М` :
  n >= 1_000 ? `${(n/1_000).toFixed(0)}К` : String(Math.round(n))

// ── SVG Donut ────────────────────────────────────────────────────────────────
function DonutChart({ segments, size = 80 }: { segments: { value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, g) => s + g.value, 0)
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: '#e8eaed' }} />
  const r = size / 2 - 9; const cx = size / 2
  const paths = segments.reduce<{ d: string; color: string; endAngle: number }[]>((acc, seg) => {
    const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : -90
    const pct = seg.value / total
    const a1 = startAngle * Math.PI / 180
    const a2 = (startAngle + pct * 360 - 0.5) * Math.PI / 180
    const x1 = cx + r * Math.cos(a1); const y1 = cx + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2); const y2 = cx + r * Math.sin(a2)
    return [...acc, { d: `M ${x1} ${y1} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2} ${y2}`, color: seg.color, endAngle: startAngle + pct * 360 }]
  }, [])
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      {paths.map((p, i) => <path key={i} d={p.d} stroke={p.color} strokeWidth={11} fill="none" strokeLinecap="butt" />)}
    </svg>
  )
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ height: 4, background: 'rgba(128,128,128,0.15)', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ width: `${max > 0 ? Math.max(3, value/max*100) : 0}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s' }} />
    </div>
  )
}

export default function DashboardPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const tg = window.Telegram?.WebApp
  const isDark = tg?.colorScheme === 'dark'

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('today')
  const [exportDays, setExportDays] = useState(30)
  const [exporting, setExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState('')
  const [importResult, setImportResult] = useState('')
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const isMobileTg = !!(tg && (tg as unknown as { platform?: string }).platform &&
    !['macos', 'tdesktop', 'web'].includes((tg as unknown as { platform?: string }).platform ?? ''))

  useEffect(() => {
    let cancelled = false
    api.get('/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!cancelled) { setData(r.data); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])


  const handleReset = async () => {
    setResetting(true)
    try {
      await api.post('/export/reset', {}, { headers: { Authorization: `Bearer ${token}` } })
      setConfirmReset(false)
      navigate('/')  // не reload — чтобы не потерять токен
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setImportResult(`❌ ${e?.response?.data?.detail || 'Ошибка сброса'}`)
    }
    setResetting(false)
  }

  const handleDbBackup = async () => {
    setBackingUp(true)
    try {
      const res = await api.get('/export/db-backup', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `tradi_backup_${new Date().toISOString().slice(0,10)}.sql`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setImportResult('❌ Ошибка создания бэкапа')
    }
    setBackingUp(false)
  }

  const handleDbRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoring(true)
    setImportResult('')
    try {
      const form = new FormData()
      form.append('file', file)
      await api.post('/export/db-restore', form, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setImportResult('✅ БД восстановлена! Перезайдите в приложение.')
      setTimeout(() => navigate('/'), 3000)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setImportResult(`❌ ${e?.response?.data?.detail || 'Ошибка восстановления'}`)
    }
    setRestoring(false)
    e.target.value = ''
  }

  const handleExport = async () => {
    setExporting(true); setExportSuccess('')
    try {
      if (isMobileTg) {
        await api.get(`/export/send?days=${exportDays}`, { headers: { Authorization: `Bearer ${token}` } })
        setExportSuccess('✅ Файл отправлен в Telegram!')
        setTimeout(() => setExportSuccess(''), 4000)
      } else {
        const res = await api.get(`/export?days=${exportDays}`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' })
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const a = document.createElement('a'); a.href = url
        a.download = `trade_report_${new Date().toISOString().slice(0,10)}.xlsx`; a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch { /* silent */ }
    setExporting(false)
  }

  const bg = isDark ? '#1a1a1a' : '#f0f2f5'
  const card = isDark ? '#242424' : '#ffffff'
  const text = isDark ? '#ffffff' : '#1a1a1a'
  const muted = isDark ? '#666' : '#999'
  const border = isDark ? '#333' : '#e8eaed'
  const stats = data?.[period]
  const maxExpense = data?.expenses_by_category[0]?.total ?? 1
  const cashTotal = Object.values(data?.cash_by_type ?? {}).reduce((s, x) => s + x.total, 0)

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', flexDirection: 'column', paddingBottom: 32 }}>

      <div style={{ background: card, padding: '14px 16px 10px', boxShadow: `0 1px 0 ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={() => navigate('/')} style={{ background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 10, width: 34, height: 34, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>←</button>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: text }}>📊 Дашборд</div>
          {(data?.low_stock_count ?? 0) > 0 && (
            <div style={{ background: '#ff3b30', borderRadius: 10, padding: '3px 8px', fontSize: 12, color: '#fff', fontWeight: 700 }}>⚠️ {data!.low_stock_count}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, background: isDark ? '#333' : '#f0f2f5', borderRadius: 10, padding: 3 }}>
          {(['today', 'week', 'month'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              flex: 1, border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: period === p ? card : 'transparent', color: period === p ? text : muted,
              boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.15s',
            }}>{p === 'today' ? 'Сегодня' : p === 'week' ? 'Неделя' : 'Месяц'}</button>
          ))}
        </div>
      </div>

      {loading || !data || !stats ? (
        <div style={{ textAlign: 'center', padding: 60, color: muted }}><div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>{loading ? 'Загрузка...' : 'Нет данных'}</div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Основные метрики ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Продажи', value: String(stats.sales_count), unit: 'шт', color: '#2481cc', icon: '🧾' },
              { label: 'Выручка', value: fmt(stats.revenue), unit: 'сум', color: '#1a6b3c', icon: '💰' },
              { label: 'Маржа', value: fmt(stats.margin), unit: `сум · ${stats.margin_percent}%`, color: '#34c759', icon: '📈' },
              { label: 'Новый долг', value: fmt(stats.debt_new), unit: 'сум', color: stats.debt_new > 0 ? '#ff3b30' : '#34c759', icon: '⏳' },
            ].map(s => (
              <div key={s.label} style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: muted, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 18 }}>{s.icon}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{s.unit}</div>
              </div>
            ))}
          </div>

          {/* ── Чистая прибыль ── */}
          <div style={{
            background: stats.net_profit >= 0 ? (isDark ? 'rgba(52,199,89,0.12)' : 'rgba(52,199,89,0.08)') : (isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.08)'),
            border: `1.5px solid ${stats.net_profit >= 0 ? '#34c75940' : '#ff3b3040'}`,
            borderRadius: 16, padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
          }}>
            {[
              { label: '💸 Расходы', value: `−${fmt(stats.expenses)}`, color: '#e05555' },
              { label: '↩️ Возвраты', value: `−${fmt(stats.returns)}`, color: '#e08030' },
              { label: '🏦 Чистая', value: `${stats.net_profit >= 0 ? '+' : ''}${fmt(stats.net_profit)}`, color: stats.net_profit >= 0 ? '#34c759' : '#ff3b30' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', borderLeft: i > 0 ? `1px solid ${border}` : 'none' }}>
                <div style={{ fontSize: 10, color: muted, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── Касса ── */}
          <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>💰 Касса за месяц</div>
            {Object.keys(data.cash_by_type).length > 0 ? (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <DonutChart size={86} segments={Object.entries(data.cash_by_type).map(([type, d]) => ({ value: d.total, color: PAYMENT_COLORS[type] || '#888' }))} />
                <div style={{ flex: 1 }}>
                  {Object.entries(data.cash_by_type).map(([type, d]) => (
                    <div key={type} style={{ marginBottom: 7 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: text }}>{PAYMENT_LABELS[type] || type}</span>
                        <span style={{ fontWeight: 700, color: PAYMENT_COLORS[type] || '#888' }}>{fmt(d.total)} сум</span>
                      </div>
                      <MiniBar value={d.total} max={cashTotal} color={PAYMENT_COLORS[type] || '#888'} />
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid ${border}`, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: muted }}>Итого получено</span>
                    <span style={{ fontWeight: 800, color: text }}>{fmt(cashTotal)} сум</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '8px 0 4px', fontSize: 13, color: muted }}>Нет активных продаж за месяц</div>
            )}
            {data.total_customer_debt > 0 && (
              <div style={{ marginTop: 8, background: '#ff3b3010', border: '1px solid #ff3b3025', borderRadius: 10, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: muted }}>⏳ В долгах у клиентов</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#ff3b30' }}>{fmt(data.total_customer_debt)} сум</span>
              </div>
            )}
            <div style={{ marginTop: 8, background: isDark ? '#1a2a1a' : '#f0faf4', border: '1px solid #34c75930', borderRadius: 10, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: muted }}>💼 Итого в кассе (всё время)</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#34c759' }}>{fmt(data.cash_alltime)} сум</span>
            </div>
          </div>

          {/* ── Заморожено в товарах (показываем всегда) ── */}
          {data.stock_value > 0 && (
            <div style={{ background: isDark ? '#1a1a2a' : '#f0f4ff', border: '1px solid #2481cc30', borderRadius: 16, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: muted }}>📦 Заморожено в товарах</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#2481cc' }}>{fmt(data.stock_value)} сум</span>
            </div>
          )}

          {/* ── По продавцам (месяц) ── */}
          {data.seller_stats.length > 0 && (
            <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>👤 По продавцам за месяц</div>
              {data.seller_stats.map((s, i) => (
                <div key={i} style={{ paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? `1px solid ${border}` : 'none', marginTop: i > 0 ? 10 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: text }}>{s.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a6b3c' }}>{fmt(s.revenue)} сум</span>
                  </div>
                  <MiniBar value={s.revenue} max={data.seller_stats[0].revenue} color="#1a6b3c" />
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: muted }}>{s.sales_count} прод.</span>
                    <span style={{ fontSize: 11, color: '#2481cc' }}>получено {fmt(s.paid)}</span>
                    {s.debt > 0 && <span style={{ fontSize: 11, color: '#ff3b30' }}>долг {fmt(s.debt)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Низкий остаток ── */}
          {data.low_stock_count > 0 && (
            <div style={{ background: '#ff3b3015', border: '1.5px solid #ff3b3030', borderRadius: 16, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ff3b30', marginBottom: 8 }}>⚠️ Мало на складе: {data.low_stock_count} поз.</div>
              {data.low_stock_items.map(item => (
                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: muted, paddingTop: 4 }}>
                  <span>{item.name}</span>
                  <span style={{ color: '#ff3b30', fontWeight: 600 }}>{unitDisplay(item.unit, item.unit_value, item.current_stock)} / {item.min_stock} {item.unit}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Расходы ── */}
          {data.expenses_by_category.length > 0 && (
            <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <DonutChart size={80} segments={data.expenses_by_category.map((e, i) => ({ value: e.total, color: EXPENSE_COLORS[i % 8] }))} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>💸 Расходы за месяц</div>
                  {data.expenses_by_category.map((e, i) => (
                    <div key={e.category} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: text }}>{e.category}</span>
                        <span style={{ fontWeight: 600, color: EXPENSE_COLORS[i % 8] }}>{fmt(e.total)}</span>
                      </div>
                      <MiniBar value={e.total} max={maxExpense} color={EXPENSE_COLORS[i % 8]} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Топ товаров ── */}
          {data.top_products.length > 0 && (
            <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>🏆 Топ товаров за месяц</div>
              {data.top_products.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? `1px solid ${border}` : 'none', marginTop: i > 0 ? 10 : 0 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: ['#ffd700','#c0c0c0','#cd7f32','#2481cc20','#2481cc20'][i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: i < 3 ? '#1a1a1a' : '#2481cc' }}>{i+1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: muted }}>{unitDisplay(p.unit, p.unit_value, p.total_qty)}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a6b3c', flexShrink: 0 }}>{fmt(p.total_revenue)} сум</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Должники ── */}
          {data.top_debtors.length > 0 && (
            <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>⏳ Должники</div>
              {data.top_debtors.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? `1px solid ${border}` : 'none', marginTop: i > 0 ? 10 : 0 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: text }}>{c.name}</div><div style={{ fontSize: 11, color: muted }}>{c.phone}</div></div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#ff3b30' }}>{fmt(c.total_debt)} сум</div>
                    <div style={{ fontSize: 10, color: muted }}>покупки: {fmt(c.total_purchases)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Возвраты ── */}
          {data.recent_returns.length > 0 && (
            <div style={{ background: card, borderRadius: 16, padding: '14px 16px', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>↩️ Последние возвраты</div>
              {data.recent_returns.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? `1px solid ${border}` : 'none', marginTop: i > 0 ? 10 : 0 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{r.product_name}</div>
                    <div style={{ fontSize: 11, color: muted }}>👤 {r.customer_name}{r.reason ? ` · ${r.reason}` : ''}</div>
                    <div style={{ fontSize: 11, color: muted }}>{new Date(r.created_at).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e08030' }}>−{fmt(r.return_amount)}</div>
                    <div style={{ fontSize: 11, color: muted }}>{unitDisplay(r.unit, r.unit_value, r.quantity)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Экспорт ── */}
          <div style={{ background: card, borderRadius: 16, padding: '16px', border: `1px solid ${border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>📥 Экспорт в Excel</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {([7, 30, 90] as const).map(d => (
                <button key={d} onClick={() => setExportDays(d)} style={{ flex: 1, border: `1.5px solid ${exportDays === d ? '#2481cc' : border}`, borderRadius: 10, padding: '7px 4px', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: exportDays === d ? '#2481cc20' : 'transparent', color: exportDays === d ? '#2481cc' : muted }}>
                  {d === 7 ? '7 дней' : d === 30 ? '30 дней' : '90 дней'}
                </button>
              ))}
            </div>
            {exportSuccess && <div style={{ background: '#34c75920', border: '1px solid #34c75940', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#34c759', fontWeight: 600, marginBottom: 10 }}>{exportSuccess}</div>}
            <button onClick={handleExport} disabled={exporting} style={{ width: '100%', background: exporting ? '#555' : 'linear-gradient(135deg, #1a6b3c, #2d9c5c)', border: 'none', borderRadius: 14, padding: 14, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {exporting ? '⏳ Формируем...' : isMobileTg ? '📲 Отправить в Telegram' : '📥 Скачать Excel'}
            </button>

            {/* Бэкап БД */}
            <div style={{ marginTop: 10, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: muted, marginBottom: 8, fontWeight: 600 }}>💾 Резервная копия базы данных</div>
              <div style={{ fontSize: 11, color: muted, marginBottom: 10 }}>
                Полный бэкап — вся история продаж, расходы, журнал, клиенты, товары.
              </div>
              <button onClick={handleDbBackup} disabled={backingUp} style={{
                width: '100%', background: isDark ? '#1a2a1a' : '#f0fff4',
                border: `1.5px solid #34c75940`, borderRadius: 12, padding: 11,
                color: '#34c759', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8,
              }}>
                {backingUp ? '⏳ Создаём бэкап...' : '💾 Скачать бэкап (.sql)'}
              </button>
              <label style={{
                display: 'block', background: isDark ? '#333' : '#f0f2f5',
                border: `1.5px dashed ${border}`, borderRadius: 12, padding: '11px 0',
                textAlign: 'center', fontSize: 13, fontWeight: 600, color: muted, cursor: 'pointer',
              }}>
                {restoring ? '⏳ Восстанавливаем...' : '♻️ Восстановить из .sql'}
                <input type="file" accept=".sql" style={{ display: 'none' }} onChange={handleDbRestore} disabled={restoring} />
              </label>
              {importResult && (
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: importResult.startsWith('✅') ? '#34c759' : '#ff3b30', padding: '8px 12px', background: importResult.startsWith('✅') ? '#34c75915' : '#ff3b3015', borderRadius: 10 }}>
                  {importResult}
                </div>
              )}
            </div>

            {/* Сброс */}
            <div style={{ marginTop: 10, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>⚠️ Сначала сделай экспорт, потом сбрасывай</div>
              {!confirmReset ? (
                <button onClick={() => setConfirmReset(true)} style={{ width: '100%', background: 'none', border: `1px solid #ff3b3040`, borderRadius: 12, padding: 11, color: '#ff3b30', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  🗑 Сбросить все данные (начать с нуля)
                </button>
              ) : (
                <div style={{ background: '#ff3b3015', border: '1px solid #ff3b3040', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ff3b30', marginBottom: 10, textAlign: 'center' }}>
                    Удалить все продажи, товары, клиентов?<br/>
                    <span style={{ fontSize: 11, fontWeight: 400 }}>Пользователи останутся. Это нельзя отменить.</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmReset(false)} style={{ flex: 1, background: isDark ? '#333' : '#f0f2f5', border: 'none', borderRadius: 10, padding: 11, color: muted, fontWeight: 600, cursor: 'pointer' }}>Отмена</button>
                    <button onClick={handleReset} disabled={resetting} style={{ flex: 2, background: '#ff3b30', border: 'none', borderRadius: 10, padding: 11, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                      {resetting ? '⏳ Сбрасываем...' : '🗑 Да, удалить всё'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}