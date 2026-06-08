import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Flame,
  Layers3,
  PieChart,
  Target,
  TrendingUp,
} from 'lucide-react'
import { todayKey } from '../data.js'
import { isCardDue, isNewCard } from '../lib/browseUtils.js'
import { getDeckPath, sortDecksByPath } from '../lib/deckUtils.js'
import Shell from './Shell.jsx'
import LearningOverviewPanel from './LearningOverviewPanel.jsx'
import StudyMonthHeatmap from './StudyMonthHeatmap.jsx'

function toLocalDateKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateKey, offset) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + offset)
  return toLocalDateKey(date)
}

function isWeakCard(card) {
  const grade = Number(card?.review?.lastGrade)
  return Boolean(
    card?.flagged ||
    card?.flagColor ||
    Number(card?.review?.lapses ?? 0) > 0 ||
    grade === 0 ||
    grade === 1
  )
}

function isMasteredCard(card) {
  return !isCardDue(card) && !isWeakCard(card) && Number(card?.review?.reps ?? 0) > 0 && Number(card?.review?.interval ?? 0) >= 7
}

function percent(value, total) {
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)))
}

function getHeatLevelClass(count) {
  if (!count) return 'bg-gray-100'
  if (count < 5) return 'bg-green-100'
  if (count < 15) return 'bg-green-300'
  return 'bg-green-500'
}

function StatCard({ icon: Icon, label, value, hint, tone = 'bg-white' }) {
  return (
    <div className={`rounded-2xl border border-white p-4 shadow-sm ${tone}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-black text-gray-400">{label}</span>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/80 text-gray-500">
          <Icon size={17} />
        </span>
      </div>
      <p className="text-3xl font-black text-gray-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-gray-400">{hint}</p>
    </div>
  )
}

function BarRow({ label, subLabel, value, maxValue, tone = 'bg-blue-500', onClick }) {
  const width = maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 100)) : 0
  return (
    <button type="button" onClick={onClick} className="group w-full rounded-xl px-2 py-2 text-left hover:bg-gray-50">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black">
        <span className="min-w-0 truncate text-gray-700">{label}</span>
        <span className="text-gray-400">{value}</span>
      </div>
      {subLabel && <p className="mb-1 truncate text-[10px] font-bold text-gray-300">{subLabel}</p>}
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </button>
  )
}

function Donut({ segments, centerLabel, centerValue }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0) || 1
  let offset = 25
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative mx-auto h-32 w-32 shrink-0">
        <svg viewBox="0 0 42 42" className="h-32 w-32 -rotate-90">
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#eef2f7" strokeWidth="7" />
          {segments.map((item) => {
            const length = (item.value / total) * 100
            const circle = (
              <circle
                key={item.label}
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke={item.color}
                strokeWidth="7"
                strokeDasharray={`${length} ${100 - length}`}
                strokeDashoffset={offset}
              />
            )
            offset -= length
            return circle
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[10px] font-black text-gray-300">{centerLabel}</p>
            <p className="text-xl font-black text-gray-950">{centerValue}</p>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {segments.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-xs font-black">
            <span className="flex items-center gap-2 text-gray-600">
              <i className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
            <span className="text-gray-400">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildDeckRows(decks, cards) {
  const map = new Map()
  for (const deck of decks) {
    map.set(deck.id, {
      ...deck,
      total: 0,
      due: 0,
      weak: 0,
      newCount: 0,
      mastered: 0,
      pressure: 0,
    })
  }

  for (const card of cards) {
    const row = map.get(card.deckId)
    if (!row) continue
    row.total += 1
    if (isCardDue(card)) row.due += 1
    if (isWeakCard(card)) row.weak += 1
    if (isNewCard(card)) row.newCount += 1
    if (isMasteredCard(card)) row.mastered += 1
  }

  return sortDecksByPath(Array.from(map.values())).map((row) => ({
    ...row,
    pressure: row.due * 3 + row.weak * 2 + row.newCount,
  })).filter((row) => row.total > 0)
}

function groupPressureRows(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const path = getDeckPath(row) || row.name
    const key = path || row.id
    const current = grouped.get(key)
    if (current) {
      current.total += row.total
      current.due += row.due
      current.weak += row.weak
      current.newCount += row.newCount
      current.mastered += row.mastered
      current.pressure += row.pressure
      current.deckIds.push(row.id)
    } else {
      grouped.set(key, {
        id: key,
        name: row.name,
        path,
        total: row.total,
        due: row.due,
        weak: row.weak,
        newCount: row.newCount,
        mastered: row.mastered,
        pressure: row.pressure,
        deckIds: [row.id],
      })
    }
  }
  return Array.from(grouped.values()).sort((a, b) => b.pressure - a.pressure)
}

function Dashboard({ data, onOpenCreateDeck, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const [tableOpen, setTableOpen] = useState(false)
  const [trendRange, setTrendRange] = useState('7')
  const today = todayKey()
  const cards = Array.isArray(data?.cards) ? data.cards : []
  const decks = Array.isArray(data?.decks) ? data.decks : []
  const reviewLogs = Array.isArray(data?.reviewLogs) ? data.reviewLogs : []

  const rows = useMemo(() => buildDeckRows(decks, cards), [cards, decks])
  const dueCards = useMemo(() => cards.filter(isCardDue), [cards])
  const weakCards = useMemo(() => cards.filter(isWeakCard), [cards])
  const newCards = useMemo(() => cards.filter(isNewCard), [cards])
  const masteredCards = useMemo(() => cards.filter(isMasteredCard), [cards])
  const reviewedToday = useMemo(() => reviewLogs.filter((log) => toLocalDateKey(log.reviewedAt) === today), [reviewLogs, today])

  const last7 = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, index - 6)), [today])
  const trend = useMemo(() => last7.map((date) => ({
    date,
    count: reviewLogs.filter((log) => toLocalDateKey(log.reviewedAt) === date).length,
  })), [last7, reviewLogs])
  const trend35 = useMemo(() => Array.from({ length: 35 }, (_, index) => addDays(today, index - 34)).map((date) => ({
    date,
    count: reviewLogs.filter((log) => toLocalDateKey(log.reviewedAt) === date).length,
  })), [reviewLogs, today])
  const activeTrend = trendRange === '35' ? trend35 : trend
  const maxActiveTrend = Math.max(1, ...activeTrend.map((item) => item.count))
  const activeTrendTotal = activeTrend.reduce((sum, item) => sum + item.count, 0)
  const activeTrendAvg = activeTrend.length ? Math.round((activeTrendTotal / activeTrend.length) * 10) / 10 : 0
  const activeTrendPeak = Math.max(0, ...activeTrend.map((item) => item.count))
  const weeklyTotal = trend.reduce((sum, item) => sum + item.count, 0)
  const weeklyTarget = Math.max(7, dueCards.length + reviewedToday.length)
  const completionRate = percent(reviewedToday.length, dueCards.length + reviewedToday.length)
  const masteryRate = percent(masteredCards.length, cards.length)
  const pressureRows = useMemo(() => groupPressureRows(rows).slice(0, 8), [rows])
  const maxPressure = Math.max(1, ...pressureRows.map((row) => row.pressure))
  const topWeakRows = useMemo(() => groupPressureRows(rows).filter((row) => row.weak > 0).slice(0, 5), [rows])
  const weakRate = percent(weakCards.length, cards.length)

  const diagnosis = []
  if (weakCards.length > cards.length * 0.35) diagnosis.push('薄弱卡占比偏高，今天优先回收薄弱点。')
  if (newCards.length > cards.length * 0.45) diagnosis.push('新卡池很大，建议先复盘旧卡再新增。')
  if (dueCards.length > 0) diagnosis.push(`今天有 ${dueCards.length} 张到期卡，先清到期更稳。`)
  if (!diagnosis.length) diagnosis.push('当前负载较稳，可以推进少量新卡。')

  const primaryDiagnosis = weakCards.length > cards.length * 0.35
    ? `薄弱卡占比 ${weakRate}%，建议先回收高压卡组。`
    : dueCards.length > 0
      ? `今天有 ${dueCards.length} 张到期卡，先清到期。`
      : '当前学习负载较稳，可以保持节奏。'

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId} wide>
      <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-[0.22em] text-blue-600">learning diagnosis</p>
          <h1 className="text-2xl font-black text-gray-950">学习诊断中心</h1>
          <p className="mt-1 text-sm text-gray-500">{primaryDiagnosis}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onOpenCreateDeck?.()} className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">新建卡组</button>
          <button type="button" onClick={() => studyDeckId && navigate(`/study/${studyDeckId}`)} className="h-10 rounded-xl bg-[#007aff] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={!studyDeckId}>开始学习</button>
        </div>
      </header>

      <section className="mb-5 rounded-[28px] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-blue-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">today diagnosis</p>
            <h2 className="mt-1 text-xl font-black text-gray-950">{primaryDiagnosis}</h2>
            <p className="mt-2 text-sm font-bold text-gray-500">建议顺序：清到期 → 回收薄弱 → 少量新卡。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => weakCards[0]?.deckId && navigate(`/study/${weakCards[0].deckId}`)} disabled={!weakCards.length} className="h-10 rounded-xl bg-orange-500 px-4 text-sm font-black text-white shadow-sm hover:bg-orange-600 disabled:bg-gray-300">开始薄弱回收</button>
            <button type="button" onClick={() => navigate('/map')} className="h-10 rounded-xl bg-white px-4 text-sm font-black text-blue-600 shadow-sm hover:bg-blue-50">进入知识拼图</button>
          </div>
        </div>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard icon={Target} label="今日待复习" value={dueCards.length} hint="先清到期" tone="bg-red-50/80" />
        <StatCard icon={CheckCircle2} label="今日已完成" value={reviewedToday.length} hint={`清空率 ${completionRate}%`} tone="bg-green-50/80" />
        <StatCard icon={AlertTriangle} label="薄弱卡" value={weakCards.length} hint={`占比 ${weakRate}%`} tone="bg-orange-50/80" />
        <StatCard icon={Layers3} label="新卡池" value={newCards.length} hint="谨慎新增" tone="bg-blue-50/80" />
        <StatCard icon={Flame} label="本周完成" value={weeklyTotal} hint={`目标参考 ${weeklyTarget}`} />
        <StatCard icon={TrendingUp} label="掌握率" value={`${masteryRate}%`} hint={`${masteredCards.length}/${cards.length}`} />
      </section>

      <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-950">学习趋势</h2>
              <p className="text-xs font-bold text-gray-400">7 天 / 35 天共用一个区域，全部来自真实复习记录。</p>
            </div>
            <div className="flex items-center gap-2">
              {[
                { value: '7', label: '7天' },
                { value: '35', label: '35天' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTrendRange(option.value)}
                  className={`h-8 rounded-xl px-3 text-xs font-black transition ${trendRange === option.value ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                >
                  {option.label}
                </button>
              ))}
              <Activity size={18} className="text-blue-500" />
            </div>
          </div>

          <div className="rounded-[24px] bg-gradient-to-b from-gray-50 to-white p-4 ring-1 ring-gray-100">
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                <p className="text-[10px] font-black text-gray-300">合计</p>
                <p className="mt-0.5 text-lg font-black text-gray-950">{activeTrendTotal}</p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                <p className="text-[10px] font-black text-gray-300">日均</p>
                <p className="mt-0.5 text-lg font-black text-gray-950">{activeTrendAvg}</p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                <p className="text-[10px] font-black text-gray-300">峰值</p>
                <p className="mt-0.5 text-lg font-black text-gray-950">{activeTrendPeak}</p>
              </div>
            </div>
            {trendRange === '35' ? (
              <div>
                <div className="grid grid-cols-7 gap-2 rounded-2xl bg-white/70 p-3 ring-1 ring-gray-100">
                  {activeTrend.map((item) => (
                    <div
                      key={item.date}
                      title={`${item.date}：${item.count} 张`}
                      className={`aspect-square rounded-lg transition hover:scale-110 ${getHeatLevelClass(item.count)}`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-end gap-1 text-[10px] font-black text-gray-300">
                  少 <span className="h-3 w-3 rounded bg-gray-100" /><span className="h-3 w-3 rounded bg-green-100" /><span className="h-3 w-3 rounded bg-green-300" /><span className="h-3 w-3 rounded bg-green-500" /> 多
                </div>
              </div>
            ) : (
              <div className="flex h-48 items-end gap-3">
                {activeTrend.map((item, index) => {
                  const height = item.count ? Math.max(12, (item.count / maxActiveTrend) * 100) : 4
                  const showLabel = index === 0 || index === activeTrend.length - 1 || index % 7 === 0
                  return (
                    <div key={item.date} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2 text-center" title={`${item.date}：${item.count} 张`}>
                      <div
                        className={`mx-auto w-full rounded-t-2xl transition-all ${item.count ? 'bg-gradient-to-t from-blue-500 to-blue-400 shadow-sm' : 'bg-gray-200/70'}`}
                        style={{ height: `${height}%`, opacity: item.count ? 0.95 : 0.45 }}
                      />
                      <span className={`text-[10px] font-black text-gray-400 ${showLabel ? '' : 'opacity-0'}`}>{item.date.slice(5)}</span>
                      <span className="text-xs font-black text-gray-700">{item.count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-950">卡片状态分布</h2>
              <p className="text-xs font-bold text-gray-400">一眼看出结构是否健康。</p>
            </div>
            <PieChart size={18} className="text-blue-500" />
          </div>
          <Donut
            centerLabel="薄弱占比"
            centerValue={`${weakRate}%`}
            segments={[
              { label: '新卡', value: newCards.length, color: '#0b8cff' },
              { label: '到期', value: dueCards.length, color: '#ff4d4f' },
              { label: '薄弱', value: weakCards.length, color: '#ffb020' },
              { label: '已掌握', value: masteredCards.length, color: '#20c997' },
            ]}
          />
        </div>
      </section>

      <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-950">卡组压力排行</h2>
              <p className="text-xs font-bold text-gray-400">已合并同路径重复项，综合到期、薄弱、新卡计算。</p>
            </div>
            <BarChart3 size={18} className="text-blue-500" />
          </div>
          <div className="space-y-1">
            {pressureRows.map((row) => (
              <BarRow
                key={row.id}
                label={row.name}
                subLabel={row.path}
                value={row.pressure}
                maxValue={maxPressure}
                tone="bg-orange-500"
                onClick={() => row.deckIds[0] && navigate('/browse', { state: { deckId: row.deckIds[0] } })}
              />
            ))}
            {pressureRows.length === 0 && <p className="py-12 text-center text-sm font-bold text-gray-400">暂无卡组数据</p>}
          </div>
        </div>

        <aside className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-black text-gray-950">今日诊断</h2>
          <div className="space-y-2">
            {diagnosis.map((item) => (
              <p key={item} className="rounded-xl bg-gray-50 px-3 py-2 text-sm font-bold leading-6 text-gray-600">{item}</p>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={() => weakCards[0]?.deckId && navigate(`/study/${weakCards[0].deckId}`)} disabled={!weakCards.length} className="h-10 rounded-xl bg-orange-50 text-sm font-black text-orange-600 hover:bg-orange-100 disabled:text-gray-300">开始薄弱复盘</button>
            <button type="button" onClick={() => navigate('/map')} className="h-10 rounded-xl bg-blue-50 text-sm font-black text-blue-600 hover:bg-blue-100">打开知识拼图</button>
            <button type="button" onClick={() => navigate('/browse')} className="h-10 rounded-xl bg-gray-100 text-sm font-black text-gray-600 hover:bg-gray-200">查看全部卡片</button>
          </div>
        </aside>
      </section>

      <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <StudyMonthHeatmap data={data} title="学习月历" />

        <div className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-black text-gray-950">薄弱来源 Top 5</h2>
          <div className="space-y-2">
            {topWeakRows.map((row, index) => (
              <button key={row.id} type="button" onClick={() => row.deckIds[0] && navigate('/browse', { state: { deckId: row.deckIds[0] } })} className="flex w-full items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-3 text-left hover:bg-orange-50">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-2xl border border-orange-100 bg-orange-50 text-xs font-black text-orange-600">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-black text-gray-900">{row.name}</strong>
                  <em className="block truncate text-[10px] font-bold not-italic text-gray-300">{row.path}</em>
                </span>
                <span className="text-xs font-black text-orange-500">薄弱 {row.weak}</span>
              </button>
            ))}
            {topWeakRows.length === 0 && <p className="rounded-xl bg-gray-50 py-8 text-center text-sm font-bold text-gray-400">暂无薄弱卡组</p>}
          </div>
        </div>
      </section>

      <section className="mb-5">
        <LearningOverviewPanel data={data} />
      </section>

      <section className="rounded-2xl border border-white bg-white/90 shadow-sm">
        <button type="button" onClick={() => setTableOpen((value) => !value)} className="flex h-12 w-full items-center justify-between px-5 text-left">
          <span className="text-sm font-black text-gray-950">展开详细数据</span>
          <ChevronDown size={16} className={`text-gray-400 transition ${tableOpen ? 'rotate-180' : ''}`} />
        </button>
        {tableOpen && (
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-bold">卡组</th>
                  <th className="px-4 py-2 text-right font-bold">新卡</th>
                  <th className="px-4 py-2 text-right font-bold">到期</th>
                  <th className="px-4 py-2 text-right font-bold">薄弱</th>
                  <th className="px-4 py-2 text-right font-bold">总数</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <strong className="block font-bold text-gray-900">{row.name}</strong>
                      <span className="text-[11px] font-bold text-gray-400">{getDeckPath(row)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">{row.newCount}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{row.due}</td>
                    <td className="px-4 py-3 text-right font-bold text-orange-600">{row.weak}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-700">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Shell>
  )
}

export default Dashboard
