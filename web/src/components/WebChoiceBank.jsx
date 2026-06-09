import React, { useEffect, useMemo, useState } from 'react'
import {
  buildWebChoiceFacets,
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
    deckRoot: '',
    subject: '',
    book: '',
    type: '',
    keyword: '',
  })
  const [selectedId, setSelectedId] = useState('')

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
  const filteredCards = useMemo(() => filterWebChoiceCards(cards, filters), [cards, filters])
  const selectedCard = useMemo(
    () => filteredCards.find((card) => card.id === selectedId) || filteredCards[0],
    [filteredCards, selectedId],
  )

  useEffect(() => {
    if (filteredCards.length && !filteredCards.some((card) => card.id === selectedId)) {
      setSelectedId(filteredCards[0].id)
    }
  }, [filteredCards, selectedId])

  if (!allowed) return null

  return (
    <div className="web-choice-bank">
      <header className="web-choice-bank-hero">
        <div>
          <div className="web-choice-kicker">内置题库</div>
          <h1>{WEB_CHOICE_BANK_TITLE}</h1>
          <p>基于 cards.json 的网站版选择题组件，不再使用 Anki 的 AS 字段模板。</p>
        </div>
        <div className="web-choice-count">
          <strong>{cards.length.toLocaleString()}</strong>
          <span>题</span>
        </div>
      </header>

      {loading ? <div className="web-choice-loading">正在加载 cards.json...</div> : null}
      {error ? <div className="web-choice-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="web-choice-layout">
          <aside className="web-choice-sidebar">
            <FacetGroup
              title="Deck"
              items={facets.decks}
              active={filters.deckRoot}
              onChange={(deckRoot) => setFilters((prev) => ({ ...prev, deckRoot }))}
            />
            <FacetGroup
              title="Subject"
              items={facets.subjects}
              active={filters.subject}
              onChange={(subject) => setFilters((prev) => ({ ...prev, subject }))}
            />
            <FacetGroup
              title="Book"
              items={facets.books}
              active={filters.book}
              onChange={(book) => setFilters((prev) => ({ ...prev, book }))}
            />
          </aside>

          <section className="web-choice-list-panel">
            <div className="web-choice-toolbar">
              <input
                value={filters.keyword}
                placeholder="搜索题干 / 选项 / 路径"
                onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
              />
              <select
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="">全部题型</option>
                <option value="单选">单选</option>
                <option value="多选">多选</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  setFilters({ deckRoot: '', subject: '', book: '', type: '', keyword: '' })
                }
              >
                重置
              </button>
            </div>

            <div className="web-choice-result-count">
              当前 {filteredCards.length.toLocaleString()} 题
            </div>

            <div className="web-choice-card-list">
              {filteredCards.slice(0, 300).map((card) => (
                <button
                  type="button"
                  key={card.id}
                  className={`web-choice-card-row ${selectedCard?.id === card.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(card.id)}
                >
                  <strong>{card.number}. {card.question}</strong>
                  <span>{card.subject} / {card.book} / {card.type}</span>
                </button>
              ))}
              {filteredCards.length > 300 ? (
                <div className="web-choice-list-more">
                  已显示前 300 题，请用筛选或搜索缩小范围。
                </div>
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

function FacetGroup({ title, items, active, onChange }) {
  return (
    <section className="web-choice-facet">
      <div className="web-choice-facet-title">{title}</div>
      <button
        type="button"
        className={!active ? 'active' : ''}
        onClick={() => onChange('')}
      >
        <span>全部</span>
        <b>{items.reduce((sum, item) => sum + item.count, 0)}</b>
      </button>
      {items.slice(0, 40).map((item) => (
        <button
          type="button"
          key={item.name}
          className={active === item.name ? 'active' : ''}
          onClick={() => onChange(item.name)}
        >
          <span>{item.name}</span>
          <b>{item.count}</b>
        </button>
      ))}
    </section>
  )
}
