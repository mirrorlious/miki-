import { useState, useEffect, useMemo, useRef, useCallback, startTransition } from 'react'
import { Link, NavLink, useNavigate, useLocation, useParams } from 'react-router-dom'
import { AlignLeft, BookOpen, Brain, ChevronRight, Flag, FolderOpen, Gift, Layers3, List, ListOrdered, Maximize2, MoreVertical, Plus, Search, Star, Trash2, Wand2, X, ArrowUp, ArrowDown, Check, GripHorizontal, MessageSquare, PencilLine, User, Volume2 } from 'lucide-react'
import { motion } from 'framer-motion'
import DOMPurify from 'dompurify'
import { getDeckOptionLabel, getDeckScopeParts } from '../lib/deckUtils.js'
import { sanitizeCardHtml, scopeAnkiCss, sanitizeCssScopeId } from '../lib/cardHtml.js'
import { getCardAnnotations, getCardLinks, getRelatedSuggestions, getCardHtmlSections, getCardScopeParts, getScopeKey, buildBrowseScopeTree, flattenScopeTree, findBestScopeNodeForDeck, isCardDue, isNewCard, getCardReviewStateLabel, hasStoredCardHtml, compactCardText, isBuiltinDylItem } from '../lib/browseUtils.js'
import { makeHtmlTextSelectable, stripAnswerSectionFromHtml, stripAnswerSectionFromText, stripSelectionBlockingStylesFromCss } from '../ankiHtml.js'
import Shell from './Shell.jsx'
import ToolbarButton from './ToolbarButton.jsx'
import CardContent from './CardContent.jsx'
import PixelItemIcon from './PixelItemIcon.jsx'

const BROWSE_CARD_RENDER_LIMIT = 48
const FLAG_COLOR_OPTIONS = [
import { memo, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import ToolbarButton from './components/ToolbarButton.jsx'
import PixelItemIcon from './components/PixelItemIcon.jsx'
import CollapseToggle from './components/CollapseToggle.jsx'
import CardContent from './components/CardContent.jsx'
import AuthDialog from './components/AuthDialog.jsx'
import Shell from './components/Shell.jsx'
import { motion } from 'framer-motion'
import DOMPurify from 'dompurify'
import {
  AlignLeft,
  BookOpen,
  Brain,
  Bold,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Flag,
  FolderOpen,
  Gift,
  Image,
  Italic,
  LayoutDashboard,
  Layers3,
  List,
  ListOrdered,
  LogIn,
  LogOut,
  GitBranch,
  Maximize2,
  MessageSquare,
  Moon,
  MoreVertical,
  PencilLine,
  Plus,
  Settings,
  Star,
  Strikethrough,
  Sun,
  Target,
  Trash2,
  Underline,
  Upload,
  User,
  Video,
  Volume2,
  Wand2,
  X,
} from 'lucide-react'
import { parseApkgFile } from './apkgImport'
import {
  makeHtmlTextSelectable,
  stripAnswerSectionFromHtml,
  stripAnswerSectionFromText,
  stripSelectionBlockingStylesFromCss,
} from './ankiHtml'
import { parseBulkCards, parseMarkdownCards } from './cardImport'
import { loadData, scheduleReview, stats, STORAGE_KEY, todayKey } from './data'
import { useCloudSync } from './useCloudSync'
import ErrorBoundary from './components/ErrorBoundary'

const DECK_COLOR_OPTIONS = [
  { value: 'sun', label: '暖黄', cardClass: 'bg-yellow-50/80 border-yellow-100/50', pillClass: 'bg-yellow-100 text-yellow-700' },
  { value: 'sea', label: '浅蓝', cardClass: 'bg-blue-50/80 border-blue-100/50', pillClass: 'bg-blue-100 text-blue-700' },
  { value: 'rose', label: '浅粉', cardClass: 'bg-rose-50/80 border-rose-100/50', pillClass: 'bg-rose-100 text-rose-700' },
  { value: 'mint', label: '薄荷', cardClass: 'bg-emerald-50/80 border-emerald-100/50', pillClass: 'bg-emerald-100 text-emerald-700' },
]



import { memo, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'


import { memo, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'


import { memo, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'


import { memo, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'


function BrowseWorktable({
  data,
  studyDeckId,
  cloud,
  onUpdateCardMeta,
  onOpenCreateDeck,
  onOpenEditDeck,
  onDeleteDeck,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const initialDeckId = location.state?.deckId ?? data.decks[0]?.id ?? ''
  const [selectedScopeKey, setSelectedScopeKey] = useState('all')
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId)
  const [query, setQuery] = useState('')
  const [cardFilter, setCardFilter] = useState('all')
  const [flagColorFilter, setFlagColorFilter] = useState('all')
  const [expandedScopeKeys, setExpandedScopeKeys] = useState(() => new Set(['all']))
  const [contextMenu, setContextMenu] = useState(null)
  const [previewCardId, setPreviewCardId] = useState(null)
  const [previewPending, setPreviewPending] = useState(false)
  const [visibleCount, setVisibleCount] = useState(BROWSE_CARD_RENDER_LIMIT)
  const loadMoreSentinelRef = useRef(null)
  const initializedScopeRef = useRef(false)

  const scopeTree = useMemo(() => buildBrowseScopeTree(data), [data])
  const scopeNodes = useMemo(() => flattenScopeTree(scopeTree), [scopeTree])
  const scopeNodeMap = useMemo(() => new Map(scopeNodes.map((node) => [node.key, node])), [scopeNodes])
  const browseDeckById = useMemo(() => new Map(data.decks.map((deck) => [deck.id, deck])), [data.decks])
  const browseCardById = useMemo(() => new Map(data.cards.map((card) => [card.id, card])), [data.cards])
  const selectedScope = scopeNodeMap.get(selectedScopeKey) ?? scopeTree
  const selectedScopeCards = useMemo(() => (
    selectedScope.key === 'all'
      ? data.cards
      : selectedScope.cardIds.map((id) => browseCardById.get(id)).filter(Boolean)
  ), [browseCardById, data.cards, selectedScope.cardIds, selectedScope.key])
  const scopeDeckIds = useMemo(() => Array.from(new Set([
    ...selectedScope.deckIds,
    ...selectedScopeCards.map((card) => card.deckId),
  ].filter(Boolean))), [selectedScope.deckIds, selectedScopeCards])

  useEffect(() => {
    if (initializedScopeRef.current) return
    const initialNode = initialDeckId ? findBestScopeNodeForDeck(scopeNodes, initialDeckId) : null
    if (initialNode) setSelectedScopeKey(initialNode.key)
    initializedScopeRef.current = true
  }, [initialDeckId, scopeNodes])

  useEffect(() => {
    setExpandedScopeKeys((current) => {
      const next = new Set(current)
      next.add('all')
      selectedScope.parts.forEach((_, index) => next.add(getScopeKey(selectedScope.parts.slice(0, index + 1))))
      return next
    })
  }, [selectedScope.parts])

  const normalizedQuery = query.trim().toLowerCase()
  const visibleCards = useMemo(() => (
    selectedScopeCards
      .filter((card) => {
        if (cardFilter === 'favorite') return Boolean(card.favorite)
        if (cardFilter === 'flagged') return isCardFlagged(card)
        return true
      })
      .filter((card) => flagColorFilter === 'all' || getCardFlagColor(card) === flagColorFilter)
      .filter((card) => {
        if (!normalizedQuery) return true
        const deck = browseDeckById.get(card.deckId)
        const sectionText = getCardHtmlSections(card).map((section) => section.text).join(' ')
        const scopeText = getCardScopeParts(card, browseDeckById).join(' ')
        return `${card.front} ${card.back} ${sectionText} ${scopeText} ${deck ? getDeckOptionLabel(deck) : ''}`.toLowerCase().includes(normalizedQuery)
      })
  ), [browseDeckById, cardFilter, flagColorFilter, normalizedQuery, selectedScopeCards])
  const visibleCardRows = useMemo(() => visibleCards.slice(0, visibleCount), [visibleCards, visibleCount])
  const visibleCardIdSet = useMemo(() => new Set(visibleCards.map((card) => card.id)), [visibleCards])
  const selectedCard = selectedCardId && visibleCardIdSet.has(selectedCardId)
    ? browseCardById.get(selectedCardId)
    : visibleCards[0] ?? null
  const previewCard = previewCardId ? browseCardById.get(previewCardId) : selectedCard
  const previewReady = Boolean(selectedCard && previewCard && previewCard.id === selectedCard.id && !previewPending)
  const selectedScopeDeckId = selectedCard?.deckId ?? scopeDeckIds[0] ?? selectedDeckId ?? data.decks[0]?.id ?? ''
  const contextCard = contextMenu?.type === 'card' ? browseCardById.get(contextMenu.cardId) : null
  const contextScope = contextMenu?.type === 'scope' ? scopeNodeMap.get(contextMenu.scopeKey) : null
  const contextDecks = contextScope ? contextScope.deckIds.map((id) => browseDeckById.get(id)).filter(Boolean) : []
  const editableContextDecks = contextDecks.filter((deck) => !isBuiltinDylItem(deck))
  const contextTargetDeckId = contextCard?.deckId
    ?? (contextScope?.cardIds?.[0] ? browseCardById.get(contextScope.cardIds[0])?.deckId : '')
    ?? contextScope?.deckIds?.[0]
    ?? selectedScopeDeckId

  useEffect(() => {
    setSelectedCardId((current) => {
      if (visibleCardIdSet.has(current)) return current
      return visibleCards[0]?.id ?? null
    })
  }, [visibleCardIdSet, visibleCards])

  useEffect(() => {
    if (!selectedCard?.id) {
      setPreviewCardId(null)
      setPreviewPending(false)
      return undefined
    }

    if (previewCardId === selectedCard.id && !previewPending) return undefined

    setPreviewPending(true)
    const applyPreview = () => {
      setPreviewCardId(selectedCard.id)
      setPreviewPending(false)
    }
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(applyPreview, { timeout: 180 })
      return () => window.cancelIdleCallback?.(idleId)
    }
    const timer = window.setTimeout(applyPreview, 80)
    return () => window.clearTimeout(timer)
  }, [previewCardId, previewPending, selectedCard?.id])

  useEffect(() => {
    if (selectedCard?.deckId) setSelectedDeckId(selectedCard.deckId)
  }, [selectedCard?.deckId, selectedCard?.id])

  useEffect(() => {
    setVisibleCount(BROWSE_CARD_RENDER_LIMIT)
  }, [visibleCards])

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && visibleCount < visibleCards.length) {
        setVisibleCount((current) => Math.min(current + 24, visibleCards.length))
      }
    }, { rootMargin: "160px" })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, visibleCards.length])

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null)
    }
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [])

  function selectScope(node) {
    const firstCard = node.key === 'all'
      ? data.cards[0]
      : browseCardById.get(node.cardIds[0])
    startTransition(() => {
      setSelectedScopeKey(node.key)
      setSelectedCardId(firstCard?.id ?? null)
      setSelectedDeckId(firstCard?.deckId ?? node.deckIds[0] ?? data.decks[0]?.id ?? '')
    })
  }

  function toggleScopeExpanded(key) {
    setExpandedScopeKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      next.add('all')
      return next
    })
  }

  function openContextMenu(event, payload) {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ ...payload, x: event.clientX, y: event.clientY })
  }

  function openCreateChapter(node, child = false) {
    const parts = node?.parts ?? []
    const section = parts[0] ?? ''
    const chapterParts = child ? parts.slice(1) : parts.slice(1, -1)
    onOpenCreateDeck?.({
      section,
      chapter: chapterParts.join(' / '),
      name: '',
      description: '',
    })
    setContextMenu(null)
  }

  function deleteContextDecks() {
    if (editableContextDecks.length === 0) return
    const confirmed = window.confirm(`确定删除 ${editableContextDecks.length} 个本地章节/卡组吗？其中的本地卡片也会一起删除。`)
    if (!confirmed) return
    editableContextDecks.forEach((deck) => onDeleteDeck?.(deck.id))
    setContextMenu(null)
  }

  function setCardFlagColor(card, color) {
    const nextColor = color || ''
    onUpdateCardMeta?.(card.id, { flagged: Boolean(nextColor), flagColor: nextColor })
    if (!nextColor && cardFilter === 'flagged') {
      setCardFilter('all')
    }
    if (flagColorFilter !== 'all' && (!nextColor || nextColor !== flagColorFilter)) {
      setFlagColorFilter('all')
    }
  }

  function toggleCardFavorite(card) {
    onUpdateCardMeta?.(card.id, { favorite: !card.favorite })
  }

  function renderFavoriteControl(card, size = 'sm') {
    const isLarge = size === 'lg'
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          toggleCardFavorite(card)
        }}
        className={`grid shrink-0 place-items-center ${isLarge ? 'h-8 w-8 rounded-lg' : 'h-6 w-6 rounded-md'} ${card.favorite ? 'bg-yellow-50 text-yellow-500' : 'text-gray-300 hover:bg-gray-100 hover:text-yellow-500'}`}
        aria-label={card.favorite ? '取消星标' : '星标'}
        title={card.favorite ? '取消星标' : '星标'}
      >
        <Star size={isLarge ? 16 : 14} fill={card.favorite ? 'currentColor' : 'none'} />
      </button>
    )
  }

  function renderFlagControl(card, size = 'sm') {
    const flagColor = getCardFlagColor(card)
    const isLarge = size === 'lg'
    return (
      <span
        className="group relative inline-flex shrink-0"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setCardFlagColor(card, flagColor ? '' : 'red')
          }}
          className={`grid place-items-center ${isLarge ? 'h-8 w-8 rounded-lg' : 'h-6 w-6 rounded-md'} ${flagColor ? getFlagColorClass(flagColor) : 'text-gray-300 hover:bg-gray-100 hover:text-red-500'}`}
          aria-label={flagColor ? '取消旗帜' : '添加旗帜'}
          title={flagColor ? '点击取消旗帜，悬停可换颜色' : '点击添加红旗，悬停可选颜色'}
        >
          <Flag size={isLarge ? 16 : 14} fill={flagColor ? 'currentColor' : 'none'} />
        </button>
        <div className={`pointer-events-none absolute right-0 top-full z-40 mt-1 ${isLarge ? 'w-28' : 'w-24'} rounded-lg border border-gray-200 bg-white p-1 text-[11px] font-bold text-gray-600 opacity-0 shadow-xl transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setCardFlagColor(card, '')
            }}
            className={`flex h-7 w-full items-center gap-2 rounded-md px-2 text-left ${flagColor ? 'hover:bg-gray-50' : 'bg-gray-100 text-gray-900'}`}
          >
            <Flag size={13} />
            无色
          </button>
          {FLAG_COLOR_OPTIONS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setCardFlagColor(card, color.value)
              }}
              className={`flex h-7 w-full items-center gap-2 rounded-md px-2 text-left ${flagColor === color.value ? getFlagColorClass(color.value) : 'hover:bg-gray-50'}`}
            >
              <Flag size={13} fill="currentColor" className={getFlagColorTextClass(color.value)} />
              {color.menuLabel}
            </button>
          ))}
        </div>
      </span>
    )
  }

  function navigateToStudyScope() {
    if (!selectedScopeDeckId) return
    const suffix = selectedScope.key === 'all' ? '' : `?scope=${encodeURIComponent(selectedScope.key)}`
    navigate(`/study/${selectedScopeDeckId}${suffix}`, { state: { scopeKey: selectedScope.key } })
  }

  function renderScopeNode(node) {
    const expanded = expandedScopeKeys.has(node.key)
    const selected = selectedScope.key === node.key
    const hasChildren = node.children.length > 0
    return (
      <div key={node.key}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => selectScope(node)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              selectScope(node)
            }
          }}
          onContextMenu={(event) => openContextMenu(event, { type: 'scope', scopeKey: node.key })}
          className={`group flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${selected ? 'bg-green-50 text-green-700 font-black' : 'text-gray-700 hover:bg-gray-50'}`}
          style={{ paddingLeft: `${Math.min(8 + node.depth * 12, 44)}px` }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (hasChildren) toggleScopeExpanded(node.key)
            }}
            className={`grid h-5 w-5 shrink-0 place-items-center rounded text-gray-300 ${hasChildren ? 'hover:bg-white hover:text-gray-600' : 'opacity-0'}`}
            tabIndex={-1}
          >
            <ChevronRight size={13} className={expanded ? 'rotate-90 transition-transform' : 'transition-transform'} />
          </button>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{node.label}</span>
          </span>
          <span className="shrink-0 text-[11px] font-bold text-gray-400">{node.count}</span>
          <MoreVertical size={13} className="shrink-0 text-gray-300 opacity-0 group-hover:opacity-100" />
        </div>
        {hasChildren && expanded && (
          <div className="mt-0.5">
            {node.children.map(renderScopeNode)}
          </div>
        )}
      </div>
    )
  }

  const menuStyle = contextMenu ? {
    left: Math.min(contextMenu.x, Math.max(8, window.innerWidth - 232)),
    top: Math.min(contextMenu.y, Math.max(8, window.innerHeight - 320)),
  } : {}

  const scopeDue = selectedScopeCards.filter(isCardDue).length
  const scopeNew = selectedScopeCards.filter(isNewCard).length

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId} wide>
      <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">浏览</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => selectedScopeDeckId && navigate(`/cards/new/${selectedScopeDeckId}`)} className="h-10 rounded-xl bg-[#007aff] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={!selectedScopeDeckId}>添加卡片</button>
          <button onClick={navigateToStudyScope} className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300" disabled={!selectedScopeDeckId}>学习</button>
        </div>
      </header>

      <div className="grid min-h-[720px] grid-cols-1 justify-center gap-4 xl:grid-cols-[300px_620px_400px]">
        <aside className="overflow-hidden rounded-2xl border border-white bg-white/90 shadow-sm">
          <div className="flex h-12 items-center justify-between border-b border-gray-200 px-4">
            <div>
              <h2 className="text-sm font-black text-gray-950">目录</h2>
              <p className="text-[11px] font-bold text-gray-400">{scopeTree.count} 张卡片</p>
            </div>
            <button type="button" onClick={() => openCreateChapter(scopeTree, true)} className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200" title="新建章节">
              <Plus size={15} />
            </button>
          </div>
          <div className="max-h-[calc(100vh-160px)] overflow-auto p-2">
            {renderScopeNode(scopeTree)}
          </div>
        </aside>

        <main className="min-w-0">
          <section className="overflow-hidden rounded-2xl border border-white bg-white/90 shadow-sm">
            <div className="border-b border-gray-200 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="关键词或标签搜索卡片"
                  className="h-9 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-[#007aff] focus:bg-white"
                />
                <span className="shrink-0 text-xs font-black text-gray-400">{visibleCards.length}</span>
                <button type="button" onClick={() => openCreateChapter(selectedScope, true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700 hover:bg-green-100" title="插入子章节">
                  <Plus size={16} />
                </button>
                <button type="button" onClick={navigateToStudyScope} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#34c759] text-white hover:bg-[#30b454] disabled:bg-gray-300" disabled={!selectedScopeDeckId} title={`开始学习 ${scopeDue || scopeNew || selectedScope.count}`}>
                  <BookOpen size={16} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-black">
                {[
                  { value: 'all', label: '全部' },
                  { value: 'favorite', label: '星标' },
                  { value: 'flagged', label: '旗帜' },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setCardFilter(filter.value)}
                    className={`h-7 rounded-lg px-2.5 transition-colors ${cardFilter === filter.value ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}
                  >
                    {filter.label}
                  </button>
                ))}
                <span className="mx-1 h-5 w-px bg-gray-200" />
                <button
                  type="button"
                  onClick={() => setFlagColorFilter('all')}
                  className={`h-7 rounded-lg px-2.5 ${flagColorFilter === 'all' ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  全部旗色
                </button>
                {FLAG_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => {
                      setCardFilter('flagged')
                      setFlagColorFilter(color.value)
                    }}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2 ${flagColorFilter === color.value ? getFlagColorClass(color.value) : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    <Flag size={13} fill={flagColorFilter === color.value ? 'currentColor' : 'none'} />
                    {color.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[calc(100vh-220px)] overflow-auto bg-gray-50/70 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleCardRows.map((card) => (
                    <article
                      key={card.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedCardId(card.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedCardId(card.id)
                        }
                      }}
                      onContextMenu={(event) => openContextMenu(event, { type: 'card', cardId: card.id })}
                      className={`flex min-h-[170px] cursor-pointer flex-col rounded-lg border px-3 py-3 text-left shadow-sm transition-colors ${selectedCard?.id === card.id ? 'border-green-200 bg-green-50/90' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-3 min-w-0 flex-1 text-sm font-black leading-5 text-gray-950">{compactCardText(card.front, 96)}</h3>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black ${isNewCard(card) ? 'bg-blue-50 text-blue-600' : isCardDue(card) ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                          {getCardReviewStateLabel(card)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-5 flex-1 text-xs leading-5 text-gray-500">{compactCardText(card.back, 220)}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[11px] font-bold text-gray-300">{hasStoredCardHtml(card) ? 'HTML' : '文本'} · {getCardScopeParts(card, browseDeckById).at(-1)}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {renderFavoriteControl(card)}
                          {renderFlagControl(card)}
                        </span>
                      </div>
                    </article>
                ))}
              <div ref={loadMoreSentinelRef} className="h-px" />
              </div>
              {visibleCards.length > visibleCardRows.length && (
                <p className="px-3 py-4 text-center text-xs font-bold text-gray-400">已显示前 {visibleCardRows.length} 张，继续搜索可以缩小范围。</p>
              )}
              {visibleCards.length === 0 && <p className="py-12 text-center text-sm text-gray-400">没有匹配的卡片。</p>}
            </div>
          </section>
        </main>

        <aside className="overflow-hidden rounded-2xl border border-white bg-white/90 shadow-sm">
          {selectedCard ? (
            <div className="max-h-[calc(100vh-150px)] overflow-auto p-4">
              <div className="sticky top-0 z-10 mb-2 flex justify-end gap-1 bg-white/90 pb-2 backdrop-blur">
                <button
                  type="button"
                  onClick={() => selectedScopeDeckId && navigate(`/cards/new/${selectedScopeDeckId}`)}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
                  title="添加卡片"
                  disabled={!selectedScopeDeckId}
                >
                  <Plus size={15} />
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {renderFavoriteControl(selectedCard, 'lg')}
                  {renderFlagControl(selectedCard, 'lg')}
                </div>
              </div>
              {previewReady ? (
                <>
                  <CardContent
                    card={previewCard}
                    side="front"
                    className="text-sm font-bold leading-relaxed text-gray-950 break-words"
                    fallbackClassName="text-sm font-bold leading-relaxed text-gray-950 break-words whitespace-pre-wrap"
                  />
                  <div className="my-4 h-px bg-gray-200" />
                  <CardContent
                    card={previewCard}
                    side="back"
                    className="text-sm leading-relaxed text-gray-700 break-words"
                    fallbackClassName="text-sm leading-relaxed text-gray-700 break-words whitespace-pre-wrap"
                  />
                </>
              ) : (
                <div className="grid min-h-[360px] place-items-center rounded-xl bg-gray-50 text-xs font-bold text-gray-400">
                  正在准备预览...
                </div>
              )}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">选择一张卡片查看预览。</p>
          )}
        </aside>
      </div>

      {contextMenu && (
        <div className="fixed z-50 w-56 rounded-xl border border-gray-200 bg-white p-1.5 text-xs font-bold text-gray-700 shadow-2xl" style={menuStyle} onClick={(event) => event.stopPropagation()}>
          {contextCard ? (
            <>
              <button type="button" onClick={() => { toggleCardFavorite(contextCard); setContextMenu(null) }} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50">
                <Star size={14} fill={contextCard.favorite ? 'currentColor' : 'none'} className={contextCard.favorite ? 'text-yellow-500' : 'text-gray-400'} />
                {contextCard.favorite ? '取消星标' : '设为星标'}
              </button>
              <div className="my-1 h-px bg-gray-100" />
              <button type="button" onClick={() => { setCardFlagColor(contextCard, ''); setContextMenu(null) }} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-gray-400 hover:bg-gray-50">
                <Flag size={14} />
                无色
              </button>
              {FLAG_COLOR_OPTIONS.map((color) => (
                <button key={color.value} type="button" onClick={() => { setCardFlagColor(contextCard, color.value); setContextMenu(null) }} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50">
                  <Flag size={14} fill="currentColor" className={getFlagColorTextClass(color.value)} />
                  {color.menuLabel}
                </button>
              ))}
            </>
          ) : (
            <>
              <button type="button" onClick={() => openCreateChapter(contextScope ?? scopeTree, true)} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50">
                <Plus size={14} /> 新建子章节
              </button>
              <button type="button" onClick={() => openCreateChapter(contextScope ?? scopeTree, false)} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50">
                <Layers3 size={14} /> 插入同级章节
              </button>
              <button type="button" onClick={() => contextTargetDeckId && navigate(`/cards/new/${contextTargetDeckId}`)} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50 disabled:text-gray-300" disabled={!contextTargetDeckId}>
                <PencilLine size={14} /> 在这里加卡
              </button>
              <div className="my-1 h-px bg-gray-100" />
              <button type="button" onClick={() => { if (editableContextDecks[0]) onOpenEditDeck?.(editableContextDecks[0]); setContextMenu(null) }} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50 disabled:text-gray-300" disabled={editableContextDecks.length !== 1}>
                <PencilLine size={14} /> 编辑本地目录
              </button>
              <button type="button" onClick={deleteContextDecks} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-red-600 hover:bg-red-50 disabled:text-gray-300" disabled={editableContextDecks.length === 0}>
                <Trash2 size={14} /> 删除本地目录
              </button>
              {contextDecks.length > 0 && editableContextDecks.length === 0 && <p className="px-3 py-2 text-[11px] leading-4 text-gray-400">内置资料目录不能直接删除，可以在旁边插入自己的章节。</p>}
            </>
          )}
        </div>
      )}
    </Shell>
  )
}

function Browse({ data, studyDeckId, cloud, onAddCardAnnotation, onRemoveCardAnnotation, onLinkCards, onUnlinkCards, onUpdateCardMeta, onOpenCreateDeck, onOpenEditDeck, onDeleteDeck }) {
  const location = useLocation()
  const navigate = useNavigate()
  const initialDeckId = location.state?.deckId ?? data.decks[0]?.id ?? ''
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId)
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [query, setQuery] = useState('')
  const [cardFilter, setCardFilter] = useState('all')
  const [annotationType, setAnnotationType] = useState(ANNOTATION_TYPES[0])
  const [annotationDraft, setAnnotationDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [linkTargetId, setLinkTargetId] = useState('')
  const groupedDecks = useMemo(() => groupDecksBySection(data.decks), [data.decks])

  useEffect(() => {
    if (!data.decks.find((deck) => deck.id === selectedDeckId)) {
      setSelectedDeckId(data.decks[0]?.id ?? '')
    }
  }, [data.decks, selectedDeckId])

  const visibleCards = useMemo(() => (
    data.cards
      .filter((card) => !selectedDeckId || card.deckId === selectedDeckId)
      .filter((card) => {
        if (cardFilter === 'favorite') return Boolean(card.favorite)
        if (cardFilter === 'flagged') return Boolean(card.flagged)
        return true
      })
      .filter((card) => {
        const keyword = query.trim().toLowerCase()
        if (!keyword) return true
        const sectionText = getCardHtmlSections(card).map((section) => section.text).join(' ')
        return `${card.front} ${card.back} ${sectionText}`.toLowerCase().includes(keyword)
      })
  ), [cardFilter, data.cards, query, selectedDeckId])
  const visibleCardRows = useMemo(() => visibleCards.slice(0, BROWSE_CARD_RENDER_LIMIT), [visibleCards])

  const selectedCard = visibleCards.find((card) => card.id === selectedCardId) ?? visibleCards[0] ?? null
  const selectedDeck = data.decks.find((deck) => deck.id === selectedDeckId)
  const selectedAnnotations = getCardAnnotations(selectedCard)
  const linkedCards = selectedCard ? getCardLinks(selectedCard).map((id) => data.cards.find((card) => card.id === id)).filter(Boolean) : []
  const relatedSuggestions = getRelatedSuggestions(data, selectedCard)
  const linkableCards = data.cards.filter((card) => card.id !== selectedCard?.id && !getCardLinks(selectedCard).includes(card.id))

  useEffect(() => {
    setSelectedCardId((current) => {
      if (visibleCards.some((card) => card.id === current)) return current
      return visibleCards[0]?.id ?? null
    })
  }, [visibleCards])

  useEffect(() => {
    setAnnotationDraft('')
    setNoteDraft(selectedCard?.comment ?? '')
    setLinkTargetId('')
  }, [selectedCard?.comment, selectedCard?.id])

  function handleAddAnnotation() {
    const text = annotationDraft.trim()
    if (!selectedCard || !text) return
    onAddCardAnnotation(selectedCard.id, { type: annotationType, text })
    setAnnotationDraft('')
  }

  function handleLinkCard(targetId = linkTargetId) {
    if (!selectedCard || !targetId) return
    onLinkCards(selectedCard.id, targetId)
    setLinkTargetId('')
  }

  function toggleCardFavorite(card) {
    onUpdateCardMeta?.(card.id, { favorite: !card.favorite })
  }

  function toggleCardFlagged(card) {
    onUpdateCardMeta?.(card.id, { flagged: !card.flagged })
  }

  function saveCardNote() {
    if (!selectedCard) return
    onUpdateCardMeta?.(selectedCard.id, { comment: noteDraft.trim() })
  }

  if (Array.isArray(data.cards)) {
    return (
      <BrowseWorktable
        data={data}
        studyDeckId={studyDeckId}
        cloud={cloud}
        onAddCardAnnotation={onAddCardAnnotation}
        onRemoveCardAnnotation={onRemoveCardAnnotation}
        onLinkCards={onLinkCards}
        onUnlinkCards={onUnlinkCards}
        onUpdateCardMeta={onUpdateCardMeta}
        onOpenCreateDeck={onOpenCreateDeck}
        onOpenEditDeck={onOpenEditDeck}
        onDeleteDeck={onDeleteDeck}
      />
    )
  }

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">浏览</h1>
          <p className="text-xs text-gray-500 mt-1">查看当前卡组里的所有卡片，未分组内容也会保留在目录中。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => selectedDeckId && navigate(`/cards/new/${selectedDeckId}`)} className="h-10 px-4 rounded-xl bg-[#007aff] text-white text-sm font-bold shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={!selectedDeckId}>添加卡片</button>
          <button onClick={() => selectedDeckId && navigate(`/study/${selectedDeckId}`)} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300" disabled={!selectedDeckId}>学习</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_340px] gap-4 min-h-[620px]">
        <aside className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">目录</h2>
            <span className="text-xs font-bold text-gray-400">{data.decks.length}</span>
          </div>
          <div className="p-2 flex flex-col gap-1">
            {groupedDecks.map((group) => (
              <div key={group.section}>
                <p className="px-3 py-1 text-[11px] font-black text-gray-300">{group.section}</p>
                {group.decks.map((deck) => {
                  const count = data.cards.filter((card) => card.deckId === deck.id).length
                  return (
                    <button
                      key={deck.id}
                      onClick={() => setSelectedDeckId(deck.id)}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between gap-3 ${selectedDeckId === deck.id ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <span>
                        <span className="block line-clamp-1">{deck.name}</span>
                        {getDeckChapter(deck) && <span className="block text-[11px] text-gray-400 line-clamp-1">{getDeckChapter(deck)}</span>}
                      </span>
                      <span className="text-xs text-gray-400">{count}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-3 py-2">
            <div className="flex items-center gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索问题或答案"
              className="h-9 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-[#007aff] focus:bg-white"
            />
            <span className="text-xs font-bold text-gray-400">{visibleCards.length} 张</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black">
              {[
                { value: 'all', label: '全部' },
                { value: 'favorite', label: '星标' },
                { value: 'flagged', label: '旗帜' },
              ].map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setCardFilter(filter.value)}
                  className={`h-7 rounded-lg px-2 transition-colors ${cardFilter === filter.value ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[580px] overflow-auto bg-gray-50/60 p-2">
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 2xl:grid-cols-3">
              {visibleCardRows.map((card) => (
                <div
                    key={card.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCardId(card.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedCardId(card.id)
                      }
                    }}
                    className={`min-h-[150px] rounded-lg border bg-white px-3 py-3 text-left shadow-sm transition-colors ${selectedCard?.id === card.id ? 'border-green-200 bg-green-50/80' : 'border-gray-200 hover:border-gray-300 hover:bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <strong className="line-clamp-2 text-sm font-black leading-5 text-gray-950">{card.front}</strong>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black ${isNewCard(card) ? 'bg-blue-50 text-blue-600' : isCardDue(card) ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                        {getCardReviewStateLabel(card)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-4 text-xs leading-5 text-gray-500">{card.back}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-gray-300">{hasStoredCardHtml(card) ? 'HTML' : '文本'}</span>
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleCardFavorite(card)
                          }}
                          className={`grid h-7 w-7 place-items-center rounded-lg ${card.favorite ? 'bg-yellow-50 text-yellow-500' : 'text-gray-300 hover:bg-gray-100 hover:text-yellow-500'}`}
                          title={card.favorite ? '取消星标' : '星标'}
                        >
                          <Star size={15} fill={card.favorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleCardFlagged(card)
                          }}
                          className={`grid h-7 w-7 place-items-center rounded-lg ${card.flagged ? 'bg-red-50 text-red-500' : 'text-gray-300 hover:bg-gray-100 hover:text-red-500'}`}
                          title={card.flagged ? '取消旗帜' : '旗帜'}
                        >
                          <Flag size={15} fill={card.flagged ? 'currentColor' : 'none'} />
                        </button>
                      </span>
                    </div>
                  </div>
              ))}
            </div>
            {visibleCards.length > visibleCardRows.length && (
              <p className="px-3 py-4 text-center text-xs font-bold text-gray-400">
                已显示前 {visibleCardRows.length} 张。继续输入关键词可以缩小范围。
              </p>
            )}
            {visibleCards.length === 0 && <p className="text-sm text-gray-400 text-center py-10">没有匹配的卡片。</p>}
          </div>
        </section>

        <aside className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">预览</h2>
            <span className="text-xs text-gray-400">{selectedDeck ? getDeckPath(selectedDeck) : '未选择'}</span>
          </div>
          {selectedCard ? (
            <div className="p-4">
              <p className="text-xs font-bold text-gray-400 mb-2">Front</p>
              <CardContent
                card={selectedCard}
                side="front"
                className="text-lg font-black text-gray-950 break-words leading-relaxed"
                fallbackClassName="text-lg font-black text-gray-950 break-words leading-relaxed"
              />
              <div className="my-5 h-px bg-gray-200" />
              <p className="text-xs font-bold text-gray-400 mb-2">Back</p>
              <CardContent
                card={selectedCard}
                side="back"
                className="text-base text-gray-700 break-words leading-relaxed"
                fallbackClassName="text-base text-gray-700 break-words leading-relaxed"
              />
              <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500">间隔 {selectedCard.review.interval} 天</span>
                <span className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500">复习 {selectedCard.review.reps} 次</span>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-950">我的笔记</h3>
                  <button
                    type="button"
                    onClick={saveCardNote}
                    className="h-7 rounded-lg bg-gray-900 px-3 text-[11px] font-black text-white disabled:bg-gray-300"
                    disabled={noteDraft.trim() === (selectedCard.comment ?? '')}
                  >
                    保存
                  </button>
                </div>
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="写下这张卡自己的理解、易错点或补充材料"
                  className="min-h-[88px] w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-700 outline-none focus:border-[#007aff] focus:bg-white"
                />
              </div>

              <div className="mt-6 border-t border-gray-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-950">批注</h3>
                  <span className="text-xs font-bold text-gray-300">{selectedAnnotations.length}</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={annotationType}
                    onChange={(event) => setAnnotationType(event.target.value)}
                    className="h-9 w-24 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs font-bold text-gray-600 outline-none focus:border-[#007aff] focus:bg-white"
                  >
                    {ANNOTATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <input
                    value={annotationDraft}
                    onChange={(event) => setAnnotationDraft(event.target.value)}
                    placeholder="补一句理解、易错或口诀"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-[#007aff] focus:bg-white"
                  />
                  <button type="button" onClick={handleAddAnnotation} className="h-9 px-3 rounded-lg bg-gray-900 text-xs font-bold text-white disabled:bg-gray-300" disabled={!annotationDraft.trim()}>
                    保存
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {selectedAnnotations.length === 0 && <p className="text-xs text-gray-400">还没有批注。可以先记一个疑问，之后在整理页横向查看。</p>}
                  {selectedAnnotations.map((annotation) => (
                    <div key={annotation.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="rounded bg-white px-2 py-0.5 text-[10px] font-black text-green-700">{annotation.type}</span>
                        <button type="button" onClick={() => onRemoveCardAnnotation(selectedCard.id, annotation.id)} className="text-[11px] font-bold text-gray-300 hover:text-red-500">删除</button>
                      </div>
                      <p className="text-xs leading-relaxed text-gray-700">{annotation.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-950">关联卡</h3>
                  <span className="text-xs font-bold text-gray-300">{linkedCards.length}</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={linkTargetId}
                    onChange={(event) => setLinkTargetId(event.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs font-semibold text-gray-600 outline-none focus:border-[#007aff] focus:bg-white"
                  >
                    <option value="">选择一张卡串联</option>
                    {groupDecksBySection(data.decks).map((group) => (
                      <optgroup key={group.section} label={group.section}>
                        {group.decks.flatMap((deck) => data.cards
                          .filter((card) => card.deckId === deck.id && linkableCards.some((item) => item.id === card.id))
                          .map((card) => <option key={card.id} value={card.id}>{deck.name} / {card.front}</option>))}
                      </optgroup>
                    ))}
                  </select>
                  <button type="button" onClick={() => handleLinkCard()} className="h-9 px-3 rounded-lg bg-gray-900 text-xs font-bold text-white disabled:bg-gray-300" disabled={!linkTargetId}>
                    串联
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {linkedCards.length === 0 && <p className="text-xs text-gray-400">可以把要件、例外、案例、对比题串成一条复习线。</p>}
                  {linkedCards.map((card) => (
                    <div key={card.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => setSelectedCardId(card.id)} className="text-left text-xs font-bold leading-relaxed text-gray-800 hover:text-[#007aff]">{card.front}</button>
                        <button type="button" onClick={() => onUnlinkCards(selectedCard.id, card.id)} className="shrink-0 text-[11px] font-bold text-gray-300 hover:text-red-500">断开</button>
                      </div>
                    </div>
                  ))}
                </div>
                {relatedSuggestions.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[11px] font-black text-gray-300">可能相关</p>
                    <div className="flex flex-col gap-2">
                      {relatedSuggestions.map((card) => (
                        <button key={card.id} type="button" onClick={() => handleLinkCard(card.id)} className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-left text-xs font-bold text-gray-500 hover:border-green-200 hover:bg-green-50 hover:text-green-700">
                          {card.front}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">选择一张卡片查看预览。</p>
          )}
        </aside>
      </div>
    </Shell>
  )
}

export default Browse