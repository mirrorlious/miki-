import { UNGROUPED_SECTION, BUILTIN_DYL_PACK_ID } from './constants.js'
import { normalizePathPart, getDeckSection, getDeckChapter, getDeckScopeParts } from './deckUtils.js'
import { getCardSideHtml, getCardSideText } from './cardHtml.js'
import { hasStartedCard, isReviewDue, formatReviewDueLabel } from './reviewUtils.js'
import { tokenizeForRelated } from './textUtils.js'


function getCardAnnotations(card) {
  return Array.isArray(card?.annotations) ? card.annotations : []
}

function getCardLinks(card) {
  return Array.isArray(card?.links) ? card.links : []
}

function getCardFlagColor(card) {
  return card?.flagColor ?? ''
}

function isBuiltinDylItem(item) {
  return item?.builtinPack === BUILTIN_DYL_PACK_ID || item?.source?.builtinPack === BUILTIN_DYL_PACK_ID
}

function shouldPreferFullBuiltinDylHtml(card) {
  return Boolean(isBuiltinDylItem(card) && (card?.frontHtml || card?.backHtml))
}

function getCardScopeParts(card, deckById) {
  const sourcePath = Array.isArray(card?.source?.deckPath)
    ? card.source.deckPath.map(normalizePathPart).filter(Boolean)
    : []
  if (sourcePath.length > 0) return sourcePath

  const deck = deckById.get(card?.deckId)
  if (!deck) return [UNGROUPED_SECTION]
  return [
    getDeckSection(deck),
    ...getDeckChapter(deck).split('/').map(normalizePathPart).filter(Boolean),
    deck.name,
  ].filter(Boolean)
}

function getScopeKey(parts) {
  return parts.length === 0 ? 'all' : `scope:${parts.join(':')}`
}

function makeScopeNode(parts) {
  return {
    key: getScopeKey(parts),
    label: parts[parts.length - 1] || '全部卡片',
    pathLabel: parts.join(' / ') || '全部卡片',
    parts,
    depth: parts.length,
    cardIds: new Set(),
    deckIds: new Set(),
    childMap: new Map(),
    children: [],
  }
}

function buildBrowseScopeTree(data) {
  const deckById = new Map(data.decks.map((deck) => [deck.id, deck]))
  const root = makeScopeNode([])

  function ensureChain(parts) {
    const chain = [root]
    let current = root
    parts.forEach((part, index) => {
      const nextParts = parts.slice(0, index + 1)
      const key = getScopeKey(nextParts)
      if (!current.childMap.has(key)) {
        current.childMap.set(key, makeScopeNode(nextParts))
      }
      current = current.childMap.get(key)
      chain.push(current)
    })
    return chain
  }

  data.cards.forEach((card) => {
    const chain = ensureChain(getCardScopeParts(card, deckById))
    chain.forEach((node) => {
      node.cardIds.add(card.id)
      if (card.deckId) node.deckIds.add(card.deckId)
    })
  })

  function finalize(node) {
    node.children = Array.from(node.childMap.values())
      .map(finalize)
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN', { numeric: true }))
    delete node.childMap
    node.cardIds = Array.from(node.cardIds)
    node.deckIds = Array.from(node.deckIds)
    node.count = node.cardIds.length
    return node
  }

  return finalize(root)
}

function flattenScopeTree(node) {
  return [node, ...node.children.flatMap(flattenScopeTree)]
}

function findBestScopeNodeForDeck(scopeNodes, deckId) {
  return scopeNodes
    .filter((node) => node.deckIds.includes(deckId) || node.cardIds.length > 0)
    .filter((node) => node.deckIds.includes(deckId))
    .sort((a, b) => b.depth - a.depth)[0] ?? null
}

function compactCardText(value = '', maxLength = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trim()}...`
}

function stripStyleScriptBlocks(value = '') {
  return String(value ?? '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/^\s*<\/style>\s*/i, '')
    .replace(/<\/style>\s*$/i, '')
}

function looksLikeCssOnlySection(value = '') {
  const raw = String(value ?? '').trim()
  if (!raw) return false
  const text = stripStyleScriptBlocks(raw).trim()
  if (!text) return true
  if (/<(?:div|p|span|table|img|section|article|main|h[1-6]|ul|ol|li|br|hr|button|input|label|svg|math|canvas|audio|video)\b/i.test(text)) return false
  return /\/\*[\s\S]*?\*\//.test(text)
    || /(?:^|\n)\s*(?:\.|#|body\b|html\b|\.card\b|@media\b|@font-face\b|[a-z-]+\s*[,>{.#:])/i.test(text)
    || /[.#]?[a-z0-9_-]+(?:\s+[.#]?[a-z0-9_-]+|[:.#][a-z0-9_-]+)?\s*\{[\s\S]*?:[\s\S]*?\}/i.test(text)
}


function getCardHtmlSections(card) {
  if (shouldPreferFullBuiltinDylHtml(card)) return []
  if (!Array.isArray(card?.htmlSections)) return []
  return card.htmlSections.filter((section) => {
    if (!section?.id || !section?.label || !(section.html || section.text)) return false
    const label = `${section.id} ${section.label}`.toLowerCase()
    if (/(?:css|style|stylesheet|javascript|script|\bjs\b|样式|脚本)/i.test(label)) return false
    if (looksLikeCssOnlySection(section.html) || looksLikeCssOnlySection(section.text)) return false
    return true
  })
}

function hasStoredCardHtml(card) {
  return Boolean(card?.frontHtml || card?.backHtml || card?.cardCss || getCardHtmlSections(card).length > 0)
}

function isNewCard(card) {
  return !hasStartedCard(card)
}

function isCardDue(card) {
  return hasStartedCard(card) && isReviewDue(card?.review)
}

function getCardReviewStateLabel(card) {
  if (!hasStartedCard(card)) return '新卡'
  return isCardDue(card) ? '到期' : formatReviewDueLabel(card.review)
}

function getRelatedSuggestions(data, card, limit = 4) {
  if (!card) return []
  const linkedIds = new Set(getCardLinks(card))
  const baseTokens = tokenizeForRelated(`${card.front} ${card.back || ''}`)
  if (baseTokens.size === 0 && !card.source?.path?.join('/')) return []

  return data.cards
    .filter((item) => item.id !== card.id && !linkedIds.has(item.id))
    .map((item) => {
      const itemTokens = tokenizeForRelated(`${item.front} ${item.back || ''}`)
      let score = 0
      if (card.source?.path?.join('/') && item.source?.path?.join('/') === card.source.path.join('/')) score += 4
      let overlap = 0
      for (const token of baseTokens) {
        if (itemTokens.has(token)) overlap += 1
      }
      score += overlap
      if (overlap > 0 && item.deckId === card.deckId) score += 1
      return { card: item, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.card)
}

function getAnnotationWall(data) {
  return data.cards.flatMap((card) => getCardAnnotations(card).map((annotation) => {
    const deck = data.decks.find((item) => item.id === card.deckId)
    return { ...annotation, card, deck }
  })).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

function getCardAnnotationCount(data) {
  return data.cards.reduce((sum, card) => sum + getCardAnnotations(card).length, 0)
}

function getLinkedPairCount(data) {
  const pairs = new Set()
  for (const card of data.cards) {
    for (const targetId of getCardLinks(card)) {
      const pair = [card.id, targetId].sort().join(':')
      pairs.add(pair)
    }
  }
  return pairs.size
}

export { getCardAnnotations, getCardLinks, getCardFlagColor, getRelatedSuggestions, getCardHtmlSections, getCardScopeParts, getScopeKey, makeScopeNode, buildBrowseScopeTree, flattenScopeTree, findBestScopeNodeForDeck, isCardDue, isNewCard, getCardReviewStateLabel, hasStoredCardHtml, compactCardText, isBuiltinDylItem, getAnnotationWall, getCardAnnotationCount, getLinkedPairCount }
