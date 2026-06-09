import React, { useEffect, useMemo, useState } from 'react'
import {
  buildWebChoiceFacets,
  buildWebChoiceOutline,
  filterWebChoiceCards,
  loadWebChoiceCards,
} from '../lib/webChoiceBank'
import { WEB_CHOICE_BANK_TITLE } from '../config/webChoiceBankConfig'
import WebChoiceQuestion from './WebChoiceQuestion'
import './WebChoiceBank.css'

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
  const activeNode = useMemo(
    () => findOutlineNode(outline, filters.scopeKey || 'all') || outline,
    [outline, filters.scopeKey],
  )

  useEffect(() => {
    if (filteredCards.length && !filteredCards.some((card) => card.id === selectedId)) {
      setSelectedId(filteredCards[0].id)
    }
  }, [filteredCards, selectedId])

  if (!allowed) return null

  function updateFilter(patch) {
    setFilters((prev) => ({ ...prev, ...patch }))
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

  return (
    <div className="web-choice-bank">
      <header className="web-choice-bank-hero compact">
        <div>
          <div className="web-choice-kicker">内置题库 · 网站版选择题</div>
          <h1>{WEB_CHOICE_BANK_TITLE}</h1>
          <p>参考“考试分析重新排版”的资料库结构：左侧目录树，中间题目卡片，右侧直接刷题。不再使用 Anki 的 AS 字段模板。</p>
        </div>
        <div className="web-choice-count">
          <strong>{cards.length.toLocaleString()}</strong>
          <span>题</span>
        </div>
      </header>

      {loading ? <div className="web-choice-loading">正在加载 cards.json...</div> : null}
      {error ? <div className="web-choice-error">{error}</div> : null}

      {!loading && !error ? (
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

            <div className="web-choice-chips">
              <Chip active={!filters.subject} onClick={() => updateFilter({ subject: '' })}>全部科目</Chip>
              {facets.subjects.slice(0, 8).map((item) => (
                <Chip key={item.name} active={filters.subject === item.name} onClick={() => updateFilter({ subject: item.name })}>
                  {item.name}
                </Chip>
              ))}
            </div>
            <div className="web-choice-chips muted">
              <Chip active={!filters.book} onClick={() => updateFilter({ book: '' })}>全部章节</Chip>
              {facets.books.slice(0, 12).map((item) => (
                <Chip key={item.name} active={filters.book === item.name} onClick={() => updateFilter({ book: item.name })}>
                  {item.name}
                </Chip>
              ))}
            </div>

            <div className="web-choice-section-title">
              <div>
                <strong>{activeNode?.label || '全部题目'}</strong>
                <span>{activeNode?.pathLabel || '全部'} · 当前 {filteredCards.length.toLocaleString()} 题</span>
              </div>
            </div>

            <div className="web-choice-card-list card-grid">
              {filteredCards.slice(0, 600).map((card) => (
                <button
                  type="button"
                  key={card.id}
                  className={`web-choice-card-row ${selectedCard?.id === card.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(card.id)}
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
            <WebChoiceQuestion card={selectedCard} mediaBaseUrl={mediaBaseUrl} />
          </main>
        </div>
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
