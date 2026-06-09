const DB_NAME = 'miki-v18-card-store'
const DB_VERSION = 2
const APP_DATA_KEY = 'appData'
const LIGHT_CACHE_KEY = 'yang-memorizer-mvp:v18-light-cache'
const LEGACY_LOCALSTORAGE_KEYS = ['yang-memorizer-mvp']
const MAX_LIGHT_CACHE_CHARS = 320_000
const LIGHT_CACHE_VERSION = 19
const STORE_NAMES = ['meta', 'cards', 'decks', 'templates', 'reviews', 'logs', 'importJobs', 'syncQueue', 'profile', 'activity', 'dailyLogs', 'reviewLogs', 'userAnkiPacks', 'userAnkiPackChunks']
const DEFAULT_BATCH_SIZE = 80

let dbPromise = null

function canUseIndexedDb() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })
}

export function idleYield() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve()
      return
    }
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 120 })
      return
    }
    window.setTimeout(resolve, 0)
  })
}

export function openMikiDb() {
  if (!canUseIndexedDb()) return Promise.resolve(null)
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          if (name === 'syncQueue') {
            const store = db.createObjectStore(name, { keyPath: 'id' })
            store.createIndex('status', 'status', { unique: false })
            store.createIndex('collection', 'collection', { unique: false })
            store.createIndex('createdAt', 'createdAt', { unique: false })
          } else if (name === 'importJobs') {
            const store = db.createObjectStore(name, { keyPath: 'id' })
            store.createIndex('status', 'status', { unique: false })
            store.createIndex('createdAt', 'createdAt', { unique: false })
          } else if (name === 'userAnkiPacks') {
            const store = db.createObjectStore(name, { keyPath: 'id' })
            store.createIndex('updatedAt', 'updatedAt', { unique: false })
            store.createIndex('type', 'type', { unique: false })
          } else if (name === 'userAnkiPackChunks') {
            const store = db.createObjectStore(name, { keyPath: 'id' })
            store.createIndex('packId', 'packId', { unique: false })
            store.createIndex('chunkIndex', 'chunkIndex', { unique: false })
          } else {
            db.createObjectStore(name, { keyPath: 'id' })
          }
        }
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })

  return dbPromise
}

export function normalizeAppData(data = {}) {
  return {
    ...data,
    profile: data.profile && typeof data.profile === 'object' ? data.profile : {},
    decks: Array.isArray(data.decks) ? data.decks : [],
    cards: Array.isArray(data.cards) ? data.cards : [],
    dailyLogs: Array.isArray(data.dailyLogs) ? data.dailyLogs : [],
    reviewLogs: Array.isArray(data.reviewLogs) ? data.reviewLogs : [],
    activity: data.activity && typeof data.activity === 'object' ? data.activity : {},
  }
}

function makeLightDeck(deck = {}) {
  return {
    id: String(deck.id ?? ''),
    name: deck.name ?? '',
    section: deck.section ?? '',
    chapter: deck.chapter ?? '',
    color: deck.color ?? '',
    parentId: deck.parentId ?? '',
    createdAt: deck.createdAt ?? null,
    updatedAt: deck.updatedAt ?? null,
  }
}

function makeLightTemplate(template = {}) {
  return {
    id: String(template.id ?? ''),
    name: template.name ?? '',
    mode: template.mode ?? 'html',
    source: template.source ?? '',
    builtIn: Boolean(template.builtIn),
    updatedAt: template.updatedAt ?? null,
  }
}

function makeLightProfile(profile = {}) {
  const {
    cardTemplates,
    aiDrafts,
    importedHtml,
    ...rest
  } = profile && typeof profile === 'object' ? profile : {}

  return {
    ...rest,
    cardTemplates: Array.isArray(cardTemplates) ? cardTemplates.map(makeLightTemplate).slice(0, 80) : [],
  }
}

function makeLightDailyLog(log = {}) {
  return {
    id: log.id ?? `daily-${log.date ?? ''}`,
    date: log.date ?? '',
    minutes: log.minutes ?? log.studyMinutes ?? 0,
    reviewCount: log.reviewCount ?? log.reviews ?? 0,
    newCount: log.newCount ?? log.newCards ?? 0,
    updatedAt: log.updatedAt ?? null,
  }
}

function makeLightReviewLog(log = {}) {
  return {
    id: String(log.id ?? ''),
    cardId: String(log.cardId ?? ''),
    grade: log.grade ?? null,
    reviewedAt: log.reviewedAt ?? null,
  }
}

export function makeLightAppData(data = {}) {
  const normalized = normalizeAppData(data)
  // localStorage 只做“启动兜底/轻量索引”。APKG HTML、Anki 字段、模板源码都不能进这里。
  // 否则 2000+ 张 HTML 卡会在 JSON.stringify 阶段直接把浏览器进程打爆。
  return {
    version: LIGHT_CACHE_VERSION,
    profile: makeLightProfile(normalized.profile),
    activity: normalized.activity && typeof normalized.activity === 'object' ? { ...normalized.activity } : {},
    decks: normalized.decks.map(makeLightDeck).filter((deck) => deck.id),
    cards: [],
    templates: Array.isArray(normalized.templates) ? normalized.templates.map(makeLightTemplate).slice(0, 120) : [],
    dailyLogs: normalized.dailyLogs.slice(0, 90).map(makeLightDailyLog),
    reviewLogs: normalized.reviewLogs.slice(0, 300).map(makeLightReviewLog),
  }
}

export function persistLightLocalCache(data) {
  if (typeof localStorage === 'undefined') return
  try {
    for (const key of LEGACY_LOCALSTORAGE_KEYS) localStorage.removeItem(key)
    const payload = makeLightAppData(data)
    const raw = JSON.stringify(payload)
    if (raw.length > MAX_LIGHT_CACHE_CHARS) {
      console.warn('Light local cache skipped: payload is still too large.', raw.length)
      return
    }
    localStorage.setItem(LIGHT_CACHE_KEY, raw)
  } catch (error) {
    console.warn('Light local cache skipped.', error)
  }
}

export function readLightLocalCache() {
  // v19 起不再用 localStorage 恢复卡库。
  // 旧缓存可能已经包含完整 APKG HTML，一读取/JSON.parse 就可能再次 OOM。
  if (typeof localStorage !== 'undefined') {
    try {
      for (const key of LEGACY_LOCALSTORAGE_KEYS) localStorage.removeItem(key)
      const raw = localStorage.getItem(LIGHT_CACHE_KEY)
      if (raw && raw.length > MAX_LIGHT_CACHE_CHARS) localStorage.removeItem(LIGHT_CACHE_KEY)
    } catch {}
  }
  return null
}

function putAll(store, items = []) {
  for (const item of items) {
    if (!item?.id) continue
    store.put(item)
  }
}

function trimHugeString(value, limit = 160_000) {
  if (typeof value !== 'string') return value
  return value.length > limit ? `${value.slice(0, limit)}
<!-- miki:trimmed-large-anki-field -->` : value
}

function compactAnkiFields(fields = {}) {
  if (!fields || typeof fields !== 'object') return {}
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, trimHugeString(String(value ?? ''), 80_000)]))
}

function compactAnkiPayload(anki = {}) {
  if (!anki || typeof anki !== 'object') return undefined
  const { qfmt, afmt, css, fields, ...rest } = anki
  return {
    ...rest,
    ...(fields ? { fields: compactAnkiFields(fields) } : {}),
  }
}

function compactSourcePayload(source = {}) {
  if (!source || typeof source !== 'object') return source
  const { anki, ...rest } = source
  return rest
}

function mapCardForIndexedDb(card = {}) {
  const next = {
    ...card,
    id: String(card.id),
    updatedAt: card.updatedAt ?? card.createdAt ?? Date.now(),
  }

  // APKG 大包最占空间的是每张卡重复的模板 CSS / qfmt / afmt / model.css。
  // 模板源码走 templates store，卡片只留 templateId + 渲染缓存 + Anki 字段。
  if (next.templateId && next.cardCss) {
    next.templateCssId = next.templateId
    delete next.cardCss
  }
  if (next.anki) {
    const compact = compactAnkiPayload(next.anki)
    if (compact) next.anki = compact
    else delete next.anki
  }
  if (next.source) next.source = compactSourcePayload(next.source)
  if (typeof next.rawFront === 'string' && next.frontHtml && next.rawFront === next.frontHtml) delete next.rawFront
  if (typeof next.rawBack === 'string' && next.backHtml && next.rawBack === next.backHtml) delete next.rawBack
  if (typeof next.rawFront === 'string') next.rawFront = trimHugeString(next.rawFront, 80_000)
  if (typeof next.rawBack === 'string') next.rawBack = trimHugeString(next.rawBack, 80_000)
  return next
}

function makeQueuePayload(collection, item) {
  if (collection === 'cards') return mapCardForIndexedDb(item)
  if (collection === 'templates') {
    return {
      ...item,
      frontCode: trimHugeString(item?.frontCode ?? '', 160_000),
      backCode: trimHugeString(item?.backCode ?? '', 160_000),
      css: trimHugeString(item?.css ?? '', 160_000),
      js: '',
    }
  }
  return item
}

function makeSyncQueueItem(collection, item, action = 'upsert') {
  const key = item?.id ?? item?.date
  return {
    id: `${collection}:${key}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    collection,
    key: String(key),
    action,
    payload: makeQueuePayload(collection, item),
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export async function saveAppDataToIndexedDb(data, { enqueueSync = false } = {}) {
  const db = await openMikiDb()
  const normalized = normalizeAppData(data)
  persistLightLocalCache(normalized)
  if (!db) return normalized

  const tx = db.transaction(['meta', 'profile', 'activity', 'decks', 'cards', 'dailyLogs', 'reviewLogs', 'syncQueue'], 'readwrite')
  tx.objectStore('meta').put({ id: APP_DATA_KEY, updatedAt: Date.now(), version: 18 })
  tx.objectStore('profile').put({ id: 'main', ...normalized.profile, updatedAt: normalized.profile.updatedAt ?? Date.now() })
  tx.objectStore('activity').put({ id: 'main', ...normalized.activity, updatedAt: normalized.activity.updatedAt ?? Date.now() })
  putAll(tx.objectStore('decks'), normalized.decks.map((deck) => ({ ...deck, id: String(deck.id) })))
  putAll(tx.objectStore('cards'), normalized.cards.map(mapCardForIndexedDb))
  putAll(tx.objectStore('dailyLogs'), normalized.dailyLogs.map((log) => ({ ...log, id: log.id ?? `daily-${log.date}` })))
  putAll(tx.objectStore('reviewLogs'), normalized.reviewLogs.map((log) => ({ ...log, id: String(log.id) })))

  if (enqueueSync) {
    const queue = tx.objectStore('syncQueue')
    for (const deck of normalized.decks) queue.put(makeSyncQueueItem('decks', deck))
    for (const card of normalized.cards) queue.put(makeSyncQueueItem('cards', card))
    for (const log of normalized.dailyLogs) queue.put(makeSyncQueueItem('dailyLogs', { ...log, id: log.date ?? log.id }))
    for (const log of normalized.reviewLogs) queue.put(makeSyncQueueItem('reviewLogs', log))
    queue.put(makeSyncQueueItem('profile', { id: 'main', ...normalized.profile }))
    queue.put(makeSyncQueueItem('activity', { id: 'main', ...normalized.activity }))
  }

  await txDone(tx)
  return normalized
}

async function getAll(db, storeName) {
  if (!db) return []
  return requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll())
}

async function getOne(db, storeName, id) {
  if (!db) return null
  return requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(id))
}

export async function loadAppDataFromIndexedDb(fallbackData = {}) {
  const fallback = normalizeAppData(fallbackData)
  const db = await openMikiDb()
  if (!db) return readLightLocalCache() ?? fallback

  try {
    const [profile, activity, decks, cards, templates, dailyLogs, reviewLogs] = await Promise.all([
      getOne(db, 'profile', 'main'),
      getOne(db, 'activity', 'main'),
      getAll(db, 'decks'),
      getAll(db, 'cards'),
      getAll(db, 'templates'),
      getAll(db, 'dailyLogs'),
      getAll(db, 'reviewLogs'),
    ])

    if (!decks.length && !cards.length) return readLightLocalCache() ?? fallback

    const { id: profileId, ...profileValue } = profile ?? {}
    const { id: activityId, ...activityValue } = activity ?? {}
    const templateById = new Map(templates.map((template) => [template.id, template]))
    const rehydratedCards = cards.map((card) => {
      if (card.cardCss || !card.templateCssId) return card
      const template = templateById.get(card.templateCssId)
      return template?.css ? { ...card, cardCss: template.css } : card
    })

    return normalizeAppData({
      ...fallback,
      profile: profile ? profileValue : fallback.profile,
      activity: activity ? activityValue : fallback.activity,
      decks: decks.length ? decks : fallback.decks,
      cards: rehydratedCards.length ? rehydratedCards : fallback.cards,
      templates: templates.length ? templates : fallback.templates,
      dailyLogs: dailyLogs.length ? dailyLogs : fallback.dailyLogs,
      reviewLogs: reviewLogs.length ? reviewLogs : fallback.reviewLogs,
    })
  } catch (error) {
    console.warn('IndexedDB load failed, using light cache.', error)
    return readLightLocalCache() ?? fallback
  }
}

export async function upsertImportJob(job) {
  const db = await openMikiDb()
  if (!db || !job?.id) return job
  const tx = db.transaction('importJobs', 'readwrite')
  tx.objectStore('importJobs').put({ ...job, updatedAt: Date.now() })
  await txDone(tx)
  return job
}

export async function putCardsBatchToIndexedDb({ cards = [], decks = [], templates = [], importJob = null, enqueueSync = true } = {}) {
  const db = await openMikiDb()
  if (!db) return { cardCount: cards.length, deckCount: decks.length }

  const tx = db.transaction(['cards', 'decks', 'templates', 'importJobs', 'syncQueue'], 'readwrite')
  putAll(tx.objectStore('decks'), decks.map((deck) => ({ ...deck, id: String(deck.id), updatedAt: deck.updatedAt ?? deck.createdAt ?? Date.now() })))
  putAll(tx.objectStore('cards'), cards.map(mapCardForIndexedDb))
  putAll(tx.objectStore('templates'), templates.map((template) => ({ ...template, id: String(template.id), updatedAt: template.updatedAt ?? Date.now() })))
  if (importJob?.id) tx.objectStore('importJobs').put({ ...importJob, updatedAt: Date.now() })

  if (enqueueSync) {
    const queue = tx.objectStore('syncQueue')
    for (const deck of decks) queue.put(makeSyncQueueItem('decks', deck))
    for (const card of cards) queue.put(makeSyncQueueItem('cards', card))
    for (const template of templates) queue.put(makeSyncQueueItem('templates', template))
  }

  await txDone(tx)
  return { cardCount: cards.length, deckCount: decks.length, templateCount: templates.length }
}

export async function putCardsInChunksToIndexedDb(items = [], options = {}) {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  let written = 0
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize)
    await putCardsBatchToIndexedDb({ cards: batch, enqueueSync: options.enqueueSync ?? true })
    written += batch.length
    options.onProgress?.({ written, total: items.length })
    await idleYield()
  }
  return written
}

export async function readPendingSyncQueue(limit = 300) {
  const db = await openMikiDb()
  if (!db) return []
  const all = await getAll(db, 'syncQueue')
  return all.filter((item) => item.status === 'pending').sort((a, b) => a.createdAt - b.createdAt).slice(0, limit)
}

export async function markSyncQueueItemsDone(ids = []) {
  const db = await openMikiDb()
  if (!db || ids.length === 0) return
  const tx = db.transaction('syncQueue', 'readwrite')
  const store = tx.objectStore('syncQueue')
  for (const id of ids) store.delete(id)
  await txDone(tx)
}

export async function markSyncQueueItemsFailed(items = [], errorMessage = '') {
  const db = await openMikiDb()
  if (!db || items.length === 0) return
  const tx = db.transaction('syncQueue', 'readwrite')
  const store = tx.objectStore('syncQueue')
  for (const item of items) {
    store.put({
      ...item,
      attempts: Number(item.attempts ?? 0) + 1,
      lastError: errorMessage,
      updatedAt: Date.now(),
      status: 'pending',
    })
  }
  await txDone(tx)
}

export async function clearMikiIndexedDb() {
  if (!canUseIndexedDb()) return
  const db = await openMikiDb()
  if (db) db.close()
  dbPromise = null
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('IndexedDB delete failed'))
    request.onblocked = () => resolve()
  })
}
