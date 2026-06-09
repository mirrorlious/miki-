import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  BookOpen,
  ChevronRight,
  Flame,
  Plus,
  Sparkles,
  Target,
  Clock,
  Zap,
} from 'lucide-react'
import { todayKey } from '../data.js'
import { isCardDue, isNewCard } from '../lib/browseUtils.js'
import { getDeckPath, sortDecksByPath } from '../lib/deckUtils.js'
import { getActivity, getDailyLogs, getReviewLogs, toLocalDateKey } from '../lib/activity.js'
import Shell from './Shell.jsx'

function pad2(value) {
  return String(value).padStart(2, '0')
}

function addDays(dateKey, offset) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + offset)
  return toLocalDateKey(date)
}

function toMonthValue(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

function monthValueToDate(monthValue) {
  const [year, month] = String(monthValue || toMonthValue()).split('-').map(Number)
  return new Date(year || new Date().getFullYear(), Math.max(0, (month || 1) - 1), 1)
}

function shiftMonth(monthValue, offset) {
  const base = monthValueToDate(monthValue)
  base.setMonth(base.getMonth() + offset)
  return toMonthValue(base)
}

function getMonthDays(monthValue) {
  const [year, month] = String(monthValue || toMonthValue()).split('-').map(Number)
  const days = new Date(year, month, 0).getDate()
  return Array.from({ length: days }, (_, index) => {
    const day = index + 1
    return { key: `${year}-${pad2(month)}-${pad2(day)}`, day }
  })
}

function formatMonthLabel(monthValue) {
  const date = monthValueToDate(monthValue)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit' })
}

function isWeakCard(card) {
  if (Number(card?.review?.reps ?? 0) <= 0) return false
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

function formatMinutes(minutes = 0) {
  const value = Math.max(0, Math.round(Number(minutes) || 0))
  const h = Math.floor(value / 60)
  const m = value % 60
  if (h <= 0) return `${m}分`
  return `${h}:${pad2(m)}`
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

  return sortDecksByPath(Array.from(map.values()))
    .map((row) => ({ ...row, pressure: row.due * 3 + row.weak * 2 + row.newCount }))
    .filter((row) => row.total > 0)
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

function buildActivityMap(data) {
  const map = new Map()
  const ensure = (key) => {
    const current = map.get(key) ?? { cards: 0, reviews: 0, logs: 0, minutes: 0, sessions: 0 }
    map.set(key, current)
    return current
  }

  for (const card of Array.isArray(data?.cards) ? data.cards : []) {
    if (card.createdAt) ensure(toLocalDateKey(card.createdAt)).cards += 1
  }
  for (const log of getReviewLogs(data)) {
    if (log.reviewedAt) ensure(toLocalDateKey(log.reviewedAt)).reviews += 1
  }
  for (const log of getDailyLogs(data)) {
    if (log.date && log.content?.trim()) ensure(log.date).logs += 1
  }

  const activity = getActivity(data)
  for (const [key, seconds] of Object.entries(activity.dailySiteSeconds || {})) {
    ensure(key).minutes += Math.round((Number(seconds) || 0) / 60)
  }
  for (const item of activity.focusLog || []) {
    if (item?.startedAt) ensure(toLocalDateKey(item.startedAt)).sessions += 1
  }
  return map
}

function getActivityScore(activity) {
  // 学习强度只统计真正学习行为：复习、专注、日志、学习会话。
  // 批量导入 2000 张卡属于资料入库，不应该把趋势图画成“火箭发射”。
  const cards = Math.max(0, Number(activity?.cards) || 0)
  const reviews = Math.max(0, Number(activity?.reviews) || 0)
  const logs = Math.max(0, Number(activity?.logs) || 0)
  const minutes = Math.max(0, Number(activity?.minutes) || 0)
  const sessions = Math.max(0, Number(activity?.sessions) || 0)
  const hasStudySignal = reviews > 0 || minutes > 0 || logs > 0 || sessions > 0
  const newCardSignal = hasStudySignal ? Math.min(2, Math.log1p(Math.min(cards, 50)) * 0.35) : 0
  return Math.round(
    Math.min(30, Math.sqrt(reviews) * 4.2) +
    Math.min(28, minutes / 8) +
    Math.min(8, logs * 2.5) +
    Math.min(8, sessions * 1.5) +
    newCardSignal
  )
}


function heatCellClass(day, currentToday, activity) {
  const score = getActivityScore(activity)
  if (score <= 0) return day.key > currentToday ? 'bg-white ring-1 ring-slate-100' : 'bg-slate-100'
  if (score < 3) return 'bg-emerald-200'
  if (score < 7) return 'bg-emerald-300'
  if (score < 14) return 'bg-emerald-400'
  return 'bg-emerald-500'
}

function MetricCard({ icon: Icon, label, value, hint, tone = 'blue', watermark }) {
  const tones = {
    blue: ['bg-blue-50', 'text-[#007AFF]'],
    green: ['bg-emerald-50', 'text-[#34C759]'],
    orange: ['bg-orange-50', 'text-[#FF9500]'],
    purple: ['bg-indigo-50', 'text-[#5856D6]'],
  }
  const [iconBg, iconColor] = tones[tone] || tones.blue
  return (
    <div className="relative flex h-44 flex-col justify-between overflow-hidden rounded-[28px] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.025)]">
      <div className="relative z-10 flex items-start justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-full ${iconBg} ${iconColor}`}>
          <Icon size={20} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#86868B]">{label}</span>
      </div>
      <div className="relative z-10">
        <div className="text-5xl font-semibold tracking-tighter text-[#1D1D1F]">{value}</div>
        <p className="mt-1 text-sm font-semibold text-[#86868B]">{hint}</p>
      </div>
      {watermark && <Target size={132} className="absolute -bottom-8 -right-8 text-indigo-500/5" strokeWidth={1} />}
    </div>
  )
}

function makeSmoothPath(points, width = 100, height = 100) {
  if (!points.length) return ''
  if (points.length === 1) return `M0,${height - points[0]}`
  const step = width / (points.length - 1)
  const coordinates = points.map((value, index) => [index * step, height - value])
  let path = `M${coordinates[0][0]},${coordinates[0][1]}`
  for (let i = 1; i < coordinates.length; i += 1) {
    const [x0, y0] = coordinates[i - 1]
    const [x1, y1] = coordinates[i]
    const cp1x = x0 + step * 0.45
    const cp2x = x1 - step * 0.45
    path += ` C${cp1x},${y0} ${cp2x},${y1} ${x1},${y1}`
  }
  return path
}

function TrendView({ trend }) {
  const rawValues = trend.map((item) => Math.max(0, Number(item.value) || 0))
  const activeCount = rawValues.filter((value) => value > 0).length
  const hasActivity = activeCount > 0
  const maxValue = Math.max(1, ...rawValues)
  const normalized = rawValues.map((value) => (value <= 0 ? 0 : Math.log1p(value) / Math.log1p(maxValue)))
  const smoothed = normalized.map((value, index, list) => {
    const prev = list[index - 1] ?? value
    const next = list[index + 1] ?? value
    return prev * 0.22 + value * 0.56 + next * 0.22
  })
  // 学习日很少时，不把单日行为画成“火箭竖线”；只画成温和凸起。
  const yValues = smoothed.map((value, index) => {
    if (!hasActivity) return 80
    if (activeCount <= 1) {
      if (rawValues[index] > 0) return 58
      if ((rawValues[index - 1] ?? 0) > 0 || (rawValues[index + 1] ?? 0) > 0) return 72
      return 80
    }
    return 80 - value * 34
  })
  const line = makeSmoothPath(yValues.map((y) => 100 - y))
  const area = line ? `${line} L100,100 L0,100 Z` : 'M0,80 L100,80 L100,100 L0,100 Z'
  const firstLabel = trend[0]?.date?.slice(5) || ''
  const midLabel = trend[Math.floor(trend.length / 2)]?.date?.slice(5) || ''
  const lastY = yValues.at(-1) ?? 80

  return (
    <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-[28px] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">学习强度趋势</h2>
          <p className="mt-1 text-sm font-semibold text-[#86868B]">以复习、专注和日志为主，导入新卡只作轻量参考。</p>
        </div>
        <span className="rounded-full bg-[#F5F5F7] px-3 py-1.5 text-xs font-bold text-[#86868B]">14 天</span>
      </div>
      <div className="relative h-52 overflow-hidden rounded-[24px] bg-gradient-to-b from-white to-[#F5F9FF]">
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="mikiTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#007AFF" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#007AFF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#mikiTrendGradient)" />
          <path d={line || 'M0,88 C25,88 35,84 50,86 C70,88 82,82 100,84'} fill="none" stroke="#007AFF" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
          {hasActivity && <circle cx="100" cy={lastY} r="4.2" fill="white" stroke="#007AFF" strokeWidth="2.8" />}
        </svg>
        <div className="absolute bottom-2 left-0 flex w-full justify-between px-1 text-[11px] font-bold text-[#86868B]">
          <span>{firstLabel}</span>
          <span>{midLabel}</span>
          <span className="text-[#007AFF]">今日</span>
        </div>
      </div>
    </div>
  )
}


function HeatmapView({ selectedMonth, setSelectedMonth, monthDays, activityMap, currentToday, hoveredDay, setHoveredDay }) {
  const activeDays = monthDays.filter((day) => getActivityScore(activityMap.get(day.key)) > 0).length
  const openDateDetail = (dateKey) => window.open(`/focus-log?date=${encodeURIComponent(dateKey)}`, '_blank', 'noopener,noreferrer')
  return (
    <div className="relative min-h-[260px] flex-1 rounded-[28px] bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">月度热力图</h2>
          <p className="mt-1 text-sm font-semibold text-[#86868B]">默认当前月份，可点击日期查看当天记录。</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[#F5F5F7] p-1">
          <button type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, -1))} className="h-7 rounded-full px-3 text-xs font-bold text-[#86868B] hover:bg-white">上月</button>
          <label className="relative h-7 cursor-pointer rounded-full bg-white px-3 text-xs font-bold leading-7 text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            {formatMonthLabel(selectedMonth)} · {activeDays} 天
            <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value || toMonthValue())} className="absolute inset-0 cursor-pointer opacity-0" aria-label="选择月份" />
          </label>
          <button type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, 1))} className="h-7 rounded-full px-3 text-xs font-bold text-[#86868B] hover:bg-white">下月</button>
        </div>
      </div>
      <div className="overflow-visible rounded-[24px] bg-[#F5F5F7]/70 p-4">
        <div className="grid max-w-[420px] grid-cols-7 gap-2">
          {monthDays.map((day) => {
            const activity = activityMap.get(day.key) ?? { cards: 0, reviews: 0, logs: 0, minutes: 0, sessions: 0 }
            const isToday = day.key === currentToday
            return (
              <button
                key={day.key}
                type="button"
                onMouseEnter={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  setHoveredDay({ ...day, ...activity, x: rect.left + rect.width / 2, y: rect.top })
                }}
                onMouseLeave={() => setHoveredDay(null)}
                onClick={() => openDateDetail(day.key)}
                className={`h-8 rounded-[10px] transition hover:z-10 hover:scale-110 ${heatCellClass(day, currentToday, activity)} ${isToday ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}
                title={`${day.key}：复习 ${activity.reviews || 0}，新卡 ${activity.cards || 0}，专注 ${activity.minutes || 0} 分钟`}
              />
            )
          })}
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-[#86868B]">
          少 <span className="h-3 w-3 rounded bg-slate-100" /><span className="h-3 w-3 rounded bg-emerald-200" /><span className="h-3 w-3 rounded bg-emerald-300" /><span className="h-3 w-3 rounded bg-emerald-400" /><span className="h-3 w-3 rounded bg-emerald-500" /> 多
        </div>
      </div>
      {hoveredDay && (
        <div className="pointer-events-none fixed z-[9999] min-w-[150px] -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold leading-5 text-white shadow-2xl" style={{ left: hoveredDay.x, top: hoveredDay.y }}>
          <p className="font-black">{hoveredDay.key}</p>
          {hoveredDay.key > currentToday ? (
            <p className="text-white/70">还没到这一天</p>
          ) : getActivityScore(hoveredDay) > 0 ? (
            <>
              <p className="text-white/80">复习 {hoveredDay.reviews || 0} · 新卡 {hoveredDay.cards || 0}</p>
              <p className="text-white/80">日志 {hoveredDay.logs || 0} · 专注 {hoveredDay.minutes || 0} 分钟</p>
              <p className="text-white/80">打开学习 {hoveredDay.sessions || 0} 次</p>
            </>
          ) : (
            <p className="text-white/70">当天暂无记录</p>
          )}
          <p className="mt-1 text-[10px] text-white/45">点击查看当天详情</p>
        </div>
      )}
    </div>
  )
}

function PressurePanel({ rows, onOpen }) {
  const max = Math.max(1, ...rows.map((row) => row.pressure))
  const colors = ['bg-[#FF3B30]', 'bg-[#FF9500]', 'bg-[#FFCC00]', 'bg-[#34C759]', 'bg-[#5AC8FA]']
  return (
    <div className="rounded-[32px] bg-white p-7 shadow-[0_4px_24px_rgba(0,0,0,0.025)]">
      <h2 className="mb-6 text-xl font-semibold tracking-tight text-[#1D1D1F]">压力排行</h2>
      <div className="space-y-5">
        {rows.slice(0, 5).map((row, index) => {
          const width = Math.max(4, Math.round((row.pressure / max) * 100))
          return (
            <button key={row.id} type="button" onClick={() => onOpen(row)} className="group w-full text-left">
              <div className="mb-2 flex items-end justify-between gap-3">
                <span className="truncate text-[15px] font-semibold text-[#1D1D1F]">{row.name}</span>
                <span className="text-[15px] font-semibold text-[#86868B]">{row.pressure}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#F5F5F7]">
                <div className={`h-full rounded-full ${colors[index] || 'bg-[#007AFF]'}`} style={{ width: `${width}%` }} />
              </div>
            </button>
          )
        })}
        {!rows.length && <p className="rounded-2xl bg-[#F5F5F7] py-10 text-center text-sm font-bold text-[#86868B]">暂无卡组数据</p>}
      </div>
      <button type="button" onClick={() => onOpen(rows[0])} disabled={!rows.length} className="mt-6 flex w-full items-center justify-between py-1 text-[15px] font-semibold text-[#007AFF] disabled:text-[#86868B]">
        查看全部 <ChevronRight size={18} />
      </button>
    </div>
  )
}

function Dashboard({ data, onOpenCreateDeck, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const [visualPanel, setVisualPanel] = useState('trend')
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthValue())
  const [hoveredDay, setHoveredDay] = useState(null)
  const currentToday = todayKey()
  const cards = Array.isArray(data?.cards) ? data.cards : []
  const decks = Array.isArray(data?.decks) ? data.decks : []
  const reviewLogs = getReviewLogs(data)
  const activity = getActivity(data)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisualPanel((value) => value === 'trend' ? 'heatmap' : 'trend')
    }, 7000)
    return () => window.clearInterval(timer)
  }, [])

  const rows = useMemo(() => buildDeckRows(decks, cards), [cards, decks])
  const dueCards = useMemo(() => cards.filter(isCardDue), [cards])
  const weakCards = useMemo(() => cards.filter(isWeakCard), [cards])
  const newCards = useMemo(() => cards.filter(isNewCard), [cards])
  const masteredCards = useMemo(() => cards.filter(isMasteredCard), [cards])
  const reviewedToday = useMemo(() => reviewLogs.filter((log) => toLocalDateKey(log.reviewedAt) === currentToday), [reviewLogs, currentToday])
  const activityMap = useMemo(() => buildActivityMap(data), [data])
  const monthDays = useMemo(() => getMonthDays(selectedMonth), [selectedMonth])
  const trend = useMemo(() => Array.from({ length: 14 }, (_, index) => {
    const date = addDays(currentToday, index - 13)
    const daily = activityMap.get(date) ?? { cards: 0, reviews: 0, logs: 0, minutes: 0, sessions: 0 }
    return { date, value: getActivityScore(daily) }
  }), [activityMap, currentToday])

  const completionRate = percent(reviewedToday.length, dueCards.length + reviewedToday.length)
  const masteryRate = percent(masteredCards.length, cards.length)
  const todayMinutes = Math.round((Number(activity.dailySiteSeconds?.[currentToday]) || 0) / 60)
  const pressureRows = useMemo(() => groupPressureRows(rows), [rows])

  const diagnosis = dueCards.length === 0 && weakCards.length === 0
    ? '负载极轻。建议追加新卡片。'
    : dueCards.length > 0
      ? `今日有 ${dueCards.length} 张到期卡，先清到期。`
      : `薄弱回收池有 ${weakCards.length} 张，适合做一轮复盘。`

  const openPressureRow = (row) => {
    if (row?.deckIds?.[0]) navigate('/browse', { state: { deckId: row.deckIds[0] } })
    else navigate('/browse')
  }

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId} wide>
      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 pb-10 text-[#1D1D1F]">
        <section className="px-1 pt-2">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#007AFF]">
            <Sparkles size={16} /> 智能诊断
          </div>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-[#1D1D1F] md:text-5xl">
                {diagnosis.split('。')[0]}。<br className="hidden md:block" />{diagnosis.includes('建议') ? '建议追加新卡片。' : '保持节奏。'}
              </h1>
              <p className="mt-4 max-w-2xl text-lg font-medium leading-relaxed text-[#86868B]">
                今日到期、薄弱回收、掌握率和学习时长已汇总。页面减少盒中盒，保留真正有用的判断。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => navigate('/import')} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#007AFF] px-7 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,122,255,0.28)] hover:bg-blue-600">
                <Plus size={18} /> 获取新卡
              </button>
              <button type="button" onClick={() => weakCards[0]?.deckId ? navigate(`/study/${weakCards[0].deckId}`) : navigate('/browse')} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:bg-gray-50">
                <Activity size={18} className="text-[#86868B]" /> 薄弱复盘
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Activity} label="今日待复习" value={dueCards.length} hint={`清空率 ${completionRate}%`} tone="blue" />
          <MetricCard icon={BookOpen} label="新卡池余量" value={newCards.length.toLocaleString()} hint={newCards.length > 0 ? '建议适量追加' : '新卡池为空'} tone="green" />
          <MetricCard icon={Clock} label="今日专注" value={formatMinutes(todayMinutes)} hint={todayMinutes >= 120 ? '超过目标' : '继续补一点'} tone="orange" />
          <MetricCard icon={Target} label="全局掌握" value={`${masteryRate}%`} hint={`${masteredCards.length} / ${cards.length} 张`} tone="purple" watermark />
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-[32px] bg-white p-3 shadow-[0_4px_24px_rgba(0,0,0,0.025)]">
            <div className="mb-2 flex items-center justify-between px-4 pt-3">
              <div className="flex rounded-full bg-[#F5F5F7] p-1">
                <button type="button" onClick={() => setVisualPanel('trend')} className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${visualPanel === 'trend' ? 'bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : 'text-[#86868B]'}`}>学习强度</button>
                <button type="button" onClick={() => setVisualPanel('heatmap')} className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${visualPanel === 'heatmap' ? 'bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : 'text-[#86868B]'}`}>月度热力图</button>
              </div>
              <span className="text-[11px] font-bold text-[#86868B]">自动滑页</span>
            </div>
            {visualPanel === 'trend' ? (
              <TrendView trend={trend} />
            ) : (
              <HeatmapView selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} monthDays={monthDays} activityMap={activityMap} currentToday={currentToday} hoveredDay={hoveredDay} setHoveredDay={setHoveredDay} />
            )}
          </div>

          <PressurePanel rows={pressureRows} onOpen={openPressureRow} />
        </section>

        <section className="rounded-[32px] bg-white px-7 py-6 shadow-[0_4px_24px_rgba(0,0,0,0.025)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[#F5F5F7] text-[#1D1D1F]"><Flame size={20} /></div>
              <div>
                <h3 className="text-base font-semibold text-[#1D1D1F]">连续打卡</h3>
                <p className="mt-0.5 text-sm font-semibold text-[#86868B]">近期学习热度以圆点展示，颜色越深表示越高。</p>
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:justify-end md:pb-0">
              {trend.map((item, index) => {
                const level = Math.min(4, Math.max(0, Math.ceil(item.value / 4)))
                const classes = ['bg-[#E5E5EA]', 'bg-[#FF9500]/30', 'bg-[#FF9500]/50', 'bg-[#FF9500]/70', 'bg-[#FF3B30]']
                const isToday = index === trend.length - 1
                return <span key={item.date} title={`${item.date}：强度 ${item.value}`} className={`shrink-0 rounded-full ${isToday ? 'h-5 w-5 ring-4 ring-[#FF3B30]/20' : 'h-4 w-4'} ${classes[level]}`} />
              })}
            </div>
          </div>
        </section>
      </main>
    </Shell>
  )
}

export default Dashboard
