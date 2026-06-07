import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronRight, ExternalLink, FolderOpen, Layers3, Mic2, Plus, Search, Sparkles, Upload, Wand2, Wrench, X } from 'lucide-react'
import { todayKey } from '../data.js'
import { compactCardText, isCardDue, isNewCard } from '../lib/browseUtils.js'
import { getDeckPath, getDeckSection, getSectionNames, sortDecksByPath } from '../lib/deckUtils.js'
import Shell from './Shell.jsx'

const CARD_MAKER_URL = 'https://anki-card-maker-xi.vercel.app/'

function isWeakCard(card) {
  const grade = Number(card?.review?.lastGrade)
  return Boolean(card?.flagged || card?.flagColor || Number(card?.review?.lapses ?? 0) > 0 || grade === 0 || grade === 1)
}

function toLocalDateKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function MetricTile({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm">
      <div className={`mb-3 grid h-11 w-11 place-items-center rounded-2xl ${tone}`}><Icon size={20} /></div>
      <p className="text-xs font-black text-gray-400">{label}</p>
      <p className="mt-1 text-3xl font-black text-gray-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-gray-400">{hint}</p>
    </div>
  )
}

function Decks({ data, onOpenCreateDeck, onOpenEditDeck, onDeleteDeck, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const [toolboxOpen, setToolboxOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [selectedSection, setSelectedSection] = useState('全部')
  const today = todayKey()
  const cards = Array.isArray(data?.cards) ? data.cards : []
  const decks = Array.isArray(data?.decks) ? data.decks : []
  const reviewLogs = Array.isArray(data?.reviewLogs) ? data.reviewLogs : []

  const dueCards = useMemo(() => cards.filter(isCardDue), [cards])
  const weakCards = useMemo(() => cards.filter(isWeakCard), [cards])
  const newCards = useMemo(() => cards.filter(isNewCard), [cards])
  const reviewedToday = useMemo(() => reviewLogs.filter((log) => toLocalDateKey(log.reviewedAt) === today), [reviewLogs, today])
  const clearRate = dueCards.length + reviewedToday.length > 0 ? Math.round((reviewedToday.length / (dueCards.length + reviewedToday.length)) * 100) : 0
  const estimatedMinutes = Math.max(3, Math.ceil(dueCards.length * 1.4 + Math.min(weakCards.length, 20) * 0.9 + Math.min(newCards.length, 10) * 0.8))

  const deckRows = useMemo(() => sortDecksByPath(decks).map((deck) => {
    const deckCards = cards.filter((card) => card.deckId === deck.id)
    const due = deckCards.filter(isCardDue).length
    const weak = deckCards.filter(isWeakCard).length
    const fresh = deckCards.filter(isNewCard).length
    return {
      ...deck,
      total: deckCards.length,
      due,
      weak,
      newCount: fresh,
      pressure: due * 3 + weak * 2 + fresh,
    }
  }).filter((deck) => deck.total > 0), [cards, decks])

  const sections = useMemo(() => ['全部', ...getSectionNames(decks)], [decks])
  const visibleDeckRows = selectedSection === '全部' ? deckRows : deckRows.filter((deck) => getDeckSection(deck) === selectedSection)
  const recommendationRows = [...deckRows].sort((a, b) => b.pressure - a.pressure).slice(0, 5)
  const firstStudyDeckId = dueCards[0]?.deckId || weakCards[0]?.deckId || newCards[0]?.deckId || studyDeckId || decks[0]?.id

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId} wide>
      <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-[0.22em] text-blue-600">today desk</p>
          <h1 className="text-2xl font-black text-gray-950">今日学习台</h1>
          <p className="mt-1 text-sm text-gray-500">首页只回答一件事：现在该学什么。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setToolboxOpen(true)} className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"><Wrench size={15} className="mr-1 inline" />工具箱</button>
          <button onClick={() => navigate('/import')} className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">导入</button>
          <button onClick={() => firstStudyDeckId && navigate(`/study/${firstStudyDeckId}`)} disabled={!firstStudyDeckId} className="h-10 rounded-xl bg-[#007aff] px-5 text-sm font-black text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300">开始今日学习</button>
        </div>
      </header>

      <section className="mb-5 overflow-hidden rounded-[28px] border border-white bg-white/90 shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_1.1fr]">
          <div className="border-b border-gray-100 p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h2 className="text-2xl font-black text-gray-950">今天先处理这三件事</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">预计 {estimatedMinutes} 分钟：先清到期，再回收薄弱，最后少量推进新卡。</p>
              </div>
              <div className="shrink-0 rounded-2xl bg-gray-950 px-5 py-4 text-center text-white">
                <p className="text-xs font-black text-gray-300">清空率</p>
                <p className="text-3xl font-black">{clearRate}%</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricTile icon={BookOpen} label="待复习" value={dueCards.length} hint="今天必须处理" tone="bg-red-50 text-red-500" />
              <MetricTile icon={AlertTriangle} label="仍模糊" value={weakCards.length} hint="优先回收" tone="bg-orange-50 text-orange-500" />
              <MetricTile icon={CheckCircle2} label="已完成" value={reviewedToday.length} hint="今日完成" tone="bg-green-50 text-green-600" />
              <MetricTile icon={Layers3} label="新卡池" value={newCards.length} hint="量力追加" tone="bg-blue-50 text-blue-600" />
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-black text-gray-950">今日推荐 5 个任务</h2>
              <button onClick={() => navigate('/map')} className="text-xs font-black text-blue-600 hover:text-blue-700">用知识拼图筛卡</button>
            </div>
            <div className="space-y-3">
              {recommendationRows.map((deck, index) => (
                <button key={deck.id} onClick={() => navigate(`/study/${deck.id}`)} className="group flex w-full items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-left transition hover:bg-blue-50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gray-950 text-sm font-black text-white">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-black text-gray-950">{deck.name}</strong>
                    <span className="mt-1 block truncate text-xs font-bold text-gray-400">{getDeckPath(deck)}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs font-black text-gray-400"><b className="text-orange-500">薄弱 {deck.weak}</b><br />新卡 {deck.newCount}</span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500" />
                </button>
              ))}
              {recommendationRows.length === 0 && <p className="rounded-2xl bg-gray-50 py-12 text-center text-sm font-bold text-gray-400">暂无学习任务</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white bg-white/90 shadow-sm">
        <button type="button" onClick={() => setLibraryOpen((value) => !value)} className="flex h-14 w-full items-center justify-between px-5 text-left">
          <span><strong className="block text-sm font-black text-gray-950">我的资料库</strong><span className="text-xs font-bold text-gray-400">{cards.length} 张卡 · {decks.length} 个卡组，默认折叠，避免首页变后台。</span></span>
          <ChevronDown size={16} className={`text-gray-400 transition ${libraryOpen ? 'rotate-180' : ''}`} />
        </button>
        {libraryOpen && (
          <div className="border-t border-gray-100 p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {sections.map((section) => (
                <button key={section} onClick={() => setSelectedSection(section)} className={`rounded-full px-3 py-1.5 text-xs font-black ${selectedSection === section ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{section}</button>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {visibleDeckRows.slice(0, 18).map((deck) => (
                <article key={deck.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black text-gray-950">{deck.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-gray-400">{deck.description || getDeckPath(deck)}</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-600">{deck.total}</span>
                  </div>
                  <div className="mb-3 flex gap-2 text-xs font-black"><span className="text-blue-600">新 {deck.newCount}</span><span className="text-red-600">到期 {deck.due}</span><span className="text-orange-600">薄弱 {deck.weak}</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => navigate(`/study/${deck.id}`)} className="h-8 rounded-lg bg-blue-50 text-xs font-black text-blue-600">学习</button>
                    <button onClick={() => navigate(`/cards/new/${deck.id}`)} className="h-8 rounded-lg bg-gray-100 text-xs font-black text-gray-600">添加</button>
                    <button onClick={() => navigate('/browse', { state: { deckId: deck.id } })} className="h-8 rounded-lg bg-gray-100 text-xs font-black text-gray-600">浏览</button>
                  </div>
                </article>
              ))}
            </div>
            {visibleDeckRows.length > 18 && <p className="pt-4 text-center text-xs font-bold text-gray-400">已显示前 18 个卡组，可在浏览页查看全部。</p>}
          </div>
        )}
      </section>

      {toolboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setToolboxOpen(false)}>
          <aside className="ml-auto h-full w-full max-w-md bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-xl font-black text-gray-950">制卡工具箱</h2><p className="text-xs font-bold text-gray-400">收起来，首页就清爽。</p></div>
              <button onClick={() => setToolboxOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-500"><X size={16} /></button>
            </div>
            <div className="grid gap-3">
              <button onClick={() => { setToolboxOpen(false); navigate(`/cards/new/${studyDeckId || decks[0]?.id || ''}`) }} className="flex items-center gap-3 rounded-2xl bg-blue-50 p-4 text-left text-blue-700"><Plus /><span><strong className="block">单张制卡</strong><em className="not-italic text-xs font-bold">手动添加一张卡片</em></span></button>
              <button onClick={() => { setToolboxOpen(false); navigate('/import') }} className="flex items-center gap-3 rounded-2xl bg-green-50 p-4 text-left text-green-700"><Upload /><span><strong className="block">批量制卡 / 导入</strong><em className="not-italic text-xs font-bold">文本、Markdown、APKG</em></span></button>
              <a href={CARD_MAKER_URL} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-purple-50 p-4 text-left text-purple-700"><Wand2 /><span><strong className="block">AI 制卡器</strong><em className="not-italic text-xs font-bold">外部工具，生成后导入</em></span><ExternalLink size={15} className="ml-auto" /></a>
              <button onClick={() => alert('语音转文字入口已预留，下一版可接 Web Speech API 或外部转写。')} className="flex items-center gap-3 rounded-2xl bg-orange-50 p-4 text-left text-orange-700"><Mic2 /><span><strong className="block">语音转文字</strong><em className="not-italic text-xs font-bold">先预留入口</em></span></button>
              <button onClick={() => { setToolboxOpen(false); navigate('/map') }} className="flex items-center gap-3 rounded-2xl bg-gray-100 p-4 text-left text-gray-700"><Search /><span><strong className="block">知识拼图</strong><em className="not-italic text-xs font-bold">组合专题筛卡</em></span></button>
            </div>
          </aside>
        </div>
      )}
    </Shell>
  )
}

export default Decks
