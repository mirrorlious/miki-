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
import './WebChoiceBank.progress.css'

const SUBJECT_LIMIT = 8
const BOOK_LIMIT = 12

export default function WebChoiceBank({
  user,
  currentUser,
  isAuthenticated,
  cardsUrl,
  mediaBaseUrl,
}) {
  const allowed = Boolean(isAuthenticated || user || currentUser)

  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    scopeKey: 'all',
    deckRoot: '',
    subject: '',
    book: '',
    type: '',
    keyword: '',
  })
  const [selectedId, setSelectedId] = useState('')
  const [collapsedKeys, setCollapsedKeys] = useState(() => new Set())
  const [showAllSubjects, setShowAllSubjects] = useState(false)
  const [showAllBooks, setShowAllBooks] = useState(false)
  const [mode, setMode] = useState('browse')
  const [wrongOnly, setWrongOnly] = useState(false)
  const [cloudAttempts, setCloudAttempts] = useState({})
  const [attemptVersion, setAttemptVersion] = useState(0)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    setLoading(true)
    setError('')
    loadWebChoiceCards(cardsUrl)
      .then((items) => {
        if (cancelled) return
        setCards(items)
        setSelectedId(items[0]?.id || '')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || '题库加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [allowed, cardsUrl])

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    loadCloudWebChoiceAttempts().then((items) => {
      if (!cancelled) setCloudAttempts(items || {})
    })
    return () => { cancelled = true }
  }, [allowed])

  const facets = useMemo(() => buildWebChoiceFacets(cards), [cards])
  const outline = useMemo(() => buildWebChoiceOutline(cards), [cards])
  const baseFilteredCards = useMemo(() => filterWebChoiceCards(cards, filters), [cards, filters])
  const filteredCards = useMemo(() => {
    if (!wrongOnly) return baseFilteredCards
    return baseFilteredCards.filter((card) => Boolean(getAttemptForCard(card, cloudAttempts)?.wrongBook))
  }, [baseFilteredCards, cloudAttempts, wrongOnly, attemptVersion])
  const selectedCard = useMemo(
    () => filteredCards.find((card) => card.id === selectedId) || filteredCards[0],
    [filteredCards, selectedId],
  )
  const selectedIndex = useMemo(() => {
    if (!selectedCard) return -1
    return filteredCards.findIndex((card) => card.id === selectedCard.id)
  }, [filteredCards, selectedCard])
  const activeNode = useMemo(
    () => findOutlineNode(outline, filters.scopeKey || 'all') || outline,
    [outline, filters.scopeKey],
  )
  const drillStats = useMemo(() => buildDrillStats(baseFilteredCards, cloudAttempts), [baseFilteredCards, cloudAttempts, attemptVersion])
  const totalStats = useMemo(() => buildDrillStats(cards, cloudAttempts), [cards, cloudAttempts, attemptVersion])

  useEffect(() => {
    if (filteredCards.length && !filteredCards.some((card) => card.id === selectedId)) {
      setSelectedId(filteredCards[0].id)
    }
  }, [filteredCards, selectedId])

  if (!allowed) return null

  function updateFilter(patch) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  function toggleFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: prev[field] === value ? '' : value }))
  }

  function resetFilters() {
    setFilters({ scopeKey: 'all', deckRoot: '', subject: '', book: '', type: '', keyword: '' })
    setWrongOnly(false)
  }

  function toggleCollapsed(key) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectCard(cardId) {
    setSelectedId(cardId)
    if (mode === 'browse') return
    const target = document.querySelector('.web-choice-drill-stage')
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function goToOffset(offset) {
    if (!filteredCards.length) return
    const current = Math.max(0, selectedIndex)
    const nextIndex = (current + offset + filteredCards.length) % filteredCards.length
    setSelectedId(filteredCards[nextIndex].id)
  }

  function startDrill() {
    if (!filteredCards.length) return
    setMode('drill')
    setSelectedId((current) => filteredCards.some((card) => card.id === current) ? current : filteredCards[0].id)
  }

  function persistAttempt(card, attempt) {
    if (!card?.id) return
    const previous = getAttemptForCard(card, cloudAttempts)
    const merged = mergeWebChoiceAttempt(previous || {}, attempt)
    setCloudAttempts((prev) => ({ ...prev, [card.id]: merged }))
    saveStoredWebChoiceAttempt(card.id, merged)
    saveCloudWebChoiceAttempt(card.id, merged)
    setAttemptVersion((value) => value + 1)
  }

  function toggleWrongBook(card) {
    if (!card?.id) return
    const previous = getAttemptForCard(card, cloudAttempts) || {}
    const next = {
      ...previous,
      selected: Array.isArray(previous.selected) ? previous.selected : [],
      revealed: Boolean(previous.revealed),
      skipped: Boolean(previous.skipped),
      correct: Boolean(previous.correct),
      wrongBook: !previous.wrongBook,
      mastery: previous.mastery || (!previous.wrongBook ? 'weak' : 'new'),
      updatedAt: Date.now(),
    }
    setCloudAttempts((prev) => ({ ...prev, [card.id]: next }))
    saveStoredWebChoiceAttempt(card.id, next)
    saveCloudWebChoiceAttempt(card.id, next)
    setAttemptVersion((value) => value + 1)
  }

  function openWrongBook() {
    setWrongOnly((value) => !value)
    setMode('drill')
  }

  const visibleSubjects = showAllSubjects ? facets.subjects : facets.subjects.slice(0, SUBJECT_LIMIT)
  const visibleBooks = showAllBooks ? facets.books : facets.books.slice(0, BOOK_LIMIT)
  const selectedAttempt = selectedCard ? getAttemptForCard(selectedCard, cloudAttempts) : null

  return (
    <div className={`web-choice-bank ${mode === 'drill' ? 'is-drill-mode' : 'is-browse-mode'}`}>
      <header className="web-choice-bank-hero compact">
        <div>
          <div className="web-choice-kicker">内置题库 · 网站版选择题</div>
          <h1>{WEB_CHOICE_BANK_TITLE}</h1>
          <p>浏览模式负责定位题目；刷题模式会记录进度、记忆状态、正确率和错题本，并同步到云端。</p>
        </div>
        <div className="web-choice-count practice-count">
          <strong>{cards.length.toLocaleString()}</strong>
          <span>题</span>
          <small>已做 {totalStats.done} · 错题 {totalStats.wrongBook}</small>
        </div>
      </header>

      {loading ? <div className="web-choice-loading">正在加载 cards.json...</div> : null}
      {error ? <div className="web-choice-error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <ChoiceDynamicIsland
            mode={mode}
            wrongOnly={wrongOnly}
            total={filteredCards.length}
            index={selectedIndex}
            stats={drillStats}
            activeTitle={wrongOnly ? '错题本' : (activeNode?.label || '全部题目')}
            onBrowse={() => setMode('browse')}
            onDrill={startDrill}
            onWrongBook={openWrongBook}
            onPrev={() => goToOffset(-1)}
            onNext={() => goToOffset(1)}
          />

          <MemoryStrip stats={drillStats} />

          {mode === 'browse' ? (
            <div className="web-choice-layout anki-like">
              <aside className="web-choice-sidebar tree-mode">
                <div className="web-choice-sidebar-head">
                  <div>
                    <strong>目录</strong>
                    <span>{cards.length.toLocaleString()} 张卡片</span>
                  </div>
                </div>
                <div className="web-choice-tree">
                  <OutlineNode
                    node={outline}
                    activeKey={filters.scopeKey || 'all'}
                    collapsedKeys={collapsedKeys}
                    onToggle={toggleCollapsed}
                    onSelect={(scopeKey) => updateFilter({ scopeKey })}
                  />
                </div>
              </aside>

              <section className="web-choice-list-panel grid-mode">
                <div className="web-choice-toolbar sticky-toolbar">
                  <input
                    value={filters.keyword}
                    placeholder="关键词或标签搜索题目"
                    onChange={(e) => updateFilter({ keyword: e.target.value })}
                  />
                  <select value={filters.type} onChange={(e) => updateFilter({ type: e.target.value })}>
                    <option value="">全部题型</option>
                    <option value="单选">单选</option>
                    <option value="多选">多选</option>
                  </select>
                  <button type="button" onClick={resetFilters}>重置</button>
                </div>

                <FilterChipGroup
                  className="web-choice-chips"
                  allLabel="全部科目"
                  field="subject"
                  items={visibleSubjects}
                  activeValue={filters.subject}
                  onClear={() => updateFilter({ subject: '' })}
                  onToggle={toggleFilter}
                  canExpand={facets.subjects.length > SUBJECT_LIMIT}
                  expanded={showAllSubjects}
                  onExpandToggle={() => setShowAllSubjects((value) => !value)}
                  hiddenCount={Math.max(0, facets.subjects.length - SUBJECT_LIMIT)}
                />

                <FilterChipGroup
                  className="web-choice-chips muted"
                  allLabel="全部章节"
                  field="book"
                  items={visibleBooks}
                  activeValue={filters.book}
                  onClear={() => updateFilter({ book: '' })}
                  onToggle={toggleFilter}
                  canExpand={facets.books.length > BOOK_LIMIT}
                  expanded={showAllBooks}
                  onExpandToggle={() => setShowAllBooks((value) => !value)}
                  hiddenCount={Math.max(0, facets.books.length - BOOK_LIMIT)}
                />

                <div className="web-choice-type-chips">
                  {['单选', '多选'].map((type) => (
                    <Chip key={type} active={filters.type === type} onClick={() => toggleFilter('type', type)}>
                      {type}
                    </Chip>
                  ))}
                  <Chip active={wrongOnly} onClick={() => setWrongOnly((value) => !value)}>错题本</Chip>
                </div>

                <div className="web-choice-section-title practice-title">
                  <div>
                    <strong>{wrongOnly ? '错题本' : (activeNode?.label || '全部题目')}</strong>
                    <span>{activeNode?.pathLabel || '全部'} · 当前 {filteredCards.length.toLocaleString()} 题</span>
                  </div>
                  <div className="web-choice-progress-pills">
                    <b>已做 {drillStats.done}</b>
                    <b>记住 {drillStats.remembered}</b>
                    <b>错题 {drillStats.wrongBook}</b>
                  </div>
                  <button type="button" className="web-choice-section-drill" onClick={startDrill} disabled={!filteredCards.length}>
                    开始刷题
                  </button>
                </div>

                <div className="web-choice-card-list card-grid">
                  {filteredCards.slice(0, 600).map((card) => {
                    const attempt = getAttemptForCard(card, cloudAttempts)
                    const status = getAttemptStatus(attempt)
                    return (
                      <button
                        type="button"
                        key={card.id}
                        className={`web-choice-card-row ${selectedCard?.id === card.id ? 'active' : ''} ${status ? `status-${status}` : ''}`}
                        onClick={() => selectCard(card.id)}
                      >
                        <div className="web-choice-card-row-top">
                          <strong>{card.number}. {card.question}</strong>
                          <em>{statusLabel(status) || card.type}</em>
                        </div>
                        <p>{makeChoiceCardPreview(card)}</p>
                        <span>{card.book} · {card.deckLeaf}</span>
                      </button>
                    )
                  })}
                  {filteredCards.length > 600 ? (
                    <div className="web-choice-list-more">
                      已显示前 600 题，请用目录、筛选或搜索缩小范围。
                    </div>
                  ) : null}
                  {!filteredCards.length ? (
                    <div className="web-choice-list-more">没有匹配的题目。</div>
                  ) : null}
                </div>
              </section>

              <main className="web-choice-question-panel">
                <WebChoiceQuestion
                  card={selectedCard}
                  mediaBaseUrl={mediaBaseUrl}
                  storedAttempt={selectedAttempt}
                  wrongBook={Boolean(selectedAttempt?.wrongBook)}
                  onAttempt={persistAttempt}
                  onReset={persistAttempt}
                  onToggleWrongBook={toggleWrongBook}
                />
              </main>
            </div>
          ) : (
            <div className="web-choice-drill-layout">
              <aside className="web-choice-drill-side">
                <div className="web-choice-drill-side-card">
                  <div className="web-choice-kicker">当前范围</div>
                  <strong>{wrongOnly ? '错题本' : (activeNode?.label || '全部题目')}</strong>
                  <span>{filteredCards.length.toLocaleString()} 题 · {filters.type || '全部题型'}</span>
                </div>
                <div className="web-choice-drill-mini-list">
                  {filteredCards.slice(Math.max(0, selectedIndex - 5), selectedIndex + 6).map((card) => {
                    const attempt = getAttemptForCard(card, cloudAttempts)
                    return (
                      <button
                        type="button"
                        key={card.id}
                        className={card.id === selectedCard?.id ? 'active' : ''}
                        onClick={() => setSelectedId(card.id)}
                      >
                        <b>{card.number}</b>
                        <span>{card.question}</span>
                        {attempt?.wrongBook ? <i>错</i> : null}
                      </button>
                    )
                  })}
                </div>
              </aside>
              <main className="web-choice-drill-stage">
                <WebChoiceQuestion
                  card={selectedCard}
                  mediaBaseUrl={mediaBaseUrl}
                  storedAttempt={selectedAttempt}
                  wrongBook={Boolean(selectedAttempt?.wrongBook)}
                  onAttempt={persistAttempt}
                  onReset={persistAttempt}
                  onToggleWrongBook={toggleWrongBook}
                  onPrev={() => goToOffset(-1)}
                  onNext={() => goToOffset(1)}
                  currentIndex={selectedIndex}
                  total={filteredCards.length}
                  showNext
                  compact
                />
              </main>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

function ChoiceDynamicIsland({ mode, wrongOnly, total, index, stats, activeTitle, onBrowse, onDrill, onWrongBook, onPrev, onNext }) {
  const progress = total > 0 && index >= 0 ? Math.round(((index + 1) / total) * 100) : 0
  const accuracy = stats.done > 0 ? Math.round((stats.correct / stats.done) * 100) : 0

  return (
    <div className="web-choice-island-wrap">
      <div className="web-choice-island" role="status" aria-live="polite">
        <div className="web-choice-island-core">
          <span className={`web-choice-island-dot ${mode === 'drill' ? 'active' : ''}`} />
          <div>
            <strong>{wrongOnly ? '错题本' : mode === 'drill' ? '刷题模式' : '浏览模式'}</strong>
            <small>{activeTitle} · {total.toLocaleString()} 题</small>
          </div>
        </div>
        <div className="web-choice-island-stat">
          <b>{index >= 0 ? index + 1 : 0}</b><span>/ {total}</span>
        </div>
        <div className="web-choice-island-progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="web-choice-island-stat hide-sm"><b>{stats.done}</b><span>已做</span></div>
        <div className="web-choice-island-stat hide-sm"><b>{accuracy}%</b><span>正确率</span></div>
        <div className="web-choice-island-actions">
          <button type="button" onClick={onBrowse} className={mode === 'browse' && !wrongOnly ? 'active' : ''}>浏览</button>
          <button type="button" onClick={onDrill} className={mode === 'drill' && !wrongOnly ? 'active' : ''}>刷题</button>
          <button type="button" onClick={onWrongBook} className={wrongOnly ? 'active danger' : ''}>错题</button>
          <button type="button" onClick={onPrev} disabled={!total}>‹</button>
          <button type="button" onClick={onNext} disabled={!total}>›</button>
        </div>
      </div>
    </div>
  )
}

function MemoryStrip({ stats }) {
  const total = Math.max(1, stats.total)
  return (
    <div className="web-choice-memory-strip">
      <span style={{ '--w': `${Math.round((stats.done / total) * 100)}%` }}>进度 {stats.done}/{stats.total}</span>
      <span style={{ '--w': `${Math.round((stats.remembered / total) * 100)}%` }}>记住 {stats.remembered}</span>
      <span style={{ '--w': `${Math.round((stats.weak / total) * 100)}%` }}>薄弱 {stats.weak}</span>
      <span style={{ '--w': `${Math.round((stats.wrongBook / total) * 100)}%` }}>错题本 {stats.wrongBook}</span>
    </div>
  )
}

function FilterChipGroup({ className, allLabel, field, items, activeValue, onClear, onToggle, canExpand, expanded, onExpandToggle, hiddenCount }) {
  return (
    <div className={`${className} chip-group-collapsible`}>
      <Chip active={!activeValue} onClick={onClear}>{allLabel}</Chip>
      {items.map((item) => (
        <Chip key={item.name} active={activeValue === item.name} onClick={() => onToggle(field, item.name)}>
          {item.name}
        </Chip>
      ))}
      {canExpand ? (
        <button type="button" className="web-choice-chip-more" onClick={onExpandToggle}>
          {expanded ? '收起' : `展开 ${hiddenCount}`}
        </button>
      ) : null}
    </div>
  )
}

function Chip({ active, children, onClick }) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      {children}
    </button>
  )
}

function OutlineNode({ node, activeKey, collapsedKeys, onToggle, onSelect }) {
  const hasChildren = node.children?.length > 0
  const collapsed = collapsedKeys.has(node.key)
  const active = activeKey === node.key

  return (
    <div className="web-choice-tree-node">
      <div
        className={`web-choice-tree-row ${active ? 'active' : ''}`}
        style={{ '--depth': Math.max(0, node.depth || 0) }}
      >
        <button
          type="button"
          className="web-choice-tree-toggle"
          onClick={(event) => {
            event.stopPropagation()
            if (hasChildren) onToggle(node.key)
          }}
          aria-label={collapsed ? '展开目录' : '收起目录'}
        >
          {hasChildren ? (collapsed ? '›' : '⌄') : '·'}
        </button>
        <button type="button" className="web-choice-tree-label" onClick={() => onSelect(node.key)} title={node.pathLabel}>
          <span>{node.label}</span>
          <b>{node.count}</b>
        </button>
      </div>
      {hasChildren && !collapsed ? (
        <div className="web-choice-tree-children">
          {node.children.map((child) => (
            <OutlineNode
              key={child.key}
              node={child}
              activeKey={activeKey}
              collapsedKeys={collapsedKeys}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function getAttemptForCard(card, attempts = {}) {
  if (!card?.id) return null
  return attempts?.[card.id] || getStoredWebChoiceAttempt(card.id)
}

function buildDrillStats(cards = [], attempts = {}) {
  const stats = { total: cards.length, done: 0, correct: 0, wrong: 0, wrongBook: 0, remembered: 0, weak: 0, learning: 0 }
  for (const card of cards) {
    const attempt = getAttemptForCard(card, attempts)
    if (!attempt) continue
    if (attempt.wrongBook) stats.wrongBook += 1
    if (attempt.mastery === 'remembered') stats.remembered += 1
    if (attempt.mastery === 'weak') stats.weak += 1
    if (attempt.mastery === 'learning') stats.learning += 1
    if (!attempt.revealed || attempt.skipped) continue
    stats.done += 1
    if (attempt.correct) stats.correct += 1
    else stats.wrong += 1
  }
  return stats
}

function getAttemptStatus(attempt) {
  if (!attempt) return ''
  if (attempt.wrongBook) return 'wrongbook'
  if (!attempt.revealed) return ''
  if (attempt.skipped) return 'seen'
  return attempt.correct ? 'correct' : 'wrong'
}

function statusLabel(status) {
  if (status === 'correct') return '已对'
  if (status === 'wrong') return '错题'
  if (status === 'wrongbook') return '错题本'
  if (status === 'seen') return '已看'
  return ''
}

function findOutlineNode(root, key) {
  if (!root) return null
  if (root.key === key) return root
  for (const child of root.children || []) {
    const found = findOutlineNode(child, key)
    if (found) return found
  }
  return null
}

function makeChoiceCardPreview(card) {
  const first = card.options?.[0] ? `A. ${card.options[0]}` : ''
  const second = card.options?.[1] ? ` B. ${card.options[1]}` : ''
  return `${first}${second}`.trim() || card.subject || card.book || ''
}
