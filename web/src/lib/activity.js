import { getDeckChapterKey, getDeckChapterLabel } from "./deckUtils.js"
import { todayKey, dateKey } from "../data.js"
import { getStoredProfile } from "./profile.js"

const ACTIVITY_TICK_SECONDS = 10
const ACTIVITY_IDLE_TIMEOUT_MS = 5 * 60 * 1000

function toLocalDateKey(value = new Date()) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDailyLogs(data) {
  return Array.isArray(data?.dailyLogs) ? data.dailyLogs : []
}

function getReviewLogs(data) {
  return Array.isArray(data?.reviewLogs) ? data.reviewLogs : []
}

function getDailyLog(data, dateKey) {
  return getDailyLogs(data).find((log) => log.date === dateKey) ?? null
}

function getActivity(data) {
  const activity = data?.activity ?? {}
  return {
    siteSeconds: Number(activity.siteSeconds) || 0,
    dailySiteSeconds: activity.dailySiteSeconds && typeof activity.dailySiteSeconds === 'object' ? activity.dailySiteSeconds : {},
    focusSessions: Number(activity.focusSessions) || 0,
    focusLog: Array.isArray(activity.focusLog) ? activity.focusLog : [],
    deckSeconds: activity.deckSeconds && typeof activity.deckSeconds === 'object' ? activity.deckSeconds : {},
  }
}

function getTodaySiteSeconds(data) {
  const activity = getActivity(data)
  return Number(activity.dailySiteSeconds[todayKey()]) || 0
}

function formatDuration(totalSeconds, compact = false) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const restSeconds = seconds % 60
  if (hours > 0) return compact ? `${hours}h ${minutes}m` : `${hours} 小时 ${minutes} 分钟`
  if (minutes > 0) return compact ? `${minutes}m ${restSeconds}s` : `${minutes} 分钟 ${restSeconds} 秒`
  return compact ? `${restSeconds}s` : `${restSeconds} 秒`
}

function getMonthCalendarDays(now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1)
  const offset = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return {
      key: toLocalDateKey(day),
      date: day,
      inMonth: day.getMonth() === month,
      isToday: day.toDateString() === now.toDateString(),
    }
  })
}

function getCalendarActivityMap(data) {
  const map = new Map()
  const ensure = (key) => {
    const current = map.get(key) ?? { cards: 0, reviews: 0, logs: 0 }
    map.set(key, current)
    return current
  }

  for (const card of data.cards) {
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

  return map
}

function getDateStudyDetails(data, dateKey) {
  const cards = data.cards
    .filter((card) => card.createdAt && toLocalDateKey(card.createdAt) === dateKey)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  const reviews = getReviewLogs(data)
    .filter((log) => log.reviewedAt && toLocalDateKey(log.reviewedAt) === dateKey)
    .sort((a, b) => (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0))
  const dailyLog = getDailyLog(data, dateKey)
  return { cards, reviews, dailyLog }
}

function getTodayFocusCount(data) {
  const today = todayKey()
  return getActivity(data).focusLog.filter((item) => item.startedAt && toLocalDateKey(item.startedAt) === today).length
}

function getFocusSummary(data, mode, now = new Date()) {
  const activity = getActivity(data)
  const today = new Date(now)
  const start = new Date(today)

  if (mode === 'month') {
    start.setDate(1)
  } else {
    const day = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - day)
  }
  start.setHours(0, 0, 0, 0)

  const end = new Date(today)
  end.setHours(23, 59, 59, 999)

  const focusItems = activity.focusLog.filter((item) => {
    const startedAt = Number(item.startedAt)
    return startedAt >= start.getTime() && startedAt <= end.getTime()
  })
  const activeDays = new Set(focusItems.map((item) => toLocalDateKey(item.startedAt)))

  return {
    label: mode === 'month' ? '本月' : '本周',
    count: focusItems.length,
    days: activeDays.size,
    total: activity.focusSessions,
  }
}

function addActivitySeconds(current, seconds, activeDeckId = null) {
  const activity = getActivity(current)
  const today = todayKey()
  const nextDailySiteSeconds = {
    ...activity.dailySiteSeconds,
    [today]: (Number(activity.dailySiteSeconds[today]) || 0) + seconds,
  }
  const nextDeckSeconds = activeDeckId
    ? { ...activity.deckSeconds, [activeDeckId]: (Number(activity.deckSeconds[activeDeckId]) || 0) + seconds }
    : activity.deckSeconds

  return {
    ...current,
    activity: {
      ...activity,
      siteSeconds: activity.siteSeconds + seconds,
      dailySiteSeconds: nextDailySiteSeconds,
      deckSeconds: nextDeckSeconds,
      updatedAt: Date.now(),
    },
  }
}

function getActiveStudyDays(data) {
  const days = new Set()
  for (const log of getDailyLogs(data)) {
    if (log.date) days.add(log.date)
  }
  for (const log of getReviewLogs(data)) {
    if (log.reviewedAt) days.add(toLocalDateKey(log.reviewedAt))
  }
  for (const card of data.cards) {
    if (card.createdAt) days.add(toLocalDateKey(card.createdAt))
  }
  return Array.from(days).sort()
}

function getTopChapterTimeRows(data, limit = 4) {
  const activity = getActivity(data)
  const rows = new Map()

  for (const [deckId, rawSeconds] of Object.entries(activity.deckSeconds)) {
    const deck = data.decks.find((item) => item.id === deckId)
    if (!deck) continue
    const raw = Math.max(0, Number(rawSeconds) || 0)
    const siteCap = activity.siteSeconds > 0 ? activity.siteSeconds : raw
    const seconds = Math.min(raw, siteCap, 12 * 60 * 60)
    const key = getDeckChapterKey(deck)
    const current = rows.get(key) ?? {
      key,
      label: getDeckChapterLabel(deck),
      seconds: 0,
      deckCount: 0,
    }
    current.seconds += seconds
    current.deckCount += 1
    rows.set(key, current)
  }

  return Array.from(rows.values())
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, limit)
}

function addFocusSession(current, deckId) {
  const activity = getActivity(current)
  return {
    ...current,
    activity: {
      ...activity,
      focusSessions: activity.focusSessions + 1,
      focusLog: [
        { id: `focus-${deckId}`, deckId, startedAt: Date.now() },
        ...activity.focusLog,
      ].slice(0, 200),
      updatedAt: Date.now(),
    },
  }
}

export { ACTIVITY_TICK_SECONDS, ACTIVITY_IDLE_TIMEOUT_MS, toLocalDateKey, getDailyLogs, getReviewLogs, getDailyLog, getActivity, getTodaySiteSeconds, formatDuration, getMonthCalendarDays, getCalendarActivityMap, getDateStudyDetails, getTodayFocusCount, getFocusSummary, addActivitySeconds, getActiveStudyDays, getTopChapterTimeRows, addFocusSession }