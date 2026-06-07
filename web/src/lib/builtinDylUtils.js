import { BUILTIN_DYL_PACK_ID } from './constants.js'
import { getCardFlagColor, getCardAnnotations, getCardLinks, isBuiltinDylItem } from './browseUtils.js'

function stripBuiltinDylItems(data) {
  return {
    ...data,
    decks: data.decks.filter((deck) => !isBuiltinDylItem(deck)),
    cards: data.cards.filter((card) => !isBuiltinDylItem(card)),
  }
}

function makeBuiltinCardOverride(baseCard, patch = {}) {
  return {
    id: baseCard.id,
    deckId: baseCard.deckId,
    builtinPack: BUILTIN_DYL_PACK_ID,
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

function mergeBuiltinDylData(data, bundle, signedIn) {
  const cleanData = stripBuiltinDylItems(data)
  if (!signedIn || !bundle?.loaded) return cleanData

  const overrides = new Map(data.cards.filter(isBuiltinDylItem).map((card) => [card.id, card]))
  const mergedCards = bundle.cards.map((baseCard) => {
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
    decks: [...bundle.decks, ...cleanData.decks],
    cards: [...mergedCards, ...cleanData.cards],
  }
}

export { stripBuiltinDylItems, makeBuiltinCardOverride, mergeBuiltinDylData }