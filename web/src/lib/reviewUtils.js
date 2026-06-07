function getReviewReps(review) {
  const reps = Number(review?.reps ?? 0)
  return Number.isFinite(reps) ? reps : 0
}

function getCardReviewReps(card) {
  return getReviewReps(card?.review)
}

function makeNewCardReview(review = {}) {
  const { dueAt, ...rest } = review ?? {}
  return {
    ...rest,
    dueDate: '',
    interval: Number(rest.interval ?? 0) || 0,
    ease: Number(rest.ease ?? 2.5) || 2.5,
    reps: 0,
    lapses: Number(rest.lapses ?? 0) || 0,
    lastGrade: rest.lastGrade ?? null,
  }
}

function hasStartedCard(card) {
  return getCardReviewReps(card) > 0
}

function getReviewDueTime(review) {
  if (review?.dueAt) {
    const dueAt = new Date(review.dueAt).getTime()
    if (Number.isFinite(dueAt)) return dueAt
  }
  if (review?.dueDate) {
    const dueDate = new Date(`${review.dueDate}T00:00:00`).getTime()
    if (Number.isFinite(dueDate)) return dueDate
  }
  return 0
}

function isReviewDue(review) {
  const dueTime = getReviewDueTime(review)
  return getReviewReps(review) > 0 && dueTime > 0 && dueTime <= Date.now()
}

function formatReviewDueLabel(review) {
  const dueAt = getReviewDueTime(review)
  if (!dueAt) return '现在'
  const diffMs = dueAt - Date.now()
  if (diffMs <= 0) return '现在'
  const minutes = Math.max(1, Math.round(diffMs / 60000))
  if (minutes < 60) return `${minutes}分钟后`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}小时后`
  const days = Math.ceil(minutes / (24 * 60))
  return `${days}天后`
}

function makeDailyCardSourceKey(dateKey, card, index) {
  return `daily:${dateKey}:${card.id || index}`
}

export { getReviewReps, getCardReviewReps, makeNewCardReview, hasStartedCard, getReviewDueTime, isReviewDue, formatReviewDueLabel, makeDailyCardSourceKey }