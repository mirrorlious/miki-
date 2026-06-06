import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, PencilLine, Layers3, FolderOpen, ChevronRight, Sparkles, Search } from 'lucide-react'
import { getDeckSection, getDeckChapter } from '../lib/deckUtils.js'
import Shell from './Shell.jsx'
import ToolbarButton from './ToolbarButton.jsx'

function Organize({ data, onOpenCreateDeck, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const outlineRows = getDeckOutlineRows(data)
  const annotations = getAnnotationWall(data)
  const ungroupedDecks = data.decks.filter((deck) => getDeckSection(deck) === UNGROUPED_SECTION)
  const professionalDecks = data.decks.filter((deck) => PROFESSIONAL_SECTIONS.includes(getDeckSection(deck)))
  const linkedPairs = data.cards.flatMap((card) => getCardLinks(card).map((targetId) => {
    const target = data.cards.find((item) => item.id === targetId)
    if (!target || card.id > target.id) return null
    return { card, target }
  })).filter(Boolean)

  const workRows = [
    { label: '收集箱', value: ungroupedDecks.reduce((sum, deck) => sum + getDeckCards(data, deck.id).length, 0), detail: `${ungroupedDecks.length} 组未分配` },
    { label: '专业课', value: professionalDecks.reduce((sum, deck) => sum + getDeckCards(data, deck.id).length, 0), detail: `${professionalDecks.length} 组材料` },
    { label: '横向批注', value: annotations.length, detail: '理解与易错' },
    { label: '关联线', value: linkedPairs.length, detail: '卡片串联' },
  ]

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">整理工作台</h1>
          <p className="text-sm text-gray-500 mt-1">收集、归档、串联和批注分开放，日常复习保持简单。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onOpenCreateDeck()} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">新建卡组</button>
          <button onClick={() => navigate('/browse')} className="h-10 px-4 rounded-xl bg-[#007aff] text-sm font-bold text-white shadow-sm hover:bg-[#006ee6]">浏览卡片</button>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {workRows.map((row) => (
          <div key={row.label} className="rounded-2xl bg-white/90 border border-white shadow-sm p-5">
            <p className="text-xs font-bold text-gray-500 mb-2">{row.label}</p>
            <p className="text-3xl font-black text-gray-950">{row.value}</p>
            <p className="mt-1 text-xs font-bold text-gray-300">{row.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_340px] gap-5 items-start">
        <aside className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">默认路径</h2>
            <FolderOpen size={15} className="text-gray-300" />
          </div>
          <div className="p-3 flex flex-col gap-2">
            <button type="button" onClick={() => navigate('/decks')} className="rounded-xl bg-gray-50 px-3 py-3 text-left hover:bg-green-50">
              <span className="flex items-center justify-between text-sm font-black text-gray-900">
                <span>收集箱</span>
                <span className="text-xs text-gray-400">{ungroupedDecks.length}</span>
              </span>
              <span className="mt-1 block text-xs text-gray-400">未分组、待归档、临时材料</span>
            </button>
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <div className="mb-2 flex items-center justify-between text-sm font-black text-gray-900">
                <span>专业课</span>
                <span className="text-xs text-gray-400">{professionalDecks.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {PROFESSIONAL_SECTIONS.map((section) => (
                  <button key={section} type="button" onClick={() => navigate('/decks')} className="rounded-lg bg-white px-2 py-2 text-left text-xs font-bold text-gray-600 hover:text-green-700">
                    {section}
                  </button>
                ))}
              </div>
            </div>
            {['政治', '英语', '规律专题'].map((section) => {
              const decks = data.decks.filter((deck) => getDeckSection(deck) === section)
              return (
                <button key={section} type="button" onClick={() => navigate('/decks')} className="rounded-xl bg-gray-50 px-3 py-3 text-left hover:bg-green-50">
                  <span className="flex items-center justify-between text-sm font-black text-gray-900">
                    <span>{section}</span>
                    <span className="text-xs text-gray-400">{decks.length}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">章节树</h2>
            <span className="text-xs font-bold text-gray-400">{data.decks.length} 组</span>
          </div>
          <div className="max-h-[620px] overflow-y-auto">
            {outlineRows.map((section) => (
              <div key={section.section} className="border-b border-gray-100 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-black text-gray-950">{section.section}</h3>
                  <span className="text-xs font-bold text-gray-400">{section.cardCount} 张</span>
                </div>
                <div className="flex flex-col gap-2">
                  {section.chapters.map((chapter) => (
                    <div key={`${section.section}-${chapter.chapter}`} className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black text-gray-800">{chapter.chapter}</p>
                        <span className="text-xs font-bold text-gray-400">{chapter.cardCount}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {chapter.decks.map((deck) => (
                          <button key={deck.id} type="button" onClick={() => navigate('/browse', { state: { deckId: deck.id } })} className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-gray-500 hover:text-[#007aff]">
                            {deck.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
            <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-950">关联线</h2>
              <span className="text-xs font-bold text-gray-400">{linkedPairs.length}</span>
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {linkedPairs.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">还没有串联卡片。</p>}
              {linkedPairs.map((pair) => (
                <div key={`${pair.card.id}-${pair.target.id}`} className="border-b border-gray-100 px-4 py-3">
                  <p className="text-xs font-bold text-gray-900 line-clamp-1">{pair.card.front}</p>
                  <p className="my-1 text-[11px] font-black text-gray-300">关联到</p>
                  <p className="text-xs font-bold text-gray-600 line-clamp-1">{pair.target.front}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
            <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-950">批注墙</h2>
              <span className="text-xs font-bold text-gray-400">{annotations.length}</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {annotations.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">批注会在这里横向汇总。</p>}
              {annotations.map((annotation) => (
                <button key={annotation.id} type="button" onClick={() => navigate('/browse', { state: { deckId: annotation.card.deckId } })} className="w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-black text-green-700">{annotation.type}</span>
                    <span className="text-[11px] font-bold text-gray-300">{annotation.deck ? getDeckPath(annotation.deck) : UNGROUPED_SECTION}</span>
                  </div>
                  <p className="text-xs font-bold text-gray-900 line-clamp-1">{annotation.card.front}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500 line-clamp-2">{annotation.text}</p>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </Shell>
  )
}


export default Organize