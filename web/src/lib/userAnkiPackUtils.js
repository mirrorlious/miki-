import { getCardAnnotations, getCardFlagColor, getCardLinks } from './browseUtils.js'
import { getDeckSection, normalizePathPart } from './deckUtils.js'

function isUserAnkiPackItem(item) {
  return Boolean(item?.userAnkiPack || item?.source?.userAnkiPack)
}

function stripUserAnkiPackItems(data) {
  return {
    ...data,
    decks: Array.isArray(data?.decks) ? data.decks.filter((deck) => !isUserAnkiPackItem(deck)) : [],
    cards: Array.isArray(data?.cards) ? data.cards.filter((card) => !isUserAnkiPackItem(card) || card.userAnkiOverride) : [],
  }
}

function makeUserAnkiCardOverride(baseCard, patch = {}) {
  return {
    id: baseCard.id,
    deckId: baseCard.deckId,
    userAnkiPack: baseCard.userAnkiPack || baseCard.source?.userAnkiPack,
    userAnkiOverride: true,
    createdAt: baseCard.createdAt,
    review: baseCard.review ?? { dueDate: '', interval: 0, ease: 2.5, reps: 0, lapses: 0, lastGrade: null },
    favorite: Boolean(baseCard.favorite),
    flagged: Boolean(baseCard.flagged),
    flagColor: getCardFlagColor(baseCard),
    comment: baseCard.comment ?? '',
    annotations: getCardAnnotations(baseCard),
    links: getCardLinks(baseCard),
    ...patch,
    updatedAt: Date.now(),
  }
}

function mergeUserAnkiPackData(data, bundle) {
  const cleanData = stripUserAnkiPackItems(data)
  if (!bundle?.loaded) return cleanData

  const deletedUserAnkiDeckIds = new Set(
    Array.isArray(data?.profile?.deletedUserAnkiDeckIds)
      ? data.profile.deletedUserAnkiDeckIds.map((id) => String(id))
      : []
  )
  const deletedDeckSections = new Set(
    Array.isArray(data?.profile?.deletedDeckSections)
      ? data.profile.deletedDeckSections.map((section) => normalizePathPart(section).toLowerCase()).filter(Boolean)
      : []
  )
  const bundleDeckById = new Map((bundle.decks || []).map((deck) => [String(deck.id), deck]))
  const isDeletedDeck = (deckId) => deletedUserAnkiDeckIds.has(String(deckId || ''))
  const isDeletedSection = (deck) => deletedDeckSections.has(normalizePathPart(getDeckSection(deck)).toLowerCase())

  const visibleBundleDecks = (bundle.decks || []).filter((deck) => !isDeletedDeck(deck.id) && !isDeletedSection(deck))
  const overrides = new Map((data.cards || []).filter((card) => card.userAnkiOverride).map((card) => [card.id, card]))
  const mergedCards = (bundle.cards || [])
    .filter((baseCard) => {
      if (isDeletedDeck(baseCard.deckId)) return false
      const deck = bundleDeckById.get(String(baseCard.deckId))
      return deck ? !isDeletedSection(deck) : true
    })
    .map((baseCard) => {
      const override = overrides.get(baseCard.id)
      if (!override) return baseCard
      return {
        ...baseCard,
        review: override.review ?? baseCard.review,
        favorite: Boolean(override.favorite),
        flagged: Boolean(override.flagged),
        flagColor: getCardFlagColor(override),
        comment: override.comment ?? '',
        annotations: getCardAnnotations(override),
        links: getCardLinks(override),
        updatedAt: override.updatedAt,
      }
    })

  return {
    ...cleanData,
    decks: [...visibleBundleDecks, ...cleanData.decks],
    cards: [...mergedCards, ...cleanData.cards],
  }
}

export { isUserAnkiPackItem, stripUserAnkiPackItems, makeUserAnkiCardOverride, mergeUserAnkiPackData }
