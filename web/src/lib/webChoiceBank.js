import {
  WEB_CHOICE_BANK_CARDS_URL,
  WEB_CHOICE_BANK_MEDIA_BASE_URL,
} from '../config/webChoiceBankConfig'
import { auth, db } from './firebase.js'

let cachedCards = null

export async function loadWebChoiceCards(cardsUrl = WEB_CHOICE_BANK_CARDS_URL) {
  if (cachedCards) return cachedCards
  const res = await fetch(cardsUrl, { cache: 'force-cache' })
  if (!res.ok) {
    throw new Error(`cards.json 加载失败：${res.status}`)
  }
  const raw = await res.json()
  cachedCards = Array.isArray(raw) ? raw.map(normalizeWebChoiceCard) : []
  return cachedCards
}

export function normalizeWebChoiceCard(card) {
  const deckPath = String(card.deck || '未分组')
  const deckParts = deckPath.split('::').map((x) => x.trim()).filter(Boolean)
  const answerLetters = Array.isArray(card.answerLetters)
    ? card.answerLetters.map((x) => String(x).trim().toUpperCase()).filter(Boolean)
    : String(card.answerLetters || '')
        .split(/[,，、\s]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean)
  const subject = card.subject || '未标注科目'
  const book = card.book || '未标注章节'
  const pathKeys = deckParts.map((_, index) => makeScopeKey(deckParts.slice(0, index + 1)))

  return {
    ...card,
    id: String(card.uid || card.noteId || `${deckPath}-${card.number}-${card.question}`),
    noteId: card.noteId,
    uid: card.uid,
    number: card.number || '',
    deckPath,
    deckParts,
    deckRoot: deckParts[0] || deckPath,
    deckLeaf: deckParts[deckParts.length - 1] || deckPath,
    subject,
    book,
    volume: card.volume || '',
    question: card.question || '',
    options: Array.isArray(card.options) ? card.options : [],
    answerLetters,
    type: answerLetters.length > 1 ? '多选' : '单选',
    analysis: card.analysis || '',
    tags: Array.isArray(card.tags) ? card.tags : [],
    scopeKeys: ['all', ...pathKeys, `subject:${subject}`, `book:${book}`],
  }
}

export function makeScopeKey(parts = []) {
  return Array.isArray(parts) && parts.length ? parts.join('::') : 'all'
}

export function buildWebChoiceOutline(cards = []) {
  const root = makeOutlineNode({ key: 'all', label: '全部题目', depth: 0 })
  const nodeMap = new Map([[root.key, root]])

  for (const card of cards) {
    root.count += 1
    root.cardIds.push(card.id)
    const parts = Array.isArray(card.deckParts) && card.deckParts.length ? card.deckParts : ['未分组']
    let parent = root
    for (let index = 0; index < parts.length; index += 1) {
      const currentParts = parts.slice(0, index + 1)
      const key = makeScopeKey(currentParts)
      let node = nodeMap.get(key)
      if (!node) {
        node = makeOutlineNode({
          key,
          label: parts[index],
          pathLabel: currentParts.join(' / '),
          depth: index + 1,
        })
        nodeMap.set(key, node)
        parent.children.push(node)
      }
      node.count += 1
      node.cardIds.push(card.id)
      parent = node
    }
  }

  sortOutline(root)
  return root
}

function makeOutlineNode({ key, label, pathLabel, depth }) {
  return {
    key,
    label,
    pathLabel: pathLabel || label,
    depth,
    count: 0,
    cardIds: [],
    children: [],
  }
}

function sortOutline(node) {
  node.children.sort((a, b) => {
    const aNum = extractLeadingNumber(a.label)
    const bNum = extractLeadingNumber(b.label)
    if (aNum !== null && bNum !== null && aNum !== bNum) return aNum - bNum
    return a.label.localeCompare(b.label, 'zh-Hans-CN', { numeric: true })
  })
  node.children.forEach(sortOutline)
}

function extractLeadingNumber(value = '') {
  const match = String(value).match(/^(?:第)?\s*(\d{1,4})/)
  return match ? Number(match[1]) : null
}

export function buildWebChoiceFacets(cards) {
  const decks = new Map()
  const subjects = new Map()
  const books = new Map()

  for (const card of cards) {
    addCount(decks, card.deckRoot)
    addCount(subjects, card.subject)
    addCount(books, card.book)
  }

  return {
    decks: toFacetList(decks),
    subjects: toFacetList(subjects),
    books: toFacetList(books),
  }
}

function addCount(map, key) {
  const clean = key || '未分组'
  map.set(clean, (map.get(clean) || 0) + 1)
}

function toFacetList(map) {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

export function filterWebChoiceCards(cards, filters = {}) {
  const keyword = String(filters.keyword || '').trim().toLowerCase()
  return cards.filter((card) => {
    if (filters.scopeKey && filters.scopeKey !== 'all' && !card.scopeKeys?.includes(filters.scopeKey)) return false
    if (filters.deckRoot && card.deckRoot !== filters.deckRoot) return false
    if (filters.subject && card.subject !== filters.subject) return false
    if (filters.book && card.book !== filters.book) return false
    if (filters.type && card.type !== filters.type) return false

    if (keyword) {
      const haystack = [
        card.number,
        card.question,
        card.subject,
        card.book,
        card.deckPath,
        ...(card.options || []),
        ...(card.tags || []),
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  })
}

export function rewriteMediaUrls(html = '', mediaBaseUrl = WEB_CHOICE_BANK_MEDIA_BASE_URL) {
  if (!html) return ''
  const base = String(mediaBaseUrl || '').replace(/\/?$/, '/')
  return String(html).replace(
    /\b(src|href)=["']([^"']+)["']/gi,
    (full, attr, url) => {
      if (/^(https?:|data:|blob:|\/)/i.test(url)) return full
      const cleanUrl = url.replace(/^\.?\//, '').replace(/^media\//, '')
      return `${attr}="${base}${encodeURI(cleanUrl)}"`
    },
  )
}

export function sanitizeTrustedCardHtml(html = '', mediaBaseUrl = WEB_CHOICE_BANK_MEDIA_BASE_URL) {
  // 这批 cards.json 是站内预处理数据，仍做一层轻量防护：去掉脚本和事件属性。
  return rewriteMediaUrls(String(html || ''), mediaBaseUrl)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=["'][^"']*["']/gi, '')
    .replace(/\s(href|src)=["']\s*javascript:[^"']*["']/gi, '')
}

export function getStoredWebChoiceAttempt(cardId) {
  if (!cardId) return null
  try {
    return JSON.parse(localStorage.getItem(`miki:web-choice:${cardId}`) || 'null')
  } catch {
    return null
  }
}

export function saveStoredWebChoiceAttempt(cardId, attempt) {
  if (!cardId) return
  try {
    localStorage.setItem(`miki:web-choice:${cardId}`, JSON.stringify(attempt))
  } catch {
    // ignore private mode / quota errors
  }
}

function cleanFirestoreValue(value) {
  if (value === undefined) return undefined
  if (Array.isArray(value)) return value.map(cleanFirestoreValue).filter((item) => item !== undefined)
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((next, [key, item]) => {
      const clean = cleanFirestoreValue(item)
      if (clean !== undefined) next[key] = clean
      return next
    }, {})
  }
  return value
}

function webChoiceDocId(cardId = '') {
  return encodeURIComponent(String(cardId || 'unknown')).replace(/\./g, '%2E')
}

export function mergeWebChoiceAttempt(previous = {}, attempt = {}) {
  const now = Date.now()
  const answered = Boolean(attempt.revealed && !attempt.skipped)
  const correct = answered && attempt.correct === true
  const wrong = answered && attempt.correct === false
  const correctCount = Number(previous.correctCount || 0) + (correct ? 1 : 0)
  const wrongCount = Number(previous.wrongCount || 0) + (wrong ? 1 : 0)
  const seenCount = Number(previous.seenCount || 0) + (attempt.skipped ? 1 : 0)
  const attempts = Number(previous.attempts || 0) + (attempt.revealed ? 1 : 0)
  const mastery = correct
    ? (correctCount >= 2 ? 'remembered' : 'learning')
    : wrong
      ? 'weak'
      : (previous.mastery || (attempt.skipped ? 'seen' : 'new'))

  return {
    ...previous,
    ...attempt,
    selected: Array.isArray(attempt.selected) ? attempt.selected : [],
    revealed: Boolean(attempt.revealed),
    skipped: Boolean(attempt.skipped),
    correct: Boolean(attempt.correct),
    attempts,
    correctCount,
    wrongCount,
    seenCount,
    wrongBook: wrong ? true : Boolean(attempt.wrongBook ?? previous.wrongBook),
    mastery,
    updatedAt: now,
    answeredAt: attempt.answeredAt || previous.answeredAt || new Date(now).toISOString(),
  }
}

export async function loadCloudWebChoiceAttempts() {
  const user = auth?.currentUser
  if (!db || !user) return {}
  try {
    const fns = await import('firebase/firestore')
    const snap = await fns.getDocs(fns.collection(db, 'users', user.uid, 'webChoiceAttempts'))
    const attempts = {}
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {}
      const cardId = data.cardId || decodeURIComponent(docSnap.id)
      attempts[cardId] = data
      saveStoredWebChoiceAttempt(cardId, data)
    })
    return attempts
  } catch (error) {
    console.warn('ZH2000 云端做题记录读取失败，使用本机记录。', error)
    return {}
  }
}

export async function saveCloudWebChoiceAttempt(cardId, attempt) {
  const user = auth?.currentUser
  if (!db || !user || !cardId) return false
  try {
    const fns = await import('firebase/firestore')
    const payload = cleanFirestoreValue({
      ...attempt,
      cardId: String(cardId),
      ownerUid: user.uid,
      updatedAt: Date.now(),
    })
    await fns.setDoc(fns.doc(db, 'users', user.uid, 'webChoiceAttempts', webChoiceDocId(cardId)), payload, { merge: true })
    return true
  } catch (error) {
    console.warn('ZH2000 云端做题记录保存失败，已保留本机记录。', error)
    return false
  }
}
