import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers3,
  Mic2,
  Plus,
  Search,
  Sparkles,
  Upload,
  Wand2,
  Wrench,
  X,
  Flame,
} from 'lucide-react'
import { todayKey } from '../data.js'
import { isCardDue, isNewCard } from '../lib/browseUtils.js'
import { getDeckPath, getDeckSection, getSectionNames, sortDecksByPath } from '../lib/deckUtils.js'
import Shell from './Shell.jsx'

const CARD_MAKER_URL = 'https://anki-card-maker-xi.vercel.app/'

function isWeakCard(card) {
  const grade = Number(card?.review?.lastGrade)
  return Boolean(
    card?.flagged ||
    card?.flagColor ||
    Number(card?.review?.lapses ?? 0) > 0 ||
    grade === 0 ||
    grade === 1
  )
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

function getDeckRows(decks, cards) {
  const rowMap = new Map()
  for (const deck of decks) {
    rowMap.set(deck.id, {
      ...deck,
      total: 0,
      due: 0,
      weak: 0,
      newCount: 0,
      pressure: 0,
    })
  }

  for (const card of cards) {
    const row = rowMap.get(card.deckId)
    if (!row) continue
    row.total += 1
    if (isCardDue(card)) row.due += 1
    if (isWeakCard(card)) row.weak += 1
    if (isNewCard(card)) row.newCount += 1
  }

  return sortDecksByPath(Array.from(rowMap.values())).map((row) => ({
    ...row,
    pressure: row.due * 3 + row.weak * 2 + row.newCount,
  }))
}

function MetricTile({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="metric-tile group relative flex min-h-[118px] min-w-0 flex-col justify-end overflow-hidden rounded-[18px] border border-white/80 bg-white/75 p-3 shadow-sm ring-1 ring-gray-100/80 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg sm:min-h-[190px] sm:p-4 lg:min-h-[240px] lg:p-5">
      <div className={`metric-tile-icon absolute left-3 top-3 flex h-10 w-10 items-start justify-start rounded-[15px] p-2.5 ${tone} opacity-95 transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] sm:left-4 sm:top-4 sm:h-12 sm:w-12 sm:p-3 sm:group-hover:left-3 sm:group-hover:top-3 sm:group-hover:h-[calc(100%-1.5rem)] sm:group-hover:w-[calc(100%-1.5rem)] sm:group-hover:rounded-[16px] sm:group-hover:p-5 sm:group-hover:opacity-100 sm:group-hover:shadow-inner`}>
        <Icon size={20} className="shrink-0 transition-transform duration-500 sm:group-hover:scale-125" />
      </div>
      <div className="relative z-10 min-w-0 transition-transform duration-300 sm:group-hover:translate-x-1">
        <p className="text-[11px] font-black leading-4 text-gray-500">{label}</p>
        <p className="mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-black leading-none tracking-tight text-gray-950 text-[clamp(1.65rem,9vw,2.25rem)] sm:mt-2 sm:text-[clamp(1.8rem,2vw,2.45rem)]">{value}</p>
        <p className="mt-1 text-[11px] font-bold leading-4 text-gray-500 sm:mt-2">{hint}</p>
      </div>
    </div>
  )
}

function ToolboxItem({ icon: Icon, title, description, tone, onClick, href }) {
  const content = (
    <>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-black text-gray-950">{title}</strong>
        <em className="mt-0.5 block truncate text-xs font-bold not-italic text-gray-400">{description}</em>
      </span>
      {href ? <ExternalLink size={15} className="text-gray-300" /> : <ChevronRight size={16} className="text-gray-300" />}
    </>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-gray-50 p-4 text-left transition hover:bg-gray-100">
        {content}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl bg-gray-50 p-4 text-left transition hover:bg-gray-100">
      {content}
    </button>
  )
}

function Decks({ data, onOpenCreateDeck, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const [toolboxOpen, setToolboxOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [selectedSection, setSelectedSection] = useState('全部')
  const [libraryQuery, setLibraryQuery] = useState('')

  const today = todayKey()
  const cards = Array.isArray(data?.cards) ? data.cards : []
  const decks = Array.isArray(data?.decks) ? data.decks : []
  const reviewLogs = Array.isArray(data?.reviewLogs) ? data.reviewLogs : []

  const dueCards = useMemo(() => cards.filter(isCardDue), [cards])
  const weakCards = useMemo(() => cards.filter(isWeakCard), [cards])
  const newCards = useMemo(() => cards.filter(isNewCard), [cards])
  const reviewedToday = useMemo(() => reviewLogs.filter((log) => toLocalDateKey(log.reviewedAt) === today), [reviewLogs, today])
  const deckRows = useMemo(() => getDeckRows(decks, cards), [decks, cards])

  const clearRate = dueCards.length + reviewedToday.length > 0
    ? Math.round((reviewedToday.length / (dueCards.length + reviewedToday.length)) * 100)
    : 0
  const estimatedMinutes = Math.max(3, Math.ceil(dueCards.length * 1.4 + Math.min(weakCards.length, 20) * 0.9 + Math.min(newCards.length, 10) * 0.8))
  const firstStudyDeckId = dueCards[0]?.deckId || weakCards[0]?.deckId || newCards[0]?.deckId || studyDeckId || decks[0]?.id
  const recommendationRows = useMemo(() => [...deckRows].filter((deck) => deck.total > 0).sort((a, b) => b.pressure - a.pressure).slice(0, 5), [deckRows])
  const sections = useMemo(() => ['全部', ...getSectionNames(deckRows)], [deckRows])

  const visibleDeckRows = useMemo(() => {
    const keyword = libraryQuery.trim().toLowerCase()
    return deckRows
      .filter((deck) => deck.total > 0)
      .filter((deck) => selectedSection === '全部' || getDeckSection(deck) === selectedSection)
      .filter((deck) => !keyword || deck.name.toLowerCase().includes(keyword) || getDeckPath(deck).toLowerCase().includes(keyword))
  }, [deckRows, libraryQuery, selectedSection])

  function goAddCard(deckId = firstStudyDeckId) {
    if (deckId) navigate(`/cards/new/${deckId}`)
    else onOpenCreateDeck?.()
  }

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId} wide>
      <header className="mb-4 flex flex-col gap-3 sm:mb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-[0.22em] text-blue-600">today desk</p>
          <h1 className="text-2xl font-black text-gray-950">今日学习台</h1>
          <p className="mt-1 text-sm text-gray-500">首页只回答一件事：现在该学什么。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setToolboxOpen(true)} className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">
            <Wrench size={15} className="mr-1 inline" />工具箱
          </button>
          <button type="button" onClick={() => navigate('/import')} className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">导入</button>
          <button type="button" onClick={() => firstStudyDeckId && navigate(`/study/${firstStudyDeckId}`)} disabled={!firstStudyDeckId} className="h-10 rounded-xl bg-[#007aff] px-5 text-sm font-black text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300">
            开始今日学习
          </button>
        </div>
      </header>

      <section className="mb-4 overflow-hidden rounded-[22px] border border-white bg-white/90 shadow-sm sm:mb-5 sm:rounded-[28px]">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_1.1fr]">
          <div className="border-b border-gray-100 p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="mb-2 text-xs font-black text-blue-600">TODAY PLAN</p>
                <h2 className="text-xl font-black text-gray-950 sm:text-2xl">今天先处理这三件事</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500 sm:block">预计 {estimatedMinutes} 分钟：先清到期，再回收薄弱，最后少量推进新卡。</p>
              </div>
              <div className="shrink-0 rounded-[20px] border border-blue-100 bg-blue-50/80 px-4 py-3 text-center text-blue-900 shadow-inner ring-1 ring-white/80 sm:rounded-[24px] sm:px-5 sm:py-4">
                <p className="text-xs font-black text-blue-400">清空率</p>
                <p className="text-2xl font-black tracking-tight sm:text-3xl">{clearRate}%</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 min-[1720px]:grid-cols-4">
              <MetricTile icon={BookOpen} label="待复习" value={dueCards.length} hint="今天必须处理" tone="bg-red-100 text-red-600" />
              <MetricTile icon={AlertTriangle} label="仍模糊" value={weakCards.length} hint="优先回收" tone="bg-orange-100 text-orange-600" />
              <MetricTile icon={CheckCircle2} label="已完成" value={reviewedToday.length} hint="今日完成" tone="bg-green-100 text-green-700" />
              <MetricTile icon={Layers3} label="新卡池" value={newCards.length} hint="量力追加" tone="bg-blue-100 text-blue-700" />
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-gray-950">今日推荐 5 个任务</h2>
              <button type="button" onClick={() => navigate('/map')} className="text-xs font-black text-blue-600 hover:text-blue-700">用知识拼图筛卡</button>
            </div>

            <div className="space-y-3">
              {recommendationRows.map((deck, index) => (
                <button key={deck.id} type="button" onClick={() => navigate(`/study/${deck.id}`)} className="group flex w-full items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-left transition hover:bg-blue-50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-blue-100 bg-blue-50/80 text-sm font-black text-blue-700 shadow-inner">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-black text-gray-950">{deck.name}</strong>
                    <span className="mt-1 block truncate text-xs font-bold text-gray-400">{getDeckPath(deck)}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs font-black text-gray-400">
                    <b className="text-orange-500">薄弱 {deck.weak}</b><br />
                    新卡 {deck.newCount}
                  </span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500" />
                </button>
              ))}
              {recommendationRows.length === 0 && (
                <p className="rounded-2xl bg-gray-50 py-12 text-center text-sm font-bold text-gray-400">暂无学习任务</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white bg-white/90 shadow-sm">
        <button type="button" onClick={() => setLibraryOpen((value) => !value)} className="flex h-14 w-full items-center justify-between px-5 text-left">
          <span>
            <strong className="block text-sm font-black text-gray-950">我的资料库</strong>
            <span className="text-xs font-bold text-gray-400">{cards.length} 张卡 · {decks.length} 个卡组，默认折叠，避免首页变后台。</span>
          </span>
          <ChevronDown size={16} className={`text-gray-400 transition ${libraryOpen ? 'rotate-180' : ''}`} />
        </button>

        {libraryOpen && (
          <div className="border-t border-gray-100 p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {sections.map((section) => (
                  <button key={section} type="button" onClick={() => setSelectedSection(section)} className={`rounded-full px-3 py-1.5 text-xs font-black ${selectedSection === section ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {section}
                  </button>
                ))}
              </div>
              <div className="relative w-full lg:w-72">
                <Search size={15} className="absolute left-3 top-2.5 text-gray-300" />
                <input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="搜索卡组 / 路径" className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-[#007aff] focus:bg-white" />
              </div>
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
                  <div className="mb-3 flex gap-2 text-xs font-black">
                    <span className="text-blue-600">新 {deck.newCount}</span>
                    <span className="text-red-600">到期 {deck.due}</span>
                    <span className="text-orange-600">薄弱 {deck.weak}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => navigate(`/study/${deck.id}`)} className="h-8 rounded-lg bg-blue-50 text-xs font-black text-blue-600">学习</button>
                    <button type="button" onClick={() => goAddCard(deck.id)} className="h-8 rounded-lg bg-gray-100 text-xs font-black text-gray-600">添加</button>
                    <button type="button" onClick={() => navigate('/browse', { state: { deckId: deck.id } })} className="h-8 rounded-lg bg-gray-100 text-xs font-black text-gray-600">浏览</button>
                  </div>
                </article>
              ))}
            </div>

            {visibleDeckRows.length > 18 && (
              <p className="pt-4 text-center text-xs font-bold text-gray-400">已显示前 18 个卡组，可在浏览页查看全部。</p>
            )}
            {visibleDeckRows.length === 0 && (
              <p className="rounded-2xl bg-gray-50 py-10 text-center text-sm font-bold text-gray-400">没有匹配的卡组。</p>
            )}
          </div>
        )}
      </section>

      {toolboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setToolboxOpen(false)}>
          <aside className="ml-auto h-full w-full max-w-md bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-950">制卡工具箱</h2>
                <p className="text-xs font-bold text-gray-400">收起来，首页就清爽。</p>
              </div>
              <button type="button" onClick={() => setToolboxOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-500">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-3">
              <ToolboxItem icon={Plus} title="单张制卡" description="手动添加一张卡片" tone="bg-blue-50 text-blue-700" onClick={() => { setToolboxOpen(false); goAddCard() }} />
              <ToolboxItem icon={Upload} title="批量制卡 / 导入" description="文本、Markdown、APKG" tone="bg-green-50 text-green-700" onClick={() => { setToolboxOpen(false); navigate('/import') }} />
              <ToolboxItem icon={Wand2} title="AI 制卡器" description="外部工具，生成后导入" tone="bg-purple-50 text-purple-700" href={CARD_MAKER_URL} />
              <ToolboxItem icon={Mic2} title="语音转文字" description="入口预留，后续可接转写" tone="bg-orange-50 text-orange-700" onClick={() => window.alert('语音转文字入口已预留，下一版可接 Web Speech API 或外部转写。')} />
              <ToolboxItem icon={Search} title="知识拼图" description="组合专题筛卡" tone="bg-gray-100 text-gray-700" onClick={() => { setToolboxOpen(false); navigate('/map') }} />
            </div>
          </aside>
        </div>
      )}
    </Shell>
  )
}

export default Decks
