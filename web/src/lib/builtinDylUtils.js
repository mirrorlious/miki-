import { BUILTIN_DYL_PACK_ID } from './constants.js'
import { getCardFlagColor, getCardAnnotations, getCardLinks, isBuiltinDylItem } from './browseUtils.js'

const ZH2000_ROOT_DECK_ID = 'builtin-zh2000-deck-root'
const ZH2000_ROOT_LABEL = '27法硕 ZH2000 题库'
const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

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

function normalizePart(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function stableHash(value = '') {
  let hash = 2166136261
  const text = String(value)
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function splitDeckPath(deck = '') {
  return String(deck || '未分组')
    .split('::')
    .map(normalizePart)
    .filter(Boolean)
}

function getAnswerLetters(card = {}) {
  if (Array.isArray(card.answerLetters)) {
    return card.answerLetters.map((item) => normalizePart(item).toUpperCase()).filter(Boolean)
  }
  return String(card.answerLetters || '')
    .split(/[,，、\s]+/)
    .map((item) => normalizePart(item).toUpperCase())
    .filter(Boolean)
}

function isRawWebChoiceCard(card = {}) {
  return Boolean(card?.question && Array.isArray(card?.options) && (Array.isArray(card?.answerLetters) || card?.rawEncryptedAnswer || card?.analysis))
}

function isRawWebChoiceBundle(bundle = {}) {
  const cards = Array.isArray(bundle.cards) ? bundle.cards : []
  if (!cards.length) return false
  return cards.slice(0, Math.min(cards.length, 20)).every(isRawWebChoiceCard)
}

function makeChoiceFront(card = {}) {
  const answerLetters = getAnswerLetters(card)
  const typeLabel = answerLetters.length > 1 ? '多选' : '单选'
  const lines = [`【${typeLabel}】 ${normalizePart(card.question)}`]
  const options = Array.isArray(card.options) ? card.options : []
  options.forEach((option, index) => {
    lines.push(`${OPTION_LABELS[index] || String(index + 1)}. ${normalizePart(option)}`)
  })
  const tags = [card.subject, card.book, card.volume].map(normalizePart).filter(Boolean)
  if (tags.length) lines.push(`标签：${tags.join(' / ')}`)
  return lines.join('\n')
}

function makeChoiceBack(card = {}) {
  return `答案：${getAnswerLetters(card).join('')}\n解析：${String(card.analysis || '')}`
}

function normalizeZh2000Card(card = {}, index = 0) {
  if (card.front && card.back && card.deckId && card.template) {
    return {
      ...card,
      builtinPack: card.builtinPack || BUILTIN_DYL_PACK_ID,
    }
  }

  const rawDeckParts = splitDeckPath(card.deck)
  const deckPath = [ZH2000_ROOT_LABEL, ...rawDeckParts]
  const uid = card.uid || card.noteId || `${card.deck || 'deck'}-${card.number || index}`
  const id = `builtin-zh2000-card-${stableHash(uid)}`
  const answerLetters = getAnswerLetters(card)
  const typeLabel = answerLetters.length > 1 ? '多选' : '单选'
  const subject = normalizePart(card.subject)
  const book = normalizePart(card.book)
  const volume = normalizePart(card.volume)
  const tags = Array.from(new Set([
    ...(Array.isArray(card.tags) ? card.tags.map(normalizePart) : []),
    subject,
    book,
    volume,
    typeLabel,
  ].filter(Boolean)))
  const front = makeChoiceFront(card)
  const back = makeChoiceBack(card)

  return {
    id,
    deckId: ZH2000_ROOT_DECK_ID,
    front,
    back,
    rawFront: front,
    rawBack: back,
    template: 'quiz-choice-control-center',
    tags,
    favorite: Boolean(card.favorite),
    flagged: Boolean(card.flagged),
    flagColor: card.flagColor || '',
    comment: card.comment || '',
    align: 'left',
    sourceKey: `web-choice-zh2000:${uid}`,
    source: {
      type: 'web-choice-bank',
      builtinPack: BUILTIN_DYL_PACK_ID,
      packId: 'zh2000',
      uid: card.uid,
      noteId: card.noteId,
      deckName: deckPath.join('::'),
      deckPath,
      subject,
      book,
      volume,
    },
    createdAt: 1779453680000 + index,
    review: card.review ?? { dueDate: '', interval: 0, ease: 2.5, reps: 0, lapses: 0, lastGrade: null },
    builtinPack: BUILTIN_DYL_PACK_ID,
  }
}

function normalizeBuiltinBundleCards(cards = []) {
  return cards.map((card, index) => normalizeZh2000Card(card, index))
}

function mergeBuiltinDylData(data, bundle, signedIn) {
  const cleanData = stripBuiltinDylItems(data)
  if (!signedIn || !bundle?.loaded) return cleanData

  // ZH2000 已经改为 Shell 顶部“题库”入口的独立网站版组件。
  // 这里不再把 raw cards.json 强行转成普通卡片，避免浏览/学习页缺失专属答题面板和解析界面。
  if (isRawWebChoiceBundle(bundle)) return cleanData

  const baseCards = normalizeBuiltinBundleCards(Array.isArray(bundle.cards) ? bundle.cards : [])
  const overrides = new Map(data.cards.filter(isBuiltinDylItem).map((card) => [card.id, card]))
  const mergedCards = baseCards.map((baseCard) => {
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
    decks: [...(Array.isArray(bundle.decks) ? bundle.decks : []), ...cleanData.decks],
    cards: [...mergedCards, ...cleanData.cards],
  }
}

export { stripBuiltinDylItems, makeBuiltinCardOverride, mergeBuiltinDylData }