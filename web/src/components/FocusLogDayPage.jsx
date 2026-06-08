import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Clock, FileText, Layers3, TimerReset } from 'lucide-react'
import Shell from './Shell.jsx'
import { getActivity, getDailyLog, getReviewLogs, toLocalDateKey } from '../lib/activity.js'
import { getDeckOptionLabel } from '../lib/deckUtils.js'

function formatDateLabel(dateKey) {
  if (!dateKey) return '未选择日期'
  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
}

function compactText(value, limit = 80) {
  const text = String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function buildDayEntries(data, dateKey) {
  const activity = getActivity(data)
  const deckById = new Map((Array.isArray(data?.decks) ? data.decks : []).map((deck) => [deck.id, deck]))
  const cards = Array.isArray(data?.cards) ? data.cards : []
  const minutes = Math.round((Number(activity.dailySiteSeconds?.[dateKey]) || 0) / 60)
  const entries = []

  if (minutes > 0) {
    entries.push({
      id: 'minutes',
      icon: Clock,
      title: `学习 ${minutes} 分钟`,
      detail: '站内专注计时',
      meta: '自动统计',
    })
  }

  const dailyLog = getDailyLog(data, dateKey)
  if (dailyLog?.content?.trim()) {
    entries.push({
      id: 'daily-log',
      icon: FileText,
      title: '今日复盘日志',
      detail: dailyLog.content.trim(),
      meta: '手动记录',
    })
  }

  const reviews = getReviewLogs(data).filter((log) => toLocalDateKey(log.reviewedAt) === dateKey)
  if (reviews.length > 0) {
    entries.push({
      id: 'reviews',
      icon: TimerReset,
      title: `复习卡片 ${reviews.length} 张`,
      detail: '包含 Again / Hard / Good / Easy 的复习记录。',
      meta: '复习记录',
    })
  }

  const createdCards = cards.filter((card) => toLocalDateKey(card.createdAt) === dateKey)
  if (createdCards.length > 0) {
    const preview = createdCards.slice(0, 3).map((card) => compactText(card.front || card.back, 36)).filter(Boolean).join('；')
    entries.push({
      id: 'cards',
      icon: Layers3,
      title: `新增卡片 ${createdCards.length} 张`,
      detail: preview || '当天新建了一批卡片。',
      meta: '制卡记录',
    })
  }

  const focusByDeck = new Map()
  for (const item of activity.focusLog) {
    if (toLocalDateKey(item.startedAt) !== dateKey) continue
    const key = item.deckId || 'unknown'
    focusByDeck.set(key, (focusByDeck.get(key) || 0) + 1)
  }
  for (const [deckId, count] of focusByDeck.entries()) {
    const deck = deckById.get(deckId)
    entries.push({
      id: `focus-${deckId}`,
      icon: BookOpen,
      title: `打开学习 ${count} 次`,
      detail: deck ? getDeckOptionLabel(deck) : '未归属卡组',
      meta: '专注会话',
    })
  }

  return { entries, minutes, reviewCount: reviews.length, cardCount: createdCards.length }
}

function FocusLogDayPage({ data, studyDeckId, cloud }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dateKey = searchParams.get('date') || toLocalDateKey(Date.now())
  const { entries, minutes, reviewCount, cardCount } = useMemo(() => buildDayEntries(data, dateKey), [data, dateKey])

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId} wide>
      <main className="mx-auto max-w-3xl rounded-[28px] border border-white bg-white/95 p-6 shadow-sm sm:p-8">
        <header className="mb-8 border-b border-gray-100 pb-6">
          <button type="button" onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-gray-500 hover:bg-gray-200">
            <ArrowLeft size={14} /> 返回
          </button>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">focus log</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">{formatDateLabel(dateKey)}</h1>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">学习 {minutes} 分钟</span>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">复习 {reviewCount} 张</span>
            <span className="rounded-full bg-orange-50 px-3 py-1.5 text-orange-700">新卡 {cardCount} 张</span>
          </div>
        </header>

        {entries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="text-lg font-black text-gray-700">当天暂无专注记录</p>
            <p className="mt-2 text-sm font-bold text-gray-400">没有复习、制卡、日志或站内专注时长。</p>
          </div>
        ) : (
          <section className="relative border-l-2 border-dashed border-emerald-200 pl-7">
            {entries.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.id} className="relative mb-7 last:mb-0">
                  <span className="absolute -left-[35px] top-4 grid h-4 w-4 place-items-center rounded-full border-2 border-emerald-400 bg-white" />
                  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-lg font-black text-gray-950">{item.title}</h2>
                          <p className="mt-0.5 text-xs font-black text-gray-300">{item.meta}</p>
                        </div>
                      </div>
                    </div>
                    {item.detail && <p className="whitespace-pre-wrap text-sm font-bold leading-7 text-gray-600">{item.detail}</p>}
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </main>
    </Shell>
  )
}

export default FocusLogDayPage
