import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Hash,
  Inbox,
  Link as LinkIcon,
  MessageSquare,
  MoreHorizontal,
  Plus,
} from 'lucide-react'
import { PROFESSIONAL_SECTIONS, UNGROUPED_SECTION } from '../lib/constants.js'
import {
  getDeckCards,
  getDeckOutlineRows,
  getDeckPath,
  getDeckSection,
} from '../lib/deckUtils.js'
import {
  getAnnotationWall,
  getCardLinks,
} from '../lib/browseUtils.js'
import Shell from './Shell.jsx'

function getSectionCardCount(data, section) {
  return data.decks
    .filter((deck) => getDeckSection(deck) === section)
    .reduce((sum, deck) => sum + getDeckCards(data, deck.id).length, 0)
}

function getSectionDecks(data, section) {
  return data.decks.filter((deck) => getDeckSection(deck) === section)
}

function makeLinkedPairs(data) {
  return data.cards.flatMap((card) => getCardLinks(card).map((targetId) => {
    const target = data.cards.find((item) => item.id === targetId)
    if (!target || card.id > target.id) return null
    return { card, target }
  })).filter(Boolean)
}

function EmptyPanel({ icon: Icon, title, detail }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-50">
        <Icon size={20} className="text-slate-300" />
      </div>
      <p className="text-sm font-black text-slate-500">{title}</p>
      <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{detail}</p>
    </div>
  )
}

function Organize({ data, onOpenCreateDeck, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const outlineRows = useMemo(() => getDeckOutlineRows(data), [data])
  const annotations = useMemo(() => getAnnotationWall(data), [data])
  const linkedPairs = useMemo(() => makeLinkedPairs(data), [data])
  const sectionNames = useMemo(() => {
    const names = new Set([...PROFESSIONAL_SECTIONS, '政治', '英语', '规律专题'])
    data.decks.forEach((deck) => names.add(getDeckSection(deck)))
    names.delete(UNGROUPED_SECTION)
    return Array.from(names)
  }, [data.decks])
  const ungroupedCount = useMemo(() => getSectionCardCount(data, UNGROUPED_SECTION), [data])
  const [activeSection, setActiveSection] = useState(() => sectionNames.find((section) => getSectionCardCount(data, section) > 0) ?? PROFESSIONAL_SECTIONS[0] ?? '刑法')
  const [expandedKeys, setExpandedKeys] = useState(() => new Set(['root']))
  const activeOutline = outlineRows.find((row) => row.section === activeSection)
  const activeDecks = getSectionDecks(data, activeSection)
  const activeCardCount = activeDecks.reduce((sum, deck) => sum + getDeckCards(data, deck.id).length, 0)
  const activeAnnotations = annotations.filter((annotation) => getDeckSection(annotation.deck) === activeSection)
  const activeLinkedPairs = linkedPairs.filter((pair) => {
    const deck = data.decks.find((item) => item.id === pair.card.deckId)
    return getDeckSection(deck) === activeSection
  })

  function toggleExpanded(key) {
    setExpandedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function navItem(section) {
    const count = getSectionCardCount(data, section)
    const active = activeSection === section
    return (
      <button
        key={section}
        type="button"
        onClick={() => setActiveSection(section)}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
      >
        <span className="flex min-w-0 items-center gap-2.5 text-sm font-bold">
          <Folder size={16} className={active ? 'text-blue-500' : 'text-slate-400'} />
          <span className="truncate">{section}</span>
        </span>
        <span className={`text-xs font-black ${active ? 'text-blue-600' : 'text-slate-400'}`}>{count}</span>
      </button>
    )
  }

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId} wide>
      <main className="mx-auto flex h-[calc(100vh-86px)] w-full max-w-[1600px] flex-col overflow-hidden px-2 py-2 sm:px-4 sm:py-5">
        <header className="mb-5 flex shrink-0 items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-950">整理工作台</h1>
            <p className="mt-1 text-sm text-slate-500">收集、归档、串联和批注，让知识结构化。</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button onClick={() => onOpenCreateDeck?.()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">
              <Plus size={16} /> 新建卡组
            </button>
            <button onClick={() => navigate('/browse')} className="h-11 rounded-xl bg-[#007aff] px-6 text-sm font-bold text-white shadow-sm shadow-blue-200 hover:bg-[#006ee6]">浏览卡片</button>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
          <aside className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">默认路径</p>
              <button type="button" onClick={() => setActiveSection(UNGROUPED_SECTION)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left ${activeSection === UNGROUPED_SECTION ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                <span className="flex items-center gap-2.5 text-sm font-bold"><Inbox size={16} className="text-blue-500" /> 收集箱</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-black text-blue-600">{ungroupedCount}</span>
              </button>
            </div>
            <div className="h-full overflow-y-auto p-4 pb-16">
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">专业课卡组</p>
              <div className="space-y-1">
                {PROFESSIONAL_SECTIONS.map(navItem)}
              </div>
              <p className="mb-2 mt-6 text-[11px] font-black uppercase tracking-wider text-slate-400">公共课与其他</p>
              <div className="space-y-1">
                {sectionNames.filter((section) => !PROFESSIONAL_SECTIONS.includes(section) && section !== UNGROUPED_SECTION).map(navItem)}
              </div>
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-slate-50/60 px-5">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="text-slate-500">卡组资源管理器</span>
                <ChevronRight size={14} className="text-slate-400" />
                <span className="truncate font-black text-slate-900">{activeSection}</span>
                <span className="ml-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-400">{activeDecks.length} 组 · {activeCardCount} 张</span>
              </div>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-600">
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="h-full overflow-y-auto pb-16">
              {activeOutline?.chapters?.length ? activeOutline.chapters.map((chapter) => {
                const key = `${activeSection}/${chapter.chapter}`
                const expanded = expandedKeys.has(key)
                return (
                  <div key={key} className="border-b border-slate-100">
                    <button type="button" onClick={() => toggleExpanded(key)} className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-slate-50">
                      <span className="flex min-w-0 items-center gap-3">
                        {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                        <Folder size={18} className={chapter.cardCount > 0 ? 'text-blue-400' : 'text-slate-300'} />
                        <span className="truncate text-sm font-black text-slate-800">{chapter.chapter}</span>
                      </span>
                      <span className="w-16 text-right text-sm font-bold text-slate-400">{chapter.cardCount} 张</span>
                    </button>
                    {expanded && (
                      <div className="border-t border-dashed border-slate-100 bg-slate-50/35 px-5 py-2">
                        {chapter.decks.map((deck) => {
                          const count = getDeckCards(data, deck.id).length
                          return (
                            <button key={deck.id} type="button" onClick={() => navigate('/browse', { state: { deckId: deck.id } })} className="flex w-full items-center justify-between rounded-lg py-2 pl-10 pr-2 text-left hover:bg-white">
                              <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-600"><Hash size={14} className="text-slate-400" /> <span className="truncate">{deck.name}</span></span>
                              <span className="text-xs font-bold text-slate-400">{count} 张</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }) : (
                <div className="grid min-h-[360px] place-items-center text-center">
                  <div>
                    <Folder size={34} className="mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-black text-slate-400">这个分区还没有卡组</p>
                    <p className="mt-1 text-xs font-bold text-slate-300">点击右上角新建卡组，或者从导入页归档材料。</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col gap-4">
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex h-12 items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4">
                <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><LinkIcon size={14} className="text-slate-400" /> 关联线</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{activeLinkedPairs.length}</span>
              </div>
              {activeLinkedPairs.length === 0 ? (
                <EmptyPanel icon={ArrowRightLeft} title="还没有串联卡片" detail="选中卡片或节点后，这里会作为横向知识链接面板。" />
              ) : (
                <div className="overflow-y-auto">
                  {activeLinkedPairs.slice(0, 30).map((pair) => (
                    <button key={`${pair.card.id}-${pair.target.id}`} type="button" onClick={() => navigate('/browse', { state: { cardId: pair.card.id, deckId: pair.card.deckId } })} className="w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50">
                      <p className="line-clamp-1 text-xs font-black text-slate-900">{pair.card.front}</p>
                      <p className="my-1 text-[11px] font-black text-slate-300">关联到</p>
                      <p className="line-clamp-1 text-xs font-bold text-slate-600">{pair.target.front}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex h-12 items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4">
                <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><MessageSquare size={14} className="text-slate-400" /> 批注墙</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{activeAnnotations.length}</span>
              </div>
              {activeAnnotations.length === 0 ? (
                <EmptyPanel icon={FileText} title="批注会在这里汇总" detail="复习或浏览时添加的理解与易错点，会按当前分区显示。" />
              ) : (
                <div className="overflow-y-auto">
                  {activeAnnotations.slice(0, 30).map((annotation) => (
                    <button key={annotation.id} type="button" onClick={() => navigate('/browse', { state: { cardId: annotation.card.id, deckId: annotation.card.deckId } })} className="w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">{annotation.type}</span>
                        <span className="truncate text-[11px] font-bold text-slate-300">{annotation.deck ? getDeckPath(annotation.deck) : UNGROUPED_SECTION}</span>
                      </div>
                      <p className="line-clamp-1 text-xs font-black text-slate-900">{annotation.card.front}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{annotation.text}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </section>
      </main>
    </Shell>
  )
}

export default Organize
