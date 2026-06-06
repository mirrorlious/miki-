import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Target } from 'lucide-react'
import { stats } from '../data.js'
import { getStoredProfile } from '../lib/profile.js'
import { getCalendarActivityMap, getMonthCalendarDays, getDateStudyDetails, getTodaySiteSeconds, getActivity, getFocusSummary, formatDuration } from '../lib/activity.js'

function LearningOverviewPanel({ data }) {
  const [now, setNow] = useState(() => Date.now())
  const [selectedDateKey, setSelectedDateKey] = useState(null)
  const [focusRange, setFocusRange] = useState('week')
  const activity = getActivity(data)
  const storedTodaySeconds = getTodaySiteSeconds(data)
  const liveBaseRef = useRef({ todaySeconds: storedTodaySeconds, siteSeconds: activity.siteSeconds, startedAt: now })

  useEffect(() => {
    liveBaseRef.current = { todaySeconds: storedTodaySeconds, siteSeconds: activity.siteSeconds, startedAt: Date.now() }
  }, [activity.siteSeconds, storedTodaySeconds])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const currentDate = new Date(now)
  const liveElapsed = Math.floor((now - liveBaseRef.current.startedAt) / 1000)
  const liveTodaySeconds = liveBaseRef.current.todaySeconds + liveElapsed
  const calendarDays = getMonthCalendarDays(currentDate)
  const activityMap = getCalendarActivityMap(data)
  const summary = stats(data)
  const profile = getStoredProfile(data)
  const goalSeconds = profile.dailyGoalMinutes * 60
  const selectedDetails = selectedDateKey ? getDateStudyDetails(data, selectedDateKey) : null
  const selectedActivity = selectedDateKey ? (activityMap.get(selectedDateKey) ?? { cards: 0, reviews: 0, logs: 0 }) : { cards: 0, reviews: 0, logs: 0 }
  const deckById = new Map(data.decks.map((deck) => [deck.id, deck]))
  const countdownInfo = getCountdownInfo(data, now)
  const focusSummary = getFocusSummary(data, focusRange, currentDate)
  const monthLabel = currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
  const todayLabel = currentDate.toLocaleDateString('zh-CN', { weekday: 'short', month: '2-digit', day: '2-digit' })

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-white bg-white/90 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="border-b border-gray-100 p-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">Calendar</p>
              <h2 className="mt-1 text-lg font-black text-gray-950">{monthLabel}</h2>
            </div>
            <CalendarDays size={20} className="text-[#007aff]" />
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black text-gray-300">
            {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dayActivity = activityMap.get(day.key)
              const active = Boolean(dayActivity?.cards || dayActivity?.reviews || dayActivity?.logs)
              const selected = selectedDateKey === day.key
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => setSelectedDateKey((current) => (current === day.key ? null : day.key))}
                  title={`${getDateLabel(day.key)}：新增 ${dayActivity?.cards ?? 0}，复习 ${dayActivity?.reviews ?? 0}`}
                  className={`relative grid h-8 place-items-center rounded-lg text-xs font-black transition-colors ${selected ? 'bg-gray-950 text-white' : day.isToday ? 'bg-[#007aff] text-white' : day.inMonth ? 'bg-gray-50 text-gray-700 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-50'}`}
                >
                  {day.date.getDate()}
                  {active && <span className={`absolute bottom-1 h-1 w-1 rounded-full ${selected || day.isToday ? 'bg-white' : 'bg-[#34c759]'}`} />}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-[11px] font-bold text-gray-300">点击日期展开当天记录，再点一次收起。</p>
        </div>

        <div className="p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">Today</p>
              <h2 className="mt-1 text-2xl font-black text-gray-950">{todayLabel}</h2>
            </div>
            <div className="rounded-xl bg-gray-950 px-4 py-3 text-right text-white">
              <p className="text-[11px] font-black text-white/50">{countdownInfo.label}</p>
              <p className="mt-1 font-mono text-2xl font-black">{countdownInfo.value}</p>
              <p className="mt-1 text-[10px] font-bold text-white/40">{countdownInfo.detail}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-black text-gray-400">今日停留</p>
                <Target size={16} className="text-gray-300" />
              </div>
              <p className="text-2xl font-black text-gray-950">{formatDuration(liveTodaySeconds, true)}</p>
              <p className="mt-1 text-[11px] font-bold text-gray-400">目标 {Math.round(Math.min(100, (liveTodaySeconds / Math.max(goalSeconds, 1)) * 100))}%</p>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-black text-gray-400">专注次数</p>
                <div className="grid grid-cols-2 rounded-lg bg-white p-0.5 text-[10px] font-black">
                  {[
                    { value: 'week', label: '周' },
                    { value: 'month', label: '月' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFocusRange(option.value)}
                      className={`h-5 rounded-md px-2 ${focusRange === option.value ? 'bg-gray-950 text-white' : 'text-gray-400 hover:text-gray-700'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-2xl font-black text-gray-950">{focusSummary.count}</p>
              <p className="mt-1 text-[11px] font-bold text-gray-400">{focusSummary.label} · 活跃 {focusSummary.days} 天 · 总 {focusSummary.total}</p>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-black text-gray-400">掌握知识点</p>
                <BookOpen size={16} className="text-gray-300" />
              </div>
              <p className="text-2xl font-black text-gray-950">{summary.mastered}</p>
              <p className="mt-1 text-[11px] font-bold text-gray-400">{summary.learned}/{data.cards.length} 已学</p>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-black text-gray-400">今日到期</p>
                <Layers3 size={16} className="text-gray-300" />
              </div>
              <p className="text-2xl font-black text-gray-950">{summary.dueToday}</p>
              <p className="mt-1 text-[11px] font-bold text-gray-400">待复习卡片</p>
            </div>
          </div>
        </div>
      </div>

      {selectedDateKey && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-gray-100 bg-white"
        >
          <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">Selected Day</p>
              <h3 className="mt-1 text-lg font-black text-gray-950">{getDateLabel(selectedDateKey)}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-black text-gray-500">新增 {selectedActivity.cards}</span>
                <span className="rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-black text-gray-500">复习 {selectedActivity.reviews}</span>
                <span className="rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-black text-gray-500">复盘 {selectedActivity.logs}</span>
              </div>
              <button type="button" onClick={() => setSelectedDateKey(null)} className="mt-4 h-8 rounded-lg bg-gray-100 px-3 text-xs font-black text-gray-500 hover:bg-gray-200">
                收起
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {selectedDetails.cards.length === 0 && !selectedDetails.dailyLog?.content?.trim() && selectedDetails.reviews.length === 0 && (
                <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm font-bold text-gray-400 md:col-span-2">这天还没有学习记录。</p>
              )}
              {selectedDetails.cards.slice(0, 6).map((card) => {
                const deck = deckById.get(card.deckId)
                return (
                  <div key={card.id} className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="line-clamp-1 text-sm font-black text-gray-800">{card.front}</p>
                    <p className="mt-1 line-clamp-1 text-xs font-bold text-gray-400">{deck?.name ?? '未归档'} · 新增卡片</p>
                  </div>
                )
              })}
              {selectedDetails.dailyLog?.content?.trim() && (
                <div className="rounded-xl bg-gray-50 px-4 py-3 md:col-span-2">
                  <p className="text-sm font-black text-gray-800">今日复盘</p>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-500">{selectedDetails.dailyLog.content}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </section>
  )
}



export default LearningOverviewPanel