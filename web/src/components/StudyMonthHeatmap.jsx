import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { todayKey } from '../data.js'
import { getActivity, getDailyLogs, getReviewLogs, toLocalDateKey } from '../lib/activity.js'

function pad2(value) {
  return String(value).padStart(2, '0')
}

function getCurrentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

function getMonthDays(monthValue) {
  const [year, month] = String(monthValue || getCurrentMonthValue()).split('-').map(Number)
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear()
  const safeMonth = Number.isFinite(month) ? month : new Date().getMonth() + 1
  const days = new Date(safeYear, safeMonth, 0).getDate()
  return Array.from({ length: days }, (_, index) => {
    const day = index + 1
    return {
      date: `${safeYear}-${pad2(safeMonth)}-${pad2(day)}`,
      day,
    }
  })
}

function shiftMonth(monthValue, offset) {
  const [year, month] = String(monthValue || getCurrentMonthValue()).split('-').map(Number)
  const date = new Date(Number.isFinite(year) ? year : new Date().getFullYear(), (Number.isFinite(month) ? month : new Date().getMonth() + 1) - 1 + offset, 1)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

function getDayLevel(minutes, hasRecord) {
  if (!hasRecord) return 0
  if (minutes >= 120) return 4
  if (minutes >= 60) return 3
  if (minutes >= 30) return 2
  return 1
}

function getDayTone(level, isFuture, hasRecord) {
  if (isFuture) return 'border-gray-100 bg-white text-gray-300 hover:bg-gray-50'
  if (!hasRecord) return 'border-gray-200 bg-gray-100 text-gray-400 hover:bg-gray-200'
  if (level === 1) return 'border-emerald-100 bg-emerald-100 text-emerald-700'
  if (level === 2) return 'border-emerald-200 bg-emerald-200 text-emerald-800'
  if (level === 3) return 'border-emerald-400 bg-emerald-400 text-white'
  return 'border-emerald-700 bg-emerald-700 text-white'
}

function makeMonthActivity(data, monthDays) {
  const activity = getActivity(data)
  const dailyLogs = getDailyLogs(data)
  const reviewLogs = getReviewLogs(data)
  const cards = Array.isArray(data?.cards) ? data.cards : []
  const map = new Map(monthDays.map((day) => [day.date, {
    date: day.date,
    minutes: Math.round((Number(activity.dailySiteSeconds?.[day.date]) || 0) / 60),
    reviews: 0,
    cards: 0,
    logs: 0,
    focus: 0,
  }]))

  for (const log of reviewLogs) {
    const date = toLocalDateKey(log.reviewedAt)
    const record = map.get(date)
    if (record) record.reviews += 1
  }

  for (const card of cards) {
    const date = toLocalDateKey(card.createdAt)
    const record = map.get(date)
    if (record) record.cards += 1
  }

  for (const log of dailyLogs) {
    const record = map.get(log.date)
    if (record && String(log.content ?? '').trim()) record.logs += 1
  }

  for (const item of activity.focusLog) {
    const date = toLocalDateKey(item.startedAt)
    const record = map.get(date)
    if (record) record.focus += 1
  }

  return map
}

function StudyMonthHeatmap({ data, title = '学习月历' }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue)
  const [hovered, setHovered] = useState(null)
  const today = todayKey()
  const monthDays = useMemo(() => getMonthDays(selectedMonth), [selectedMonth])
  const monthMap = useMemo(() => makeMonthActivity(data, monthDays), [data, monthDays])
  const monthStats = useMemo(() => {
    let activeDays = 0
    let totalMinutes = 0
    let totalRecords = 0
    monthDays.forEach((day) => {
      const record = monthMap.get(day.date)
      const recordCount = (record?.reviews ?? 0) + (record?.cards ?? 0) + (record?.logs ?? 0) + (record?.focus ?? 0)
      if ((record?.minutes ?? 0) > 0 || recordCount > 0) activeDays += 1
      totalMinutes += record?.minutes ?? 0
      totalRecords += recordCount
    })
    return { activeDays, totalMinutes, totalRecords }
  }, [monthDays, monthMap])

  const openDay = (date) => {
    window.open(`/focus-log?date=${date}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="overflow-visible rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-black text-gray-950">{title}</h2>
          <p className="text-xs font-bold text-gray-400">默认当前月份；点击某天会在新标签页打开当天专注详情。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, -1))} className="grid h-8 w-8 place-items-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200" title="上个月">
            <ChevronLeft size={15} />
          </button>
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value || getCurrentMonthValue())}
            className="h-8 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 outline-none focus:border-emerald-400"
          />
          <button type="button" onClick={() => setSelectedMonth((value) => shiftMonth(value, 1))} className="grid h-8 w-8 place-items-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200" title="下个月">
            <ChevronRight size={15} />
          </button>
          <CalendarDays size={18} className="text-emerald-500" />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-gray-100">
          <p className="text-[10px] font-black text-gray-300">打卡天数</p>
          <p className="mt-1 text-lg font-black text-gray-950">{monthStats.activeDays}</p>
        </div>
        <div className="rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-gray-100">
          <p className="text-[10px] font-black text-gray-300">专注分钟</p>
          <p className="mt-1 text-lg font-black text-gray-950">{monthStats.totalMinutes}</p>
        </div>
        <div className="rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-gray-100">
          <p className="text-[10px] font-black text-gray-300">记录条数</p>
          <p className="mt-1 text-lg font-black text-gray-950">{monthStats.totalRecords}</p>
        </div>
      </div>

      <div className="relative overflow-visible rounded-[24px] bg-gradient-to-b from-gray-50 to-white p-4 ring-1 ring-gray-100">
        <div className="study-month-grid grid gap-2 sm:gap-2.5">
          {monthDays.map((day) => {
            const record = monthMap.get(day.date) ?? {}
            const recordCount = (record.reviews ?? 0) + (record.cards ?? 0) + (record.logs ?? 0) + (record.focus ?? 0)
            const isFuture = day.date > today
            const hasRecord = !isFuture && ((record.minutes ?? 0) > 0 || recordCount > 0)
            const level = getDayLevel(record.minutes ?? 0, hasRecord)
            const tone = getDayTone(level, isFuture, hasRecord)
            return (
              <button
                key={day.date}
                type="button"
                onMouseEnter={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  setHovered({
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    date: day.date,
                    minutes: record.minutes ?? 0,
                    reviews: record.reviews ?? 0,
                    cards: record.cards ?? 0,
                    logs: record.logs ?? 0,
                    focus: record.focus ?? 0,
                    isFuture,
                    hasRecord,
                  })
                }}
                onMouseLeave={() => setHovered(null)}
                onClick={() => openDay(day.date)}
                className={`relative aspect-square min-h-8 rounded-xl border text-xs font-black transition duration-150 hover:z-10 hover:scale-110 hover:shadow-xl active:scale-105 ${tone} ${day.date === today ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}
                title={`${day.date} · ${record.minutes ?? 0} 分钟`}
              >
                {day.day}
              </button>
            )
          })}
        </div>

        {hovered && (
          <div
            className="pointer-events-none fixed z-[9999] min-w-[168px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-2xl bg-gray-950 px-3 py-2 text-xs font-bold leading-5 text-white shadow-2xl"
            style={{ left: hovered.x, top: hovered.y }}
          >
            <p className="font-black">{hovered.date}</p>
            {hovered.isFuture ? (
              <p className="text-white/70">还没到这一天</p>
            ) : hovered.hasRecord ? (
              <>
                <p className="text-white/80">学习 {hovered.minutes} 分钟</p>
                <p className="text-white/70">复习 {hovered.reviews} · 新卡 {hovered.cards} · 日志 {hovered.logs}</p>
              </>
            ) : (
              <p className="text-white/70">当天暂无专注记录</p>
            )}
            <p className="mt-1 flex items-center gap-1 text-white/45"><ExternalLink size={12} /> 点击查看详情</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] font-black text-gray-300">
        少
        <span className="h-3 w-3 rounded bg-emerald-100" />
        <span className="h-3 w-3 rounded bg-emerald-200" />
        <span className="h-3 w-3 rounded bg-emerald-400" />
        <span className="h-3 w-3 rounded bg-emerald-700" />
        多
      </div>
    </section>
  )
}

export default StudyMonthHeatmap
