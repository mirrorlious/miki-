import { useNavigate, Link } from 'react-router-dom'
import { BookOpen, PencilLine, Plus, Sparkles } from 'lucide-react'
import { stats } from '../data.js'

function isNewCard(card) { return !(card?.review?.reps > 0) }
function isCardDue(card) { if (!card?.review?.dueDate) return false; var d = card.review.dueAt ? new Date(card.review.dueAt).getTime() : new Date(card.review.dueDate + 'T00:00:00').getTime(); return Number.isFinite(d) && d <= Date.now() }

function Dashboard({ data, onOpenCreateDeck, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const summary = stats(data)
  const dueCards = data.cards.filter(isCardDue)
  const deckRows = data.decks.map((deck) => {
    const cards = data.cards.filter((card) => card.deckId === deck.id)
    return {
      ...deck,
      total: cards.length,
      due: cards.filter(isCardDue).length,
      newCount: cards.filter(isNewCard).length,
    }
  })

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">统计</h1>
          <p className="text-xs text-gray-500 mt-1">按卡组查看当前复习负载。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onOpenCreateDeck()} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">
            新建卡组
          </button>
          <button onClick={() => studyDeckId && navigate(`/study/${studyDeckId}`)} className="h-10 px-4 rounded-xl bg-[#007aff] text-white text-sm font-bold shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={!studyDeckId}>
            开始学习
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl bg-white/90 border border-white shadow-sm p-5">
          <p className="text-xs font-bold text-gray-500 mb-2">今日待复习</p>
          <p className="text-3xl font-black text-gray-950">{summary.dueToday}</p>
        </div>
        <div className="rounded-2xl bg-white/90 border border-white shadow-sm p-5">
          <p className="text-xs font-bold text-gray-500 mb-2">已开始学习</p>
          <p className="text-3xl font-black text-gray-950">{summary.learned}</p>
        </div>
        <div className="rounded-2xl bg-white/90 border border-white shadow-sm p-5">
          <p className="text-xs font-bold text-gray-500 mb-2">成熟卡片</p>
          <p className="text-3xl font-black text-gray-950">{summary.mastered}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
        <div className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">卡组统计</h2>
            <Link to="/decks" className="text-xs font-bold text-green-600 hover:text-green-700">回到卡组</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-bold">目录</th>
                <th className="text-right px-4 py-2 font-bold">新卡</th>
                <th className="text-right px-4 py-2 font-bold">到期</th>
                <th className="text-right px-4 py-2 font-bold">总数</th>
              </tr>
            </thead>
            <tbody>
              {deckRows.map((deck) => (
                <tr key={deck.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <strong className="block font-bold text-gray-900">{deck.name}</strong>
                    <span className="mt-1 block text-[11px] font-bold text-gray-400">{getDeckPath(deck)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-blue-600 font-bold">{deck.newCount}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-bold">{deck.due}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-bold">{deck.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">今日清单</h2>
            <span className="text-xs font-bold text-gray-400">{dueCards.length} 项</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {dueCards.length === 0 && <p className="text-sm text-gray-400 text-center py-10">没有到期卡片</p>}
            {dueCards.map((card) => (
              <button key={card.id} onClick={() => navigate(`/study/${card.deckId}`)} className="w-full text-left flex justify-between items-center px-4 py-3 border-t border-gray-100 hover:bg-gray-50 group">
                <div className="pr-4">
                  <h4 className="font-bold text-sm text-gray-900 mb-1 line-clamp-1">{card.front}</h4>
                  <p className="text-[11px] text-gray-500 line-clamp-1">{card.back}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-600 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </Shell>
  )
}


export default Dashboard