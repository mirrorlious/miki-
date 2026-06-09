import { idleYield, openMikiDb } from './indexedDbStore.js'
import { makeNewCardReview } from './reviewUtils.js'

const CHUNK_SIZE = 25
const PACK_STORE = 'userAnkiPacks'
const CHUNK_STORE = 'userAnkiPackChunks'

function now() { return Date.now() }
function cleanId(value = '') { return String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || `pack-${Date.now()}` }

export function makeUserAnkiPackId(fileName = 'apkg') {
  const base = cleanId(fileName.replace(/\.(apkg|colpkg)$/i, ''))
  return `user-apkg-${Date.now()}-${base}`
}

export function getUserAnkiPackChunkSize() {
  return CHUNK_SIZE
}

function normalizeDeck(deck = {}, packId = '') {
  return {
    ...deck,
    id: String(deck.id),
    userAnkiPack: packId,
    source: {
      ...(deck.source || {}),
      type: 'user-apkg-pack',
      userAnkiPack: packId,
    },
  }
}

function getTemplateForCard(card = {}, templates = []) {
  return (templates || []).find((template) => template?.id && (template.id === card.templateId || template.id === card.template)) || null
}

function normalizeCard(card = {}, packId = '', chunkIndex = 0, templates = []) {
  const template = getTemplateForCard(card, templates)
  const shouldAttachTemplateCss = !card?.source?.lazyNativeAnkiRender && !card.cardCss && template?.css
  return {
    ...card,
    ...(shouldAttachTemplateCss ? { cardCss: template.css } : {}),
    id: String(card.id),
    userAnkiPack: packId,
    userAnkiChunk: chunkIndex,
    review: card.review || makeNewCardReview(),
    source: {
      ...(card.source || {}),
      type: card.source?.type || 'apkg',
      nativeTemplate: true,
      userAnkiPack: packId,
      userAnkiChunk: chunkIndex,
    },
  }
}


function withNativeTemplateRecord(card = {}, templates = []) {
  const template = getTemplateForCard(card, templates)
  if (!template) return card
  return {
    ...card,
    nativeTemplateRecord: template,
    source: {
      ...(card.source || {}),
      templateId: card.templateId || card.template || template.id,
    },
  }
}


function truncateText(value = '', maxLength = 900) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}…`
}

function makeUserAnkiCardIndex(card = {}, packId = '', chunkIndex = 0) {
  const normalized = normalizeCard(card, packId, chunkIndex)
  return {
    id: normalized.id,
    deckId: normalized.deckId,
    template: normalized.template,
    title: normalized.title,
    front: truncateText(normalized.front || normalized.question || normalized.frontText || '', 1200),
    back: truncateText(normalized.back || normalized.answer || normalized.backText || '', 1200),
    tags: normalized.tags,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    review: normalized.review || makeNewCardReview(),
    favorite: Boolean(normalized.favorite),
    flagged: Boolean(normalized.flagged),
    flagColor: normalized.flagColor,
    suspended: Boolean(normalized.suspended),
    userAnkiPack: packId,
    userAnkiChunk: chunkIndex,
    source: {
      ...(normalized.source || {}),
      type: normalized.source?.type || 'apkg',
      nativeTemplate: true,
      userAnkiPack: packId,
      userAnkiChunk: chunkIndex,
      lazyUserAnkiCard: true,
    },
  }
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'))
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'))
  })
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
  })
}

async function getAll(storeName) {
  const db = await openMikiDb()
  if (!db || !db.objectStoreNames.contains(storeName)) return []
  return requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll())
}

async function forEachUserAnkiChunk(callback) {
  const db = await openMikiDb()
  if (!db || !db.objectStoreNames.contains(CHUNK_STORE)) return
  await new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNK_STORE, 'readonly')
    const request = tx.objectStore(CHUNK_STORE).openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      try {
        callback(cursor.value)
      } catch (error) {
        reject(error)
        return
      }
      cursor.continue()
    }
    request.onerror = () => reject(request.error || new Error('IndexedDB cursor failed'))
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'))
  })
}


export async function createUserAnkiPackManifest({ packId, fileName, deckSummaries = [], cardCount = 0, noteCount = 0, templates = [] } = {}) {
  const db = await openMikiDb()
  const manifest = {
    id: packId,
    title: fileName || 'Anki 导入包',
    fileName: fileName || '',
    type: 'user-apkg-pack',
    cardCount: Number(cardCount) || 0,
    noteCount: Number(noteCount) || 0,
    deckSummaries,
    templates,
    chunkSize: CHUNK_SIZE,
    createdAt: now(),
    updatedAt: now(),
  }
  if (!db || !db.objectStoreNames.contains(PACK_STORE)) return manifest
  const tx = db.transaction(PACK_STORE, 'readwrite')
  tx.objectStore(PACK_STORE).put(manifest)
  await txDone(tx)
  return manifest
}

function compactCardForChunk(card = {}, templates = []) {
  const next = { ...card }
  const template = getTemplateForCard(next, templates)
  if (template?.css && next.cardCss === template.css) delete next.cardCss
  return next
}

export async function putUserAnkiPackChunk({ packId, chunkIndex, cards = [], decks = [], templates = [], processed = 0, total = 0 } = {}) {
  const db = await openMikiDb()
  const chunk = {
    id: `${packId}:chunk:${String(chunkIndex).padStart(5, '0')}`,
    packId,
    chunkIndex,
    cards: cards.map((card) => normalizeCard(compactCardForChunk(card, templates), packId, chunkIndex)),
    decks: decks.map((deck) => normalizeDeck(deck, packId)),
    templates,
    processed,
    total,
    updatedAt: now(),
  }
  if (!db || !db.objectStoreNames.contains(CHUNK_STORE)) return chunk
  const tx = db.transaction([CHUNK_STORE, PACK_STORE], 'readwrite')
  tx.objectStore(CHUNK_STORE).put(chunk)
  const packReq = tx.objectStore(PACK_STORE).get(packId)
  packReq.onsuccess = () => {
    const pack = packReq.result
    if (pack) {
      tx.objectStore(PACK_STORE).put({
        ...pack,
        chunkCount: Math.max(Number(pack.chunkCount) || 0, chunkIndex + 1),
        importedCount: Math.max(Number(pack.importedCount) || 0, processed),
        updatedAt: now(),
      })
    }
  }
  await txDone(tx)
  return chunk
}

export async function loadUserAnkiPacksAsData() {
  const packs = await getAll(PACK_STORE)
  if (!packs.length) return { loaded: true, decks: [], cards: [], packs: [] }

  const activePacks = packs.filter((pack) => !pack.deletedAt)
  const activePackIds = new Set(activePacks.map((pack) => pack.id))
  const deckMap = new Map()
  const cardMap = new Map()

  await forEachUserAnkiChunk((chunk) => {
    if (!activePackIds.has(chunk.packId)) return
    for (const deck of chunk.decks || []) deckMap.set(deck.id, normalizeDeck(deck, chunk.packId))
    for (const card of chunk.cards || []) cardMap.set(card.id, makeUserAnkiCardIndex(card, chunk.packId, chunk.chunkIndex))
  })

  await idleYield()
  return {
    loaded: true,
    packs: activePacks,
    decks: Array.from(deckMap.values()),
    cards: Array.from(cardMap.values()),
  }
}


export async function getUserAnkiPackCardById(cardId, packId = '', chunkIndex = null) {
  const db = await openMikiDb()
  if (!db || !db.objectStoreNames.contains(CHUNK_STORE) || !cardId) return null
  const targetCardId = String(cardId)
  const targetPackId = String(packId || '')
  const targetChunkIndex = Number.isFinite(Number(chunkIndex)) ? Number(chunkIndex) : null

  if (targetPackId && targetChunkIndex !== null) {
    const key = `${targetPackId}:chunk:${String(targetChunkIndex).padStart(5, '0')}`
    const chunk = await requestToPromise(db.transaction(CHUNK_STORE, 'readonly').objectStore(CHUNK_STORE).get(key))
    const match = (chunk?.cards || []).find((card) => String(card.id) === targetCardId)
    if (match) return withNativeTemplateRecord(normalizeCard(match, chunk.packId, chunk.chunkIndex, chunk.templates || []), chunk.templates || [])
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNK_STORE, 'readonly')
    const request = tx.objectStore(CHUNK_STORE).openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve(null)
        return
      }
      const chunk = cursor.value
      if (!targetPackId || chunk.packId === targetPackId) {
        const match = (chunk.cards || []).find((card) => String(card.id) === targetCardId)
        if (match) {
          resolve(withNativeTemplateRecord(normalizeCard(match, chunk.packId, chunk.chunkIndex, chunk.templates || []), chunk.templates || []))
          return
        }
      }
      cursor.continue()
    }
    request.onerror = () => reject(request.error || new Error('IndexedDB cursor failed'))
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'))
  })
}

export async function deleteUserAnkiPack(packId) {
  const db = await openMikiDb()
  if (!db || !packId) return
  const tx = db.transaction([PACK_STORE, CHUNK_STORE], 'readwrite')
  const packStore = tx.objectStore(PACK_STORE)
  const chunkStore = tx.objectStore(CHUNK_STORE)
  packStore.put({ id: packId, deletedAt: now(), updatedAt: now() })
  const chunks = await new Promise((resolve, reject) => {
    const request = chunkStore.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
  for (const chunk of chunks) {
    if (chunk.packId === packId) chunkStore.delete(chunk.id)
  }
  await txDone(tx)
}
