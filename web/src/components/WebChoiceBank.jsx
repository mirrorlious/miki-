import React, { useEffect, useMemo, useState } from 'react'
import {
  buildWebChoiceFacets,
  buildWebChoiceOutline,
  filterWebChoiceCards,
  getStoredWebChoiceAttempt,
  loadWebChoiceCards,
} from '../lib/webChoiceBank'
import { WEB_CHOICE_BANK_TITLE } from '../config/webChoiceBankConfig'
import WebChoiceQuestion from './WebChoiceQuestion'
import './WebChoiceBank.css'

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

  const facets = useMemo(() => buildWebChoiceFacets(cards), [cards])
  const outline = useMemo(() => buildWebChoiceOutline(cards), [cards])
  const filteredCards = useMemo(() => filterWebChoiceCards(cards, filters), [cards, filters])
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
  const drillStats = useMemo(() => buildDrillStats(filteredCards), [filteredCards, attemptVersion])

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
    const nextIndex = Math.min(Math.max(current + offset, 0), filteredCards.length - 1)
    setSelectedId(filteredCards[nextIndex].id)
  }

  function startDrill() {
    if (!filteredCards.length) return
    setMode('drill')
    setSelectedId((current) => filteredCards.some((card) => card.id === current) ? current : filteredCards[0].id)
  }

  function handleAttemptChange() {
    setAttemptVersion((value) => value + 1)
  }

  const visibleSubjects = showAllSubjects ? facets.subjects : facets.subjects.slice(0, SUBJECT_LIMIT)
  const visibleBooks = showAllBooks ? facets.books : facets.books.slice(0, BOOK_LIMIT)

  return (
    <div className={`web-choice-bank ${mode === 'drill' ? 'is-drill-mode' : 'is-browse-mode'}`}>
      <header className="web-choice-bank-hero compact">
        <div>
          <div className="web-choice-kicker">内置题库 · 网站版选择题</div>
          <h1>{WEB_CHOICE_BANK_TITLE}</h1>
          <p>浏览模式负责定位题目；刷题模式只保留题目、答案、解析和进度，让手机端也能沉浸做题。</p>
        </div>
        <div className="web-choice-count">
          <strong>{cards.length.toLocaleString()}</strong>
          <span>题</span>
        </div>
      </header>

      {loading ? <div className="web-choice-loading">正在加载 cards.json...</div> : null}
      {error ? <div className="web-choice-error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <ChoiceDynamicIsland
            mode={mode}
            total={filteredCards.length}
            index={selectedIndex}
            stats={drillStats}
            activeTitle={activeNode?.label || '全部题目'}
            onBrowse={() => setMode('browse')}
            onDrill={startDrill}
            onPrev={() => goToOffset(-1)}
            onNext={() => goToOffset(1)}
          />

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
                </div>

                <div className="web-choice-section-title">
                  <div>
                    <strong>{activeNode?.label || '全部题目'}</strong>
                    <span>{activeNode?.pathLabel || '全部'} · 当前 {filteredCards.length.toLocaleString()} 题</span>
                  </div>
                  <button type="button" className="web-choice-section-drill" onClick={startDrill} disabled={!filteredCards.length}>
                    开始刷题
                  </button>
                </div>

                <div className="web-choice-card-list card-grid">
                  {filteredCards.slice(0, 600).map((card) => (
                    <button
                      type="button"
                      key={card.id}
                      className={`web-choice-card-row ${selectedCard?.id === card.id ? 'active' : ''}`}
                      onClick={() => selectCard(card.id)}
                    >
                      <div className="web-choice-card-row-top">
                        <strong>{card.number}. {card.question}</strong>
                        <em>{card.type}</em>
                      </div>
                      <p>{makeChoiceCardPreview(card)}</p>
                      <span>{card.book} · {card.deckLeaf}</span>
                    </button>
                  ))}
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
                <WebChoiceQuestion card={selectedCard} mediaBaseUrl={mediaBaseUrl} onAttempt={handleAttemptChange} onReset={handleAttemptChange} />
              </main>
            </div>
          ) : (
            <div className="web-choice-drill-layout">
              <aside className="web-choice-drill-side">
                <div className="web-choice-drill-side-card">
                  <div className="web-choice-kicker">当前范围</div>
                  <strong>{activeNode?.label || '全部题目'}</strong>
                  <span>{filteredCards.length.toLocaleString()} 题 · {filters.type || '全部题型'}</span>
                </div>
                <div className="web-choice-drill-mini-list">
                  {filteredCards.slice(Math.max(0, selectedIndex - 5), selectedIndex + 6).map((card) => (
                    <button
                      type="button"
                      key={card.id}
                      className={card.id === selectedCard?.id ? 'active' : ''}
                      onClick={() => setSelectedId(card.id)}
                    >
                      <b>{card.number}</b>
                      <span>{card.question}</span>
                    </button>
                  ))}
                </div>
              </aside>
              <main className="web-choice-drill-stage">
                <WebChoiceQuestion
                  card={selectedCard}
                  mediaBaseUrl={mediaBaseUrl}
                  onAttempt={handleAttemptChange}
                  onReset={handleAttemptChange}
                  onPrev={() => goToOffset(-1)}
                  onNext={() => goToOffset(1)}
                  showNext
                  compact
                  currentIndex={Math.max(0, selectedIndex)}
                  total={filteredCards.length}
                />
              </main>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

function ChoiceDynamicIsland({ mode, total, index, stats, activeTitle, onBrowse, onDrill, onPrev, onNext }) {
  const progress = total > 0 && index >= 0 ? Math.round(((index + 1) / total) * 100) : 0
  const accuracy = stats.done > 0 ? Math.round((stats.correct / stats.done) * 100) : 0

  return (
    <div className="web-choice-island-wrap">
      <div className="web-choice-island" role="status" aria-live="polite">
        <div className="web-choice-island-core">
          <span className={`web-choice-island-dot ${mode === 'drill' ? 'active' : ''}`} />
          <div>
            <strong>{mode === 'drill' ? '刷题模式' : '浏览模式'}</strong>
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
          <button type="button" onClick={onBrowse} className={mode === 'browse' ? 'active' : ''}>浏览</button>
          <button type="button" onClick={onDrill} className={mode === 'drill' ? 'active' : ''}>刷题</button>
          <button type="button" onClick={onPrev} disabled={index <= 0}>‹</button>
          <button type="button" onClick={onNext} disabled={!total || index >= total - 1}>›</button>
        </div>
      </div>
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

function buildDrillStats(cards = []) {
  let done = 0
  let correct = 0
  for (const card of cards) {
    const attempt = getStoredWebChoiceAttempt(card.id)
    if (!attempt?.revealed) continue
    done += 1
    if (attempt.correct) correct += 1
  }
  return { done, correct }
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
