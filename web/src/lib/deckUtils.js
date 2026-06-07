import { DECK_COLOR_OPTIONS, DEFAULT_DECK_SECTIONS, UNGROUPED_SECTION } from './constants.js'
import { stripAnswerSectionFromHtml, stripAnswerSectionFromText } from '../ankiHtml.js'
import { getCardReviewReps, makeNewCardReview } from './reviewUtils.js'

function getDeckSection(deck) {
  return deck?.section?.trim() || UNGROUPED_SECTION
}

function getDeckChapter(deck) {
  return deck?.chapter?.trim() || ''
}


function getStableDeckColor(value = '') {
  const colors = DECK_COLOR_OPTIONS.map((option) => option.value)
  const hash = Array.from(String(value)).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return colors[hash % colors.length] ?? 'sun'
}

function getDeckScopeParts(deck) {
  return [
    getDeckSection(deck),
    ...getDeckChapter(deck).split('/').map(normalizePathPart).filter(Boolean),
    deck?.name,
  ].filter(Boolean)
}

function getDeckPath(deck) {
  const section = getDeckSection(deck)
  const chapter = getDeckChapter(deck)
  return chapter ? ${section} /  : section
}

function getDeckOptionLabel(deck) {
  return ${getDeckPath(deck)} / 
}

function normalizePathPart(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

function splitAnkiDeckPath(value = '') {
  return String(value)
    .split('::')
    .map((part) => normalizePathPart(part))
    .filter(Boolean)
}

function isAnkiMajorPathPart(value = '') {
  return /^(?:[A-Z\uFF21-\uFF3A]\s*)?(?:刑法学|民法学|法理学|宪法学|法制史|行政法|商经法|三国法|理论法|刑法|民法|宪法|法理|法条分析)/.test(normalizePathPart(value))
}

function findAnkiMajorPathIndex(sourcePath = []) {
  const directIndex = sourcePath.findIndex(isAnkiMajorPathPart)
  if (directIndex >= 0) return directIndex
  return sourcePath.length >= 3 ? 1 : -1
}

function getAnkiDeckTarget(card, fallbackDeck) {
  const sourcePath = Array.isArray(card?.source?.deckPath) && card.source.deckPath.length > 0
    ? card.source.deckPath.map(normalizePathPart).filter(Boolean)
    : splitAnkiDeckPath(card?.source?.deckName)

  if (sourcePath.length === 0) {
    return {
      section: fallbackDeck?.section ?? '',
      chapter: fallbackDeck?.chapter ?? '',
      name: fallbackDeck?.name ?? 'Anki 导入',
      description: fallbackDeck?.description ?? '从 Anki 导入的卡片。',
    }
  }

  if (sourcePath.length === 1) {
    return {
      section: 'Anki 导入',
      chapter: '',
      name: sourcePath[0],
      description: 从 Anki 原卡组  导入。,
    }
  }

  const majorIndex = findAnkiMajorPathIndex(sourcePath)
  if (majorIndex >= 0) {
    const name = sourcePath[majorIndex]
    const section = sourcePath[0] && sourcePath[0] !== name ? sourcePath[0] : 'Anki 导入'
    return {
      section,
      chapter: '',
      name,
      description: 从 Anki 原卡组  导入，按大科目  归组。,
    }
  }

  const name = sourcePath[sourcePath.length - 1]
  const section = sourcePath[0]
  const chapter = sourcePath.length > 2 ? sourcePath.slice(1, -1).join(' / ') : ''

  return {
    section,
    chapter,
    name,
    description: 从 Anki 原卡组  导入。,
  }
}

function summarizeAnkiDeckTargets(deckSummaries = [], fallbackDeck = null) {
  const targetMap = new Map()
  for (const summary of deckSummaries) {
    const target = getAnkiDeckTarget({ source: { deckName: summary.deckName, deckPath: summary.deckPath } }, fallbackDeck)
    const key = getDeckIdentityKey(target)
    const current = targetMap.get(key) ?? { ...target, count: 0, sourceCount: 0, samples: [] }
    current.count += Number(summary.count) || 0
    current.sourceCount += 1
    if (current.samples.length < 3) current.samples.push(summary.deckPath?.join(' / ') || summary.deckName)
    targetMap.set(key, current)
  }
  return Array.from(targetMap.values()).sort((a, b) => getDeckOptionLabel(a).localeCompare(getDeckOptionLabel(b), 'zh-CN'))
}

function getDeckIdentityKey(deck) {
  return [deck?.section ?? '', deck?.chapter ?? '', deck?.name ?? '']
    .map((part) => normalizePathPart(part).toLowerCase())
    .join('|||')
}

function getSectionNames(decks) {
  const customSections = decks
    .map(getDeckSection)
    .filter((section) => section && section !== UNGROUPED_SECTION && !DEFAULT_DECK_SECTIONS.includes(section))
  return [
    ...DEFAULT_DECK_SECTIONS,
    ...Array.from(new Set(customSections)),
    UNGROUPED_SECTION,
  ]
}

function sortDecksByPath(decks) {
  return [...decks].sort((a, b) => getDeckOptionLabel(a).localeCompare(getDeckOptionLabel(b), 'zh-CN'))
}

function groupDecksBySection(decks) {
  return getSectionNames(decks)
    .map((section) => ({
      section,
      decks: sortDecksByPath(decks.filter((deck) => getDeckSection(deck) === section)),
    }))
    .filter((group) => group.decks.length > 0)
}

function getDeckChapterKey(deck) {
  return ${getDeckSection(deck)}|||
}

function getDeckChapterLabel(deck) {
  const chapter = getDeckChapter(deck)
  return chapter ? getDeckPath(deck) : ${getDeckSection(deck)} / 未细分
}

function getDeckCards(data, deckId) {
  return data.cards.filter((card) => card.deckId === deckId)
}

function getDeckOutlineRows(data) {
  return getSectionNames(data.decks)
    .map((section) => {
      const decks = sortDecksByPath(data.decks.filter((deck) => getDeckSection(deck) === section))
      return {
        section,
        decks,
        cardCount: decks.reduce((sum, deck) => sum + getDeckCards(data, deck.id).length, 0),
        chapters: decks.reduce((chapters, deck) => {
          const chapter = getDeckChapter(deck) || '未细分'
          const current = chapters.get(chapter) ?? { chapter, decks: [], cardCount: 0 }
          current.decks.push(deck)
          current.cardCount += getDeckCards(data, deck.id).length
          chapters.set(chapter, current)
          return chapters
        }, new Map()),
      }
    })
    .filter((row) => row.decks.length > 0)
    .map((row) => ({ ...row, chapters: Array.from(row.chapters.values()) }))
}

function normalizeImportedAnkiCards(data) {
  let changed = false
  const cards = data.cards.map((card) => {
    const patch = {}
    const reps = getCardReviewReps(card)

    if (reps === 0 && (card.review?.dueDate || card.review?.dueAt || card.review?.reps !== 0)) {
      patch.review = makeNewCardReview(card.review)
    }

    if (card?.source?.type === 'apkg') {
      const nextFront = stripAnswerSectionFromText(card.front)
      const nextFrontHtml = card.frontHtml ? stripAnswerSectionFromHtml(card.frontHtml) : card.frontHtml

      if (nextFront && nextFront !== card.front) patch.front = nextFront
      if (nextFrontHtml && nextFrontHtml !== card.frontHtml) patch.frontHtml = nextFrontHtml
    }

    if (Object.keys(patch).length === 0) return card
    changed = true
    return { ...card, ...patch }
  })

  return changed ? { ...data, cards } : data
}

export { getDeckSection, getDeckChapter, getStableDeckColor, getDeckScopeParts, getDeckPath, getDeckOptionLabel, normalizePathPart, splitAnkiDeckPath, isAnkiMajorPathPart, findAnkiMajorPathIndex, getAnkiDeckTarget, summarizeAnkiDeckTargets, getDeckIdentityKey, getSectionNames, sortDecksByPath, groupDecksBySection, getDeckChapterKey, getDeckChapterLabel, getDeckCards, getDeckOutlineRows, normalizeImportedAnkiCards }