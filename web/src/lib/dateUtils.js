import { getStoredProfile } from './profile.js'
function getDateLabel(dateKey) {
  return new Date(${dateKey}T00:00:00).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatCountdown(totalMs) {
  const seconds = Math.max(0, Math.floor(totalMs / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const restSeconds = seconds % 60
  return ${String(hours).padStart(2, '0')}::
}

function formatCountdownWithDays(totalMs) {
  const seconds = Math.max(0, Math.floor(totalMs / 1000))
  const days = Math.floor(seconds / 86400)
  const rest = seconds % 86400
  const clock = formatCountdown(rest * 1000)
  return days > 0 ? ${days}天  : clock
}

function formatStudyDate(dateKey) {
  return new Date(${dateKey}T00:00:00).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function getCountdownInfo(data, now) {
  const profile = getStoredProfile(data)
  if (profile.examDate) {
    const target = new Date(${profile.examDate}T23:59:59).getTime()
    if (target > now) {
      return {
        label: '考试倒计时',
        detail: profile.examDate,
        value: formatCountdownWithDays(target - now),
      }
    }
  }

  const currentDate = new Date(now)
  const endOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
  return {
    label: '今日倒计时',
    detail: '到今晚 24:00',
    value: formatCountdown(endOfDay.getTime() - now),
  }
}

export { getDateLabel, formatCountdown, formatCountdownWithDays, formatStudyDate, getCountdownInfo }