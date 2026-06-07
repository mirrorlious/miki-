import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, BarChart3, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Flame, Layers3, PieChart, Target, TrendingUp } from 'lucide-react'
import { todayKey } from '../data.js'
import { compactCardText, isCardDue, isNewCard } from '../lib/browseUtils.js'
import { getDeckPath, sortDecksByPath } from '../lib/deckUtils.js'
import Shell from './Shell.jsx'

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
  return Boolean(card?.flagged || card?.flagColor || Number(card?.review?.lapses ?? 0) > 0 || grade === 0 || grade === 1)
}

function isMasteredCard(card) {
  return !isCardDue(card) && !isWeakCard(card) && Number(card?.review?.reps ?? 0) > 0 && Number(card?.review?.interval ?? 0) >= 7
}

function percent(value, total) {
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)))
}

function StatCard({ icon: Icon, label, value, hint, tone = 'bg-white' }) {
  return (
    <div className={`rounded-2xl border border-white p-4 shadow-sm ${tone}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-black text-gray-400">{label}</span>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/80 text-gray-500"><Icon size={17} /></span>
      </div>
      <p className="text-3xl font-black text-gray-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-gray-400">{hint}</p>
    </div>
  )
}

function BarRow({ label, value, maxValue, tone = 'bg-blue-500', onClick }) {
  const width = maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 100)) : 0
  return (
    <button type="button" onClick={onClick} className="group w-full rounded-xl px-2 py-2 text-left hover:bg-gray-50">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black">
        <span className="min-w-0 truncate text-gray-700">{label}</span>
        <span className="text-gray-400">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </button>
  )
}

function Donut({ segments }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0) || 1
  let offset = 25
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 42 42" className="h-32 w-32 -rotate-90">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#eef2f7" strokeWidth="7" />
        {segments.map((item) => {
          const length = (item.value / total) * 100
          const circle = <circle key={item.label} cx="21" cy="21" r="15.915" fill="transparent" stroke={item.color} strokeWidth="7" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={offset} />
          offset -= length
          return circle
        })}
      </svg>
      <div className="min-w-0 flex-1 space-y-2">
        {segments.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-xs font-black">
            <span className="flex items-center gap-2 text-gray-600"><i className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />{item.label}</span>
            <span className="text-gray-400">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Dashboard({ data, onOpenCreateDeck, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const [tableOpen, setTableOpen] = useState(false)
  const today = todayKey()
  const cards = Array.isArray(data?.cards) ? data.cards : []
  const decks = Array.isArray(data?.decks) ? data.decks : []
  const reviewLogs = Array.isArray(data?.reviewLogs) ? data.reviewLogs : []

  const rows = useMemo(() => sortDecksByPath(decks).map((deck) => {
    const deckCards = cards.filter((card) => card.deckId === deck.id)
    const due = deckCards.filter(isCardDue).length
    const weak = deckCards.filter(isWeakCard).length
    const fresh = deckCards.filter(isNewCard).length
    const mastered = deckCards.filter(isMasteredCard).length
    return {
      ...deck,
      total: deckCards.length,
      due,
      weak,
      newCount: fresh,
      mastered,
      pressure: due * 3 + weak * 2 + fresh,
    }
  }).filter((row) => row.total > 0), [cards, decks])

  const dueCards = cards.filter(isCardDue)
  const weakCards = cards.filter(isWeakCard)
  const newCards = cards.filter(isNewCard)
  const masteredCards = cards.filter(isMasteredCard)
  const reviewedToday = reviewLogs.filter((log) => toLocalDateKey(log.reviewedAt) === today)
  const last7 = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6))
  const trend = last7.map((date) => ({ date, count: reviewLogs.filter((log) => toLocalDateKey(log.reviewedAt) === date).length }))
  const maxTrend = Math.max(1, ...trend.map((item) => item.count))
  const heatDays = Array.from({ length: 35 }, (_, index) => addDays(today, index - 34)).map((date) => ({
    date,
    count: reviewLogs.filter((log) => toLocalDateKey(log.reviewedAt) === date).length,
  }))
  const weeklyTotal = trend.reduce((sum, item) => sum + item.count, 0)
  const weeklyTarget = Math.max(7, dueCards.length + reviewedToday.length)
  const completionRate = percent(reviewedToday.length, dueCards.length + reviewedToday.length)
  const masteryRate = percent(masteredCards.length, cards.length)
  const pressureRows = [...rows].sort((a, b) => b.pressure - a.pressure).slice(0, 8)
  const maxPressure = Math.max(1, ...pressureRows.map((row) => row.pressure))
  const weakestTerms = pressureRows.slice(0, 5)

  const diagnosis = []
  if (weakCards.length > cards.length * 0.35) diagnosis.push('薄弱卡占比偏高，今天优先回收薄弱点。')
  if (newCards.length > cards.length * 0.45) diagnosis.push('新卡池很大，建议先复盘旧卡再新增。')
  if (dueCards.length > 0) diagnosis.push(`今天有 ${dueCards.length} 张到期卡，先清到期更稳。`)
  if (!diagnosis.length) diagnosis.push('当前负载较稳，可以推进少量新卡。')

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId} wide>
      <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-[0.22em] text-blue-600">learning diagnosis</p>
          <h1 className="text-2xl font-black text-gray-950">学习诊断中心</h1>
          <p className="mt-1 text-sm text-gray-500">看趋势、看压力、看薄弱点，而不是只看卡组表。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onOpenCreateDeck?.()} className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">新建卡组</button>
          <button onClick={() => studyDeckId && navigate(`/study/${studyDeckId}`)} className="h-10 rounded-xl bg-[#007aff] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={!studyDeckId}>开始学习</button>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard icon={Target} label="今日待复习" value={dueCards.length} hint="先清到期" tone="bg-red-50/80" />
        <StatCard icon={CheckCircle2} label="今日已完成" value={reviewedToday.length} hint={`清空率 ${completionRate}%`} tone="bg-green-50/80" />
        <StatCard icon={AlertTriangle} label="薄弱卡" value={weakCards.length} hint="优先回收" tone="bg-orange-50/80" />
        <StatCard icon={Layers3} label="新卡池" value={newCards.length} hint="谨慎新增" tone="bg-blue-50/80" />
        <StatCard icon={Flame} label="本周完成" value={weeklyTotal} hint={`目标参考 ${weeklyTarget}`} />
        <StatCard icon={TrendingUp} label="掌握率" value={`${masteryRate}%`} hint={`${masteredCards.length}/${cards.length}`} />
      </section>

      <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-950">最近 7 天复习趋势</h2>
              <p className="text-xs font-bold text-gray-400">每天复习张数，先看节奏是否断档。</p>
            </div>
            <Activity size={18} className="text-blue-500" />
          </div>
          <div className="flex h-56 items-end gap-3 rounded-2xl bg-gray-50 p-4">
            {trend.map((item) => (
              <div key={item.date} className="flex h-full flex-1 flex-col justify-end gap-2 text-center">
                <div className="mx-auto w-full max-w-12 rounded-t-xl bg-[#007aff] transition-all" style={{ height: `${Math.max(5, (item.count / maxTrend) * 100)}%`, opacity: item.count ? 0.9 : 0.18 }} />
                <span className="text-[10px] font-black text-gray-400">{item.date.slice(5)}</span>
                <span className="text-xs font-black text-gray-700">{item.count}</span>
              </div>
            ))}
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
          <Donut segments={[
            { label: '新卡', value: newCards.length, color: '#0b8cff' },
            { label: '到期', value: dueCards.length, color: '#ff4d4f' },
            { label: '薄弱', value: weakCards.length, color: '#ffb020' },
            { label: '已掌握', value: masteredCards.length, color: '#20c997' },
          ]} />
        </div>
      </section>

      <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-950">卡组压力排行</h2>
              <p className="text-xs font-bold text-gray-400">综合到期、薄弱、新卡计算，先处理最危险的。</p>
            </div>
            <BarChart3 size={18} className="text-blue-500" />
          </div>
          <div className="space-y-1">
            {pressureRows.map((row) => <BarRow key={row.id} label={row.name} value={row.pressure} maxValue={maxPressure} tone="bg-orange-500" onClick={() => navigate('/browse', { state: { deckId: row.id } })} />)}
            {pressureRows.length === 0 && <p className="py-12 text-center text-sm font-bold text-gray-400">暂无卡组数据</p>}
          </div>
        </div>

        <aside className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-black text-gray-950">今日诊断</h2>
          <div className="space-y-2">
            {diagnosis.map((item) => <p key={item} className="rounded-xl bg-gray-50 px-3 py-2 text-sm font-bold leading-6 text-gray-600">{item}</p>)}
          </div>
          <div className="mt-4 grid gap-2">
            <button onClick={() => weakCards[0]?.deckId && navigate(`/study/${weakCards[0].deckId}`)} disabled={!weakCards.length} className="h-10 rounded-xl bg-orange-50 text-sm font-black text-orange-600 hover:bg-orange-100 disabled:text-gray-300">开始薄弱复盘</button>
            <button onClick={() => navigate('/map')} className="h-10 rounded-xl bg-blue-50 text-sm font-black text-blue-600 hover:bg-blue-100">打开知识拼图</button>
            <button onClick={() => navigate('/browse')} className="h-10 rounded-xl bg-gray-100 text-sm font-black text-gray-600 hover:bg-gray-200">查看全部卡片</button>
          </div>
        </aside>
      </section>

      <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <div className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-950">学习热力图</h2>
              <p className="text-xs font-bold text-gray-400">最近 35 天复习活跃度。</p>
            </div>
            <CalendarDays size={18} className="text-blue-500" />
          </div>
          <div className="grid grid-cols-7 gap-2">
            {heatDays.map((day) => {
              const level = day.count === 0 ? 'bg-gray-100' : day.count < 5 ? 'bg-green-100' : day.count < 15 ? 'bg-green-300' : 'bg-green-500'
              return <div key={day.date} title={`${day.date}：${day.count} 张`} className={`aspect-square rounded-lg ${level}`} />
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-black text-gray-950">薄弱卡组 Top 5</h2>
          <div className="space-y-2">
            {weakestTerms.map((row, index) => (
              <button key={row.id} onClick={() => navigate('/browse', { state: { deckId: row.id } })} className="flex w-full items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-3 text-left hover:bg-gray-100">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-950 text-xs font-black text-white">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-black text-gray-900">{row.name}</span>
                <span className="text-xs font-black text-orange-500">薄弱 {row.weak}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white bg-white/90 shadow-sm">
        <button type="button" onClick={() => setTableOpen((value) => !value)} className="flex h-12 w-full items-center justify-between px-5 text-left">
          <span className="text-sm font-black text-gray-950">详细卡组表格</span>
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
                    <td className="px-4 py-3"><strong className="block font-bold text-gray-900">{row.name}</strong><span className="text-[11px] font-bold text-gray-400">{getDeckPath(row)}</span></td>
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
