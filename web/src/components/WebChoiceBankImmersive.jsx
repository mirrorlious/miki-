import React, { useEffect, useMemo, useState } from 'react'
import {
  buildWebChoiceFacets,
  buildWebChoiceOutline,
  filterWebChoiceCards,
  getStoredWebChoiceAttempt,
  loadCloudWebChoiceAttempts,
  loadWebChoiceCards,
  mergeWebChoiceAttempt,
  saveCloudWebChoiceAttempt,
  saveStoredWebChoiceAttempt,
} from '../lib/webChoiceBank'
import { WEB_CHOICE_BANK_TITLE } from '../config/webChoiceBankConfig'
import WebChoiceQuestion from './WebChoiceQuestion'
import './WebChoiceBank.css'
import './WebChoiceBank.drill.css'
import './WebChoiceBank.progress.css'
import './WebChoiceBank.immersive.css'
import './WebChoiceBank.regionToggle.css'

export default function WebChoiceBankImmersive({ user, currentUser, isAuthenticated, cardsUrl, mediaBaseUrl }) {
  const allowed = Boolean(isAuthenticated || user || currentUser)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ scopeKey: 'all', subject: '', book: '', type: '', keyword: '' })
  const [selectedId, setSelectedId] = useState('')
  const [collapsedKeys, setCollapsedKeys] = useState(() => new Set())
  const [tab, setTab] = useState('outline')
  const [sideOpen, setSideOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [hideSidebar, setHideSidebar] = useState(false)
  const [hideQuestion, setHideQuestion] = useState(false)
  const [wrongOnly, setWrongOnly] = useState(false)
  const [unansweredOnly, setUnansweredOnly] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [attempts, setAttempts] = useState({})
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!allowed) return
    let dead = false
    setLoading(true)
    setError('')
    loadWebChoiceCards(cardsUrl)
      .then((items) => { if (!dead) { setCards(items); setSelectedId(items[0]?.id || '') } })
      .catch((err) => { if (!dead) setError(err?.message || '题库加载失败') })
      .finally(() => { if (!dead) setLoading(false) })
    return () => { dead = true }
  }, [allowed, cardsUrl])

  useEffect(() => {
    if (!allowed) return
    let dead = false
    loadCloudWebChoiceAttempts().then((items) => { if (!dead) setAttempts(items || {}) })
    return () => { dead = true }
  }, [allowed])

  const facets = useMemo(() => buildWebChoiceFacets(cards), [cards])
  const outline = useMemo(() => buildWebChoiceOutline(cards), [cards])
  const baseCards = useMemo(() => filterWebChoiceCards(cards, filters), [cards, filters])
  const visibleCards = useMemo(() => {
    let next = baseCards
    if (wrongOnly) next = next.filter((card) => getAttempt(card, attempts)?.wrongBook)
    if (unansweredOnly) next = next.filter((card) => !getAttempt(card, attempts)?.revealed)
    return next
  }, [baseCards, attempts, wrongOnly, unansweredOnly, version])
  const selectedCard = visibleCards.find((card) => card.id === selectedId) || visibleCards[0]
  const selectedIndex = selectedCard ? visibleCards.findIndex((card) => card.id === selectedCard.id) : -1
  const selectedAttempt = selectedCard ? getAttempt(selectedCard, attempts) : null
  const stats = useMemo(() => buildStats(baseCards, attempts), [baseCards, attempts, version])
  const totalStats = useMemo(() => buildStats(cards, attempts), [cards, attempts, version])
  const accuracy = stats.done ? Math.round((stats.correct / stats.done) * 100) : 0
  const progress = visibleCards.length && selectedIndex >= 0 ? Math.max(1, Math.round(((selectedIndex + 1) / visibleCards.length) * 100)) : 0

  useEffect(() => {
    if (visibleCards.length && !visibleCards.some((card) => card.id === selectedId)) setSelectedId(visibleCards[0].id)
  }, [visibleCards, selectedId])

  if (!allowed) return null

  const updateFilter = (patch) => setFilters((prev) => ({ ...prev, ...patch }))
  const toggleFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: prev[field] === value ? '' : value }))
  const resetFilters = () => { setFilters({ scopeKey: 'all', subject: '', book: '', type: '', keyword: '' }); setWrongOnly(false); setUnansweredOnly(false) }
  const toggleCollapsed = (key) => setCollapsedKeys((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })
  const selectScope = (scopeKey) => { updateFilter({ scopeKey }); setSideOpen(false) }
  const go = (offset) => { if (!visibleCards.length) return; const next = (Math.max(0, selectedIndex) + offset + visibleCards.length) % visibleCards.length; setSelectedId(visibleCards[next].id) }
  const toggleUnanswered = () => { setUnansweredOnly((v) => !v); if (!unansweredOnly) setWrongOnly(false) }
  const toggleWrong = () => { setWrongOnly((v) => !v); if (!wrongOnly) setUnansweredOnly(false) }
  const toggleSidebarRegion = () => setHideSidebar((value) => { const next = !value; if (next) setHideQuestion(false); return next })
  const toggleQuestionRegion = () => setHideQuestion((value) => { const next = !value; if (next) setHideSidebar(false); return next })

  function persistAttempt(card, attempt) {
    if (!card?.id) return
    const merged = mergeWebChoiceAttempt(getAttempt(card, attempts) || {}, attempt)
    setAttempts((prev) => ({ ...prev, [card.id]: merged }))
    saveStoredWebChoiceAttempt(card.id, merged)
    saveCloudWebChoiceAttempt(card.id, merged)
    setVersion((v) => v + 1)
  }

  function toggleWrongBook(card) {
    if (!card?.id) return
    const prev = getAttempt(card, attempts) || {}
    const next = { ...prev, selected: Array.isArray(prev.selected) ? prev.selected : [], revealed: Boolean(prev.revealed), skipped: Boolean(prev.skipped), correct: Boolean(prev.correct), wrongBook: !prev.wrongBook, mastery: prev.mastery || (!prev.wrongBook ? 'weak' : 'new'), updatedAt: Date.now() }
    setAttempts((items) => ({ ...items, [card.id]: next }))
    saveStoredWebChoiceAttempt(card.id, next)
    saveCloudWebChoiceAttempt(card.id, next)
    setVersion((v) => v + 1)
  }

  return (
    <div className={`web-bank2 ${expanded ? 'is-expanded' : ''} ${hideSidebar ? 'web-bank2--hide-sidebar' : ''} ${hideQuestion ? 'web-bank2--hide-question' : ''}`}>
      <header className="web-bank2-topbar">
        <div className="web-bank2-brand"><span className="web-bank2-logo">m!</span><span>内置题库</span><b>›</b><strong>{WEB_CHOICE_BANK_TITLE}</strong></div>
        <div className="web-bank2-top-actions">
          <button type="button" onClick={() => setSideOpen((v) => !v)} className="web-bank2-mobile-filter">目录</button>
          <button type="button" className={`web-bank2-region-toggle ${hideSidebar ? 'active' : ''}`} onClick={toggleSidebarRegion} aria-pressed={hideSidebar} title={hideSidebar ? '显示目录区域' : '隐藏目录区域'}>
            <span className="web-bank2-region-icon web-bank2-region-icon--sidebar" />
          </button>
          <button type="button" className={`web-bank2-region-toggle ${hideQuestion ? 'active' : ''}`} onClick={toggleQuestionRegion} aria-pressed={hideQuestion} title={hideQuestion ? '显示题目区域' : '隐藏题目区域'}>
            <span className="web-bank2-region-icon web-bank2-region-icon--question" />
          </button>
          <button type="button" onClick={() => setExpanded((v) => !v)} title="放大 / 还原">⛶</button>
        </div>
      </header>
      {loading ? <div className="web-choice-loading">正在加载 cards.json...</div> : null}
      {error ? <div className="web-choice-error">{error}</div> : null}
      {!loading && !error ? (
        <main className="web-bank2-shell">
          <aside className={`web-bank2-sidebar ${sideOpen ? 'open' : ''}`}>
            <div className="web-bank2-side-head"><div><strong>{cards.length.toLocaleString()}</strong><span>总题目量</span></div><div><strong>{accuracy}%</strong><span>当前正确率</span></div></div>
            <label className="web-bank2-search"><span>⌕</span><input value={filters.keyword} placeholder="搜索题目或关键词..." onChange={(event) => updateFilter({ keyword: event.target.value })} /></label>
            <div className="web-bank2-tabs"><button type="button" className={tab === 'outline' ? 'active' : ''} onClick={() => setTab('outline')}>章节目录</button><button type="button" className={tab === 'filters' ? 'active' : ''} onClick={() => setTab('filters')}>标签筛选</button></div>
            <div className="web-bank2-side-scroll">
              {tab === 'outline' ? <OutlineNode node={outline} activeKey={filters.scopeKey || 'all'} collapsedKeys={collapsedKeys} onToggle={toggleCollapsed} onSelect={selectScope} /> : (
                <div className="web-bank2-filters">
                  <FilterGroup title="题型"><Chip active={!filters.type} onClick={() => updateFilter({ type: '' })}>全部</Chip>{['单选', '多选'].map((type) => <Chip key={type} active={filters.type === type} onClick={() => toggleFilter('type', type)}>{type}</Chip>)}</FilterGroup>
                  <FilterGroup title="状态"><Chip active={unansweredOnly} onClick={toggleUnanswered}>未做</Chip><Chip active={wrongOnly} onClick={toggleWrong}>错题本</Chip><Chip active={false} onClick={resetFilters}>重置</Chip></FilterGroup>
                  <FilterGroup title="科目"><Chip active={!filters.subject} onClick={() => updateFilter({ subject: '' })}>全部科目</Chip>{facets.subjects.map((item) => <Chip key={item.name} active={filters.subject === item.name} onClick={() => toggleFilter('subject', item.name)}>{item.name}</Chip>)}</FilterGroup>
                  <FilterGroup title="章节"><Chip active={!filters.book} onClick={() => updateFilter({ book: '' })}>全部章节</Chip>{facets.books.map((item) => <Chip key={item.name} active={filters.book === item.name} onClick={() => toggleFilter('book', item.name)}>{item.name}</Chip>)}</FilterGroup>
                </div>
              )}
            </div>
          </aside>
          <section className="web-bank2-main">
            <div className="web-bank2-question-head">
              <div className="web-bank2-meta-line"><span className="web-bank2-type">{selectedCard?.type || filters.type || '题型'}</span><span>{selectedCard?.subject || '全部科目'}</span>{selectedCard?.volume ? <><b>›</b><span>{selectedCard.volume}</span></> : null}{selectedCard?.book ? <><b>›</b><strong>{selectedCard.book}</strong></> : null}</div>
              <div className="web-bank2-progress"><strong>{selectedIndex >= 0 ? selectedIndex + 1 : 0}</strong><span>/ {visibleCards.length || 0}</span><i><em style={{ width: `${progress}%` }} /></i></div>
              <div className="web-bank2-mode-pills"><button type="button" className={unansweredOnly ? 'active' : ''} onClick={toggleUnanswered}>未做</button><button type="button" className={wrongOnly ? 'active' : ''} onClick={toggleWrong}>错题</button><button type="button" className={statsOpen ? 'active' : ''} onClick={() => setStatsOpen((v) => !v)}>{statsOpen ? '收起统计' : '显示统计'}</button></div>
              <div className="web-bank2-nav"><button type="button" onClick={() => go(-1)} disabled={!visibleCards.length}>‹</button><button type="button" onClick={() => go(1)} disabled={!visibleCards.length}>›</button></div>
            </div>
            {statsOpen ? <div className="web-bank2-stats-row"><StatPill label="已做" value={`${stats.done}/${stats.total}`} /><StatPill label="记住" value={stats.remembered} /><StatPill label="薄弱" value={stats.weak} /><StatPill label="错题本" value={stats.wrongBook} /><StatPill label="总错题" value={totalStats.wrongBook} subtle /></div> : null}
            <div className="web-bank2-question-scroll"><WebChoiceQuestion card={selectedCard} mediaBaseUrl={mediaBaseUrl} storedAttempt={selectedAttempt} wrongBook={Boolean(selectedAttempt?.wrongBook)} onAttempt={persistAttempt} onReset={persistAttempt} onToggleWrongBook={toggleWrongBook} onPrev={() => go(-1)} onNext={() => go(1)} showNext compact /></div>
          </section>
        </main>
      ) : null}
    </div>
  )
}

function FilterGroup({ title, children }) { return <section className="web-bank2-filter-group"><h3>{title}</h3><div>{children}</div></section> }
function Chip({ active, children, onClick }) { return <button type="button" className={active ? 'active' : ''} onClick={onClick}>{children}</button> }
function StatPill({ label, value, subtle = false }) { return <div className={`web-bank2-stat-pill ${subtle ? 'subtle' : ''}`}><b>{value}</b><span>{label}</span></div> }

function OutlineNode({ node, activeKey, collapsedKeys, onToggle, onSelect }) {
  const hasChildren = node.children?.length > 0
  const collapsed = collapsedKeys.has(node.key)
  const active = activeKey === node.key
  return <div className="web-choice-tree-node"><div className={`web-choice-tree-row ${active ? 'active' : ''}`} style={{ '--depth': Math.max(0, node.depth || 0) }}><button type="button" className="web-choice-tree-toggle" onClick={(event) => { event.stopPropagation(); if (hasChildren) onToggle(node.key) }}>{hasChildren ? (collapsed ? '›' : '⌄') : '·'}</button><button type="button" className="web-choice-tree-label" onClick={() => onSelect(node.key)} title={node.pathLabel}><span>{node.label}</span><b>{node.count}</b></button></div>{hasChildren && !collapsed ? <div className="web-choice-tree-children">{node.children.map((child) => <OutlineNode key={child.key} node={child} activeKey={activeKey} collapsedKeys={collapsedKeys} onToggle={onToggle} onSelect={onSelect} />)}</div> : null}</div>
}

function getAttempt(card, attempts = {}) { if (!card?.id) return null; return attempts?.[card.id] || getStoredWebChoiceAttempt(card.id) }
function buildStats(cards = [], attempts = {}) {
  const stats = { total: cards.length, done: 0, correct: 0, wrong: 0, wrongBook: 0, remembered: 0, weak: 0 }
  for (const card of cards) {
    const attempt = getAttempt(card, attempts)
    if (!attempt) continue
    if (attempt.wrongBook) stats.wrongBook += 1
    if (attempt.mastery === 'remembered') stats.remembered += 1
    if (attempt.mastery === 'weak') stats.weak += 1
    if (!attempt.revealed || attempt.skipped) continue
    stats.done += 1
    if (attempt.correct) stats.correct += 1
    else stats.wrong += 1
  }
  return stats
}
function findOutlineNode(root, key) { if (!root) return null; if (root.key === key) return root; for (const child of root.children || []) { const found = findOutlineNode(child, key); if (found) return found } return null }
