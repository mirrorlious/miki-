const TOMBSTONE_LIMIT_PER_COLLECTION = 8000
const TOMBSTONE_COLLECTIONS = ['decks', 'cards', 'templates', 'dailyLogs', 'reviewLogs']

function toMillis(value) {
  if (!value) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value instanceof Date) return value.getTime()
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (typeof value?.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1000000)
  return Number(value) || 0
}

function itemTime(item) {
  return Math.max(
    toMillis(item?.updatedAt),
    toMillis(item?.createdAt),
    toMillis(item?.reviewedAt),
    toMillis(item?.startedAt),
    toMillis(item?.deletedAt),
  )
}

function normalizeTombstoneCollection(value = {}) {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, deletedAt]) => [String(key), toMillis(deletedAt)])
      .filter(([key, deletedAt]) => key && deletedAt > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOMBSTONE_LIMIT_PER_COLLECTION),
  )
}

function normalizeTombstones(value = {}) {
  const source = value && typeof value === 'object' ? value : {}
  return TOMBSTONE_COLLECTIONS.reduce((next, collection) => {
    const normalized = normalizeTombstoneCollection(source[collection])
    if (Object.keys(normalized).length > 0) next[collection] = normalized
    return next
  }, {})
}

function mergeTombstones(...values) {
  const merged = {}
  for (const value of values) {
    const normalized = normalizeTombstones(value)
    for (const collection of TOMBSTONE_COLLECTIONS) {
      const items = normalized[collection]
      if (!items) continue
      if (!merged[collection]) merged[collection] = {}
      for (const [key, deletedAt] of Object.entries(items)) {
        merged[collection][key] = Math.max(toMillis(merged[collection][key]), toMillis(deletedAt))
      }
    }
  }
  return normalizeTombstones(merged)
}

function getTombstones(data = {}) {
  const profile = data?.profile && typeof data.profile === 'object' ? data.profile : {}
  return mergeTombstones(data?.tombstones, profile?.tombstones)
}

function getTombstoneTime(data = {}, collection = '', key = '') {
  if (!collection || !key) return 0
  return toMillis(getTombstones(data)?.[collection]?.[String(key)])
}

function isTombstoned(data = {}, collection = '', key = '', activeUpdatedAt = 0) {
  const deletedAt = getTombstoneTime(data, collection, key)
  return deletedAt > 0 && deletedAt >= toMillis(activeUpdatedAt)
}

function withTombstones(data = {}, tombstonePatch = {}, timestamp = Date.now()) {
  const currentProfile = data.profile && typeof data.profile === 'object' ? data.profile : {}
  const currentTombstones = getTombstones(data)
  const nextPatch = {}
  for (const [collection, ids] of Object.entries(tombstonePatch || {})) {
    const cleanIds = Array.from(new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(String)))
    if (!cleanIds.length) continue
    nextPatch[collection] = cleanIds.reduce((next, id) => {
      next[id] = timestamp
      return next
    }, {})
  }
  const tombstones = mergeTombstones(currentTombstones, nextPatch)
  return {
    ...data,
    tombstones,
    profile: {
      ...currentProfile,
      tombstones,
      updatedAt: Math.max(toMillis(currentProfile.updatedAt), timestamp),
    },
  }
}

function normalizeTextKey(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function stableTextHash(value = '') {
  const text = String(value ?? '')
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function cleanKeyPart(value = '') {
  return normalizeTextKey(value).replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'unknown'
}

function getApkgCardOrd(card = {}) {
  return card?.source?.cardOrd ?? card?.source?.ankiCardOrd ?? card?.anki?.cardOrd ?? card?.anki?.ord ?? card?.ord ?? 0
}

function makeStableApkgCardKey(card = {}) {
  const source = card.source || {}
  const anki = card.anki || {}
  const noteId = source.ankiNoteId ?? anki.noteId ?? source.noteId ?? ''
  const cardId = source.ankiCardId ?? anki.cardId ?? source.cardId ?? ''
  const cardOrd = getApkgCardOrd(card)
  if (noteId || cardId) {
    const fileHint = cleanKeyPart(source.fileName || source.deckName || anki.deckName || source.importId || 'apkg')
    return `apkg:${fileHint}:${noteId}:${cardId}:${cardOrd}`
  }

  const oldSourceKey = String(card.sourceKey || '')
  const oldMatch = oldSourceKey.match(/^apkg:apkg-[^:]+:(.+)$/)
  if (oldMatch) return `apkg:legacy:${oldMatch[1]}`
  if (oldSourceKey.startsWith('apkg:')) return oldSourceKey
  return ''
}

function makeStableCardIdentity(card = {}) {
  if (card?.source?.type === 'apkg' || String(card.sourceKey || '').startsWith('apkg:') || card?.anki) {
    const apkgKey = makeStableApkgCardKey(card)
    if (apkgKey) return apkgKey
  }
  if (card.sourceKey) return `source:${String(card.sourceKey)}`
  if (card.id) return `id:${String(card.id)}`
  const deckPart = card.deckId ? String(card.deckId) : 'no-deck'
  const textHash = stableTextHash(`${card.front ?? ''}\n---\n${card.back ?? ''}`)
  return `text:${deckPart}:${textHash}`
}

function getDeckIdentity(deck = {}) {
  const section = normalizeTextKey(deck.section || '')
  const chapter = normalizeTextKey(deck.chapter || '')
  const name = normalizeTextKey(deck.name || deck.title || '')
  return `${section}|||${chapter}|||${name || deck.id || ''}`
}

function mergeReviewValue(a = {}, b = {}) {
  const aReps = Number(a?.reps ?? 0)
  const bReps = Number(b?.reps ?? 0)
  if (bReps > aReps) return b
  if (aReps > bReps) return a
  return itemTime(b) >= itemTime(a) ? b : a
}

function mergeCardValues(base = {}, incoming = {}, canonicalId = base.id) {
  const newer = itemTime(incoming) >= itemTime(base) ? incoming : base
  const older = newer === incoming ? base : incoming
  return {
    ...older,
    ...newer,
    id: canonicalId,
    deckId: newer.deckId ?? older.deckId,
    review: mergeReviewValue(older.review, newer.review),
    favorite: Boolean(older.favorite || newer.favorite),
    flagged: Boolean(older.flagged || newer.flagged),
    annotations: Array.isArray(newer.annotations) && newer.annotations.length ? newer.annotations : older.annotations,
    links: Array.from(new Set([...(Array.isArray(older.links) ? older.links : []), ...(Array.isArray(newer.links) ? newer.links : [])])),
    updatedAt: Math.max(itemTime(older), itemTime(newer), Date.now()),
  }
}

function normalizeAndDedupeData(data = {}) {
  const source = data && typeof data === 'object' ? data : {}
  let changed = false
  const tombstones = getTombstones(source)
  const dataWithTombstones = Object.keys(tombstones).length
    ? {
        ...source,
        tombstones,
        profile: { ...(source.profile || {}), tombstones },
      }
    : source

  const deckIdRemap = new Map()
  const deckByIdentity = new Map()
  const decks = []
  for (const deck of Array.isArray(dataWithTombstones.decks) ? dataWithTombstones.decks : []) {
    if (!deck?.id || isTombstoned(dataWithTombstones, 'decks', deck.id, itemTime(deck))) {
      changed = true
      continue
    }
    const key = getDeckIdentity(deck)
    const existing = deckByIdentity.get(key)
    if (!existing) {
      deckByIdentity.set(key, deck)
      decks.push(deck)
      continue
    }
    changed = true
    deckIdRemap.set(String(deck.id), String(existing.id))
    const merged = itemTime(deck) > itemTime(existing) ? { ...deck, id: existing.id } : { ...existing, ...deck, id: existing.id }
    const index = decks.findIndex((item) => item.id === existing.id)
    if (index >= 0) decks[index] = merged
    deckByIdentity.set(key, merged)
  }

  const cardIdRemap = new Map()
  const cardByIdentity = new Map()
  const cards = []
  for (const rawCard of Array.isArray(dataWithTombstones.cards) ? dataWithTombstones.cards : []) {
    if (!rawCard?.id || isTombstoned(dataWithTombstones, 'cards', rawCard.id, itemTime(rawCard))) {
      changed = true
      continue
    }
    const nextDeckId = deckIdRemap.get(String(rawCard.deckId)) || rawCard.deckId
    const card = nextDeckId !== rawCard.deckId ? { ...rawCard, deckId: nextDeckId } : rawCard
    if (card !== rawCard) changed = true
    const key = makeStableCardIdentity(card)
    const existing = cardByIdentity.get(key)
    if (!existing) {
      cardByIdentity.set(key, card)
      cards.push(card)
      continue
    }
    changed = true
    cardIdRemap.set(String(card.id), String(existing.id))
    const merged = mergeCardValues(existing, card, existing.id)
    const index = cards.findIndex((item) => item.id === existing.id)
    if (index >= 0) cards[index] = merged
    cardByIdentity.set(key, merged)
  }

  const templatesById = new Map()
  const templates = []
  for (const template of Array.isArray(dataWithTombstones.templates) ? dataWithTombstones.templates : []) {
    if (!template?.id || isTombstoned(dataWithTombstones, 'templates', template.id, itemTime(template))) {
      changed = true
      continue
    }
    const existing = templatesById.get(template.id)
    if (!existing) {
      templatesById.set(template.id, template)
      templates.push(template)
      continue
    }
    changed = true
    const merged = itemTime(template) >= itemTime(existing) ? { ...existing, ...template } : existing
    const index = templates.findIndex((item) => item.id === template.id)
    if (index >= 0) templates[index] = merged
    templatesById.set(template.id, merged)
  }

  const reviewLogIds = new Set()
  const reviewLogs = []
  for (const log of Array.isArray(dataWithTombstones.reviewLogs) ? dataWithTombstones.reviewLogs : []) {
    const cardId = cardIdRemap.get(String(log.cardId)) || log.cardId
    if (cardId && getTombstoneTime(dataWithTombstones, 'cards', cardId) > 0) {
      changed = true
      continue
    }
    const id = String(log.id || `${cardId || 'card'}:${log.reviewedAt || reviewLogs.length}`)
    if (reviewLogIds.has(id)) {
      changed = true
      continue
    }
    reviewLogIds.add(id)
    reviewLogs.push(cardId === log.cardId ? log : { ...log, cardId })
  }

  if (
    decks.length !== (Array.isArray(dataWithTombstones.decks) ? dataWithTombstones.decks.length : 0)
    || cards.length !== (Array.isArray(dataWithTombstones.cards) ? dataWithTombstones.cards.length : 0)
    || templates.length !== (Array.isArray(dataWithTombstones.templates) ? dataWithTombstones.templates.length : 0)
    || reviewLogs.length !== (Array.isArray(dataWithTombstones.reviewLogs) ? dataWithTombstones.reviewLogs.length : 0)
  ) changed = true

  if (!changed && dataWithTombstones === source) return source
  return {
    ...dataWithTombstones,
    decks,
    cards,
    templates,
    reviewLogs,
  }
}

export {
  TOMBSTONE_COLLECTIONS,
  toMillis,
  itemTime,
  getTombstones,
  getTombstoneTime,
  isTombstoned,
  mergeTombstones,
  normalizeTombstones,
  withTombstones,
  makeStableApkgCardKey,
  makeStableCardIdentity,
  normalizeAndDedupeData,
}
