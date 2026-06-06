import { getDeckScopeParts } from './deckUtils.js'
import { getCardSideHtml, getCardSideText } from './cardHtml.js'


function getCardAnnotations(card) {
  return Array.isArray(card?.annotations) ? card.annotations : []
}

function getCardLinks(card) {
  return Array.isArray(card?.links) ? card.links : []
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
  return parts.length === 0 ? 'all' : `scope:${parts.join('|||')}`
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

  data.decks.forEach((deck) => {
    const node = ensureChain(getDeckScopeParts(deck)).at(-1)
    node.deckIds.add(deck.id)
  })

  data.cards.forEach((card) => {
    const chain = ensureChain(getCardScopeParts(card, deckById))
    chain.forEach((node) => node.cardIds.add(card.id))
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

function getCardHtmlSections(card) {
  return Array.isArray(card?.htmlSections)
    ? card.htmlSections.filter((section) => section?.id && section?.label && (section.html || section.text))
    : []
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

function isBuiltinDylItem(item) {
  return item?.builtinPack === BUILTIN_DYL_PACK_ID || item?.source?.builtinPack === BUILTIN_DYL_PACK_ID
}

function getRelatedSuggestions(data, card, limit = 4) {
  if (!card) return []
  const linkedIds = new Set(getCardLinks(card))
  const baseTokens = tokenizeForRelated(`${card.front} ${card.back}`)
  if (baseTokens.size === 0 && !card.source?.path?.join('/')) return []

  return data.cards
    .filter((item) => item.id !== card.id && !linkedIds.has(item.id))
    .map((item) => {
      const itemTokens = tokenizeForRelated(`${item.front} ${item.back}`)
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

export { getCardAnnotations, getCardLinks, getRelatedSuggestions, getCardHtmlSections, getCardScopeParts, getScopeKey, buildBrowseScopeTree, flattenScopeTree, findBestScopeNodeForDeck, isCardDue, isNewCard, getCardReviewStateLabel, hasStoredCardHtml, compactCardText, isBuiltinDylItem }