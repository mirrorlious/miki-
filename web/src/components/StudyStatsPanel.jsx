import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getActivity, getDailyLogs, getReviewLogs, toLocalDateKey } from '../lib/activity.js';

const STAT_ITEMS = [
  {
    key: 'round',
    label: '本轮复习',
    getValue: (p) => p.reviewed ?? 0,
    getDetail: (p) => (p.sessionTotal ? `进度 ${p.progressPercent}%` : '尚未开始'),
    iconColor: 'text-indigo-500',
    iconBg: 'bg-indigo-50',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    )
  },
  {
    key: 'due',
    label: '即将到期',
    getValue: (p) => p.dueCount ?? 0,
    getDetail: (p) => (p.isDrill ? '抽背中' : '等待队列'),
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-50',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    key: 'learned',
    label: '已学卡片',
    getValue: (p) => p.reviewedCount ?? 0,
    getDetail: (p) => `含 ${p.newCardCount ?? 0} 张新卡`,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    key: 'stable',
    label: '稳固记忆',
    getValue: (p) => p.masteredCount ?? 0,
    getDetail: () => '间隔 7 天+',
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-50',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    )
  },
];

function pad2(value) {
  return String(value).padStart(2, '0')
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
    const key = `${year}-${pad2(month)}-${pad2(day)}`
    return { key, day }
  })
}

function getLevel(score) {
  const value = Number(score) || 0
  if (value <= 0) return 0
  if (value < 3) return 1
  if (value < 7) return 2
  if (value < 14) return 3
  return 4
}

function getCellColorClass(day, todayKey, activity) {
  const level = getLevel((activity.cards || 0) + (activity.reviews || 0) + (activity.logs || 0) + (activity.sessions || 0) + Math.floor((activity.minutes || 0) / 20))
  if (level > 0) {
    return ['bg-emerald-200', 'bg-emerald-300', 'bg-emerald-400', 'bg-emerald-500'][level - 1]
  }
  if (day.key > todayKey) return 'bg-white ring-1 ring-slate-100'
  return 'bg-slate-100'
}

function formatMonthLabel(monthValue) {
  const date = monthValueToDate(monthValue)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit' })
}

function buildMonthActivity(data) {
  const safeCards = Array.isArray(data?.cards) ? data.cards : []
  const map = new Map()
  const ensure = (key) => {
    const current = map.get(key) ?? { cards: 0, reviews: 0, logs: 0, minutes: 0, sessions: 0 }
    map.set(key, current)
    return current
  }

  for (const card of safeCards) {
    if (!card.createdAt) continue
    ensure(toLocalDateKey(card.createdAt)).cards += 1
  }

  for (const log of getReviewLogs(data)) {
    if (!log.reviewedAt) continue
    ensure(toLocalDateKey(log.reviewedAt)).reviews += 1
  }

  for (const log of getDailyLogs(data)) {
    if (!log.date || !log.content?.trim()) continue
    ensure(log.date).logs += 1
  }

  const activity = getActivity(data)
  for (const [key, seconds] of Object.entries(activity.dailySiteSeconds)) {
    ensure(key).minutes += Math.round((Number(seconds) || 0) / 60)
  }

  for (const item of activity.focusLog) {
    if (!item?.startedAt) continue
    ensure(toLocalDateKey(item.startedAt)).sessions += 1
  }

  return map
}

export default function StudyStatsPanel({
  reviewed, dueCount, isDrill, progressPercent,
  reviewedCount, newCardCount, masteredCount, sessionTotal,
  data, scopeCardIds,
}) {
  const props = { reviewed, dueCount, isDrill, progressPercent, reviewedCount, newCardCount, masteredCount, sessionTotal };
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthValue())
  const [hoveredDay, setHoveredDay] = useState(null)
  const todayKey = toLocalDateKey(new Date())
  const scopeIdSet = useMemo(() => new Set(Array.isArray(scopeCardIds) ? scopeCardIds : []), [scopeCardIds])
  const monthDays = useMemo(() => getMonthDays(selectedMonth), [selectedMonth])
  const activityMap = useMemo(() => buildMonthActivity(data), [data])
  const activeDays = useMemo(() => monthDays.filter((day) => {
    const activity = activityMap.get(day.key) ?? { cards: 0, reviews: 0, logs: 0, minutes: 0, sessions: 0 }
    return activity.cards || activity.reviews || activity.logs || activity.minutes || activity.sessions
  }).length, [activityMap, monthDays])

  const openDateDetail = (dateKey) => {
    window.open(`/focus-log?date=${encodeURIComponent(dateKey)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="mb-6 bg-white rounded-[1.25rem] border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="flex flex-wrap">
        <div className="flex-[3] basis-[320px] min-w-[280px] p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-slate-800 tracking-wide">学习概览</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-x-3 gap-y-6">
            {STAT_ITEMS.map((item) => (
              <div key={item.key} className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-md ${item.iconBg} ${item.iconColor} shrink-0`}>
                    {item.icon}
                  </div>
                  <span className="text-xs font-semibold text-slate-500 truncate">{item.label}</span>
                </div>
                
                <div className="flex items-baseline gap-2">
                  <h4 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight truncate">
                    {item.getValue(props)}
                  </h4>
                </div>
                
                <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                  {item.getDetail(props)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-[2] basis-[280px] min-w-[280px] p-5 lg:p-6 bg-slate-50/70 flex flex-col justify-center">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
             <h2 className="text-sm font-bold text-slate-800 tracking-wide">本月趋势</h2>
             <div className="flex items-center gap-1 shrink-0">
               <button
                 type="button"
                 onClick={() => setSelectedMonth((current) => shiftMonth(current, -1))}
                 className="grid h-6 w-6 place-items-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-100 hover:text-slate-700"
                 aria-label="上个月"
               >
                 <ChevronLeft size={13} />
               </button>
               <label className="relative inline-flex h-6 cursor-pointer items-center rounded-full bg-emerald-100/60 px-2 text-[10px] font-bold text-emerald-700">
                 {formatMonthLabel(selectedMonth)} · {activeDays}天
                 <input
                   type="month"
                   value={selectedMonth}
                   onChange={(event) => setSelectedMonth(event.target.value || toMonthValue())}
                   className="absolute inset-0 cursor-pointer opacity-0"
                   aria-label="选择月份"
                 />
               </label>
               <button
                 type="button"
                 onClick={() => setSelectedMonth((current) => shiftMonth(current, 1))}
                 className="grid h-6 w-6 place-items-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-100 hover:text-slate-700"
                 aria-label="下个月"
               >
                 <ChevronRight size={13} />
               </button>
             </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="w-full overflow-visible pb-1">
              <div className="grid w-max grid-cols-7 gap-1 pr-1">
                {monthDays.map((day) => {
                  const activity = activityMap.get(day.key) ?? { cards: 0, reviews: 0, logs: 0, minutes: 0, sessions: 0 }
                  const isToday = day.key === todayKey
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onMouseEnter={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect()
                        setHoveredDay({
                          ...day,
                          ...activity,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        })
                      }}
                      onMouseLeave={() => setHoveredDay(null)}
                      onClick={() => openDateDetail(day.key)}
                      className={`relative h-3 w-3 rounded-[2px] ${getCellColorClass(day, todayKey, activity)} transition-all hover:z-10 hover:scale-125 cursor-pointer ${isToday ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}
                      title={`${day.key}：复习 ${activity.reviews || 0}，新卡 ${activity.cards || 0}，专注 ${activity.minutes || 0} 分钟`}
                    />
                  )
                })}
              </div>
            </div>

            {hoveredDay && (
              <div
                className="pointer-events-none fixed z-[9999] min-w-[150px] -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold leading-5 text-white shadow-2xl"
                style={{ left: hoveredDay.x, top: hoveredDay.y }}
              >
                <p className="font-black">{hoveredDay.key}</p>
                {hoveredDay.key > todayKey ? (
                  <p className="text-white/70">还没到这一天</p>
                ) : (hoveredDay.cards || hoveredDay.reviews || hoveredDay.logs || hoveredDay.minutes || hoveredDay.sessions) ? (
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
            
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-slate-400 font-medium">{monthDays[0]?.key.slice(5)}</span>
              <div className="flex items-center gap-1.5 opacity-80 shrink-0">
                <span className="text-[9px] text-slate-400">少</span>
                <div className="flex gap-[2px]">
                  <div className="w-2 h-2 rounded-[1px] bg-slate-100 ring-1 ring-slate-100"></div>
                  <div className="w-2 h-2 rounded-[1px] bg-emerald-200"></div>
                  <div className="w-2 h-2 rounded-[1px] bg-emerald-300"></div>
                  <div className="w-2 h-2 rounded-[1px] bg-emerald-400"></div>
                  <div className="w-2 h-2 rounded-[1px] bg-emerald-500"></div>
                </div>
                <span className="text-[9px] text-slate-400">多</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
