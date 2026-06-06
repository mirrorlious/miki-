import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Plus, CalendarDays, Search, Sparkles, PencilLine, GitCommit, ChevronRight } from 'lucide-react'
import { todayKey, stats } from '../data.js'
import { getDailyLog } from '../lib/activity.js'
import { parseDailyReview } from '../lib/dailyReview.js'
import { getDeckSection, getDeckChapter } from '../lib/deckUtils.js'
import Shell from './Shell.jsx'
import ToolbarButton from './ToolbarButton.jsx'
import LearningOverviewPanel from './LearningOverviewPanel.jsx'
import AchievementSummaryPanel from './AchievementSummaryPanel.jsx'
import DailyReviewPanel from './DailyReviewPanel.jsx'
import CollapseToggle from './CollapseToggle.jsx'

function Decks({ data, onOpenCreateDeck, onOpenEditDeck, onDeleteDeck, onDeleteSection, onSaveDailyLog, onCreateDailyCards, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const [selectedDeckId, setSelectedDeckId] = useState(data.decks[0]?.id ?? null)
  const [selectedSection, setSelectedSection] = useState('全部')
  const [collapsedPanels, setCollapsedPanels] = useState({
    daily: true,
    sections: false,
    deckList: false,
    currentDeck: false,
  })

  function toggleDeckPanel(panel) {
    setCollapsedPanels((current) => ({ ...current, [panel]: !current[panel] }))
  }

  function isPanelExpanded(panel) {
    return !collapsedPanels[panel]
  }

  const deckRows = useMemo(() => sortDecksByPath(data.decks).map((deck) => {
    const cards = data.cards.filter((card) => card.deckId === deck.id)
    return {
      ...deck,
      total: cards.length,
      due: cards.filter(isCardDue).length,
      newCount: cards.filter(isNewCard).length,
    }
  }), [data.cards, data.decks])

  const sectionRows = useMemo(() => getSectionNames(data.decks)
    .map((section) => {
      const sectionDecks = deckRows.filter((deck) => getDeckSection(deck) === section)
      return {
        section,
        total: sectionDecks.reduce((sum, deck) => sum + deck.total, 0),
        due: sectionDecks.reduce((sum, deck) => sum + deck.due, 0),
        deckCount: sectionDecks.length,
      }
    }), [data.decks, deckRows])

  const visibleDeckRows = useMemo(() => (
    selectedSection === '全部'
      ? deckRows
      : deckRows.filter((deck) => getDeckSection(deck) === selectedSection)
  ), [deckRows, selectedSection])

  useEffect(() => {
    if (selectedSection !== '全部' && !sectionRows.some((section) => section.section === selectedSection)) {
      setSelectedSection('全部')
    }
  }, [sectionRows, selectedSection])

  useEffect(() => {
    if (!visibleDeckRows.some((deck) => deck.id === selectedDeckId)) {
      setSelectedDeckId(visibleDeckRows[0]?.id ?? null)
    }
  }, [selectedDeckId, visibleDeckRows])

  const selectedDeck = visibleDeckRows.find((deck) => deck.id === selectedDeckId) ?? deckRows.find((deck) => deck.id === selectedDeckId)
  const deckCards = data.cards.filter((card) => card.deckId === selectedDeck?.id)
  const emptyDeckListText = selectedSection === '全部'
    ? '还没有卡组。'
    : `${selectedSection} 还没有卡组，可以先开一个章节或专题。`
  const selectedSectionSummary = useMemo(() => {
    if (selectedSection === '全部') return { deckCount: 0, cardCount: 0 }
    const sectionDecks = deckRows.filter((deck) => getDeckSection(deck) === selectedSection)
    return {
      deckCount: sectionDecks.length,
      cardCount: sectionDecks.reduce((sum, deck) => sum + deck.total, 0),
    }
  }, [deckRows, selectedSection])

  function handleDelete(deck) {
    const count = data.cards.filter((card) => card.deckId === deck.id).length
    const confirmed = window.confirm(`确定删除卡组“${deck.name}”吗？该卡组下的 ${count} 张卡片也会一起删除。`)
    if (!confirmed) return
    onDeleteDeck(deck.id)
  }

  function handleDeleteSelectedSection() {
    if (selectedSection === '全部' || selectedSectionSummary.deckCount === 0) return
    const confirmed = window.confirm(`确定删除板块“${selectedSection}”吗？该板块下的 ${selectedSectionSummary.deckCount} 个卡组和 ${selectedSectionSummary.cardCount} 张卡片会一起删除。`)
    if (!confirmed) return
    onDeleteSection(selectedSection)
    setSelectedSection('全部')
  }

  function openCreateDeckForCurrentSection() {
    const section = selectedSection !== '全部' && selectedSection !== UNGROUPED_SECTION ? selectedSection : ''
    onOpenCreateDeck(section ? { section } : null)
  }

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">卡组</h1>
          <p className="text-xs text-gray-500 mt-1">按法硕科目、章节和专题组织复习材料。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => selectedDeckId && navigate(`/cards/new/${selectedDeckId}`)} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300" disabled={!selectedDeckId}>添加</button>
          <button onClick={() => navigate('/import')} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300" disabled={!selectedDeckId}>导入</button>
          <button onClick={() => selectedDeckId && navigate(`/study/${selectedDeckId}`)} className="h-10 px-4 rounded-xl bg-[#007aff] text-white text-sm font-bold shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={!selectedDeckId}>学习</button>
        </div>
      </header>

      <LearningOverviewPanel data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_340px] gap-5 items-start">
        <aside className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">学习板块</h2>
            <div className="flex items-center gap-1">
              <BookOpen size={15} className="text-gray-300" />
              <CollapseToggle expanded={isPanelExpanded('sections')} onToggle={() => toggleDeckPanel('sections')} label="学习板块" />
            </div>
          </div>
          {isPanelExpanded('sections') && <div className="p-2 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setSelectedSection('全部')}
              className={`text-left px-3 py-2 rounded text-sm flex items-center justify-between gap-3 ${selectedSection === '全部' ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span>全部</span>
              <span className="text-xs text-gray-400">{data.cards.length}</span>
            </button>
            {sectionRows.map((section) => {
              const isEmpty = section.deckCount === 0
              const isSelected = selectedSection === section.section
              return (
                <button
                  key={section.section}
                  type="button"
                  onClick={() => setSelectedSection(section.section)}
                  className={`text-left px-3 py-2 rounded text-sm ${isSelected ? 'bg-green-50 text-green-700 font-bold' : isEmpty ? 'text-gray-400 hover:bg-gray-50 hover:text-gray-600' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="line-clamp-1">{section.section}</span>
                    <span className="text-xs text-gray-400">{section.total}</span>
                  </span>
                  <span className="mt-1 block text-[11px] text-gray-400">{isEmpty ? '待开架' : `${section.deckCount} 组 · 到期 ${section.due}`}</span>
                </button>
              )
            })}
          </div>}
        </aside>

        <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">{selectedSection === '全部' ? '牌组列表' : `${selectedSection}牌组`}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">{visibleDeckRows.length} 个</span>
              {selectedSection !== '全部' && visibleDeckRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedSection}
                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-red-50 px-2 text-[11px] font-black text-red-600 hover:bg-red-100"
                  title={`删除 ${selectedSection} 板块`}
                >
                  <Trash2 size={12} />
                  删除板块
                </button>
              )}
              <CollapseToggle expanded={isPanelExpanded('deckList')} onToggle={() => toggleDeckPanel('deckList')} label="牌组列表" />
            </div>
          </div>
          {isPanelExpanded('deckList') && (visibleDeckRows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-400 mb-4">{emptyDeckListText}</p>
              <button onClick={openCreateDeckForCurrentSection} className="h-10 px-4 rounded-xl bg-[#007aff] text-white text-sm font-bold hover:bg-[#006ee6]">新建卡组</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2 font-bold">牌组</th>
                  <th className="text-right px-3 py-2 font-bold">新卡</th>
                  <th className="text-right px-3 py-2 font-bold">到期</th>
                  <th className="text-right px-3 py-2 font-bold">总数</th>
                  <th className="text-right px-4 py-2 font-bold">操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeckRows.map((deck) => (
                  <tr key={deck.id} className={`border-t border-gray-100 hover:bg-gray-50 ${selectedDeckId === deck.id ? 'bg-green-50/60' : ''}`}>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setSelectedDeckId(deck.id)} className="text-left">
                        <strong className="block text-sm text-gray-950">{deck.name}</strong>
                        <span className="mt-1 inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                          <FolderOpen size={11} /> {getDeckPath(deck)}
                        </span>
                        <span className="block text-xs text-gray-500 line-clamp-1 mt-1">{deck.description}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right text-blue-600 font-bold">{deck.newCount}</td>
                    <td className="px-3 py-3 text-right text-red-600 font-bold">{deck.due}</td>
                    <td className="px-3 py-3 text-right text-gray-700 font-bold">{deck.total}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => navigate(`/study/${deck.id}`)} className="h-7 px-2 rounded-lg bg-white text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50">学习</button>
                        <button onClick={() => navigate(`/cards/new/${deck.id}`)} className="h-7 px-2 rounded-lg bg-white text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50">添加</button>
                        <button onClick={() => navigate('/browse', { state: { deckId: deck.id } })} className="h-7 px-2 rounded-lg bg-white text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50">浏览</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </section>

        <aside className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">当前牌组</h2>
            <div className="flex items-center gap-2">
              {selectedDeck && <span className="text-xs font-bold text-gray-400">{deckCards.length} 张</span>}
              <CollapseToggle expanded={isPanelExpanded('currentDeck')} onToggle={() => toggleDeckPanel('currentDeck')} label="当前牌组" />
            </div>
          </div>
          {isPanelExpanded('currentDeck') && <>
          <div className="p-4">
            <div>
              {selectedDeck && (
                <span className="mb-2 inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-[11px] font-black text-green-700">
                  <FolderOpen size={12} /> {getDeckPath(selectedDeck)}
                </span>
              )}
              <h3 className="font-black text-gray-950 mb-2">{selectedDeck?.name ?? '卡片列表'}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{selectedDeck?.description ?? '先选择一个卡组。'}</p>
            </div>
            {selectedDeck && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => navigate(`/study/${selectedDeck.id}`)} className="h-9 rounded-xl bg-[#007aff] text-white text-xs font-bold hover:bg-[#006ee6]">开始学习</button>
                <button onClick={() => navigate(`/cards/new/${selectedDeck.id}`)} className="h-9 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200">添加卡片</button>
                <button onClick={() => onOpenEditDeck(selectedDeck)} className="h-9 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200 flex items-center justify-center gap-1.5">
                  <PencilLine size={14} /> 编辑
                </button>
                <button onClick={() => handleDelete(selectedDeck)} className="h-9 rounded-xl bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 flex items-center justify-center gap-1.5">
                  <Trash2 size={14} /> 删除
                </button>
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 max-h-[360px] overflow-y-auto">
            {deckCards.length === 0 && <p className="text-sm text-gray-400 p-4">当前卡组为空。</p>}
            {deckCards.slice(0, 8).map((card) => (
              <div key={card.id} className="px-4 py-3 border-b border-gray-100">
                <strong className="block text-sm text-gray-900 line-clamp-1 mb-1">{card.front}</strong>
                <p className="text-[11px] text-gray-500 line-clamp-1">{card.back}</p>
              </div>
            ))}
          </div>
          </>}
        </aside>
      </div>

      <div className="mt-5">
        <DailyReviewPanel
          data={data}
          selectedDeckId={selectedDeckId}
          onSelectDeck={setSelectedDeckId}
          onSaveDailyLog={onSaveDailyLog}
          onCreateDailyCards={onCreateDailyCards}
          collapsed={collapsedPanels.daily}
          onToggle={() => toggleDeckPanel('daily')}
        />
      </div>

      <AchievementSummaryPanel data={data} />
    </Shell>
  )
}


export default Decks