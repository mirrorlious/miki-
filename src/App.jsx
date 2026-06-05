import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import DOMPurify from 'dompurify'
import {
  AlignLeft,
  BookOpen,
  Brain,
  Bold,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Flag,
  FolderOpen,
  Gift,
  Image,
  Italic,
  LayoutDashboard,
  Layers3,
  List,
  ListOrdered,
  LogIn,
  LogOut,
  GitBranch,
  Maximize2,
  MessageSquare,
  MoreVertical,
  PencilLine,
  Plus,
  Settings,
  Star,
  Strikethrough,
  Target,
  Trash2,
  Underline,
  Upload,
  User,
  Video,
  Volume2,
  Wand2,
  X,
} from 'lucide-react'
import { parseApkgFile } from './apkgImport'
import { parseBulkCards, parseMarkdownCards } from './cardImport'
import { loadData, scheduleReview, stats, STORAGE_KEY, todayKey } from './data'
import { useCloudSync } from './useCloudSync'

const DECK_COLOR_OPTIONS = [
  { value: 'sun', label: '暖黄', cardClass: 'bg-yellow-50/80 border-yellow-100/50', pillClass: 'bg-yellow-100 text-yellow-700' },
  { value: 'sea', label: '浅蓝', cardClass: 'bg-blue-50/80 border-blue-100/50', pillClass: 'bg-blue-100 text-blue-700' },
  { value: 'rose', label: '浅粉', cardClass: 'bg-rose-50/80 border-rose-100/50', pillClass: 'bg-rose-100 text-rose-700' },
  { value: 'mint', label: '薄荷', cardClass: 'bg-emerald-50/80 border-emerald-100/50', pillClass: 'bg-emerald-100 text-emerald-700' },
]

const DEFAULT_DECK_SECTIONS = ['法理', '宪法', '民法', '刑法', '法制史', '政治', '英语', '规律专题']
const UNGROUPED_SECTION = '未分组'
const PROFESSIONAL_SECTIONS = ['法理', '宪法', '民法', '刑法', '法制史']
const ANNOTATION_TYPES = ['理解', '易错', '口诀', '法条', '案例', '对比']
const ACTIVITY_TICK_SECONDS = 10
const ACTIVITY_IDLE_TIMEOUT_MS = 5 * 60 * 1000
const CHAPTER_MILESTONE_SECONDS = 10 * 60
const BROWSE_CARD_RENDER_LIMIT = 300
const STUDY_GRADE_OPTIONS = [
  {
    grade: 0,
    label: 'Again',
    title: '重来',
    detail: '仍然不稳',
    result: '今天再巩固',
    className: 'bg-red-50 text-red-700 hover:bg-red-100 border-red-100',
    badgeClass: 'bg-red-100 text-red-700',
  },
  {
    grade: 1,
    label: 'Hard',
    title: '困难',
    detail: '有点卡住',
    result: '短间隔复习',
    className: 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-100',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
  {
    grade: 2,
    label: 'Good',
    title: '记住',
    detail: '基本熟了',
    result: '按计划延后',
    className: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    grade: 3,
    label: 'Easy',
    title: '轻松',
    detail: '很稳',
    result: '更久后再见',
    className: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
]
const PIXEL_ITEM_BADGES = {
  card: {
    palette: { d: '#244938', g: '#34c759', l: '#9ff2b1', y: '#f9d96b', w: '#fff7d6' },
    pixels: ['...........', '..ddddddd..', '.dgggggggd.', '.dglgglggd.', '.dgggggggd.', '.dggdddggd.', '.dgggggggd.', '.dglgglggd.', '.dgggggggd.', '..ddddddd..', '...........'],
  },
  calendar: {
    palette: { d: '#23384f', s: '#63b3ed', l: '#d8f3ff', r: '#ff6b6b', w: '#ffffff', y: '#fde047' },
    pixels: ['...........', '...r...r...', '..ddddddd..', '.dsssssssd.', '.dslssslsd.', '.dsssssssd.', '.dsllyllsd.', '.dsssssssd.', '.dsssssssd.', '..ddddddd..', '...........'],
  },
  review: {
    palette: { d: '#4a3424', r: '#ef4444', y: '#fde68a', b: '#38bdf8', w: '#fff7d6' },
    pixels: ['.....d.....', '...ddddd...', '..dwwwwwd..', '.dwwrwwwd..', '.dwwrrwwd..', 'dwwwwywwwd.', '.dwwbbwwd..', '.dwwwbwwd..', '..dwwwwwd..', '...ddddd...', '.....d.....'],
  },
  note: {
    palette: { d: '#4b2f5f', p: '#c084fc', l: '#f3e8ff', y: '#facc15', w: '#ffffff' },
    pixels: ['...........', '..dd...dd..', '.dppdddppd.', '.dpppppppd.', '.dplllpppd.', '.dpppppppd.', '.dplllpppd.', '.dpppppppd.', '.dppdddppd.', '..dd...dd..', '...........'],
  },
  link: {
    palette: { d: '#164e63', c: '#22d3ee', l: '#a5f3fc', w: '#ecfeff' },
    pixels: ['...........', '..dddd.....', '.dccccd....', 'dcc...ccd..', 'dcc...ccd..', '.dccccd....', '...dddd....', '....dccccd.', '..dcc...ccd', '..dcc...ccd', '....dddd...'],
  },
  folder: {
    palette: { d: '#5b3718', b: '#a16207', y: '#fbbf24', l: '#fde68a', k: '#3f2a16' },
    pixels: ['...........', '...ddddd...', '..dyyyyyd..', '.dyyyyyyyd.', '.dllllllld.', '.dbbbbbbbd.', '.dbbbybbbd.', '.dbbbybbbd.', '.dbbbbbbbd.', '..ddddddd..', '...kkkkk...'],
  },
  flame: {
    palette: { d: '#4b1d1d', r: '#ef4444', o: '#f97316', y: '#fde047', b: '#7c2d12' },
    pixels: ['.....r.....', '....ror....', '...royor...', '...royyo...', '..royyyor..', '.droyyyord.', '.droyoyord.', '..dorrodd..', '...dbbbd...', '...dbbbd...', '....ddd....'],
  },
  focus: {
    palette: { d: '#213547', b: '#3b82f6', c: '#93c5fd', w: '#f8fafc', y: '#facc15' },
    pixels: ['..d.....d..', '....ddd....', '...dbbbd...', '..dbbbbbd..', '..dbcbcbd..', '.dbbbbbbbd.', '.dbbbbbbbd.', '..ddddddd..', '..dyyyyd...', '....dyd....', '...........'],
  },
  timer: {
    palette: { d: '#2f2a3f', p: '#a78bfa', l: '#ddd6fe', w: '#ffffff', g: '#34c759' },
    pixels: ['...........', '..ddddddd..', '...dwwwd...', '...dwlwd...', '....dld....', '.....d.....', '....dgd....', '...dglgd...', '...dgggd...', '..ddddddd..', '...........'],
  },
}
const ACHIEVEMENTS = [
  {
    id: 'first-card',
    title: '知识绿砖',
    description: '铸出第 1 块知识砖',
    points: 10,
    icon: 'card',
    color: '#34c759',
    isEarned: (data) => data.cards.length >= 1,
    progress: (data) => `${Math.min(data.cards.length, 1)}/1`,
  },
  {
    id: 'daily-review',
    title: '日历石碑',
    description: '在今天立下一块复盘石碑',
    points: 10,
    icon: 'calendar',
    color: '#007aff',
    isEarned: (data) => Boolean(getDailyLog(data, todayKey())?.content?.trim()),
    progress: (data) => (getDailyLog(data, todayKey())?.content?.trim() ? '1/1' : '0/1'),
  },
  {
    id: 'first-review',
    title: '复习罗盘',
    description: '点亮第 1 次复习评分',
    points: 15,
    icon: 'review',
    color: '#ff9f0a',
    isEarned: (data) => getReviewLogs(data).length >= 1,
    progress: (data) => `${Math.min(getReviewLogs(data).length, 1)}/1`,
  },
  {
    id: 'first-note',
    title: '批注卷轴',
    description: '写下第 1 条理解批注',
    points: 10,
    icon: 'note',
    color: '#af52de',
    isEarned: (data) => getCardAnnotationCount(data) >= 1,
    progress: (data) => `${Math.min(getCardAnnotationCount(data), 1)}/1`,
  },
  {
    id: 'first-link',
    title: '线索锁链',
    description: '把 2 张相关卡片扣成一环',
    points: 15,
    icon: 'link',
    color: '#5ac8fa',
    isEarned: (data) => getLinkedPairCount(data) >= 1,
    progress: (data) => `${Math.min(getLinkedPairCount(data), 1)}/1`,
  },
  {
    id: 'first-folder',
    title: '归档宝箱',
    description: '把 1 个卡组放进板块宝箱',
    points: 10,
    icon: 'folder',
    color: '#5856d6',
    isEarned: (data) => data.decks.some((deck) => getDeckSection(deck) !== UNGROUPED_SECTION),
    progress: (data) => `${Math.min(data.decks.filter((deck) => getDeckSection(deck) !== UNGROUPED_SECTION).length, 1)}/1`,
  },
  {
    id: 'three-days',
    title: '三日营火',
    description: '连续点起 3 天学习火光',
    points: 20,
    icon: 'flame',
    color: '#ff3b30',
    isEarned: (data) => getActiveStudyDays(data).length >= 3,
    progress: (data) => `${Math.min(getActiveStudyDays(data).length, 3)}/3`,
  },
  {
    id: 'first-focus',
    title: '专注初响',
    description: '开启第 1 次学习专注',
    points: 10,
    icon: 'focus',
    color: '#007aff',
    isEarned: (data) => getActivity(data).focusSessions >= 1,
    progress: (data) => `${Math.min(getActivity(data).focusSessions, 1)}/1`,
  },
  {
    id: 'chapter-clock',
    title: '章节沙漏',
    description: '任一章节累计学习 10 分钟',
    points: 20,
    icon: 'timer',
    color: '#af52de',
    isEarned: (data) => getTopChapterTimeRows(data, 1).some((row) => row.seconds >= CHAPTER_MILESTONE_SECONDS),
    progress: (data) => `${Math.min(Math.floor((getTopChapterTimeRows(data, 1)[0]?.seconds ?? 0) / 60), 10)}/10 分钟`,
  },
]

const REWARD_OPTIONS = [
  {
    id: 'focus-pass',
    title: '专注通行证',
    description: '给今天的学习页解锁一枚专注徽章。',
    cost: 20,
    badge: 'Focus',
  },
  {
    id: 'profile-frame',
    title: '学习贴纸',
    description: '在个人页标记一枚已兑换学习贴纸。',
    cost: 40,
    badge: 'Sticker',
  },
  {
    id: 'vip-week',
    title: '会员体验券',
    description: '预留给后续高级功能的 7 天体验资格。',
    cost: 80,
    badge: 'VIP',
  },
]

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })
}

async function compressImageFile(file, { maxSize = 900, quality = 0.78 } = {}) {
  if (!file?.type?.startsWith('image/')) throw new Error('请选择图片文件。')
  const dataUrl = await readFileAsDataUrl(file)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return dataUrl

  const image = await loadImageFromDataUrl(dataUrl)
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

function getDeckSection(deck) {
  return deck?.section?.trim() || UNGROUPED_SECTION
}

function getDeckChapter(deck) {
  return deck?.chapter?.trim() || ''
}

function getDeckPath(deck) {
  const section = getDeckSection(deck)
  const chapter = getDeckChapter(deck)
  return chapter ? `${section} / ${chapter}` : section
}

function getDeckChapterKey(deck) {
  return `${getDeckSection(deck)}|||${getDeckChapter(deck)}`
}

function getDeckChapterLabel(deck) {
  const chapter = getDeckChapter(deck)
  return chapter ? getDeckPath(deck) : `${getDeckSection(deck)} / 未细分`
}

function getDeckOptionLabel(deck) {
  return `${getDeckPath(deck)} / ${deck.name}`
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
      description: `从 Anki 原卡组 ${sourcePath[0]} 导入。`,
    }
  }

  const name = sourcePath[sourcePath.length - 1]
  const section = sourcePath[0]
  const chapter = sourcePath.length > 2 ? sourcePath.slice(1, -1).join(' / ') : ''

  return {
    section,
    chapter,
    name,
    description: `从 Anki 原卡组 ${sourcePath.join(' / ')} 导入。`,
  }
}

function getDeckIdentityKey(deck) {
  return [deck?.section ?? '', deck?.chapter ?? '', deck?.name ?? '']
    .map((part) => normalizePathPart(part).toLowerCase())
    .join('|||')
}

function getStableDeckColor(value = '') {
  const colors = DECK_COLOR_OPTIONS.map((option) => option.value)
  const hash = Array.from(String(value)).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return colors[hash % colors.length] ?? 'sun'
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

function DeckSelectOptions({ decks }) {
  return groupDecksBySection(decks).map((group) => (
    <optgroup key={group.section} label={group.section}>
      {group.decks.map((deck) => (
        <option key={deck.id} value={deck.id}>{getDeckOptionLabel(deck)}</option>
      ))}
    </optgroup>
  ))
}

function getDeckCards(data, deckId) {
  return data.cards.filter((card) => card.deckId === deckId)
}

function getCardAnnotations(card) {
  return Array.isArray(card?.annotations) ? card.annotations : []
}

function getCardLinks(card) {
  return Array.isArray(card?.links) ? card.links : []
}

function getCardSideHtml(card, side) {
  return side === 'front' ? card?.frontHtml : card?.backHtml
}

function getCardSideText(card, side) {
  return side === 'front' ? card?.front : card?.back
}

function looksLikeHtml(value = '') {
  return /<\/?[a-z][\s\S]*>/i.test(String(value))
}

function htmlToPlainText(html = '') {
  if (typeof document === 'undefined') return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const element = document.createElement('div')
  element.innerHTML = String(html)
  return (element.textContent || element.innerText || '').replace(/\s+/g, ' ').trim()
}

function sanitizeCssScopeId(value = '') {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'card'
}

function scopeAnkiCss(css = '', scopeSelector = '.anki-card-content') {
  const cleanCss = String(css)
    .replace(/<\/?style[^>]*>/gi, '')
    .replace(/@import[^;]+;/gi, '')
    .trim()

  if (!cleanCss) return ''

  return cleanCss.replace(/(^|})\s*([^@{}][^{}]*)\{/g, (match, boundary, selectorText) => {
    const scopedSelectors = selectorText
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => {
        if (/^(?:from|to|\d+(?:\.\d+)?%)$/i.test(selector)) return selector
        if (/^(?:html|body|\.card|#qa|#content)$/i.test(selector)) return scopeSelector
        if (selector.startsWith(scopeSelector)) return selector
        return `${scopeSelector} ${selector}`
      })
      .join(', ')

    return scopedSelectors ? `${boundary} ${scopedSelectors} {` : match
  })
}

function sanitizeCardHtml(html) {
  return DOMPurify.sanitize(String(html ?? ''), {
    ADD_TAGS: ['audio', 'video', 'source'],
    ADD_ATTR: ['alt', 'class', 'colspan', 'controls', 'height', 'href', 'rel', 'rowspan', 'src', 'style', 'target', 'title', 'width'],
  })
}

function isScriptCallText(value = '') {
  return /^(?:decrypt|render|show|load|init)[a-zA-Z0-9_$]*\(\)$/i.test(String(value ?? '').replace(/\s+/g, ' ').trim())
}

function CardContent({ card, side, className = '', fallbackClassName = '', placeholder = '' }) {
  const explicitHtml = getCardSideHtml(card, side)
  const text = getCardSideText(card, side) || placeholder
  const html = explicitHtml || (card?.template === 'html' && looksLikeHtml(text) ? text : '')
  const fallbackText = isScriptCallText(text)
    ? '这张 Anki 卡依赖脚本或加密模板，无法直接显示。请删除后用新版导入重新尝试。'
    : text

  if (html) {
    const safeHtml = sanitizeCardHtml(html)
    const hasRenderableHtml = safeHtml.trim()
      && (htmlToPlainText(safeHtml) || /<(?:img|audio|video|table|ul|ol|ruby|math|svg)\b/i.test(safeHtml))
    const scopeId = sanitizeCssScopeId(`${card?.id ?? 'preview'}-${side}`)
    const scopedCss = scopeAnkiCss(card?.cardCss, `[data-anki-card="${scopeId}"]`)

    if (hasRenderableHtml) {
      return (
        <>
          {scopedCss && <style>{scopedCss}</style>}
          <div
            data-anki-card={scopeId}
            className={`anki-card-content ${className}`}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </>
      )
    }
  }

  return <p className={fallbackClassName || className}>{fallbackText}</p>
}

function toLocalDateKey(value = new Date()) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateLabel(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function tokenizeForRelated(value) {
  const asciiTokens = String(value ?? '').toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
  const chineseTokens = String(value ?? '').match(/[\u4e00-\u9fa5]{2,}/g) ?? []
  const slicedChinese = chineseTokens.flatMap((token) => {
    const parts = []
    for (let index = 0; index < token.length - 1; index += 1) parts.push(token.slice(index, index + 2))
    return parts
  })
  const stopTokens = new Set(['decryptfront', 'decryptback', 'decrypt', 'front', 'back'])
  return new Set([...asciiTokens, ...slicedChinese].filter((token) => !stopTokens.has(token)))
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

function getAnnotationWall(data) {
  return data.cards.flatMap((card) => getCardAnnotations(card).map((annotation) => {
    const deck = data.decks.find((item) => item.id === card.deckId)
    return { ...annotation, card, deck }
  })).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
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

function getDailyLogs(data) {
  return Array.isArray(data?.dailyLogs) ? data.dailyLogs : []
}

function getReviewLogs(data) {
  return Array.isArray(data?.reviewLogs) ? data.reviewLogs : []
}

function getDailyLog(data, dateKey) {
  return getDailyLogs(data).find((log) => log.date === dateKey) ?? null
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

function getActiveStudyDays(data) {
  const days = new Set()
  for (const log of getDailyLogs(data)) {
    if (log.date) days.add(log.date)
  }
  for (const log of getReviewLogs(data)) {
    if (log.reviewedAt) days.add(toLocalDateKey(log.reviewedAt))
  }
  for (const card of data.cards) {
    if (card.createdAt) days.add(toLocalDateKey(card.createdAt))
  }
  return Array.from(days).sort()
}

function getActivity(data) {
  const activity = data?.activity ?? {}
  return {
    siteSeconds: Number(activity.siteSeconds) || 0,
    dailySiteSeconds: activity.dailySiteSeconds && typeof activity.dailySiteSeconds === 'object' ? activity.dailySiteSeconds : {},
    focusSessions: Number(activity.focusSessions) || 0,
    focusLog: Array.isArray(activity.focusLog) ? activity.focusLog : [],
    deckSeconds: activity.deckSeconds && typeof activity.deckSeconds === 'object' ? activity.deckSeconds : {},
  }
}

function getTodaySiteSeconds(data) {
  const activity = getActivity(data)
  return Number(activity.dailySiteSeconds[todayKey()]) || 0
}

function formatDuration(totalSeconds, compact = false) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const restSeconds = seconds % 60
  if (hours > 0) return compact ? `${hours}h ${minutes}m` : `${hours} 小时 ${minutes} 分钟`
  if (minutes > 0) return compact ? `${minutes}m ${restSeconds}s` : `${minutes} 分钟 ${restSeconds} 秒`
  return compact ? `${restSeconds}s` : `${restSeconds} 秒`
}

function formatCountdown(totalMs) {
  const seconds = Math.max(0, Math.floor(totalMs / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const restSeconds = seconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(restSeconds).padStart(2, '0')}`
}

function formatCountdownWithDays(totalMs) {
  const seconds = Math.max(0, Math.floor(totalMs / 1000))
  const days = Math.floor(seconds / 86400)
  const rest = seconds % 86400
  const clock = formatCountdown(rest * 1000)
  return days > 0 ? `${days}天 ${clock}` : clock
}

function getCountdownInfo(data, now) {
  const profile = getStoredProfile(data)
  if (profile.examDate) {
    const target = new Date(`${profile.examDate}T23:59:59`).getTime()
    if (target > now) {
      return {
        label: '考试倒计时',
        detail: profile.examDate,
        value: formatCountdownWithDays(target - now),
      }
    }
  }

  const currentDate = new Date(now)
  const endOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
  return {
    label: '今日倒计时',
    detail: '到今晚 24:00',
    value: formatCountdown(endOfDay.getTime() - now),
  }
}

function getMonthCalendarDays(now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1)
  const offset = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return {
      key: toLocalDateKey(day),
      date: day,
      inMonth: day.getMonth() === month,
      isToday: day.toDateString() === now.toDateString(),
    }
  })
}

function getCalendarActivityMap(data) {
  const map = new Map()
  const ensure = (key) => {
    const current = map.get(key) ?? { cards: 0, reviews: 0, logs: 0 }
    map.set(key, current)
    return current
  }

  for (const card of data.cards) {
    if (!card.createdAt) continue
    ensure(toLocalDateKey(card.createdAt)).cards += 1
  }
  for (const log of getReviewLogs(data)) {
    if (!log.reviewedAt) continue
    ensure(toLocalDateKey(log.reviewedAt)).reviews += 1
  }
  for (const log of getDailyLogs(data)) {
    if (!log.date || !log.content?.trim()) continue
    ensure(log.date).logs += 1
  }

  return map
}

function getDateStudyDetails(data, dateKey) {
  const cards = data.cards
    .filter((card) => card.createdAt && toLocalDateKey(card.createdAt) === dateKey)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  const reviews = getReviewLogs(data)
    .filter((log) => log.reviewedAt && toLocalDateKey(log.reviewedAt) === dateKey)
    .sort((a, b) => (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0))
  const dailyLog = getDailyLog(data, dateKey)
  return { cards, reviews, dailyLog }
}

function getTopChapterTimeRows(data, limit = 4) {
  const activity = getActivity(data)
  const rows = new Map()

  for (const [deckId, rawSeconds] of Object.entries(activity.deckSeconds)) {
    const deck = data.decks.find((item) => item.id === deckId)
    if (!deck) continue
    const raw = Math.max(0, Number(rawSeconds) || 0)
    const siteCap = activity.siteSeconds > 0 ? activity.siteSeconds : raw
    const seconds = Math.min(raw, siteCap, 12 * 60 * 60)
    const key = getDeckChapterKey(deck)
    const current = rows.get(key) ?? {
      key,
      label: getDeckChapterLabel(deck),
      seconds: 0,
      deckCount: 0,
    }
    current.seconds += seconds
    current.deckCount += 1
    rows.set(key, current)
  }

  return Array.from(rows.values())
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, limit)
}

function getTodayFocusCount(data) {
  const today = todayKey()
  return getActivity(data).focusLog.filter((item) => item.startedAt && toLocalDateKey(item.startedAt) === today).length
}

function getFocusSummary(data, mode, now = new Date()) {
  const activity = getActivity(data)
  const today = new Date(now)
  const start = new Date(today)

  if (mode === 'month') {
    start.setDate(1)
  } else {
    const day = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - day)
  }
  start.setHours(0, 0, 0, 0)

  const end = new Date(today)
  end.setHours(23, 59, 59, 999)

  const focusItems = activity.focusLog.filter((item) => {
    const startedAt = Number(item.startedAt)
    return startedAt >= start.getTime() && startedAt <= end.getTime()
  })
  const activeDays = new Set(focusItems.map((item) => toLocalDateKey(item.startedAt)))

  return {
    label: mode === 'month' ? '本月' : '本周',
    count: focusItems.length,
    days: activeDays.size,
    total: activity.focusSessions,
  }
}

function addActivitySeconds(current, seconds, activeDeckId = null) {
  const activity = getActivity(current)
  const today = todayKey()
  const nextDailySiteSeconds = {
    ...activity.dailySiteSeconds,
    [today]: (Number(activity.dailySiteSeconds[today]) || 0) + seconds,
  }
  const nextDeckSeconds = activeDeckId
    ? { ...activity.deckSeconds, [activeDeckId]: (Number(activity.deckSeconds[activeDeckId]) || 0) + seconds }
    : activity.deckSeconds

  return {
    ...current,
    activity: {
      ...activity,
      siteSeconds: activity.siteSeconds + seconds,
      dailySiteSeconds: nextDailySiteSeconds,
      deckSeconds: nextDeckSeconds,
      updatedAt: Date.now(),
    },
  }
}

function addFocusSession(current, deckId) {
  const activity = getActivity(current)
  return {
    ...current,
    activity: {
      ...activity,
      focusSessions: activity.focusSessions + 1,
      focusLog: [
        { id: `focus-${Date.now()}`, deckId, startedAt: Date.now() },
        ...activity.focusLog,
      ].slice(0, 200),
      updatedAt: Date.now(),
    },
  }
}

function formatStudyDate(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function makeDailyCardSourceKey(dateKey, card, index) {
  return `daily:${dateKey}:${index}:${String(card.front ?? '').trim().slice(0, 30)}`
}

function parseDailyReview(content) {
  const lines = String(content ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const cards = parseBulkCards(content)
  const buckets = [
    { key: 'mistakes', label: '易错', patterns: ['易错', '错题', '误区', '混淆', '注意'] },
    { key: 'questions', label: '疑问', patterns: ['疑问', '问题', '不懂', '为什么', '待问'] },
    { key: 'pending', label: '待整理', patterns: ['待整理', '整理', '归档', '整合', '专题'] },
    { key: 'highlights', label: '高亮', patterns: ['高亮', '重点', '标记', '背诵', '记住'] },
  ]

  const clues = buckets.map((bucket) => ({
    ...bucket,
    items: lines.filter((line) => bucket.patterns.some((pattern) => line.includes(pattern))),
  }))
  const subjectHits = DEFAULT_DECK_SECTIONS
    .map((section) => ({
      section,
      count: lines.filter((line) => line.includes(section)).length,
    }))
    .filter((item) => item.count > 0)

  return {
    lines,
    cards,
    clues,
    subjectHits,
    totalClues: clues.reduce((sum, clue) => sum + clue.items.length, 0),
  }
}

function getAchievementState(data) {
  const items = ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    earned: achievement.isEarned(data),
    progressText: achievement.progress(data),
  }))

  return {
    items,
    earnedItems: items.filter((achievement) => achievement.earned),
    totalPoints: items.filter((achievement) => achievement.earned).reduce((sum, achievement) => sum + achievement.points, 0),
    maxPoints: items.reduce((sum, achievement) => sum + achievement.points, 0),
  }
}

function getStoredProfile(data) {
  const profile = data?.profile && typeof data.profile === 'object' ? data.profile : {}
  return {
    name: profile.name ?? '',
    nickname: profile.nickname ?? profile.name ?? '',
    bio: profile.bio ?? '',
    examDate: profile.examDate ?? '',
    dailyGoalMinutes: Number(profile.dailyGoalMinutes) || 45,
    redeemedRewards: Array.isArray(profile.redeemedRewards) ? profile.redeemedRewards : [],
  }
}

function getProfile(data, cloud) {
  const stored = getStoredProfile(data)
  const fallbackName = cloud?.user?.displayName || cloud?.accountLabel || '学习者'
  const nickname = stored.nickname.trim() || stored.name.trim() || fallbackName
  return {
    ...stored,
    nickname,
  }
}

function getRewardState(data) {
  const achievementState = getAchievementState(data)
  const profile = getStoredProfile(data)
  const redeemedRewards = profile.redeemedRewards
  const spentPoints = redeemedRewards.reduce((sum, item) => {
    const reward = REWARD_OPTIONS.find((option) => option.id === item.rewardId)
    return sum + (reward?.cost ?? 0)
  }, 0)

  return {
    ...achievementState,
    spentPoints,
    availablePoints: Math.max(0, achievementState.totalPoints - spentPoints),
    redeemedRewards,
  }
}

function formatSyncTime(timestamp) {
  if (!timestamp) return '尚未同步'
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function formatCompactSyncTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ToolbarButton({ to, icon: Icon, label, disabled = false }) {
  const baseClass = 'h-9 px-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors'

  if (disabled) {
    return (
      <span className={`${baseClass} text-gray-300 cursor-not-allowed`}>
        <Icon size={16} />
        {label}
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${baseClass} ${isActive ? 'bg-white text-[#007aff] shadow-sm' : 'text-gray-500 hover:bg-white/70 hover:text-gray-900'}`}
    >
      <Icon size={16} />
      {label}
    </NavLink>
  )
}

function DeckDialog({ open, mode, initialValue, existingNames, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', description: '', color: 'sun', section: '', chapter: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm({
      name: initialValue?.name ?? '',
      description: initialValue?.description ?? '',
      color: initialValue?.color ?? 'sun',
      section: initialValue?.section ?? '',
      chapter: initialValue?.chapter ?? '',
    })
    setError('')
  }, [open, initialValue])

  if (!open) return null

  function handleSubmit(event) {
    event.preventDefault()
    const name = form.name.trim()
    const description = form.description.trim()
    const section = form.section.trim()
    const chapter = form.chapter.trim()
    const duplicated = existingNames.some((item) => item.toLowerCase() === name.toLowerCase())

    if (!name) {
      setError('卡组名称不能为空。')
      return
    }
    if (name.length > 24) {
      setError('卡组名称不要超过 24 个字。')
      return
    }
    if (description.length > 120) {
      setError('卡组说明不要超过 120 个字。')
      return
    }
    if (section.length > 18) {
      setError('板块名称不要超过 18 个字。')
      return
    }
    if (chapter.length > 40) {
      setError('章节/专题不要超过 40 个字。')
      return
    }
    if (duplicated) {
      setError('已经有同名卡组了，换一个名字。')
      return
    }

    onSubmit({ name, description: description || '先往里面放最核心的一组卡片。', color: form.color, section, chapter })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-white rounded-[28px] border border-gray-100 shadow-2xl p-7">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[11px] text-gray-400 font-bold tracking-[0.2em] uppercase mb-2">{mode === 'create' ? 'Create Deck' : 'Edit Deck'}</p>
            <h3 className="text-2xl font-black text-gray-900">{mode === 'create' ? '新建卡组' : '编辑卡组'}</h3>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
            <label className="block">
              <span className="block text-sm font-bold text-gray-800 mb-2">板块</span>
              <input
                value={form.section}
                list="deck-section-suggestions"
                onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))}
                placeholder="可先留空"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
              />
              <datalist id="deck-section-suggestions">
                {DEFAULT_DECK_SECTIONS.map((section) => <option key={section} value={section} />)}
              </datalist>
            </label>

            <label className="block">
              <span className="block text-sm font-bold text-gray-800 mb-2">章节/专题</span>
              <input
                value={form.chapter}
                onChange={(event) => setForm((current) => ({ ...current, chapter: event.target.value }))}
                placeholder="可后续整理，例如：刑法总则、规律题"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-sm font-bold text-gray-800 mb-2">卡组名称</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="例如：考研英语高频词"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-bold text-gray-800 mb-2">卡组说明</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              placeholder="写一句简短说明，方便你以后快速判断用途。"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:border-blue-400 focus:bg-white resize-none"
            />
          </label>

          <div>
            <span className="block text-sm font-bold text-gray-800 mb-2">卡组颜色</span>
            <div className="grid grid-cols-4 gap-3">
              {DECK_COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, color: option.value }))}
                  className={`rounded-2xl border px-3 py-4 text-xs font-bold transition-all ${form.color === option.value ? 'border-gray-900 bg-gray-900 text-white shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm font-bold text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">
              取消
            </button>
            <button type="submit" className="px-6 py-2.5 rounded-full bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 shadow-sm">
              {mode === 'create' ? '创建卡组' : '保存修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AuthDialog({ open, cloud, onClose }) {
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ email: '', password: '' })

  useEffect(() => {
    if (!open) return
    setMode('signin')
    setForm({ email: '', password: '' })
  }, [open])

  useEffect(() => {
    if (open && cloud.user) onClose()
  }, [open, cloud.user, onClose])

  if (!open) return null

  const title = mode === 'signup' ? '创建账号' : mode === 'reset' ? '找回密码' : '登录账号'
  const subtitle = mode === 'signup' ? '邮箱账号会自动绑定当前云同步。' : mode === 'reset' ? '输入邮箱后会收到重置链接。' : '登录后会切换到你的云端数据。'
  const primaryLabel = mode === 'signup' ? '注册并登录' : mode === 'reset' ? '发送重置邮件' : '登录'

  async function handleSubmit(event) {
    event.preventDefault()
    const payload = { email: form.email, password: form.password }
    const ok = mode === 'signup'
      ? await cloud.onSignUpWithEmail(payload)
      : mode === 'reset'
        ? await cloud.onResetPassword(payload)
        : await cloud.onSignInWithEmail(payload)

    if (ok && mode === 'reset') {
      setMode('signin')
      setForm((current) => ({ ...current, password: '' }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-white bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-gray-300">Account</p>
            <h2 className="text-2xl font-black text-gray-950">{title}</h2>
            <p className="mt-1 text-sm font-bold text-gray-400">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200" title="关闭">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-gray-500">邮箱</span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
              placeholder="you@example.com"
            />
          </label>

          {mode !== 'reset' && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-gray-500">密码</span>
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
                placeholder="至少 6 位"
              />
            </label>
          )}

          {cloud.authError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{cloud.authError}</p>}

          <button type="submit" disabled={cloud.authBusy} className="mt-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-black text-white shadow-sm hover:bg-gray-800 disabled:bg-gray-300">
            <LogIn size={15} />
            {cloud.authBusy ? '处理中...' : primaryLabel}
          </button>
        </form>

        {mode !== 'reset' && (
          <>
            <div className="my-4 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-gray-300">
              <span className="h-px flex-1 bg-gray-100" />
              or
              <span className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button type="button" onClick={cloud.onSignInWithGoogle} disabled={cloud.authBusy} className="flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300">
                使用 Google 登录
              </button>
              <button type="button" onClick={cloud.onSignInWithGithub} disabled={cloud.authBusy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300">
                <GitBranch size={15} />
                使用 GitHub 登录
              </button>
            </div>
          </>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs font-black">
          {mode === 'signin' ? (
            <>
              <button type="button" onClick={() => setMode('signup')} className="text-blue-600 hover:text-blue-700">创建新账号</button>
              <button type="button" onClick={() => setMode('reset')} className="text-gray-400 hover:text-gray-700">忘记密码</button>
            </>
          ) : (
            <button type="button" onClick={() => setMode('signin')} className="text-blue-600 hover:text-blue-700">返回登录</button>
          )}
        </div>
      </div>
    </div>
  )
}

function Shell({ children, data, cloud, studyDeckId }) {
  const summary = stats(data)
  const firstDeckId = studyDeckId ?? data.decks[0]?.id
  const latestSyncAt = cloud.lastWriteAt ?? cloud.lastReadAt ?? cloud.lastSyncedAt
  const syncLabel = !cloud.enabled
    ? '本地'
    : !cloud.user
      ? '待登录'
      : cloud.syncState === 'error'
        ? '失败'
        : cloud.syncState === 'connecting'
          ? '连接'
          : '同步'
  const syncTimeLabel = cloud.enabled && cloud.user
    ? (latestSyncAt ? formatCompactSyncTime(latestSyncAt) : '--:--')
    : ''
  const syncTitle = [
    cloud.message,
    cloud.lastWriteAt ? `上次写入：${formatSyncTime(cloud.lastWriteAt)}` : '',
    cloud.lastReadAt ? `上次读取：${formatSyncTime(cloud.lastReadAt)}` : '',
    cloud.lastErrorMessage ? `错误：${cloud.lastErrorMessage}` : '',
  ].filter(Boolean).join('\n')
  const syncIconClass = cloud.syncState === 'error'
    ? 'text-red-500'
    : cloud.user
      ? 'text-[#34c759]'
      : 'text-gray-300'
  const syncPillClass = cloud.syncState === 'error'
    ? 'bg-red-50 text-red-600 hover:bg-red-50'
    : cloud.user
      ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
      : 'bg-gray-50 text-gray-400'
  const profile = getProfile(data, cloud)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)

  const navItems = [
    { to: '/decks', icon: LayoutDashboard, label: '卡组' },
    { to: '/browse', icon: AlignLeft, label: '浏览', disabled: !firstDeckId },
    { to: '/organize', icon: FolderOpen, label: '整理', disabled: !firstDeckId },
    { to: '/app', icon: Target, label: '统计' },
    { to: '/profile', icon: User, label: '个人' },
  ]

  function openAuthDialog() {
    cloud.onClearAuthError?.()
    setAuthDialogOpen(true)
  }

  const syncBusy = cloud.syncState === 'syncing' || cloud.syncState === 'connecting'

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-950 font-sans">
      <AuthDialog open={authDialogOpen} cloud={cloud} onClose={() => setAuthDialogOpen(false)} />
      <header className="sticky top-0 z-40 border-b border-white/70 bg-[#f5f5f7]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/decks" className="flex items-center gap-3 text-sm font-black text-gray-950">
            <span className="brand-logo" aria-label="mik!">
              <span className="brand-letter brand-letter-m">m</span>
              <span className="brand-letter brand-letter-i">i</span>
              <span className="brand-letter brand-letter-k">k</span>
              <span className="brand-letter brand-letter-bang">!</span>
            </span>
            <span>
              <span className="brand-word" aria-label="mik!">
                <span className="brand-letter brand-letter-m">m</span>
                <span className="brand-letter brand-letter-i">i</span>
                <span className="brand-letter brand-letter-k">k</span>
                <span className="brand-letter brand-letter-bang">!</span>
              </span>
              <span className="hidden sm:block text-[11px] font-semibold text-gray-400 leading-tight">Spaced repetition desk</span>
            </span>
          </Link>

          <nav className="hidden h-11 rounded-xl bg-gray-200/70 p-1 lg:flex items-center gap-1">
            {navItems.map((item) => (
              <ToolbarButton key={item.to} to={item.disabled ? '/decks' : item.to} icon={item.icon} label={item.label} disabled={item.disabled} />
            ))}
          </nav>

          <div className="flex min-w-0 items-center justify-end gap-2 text-xs text-gray-500">
            <div className="flex min-w-0 items-center gap-1 rounded-2xl bg-white/85 px-1.5 py-1 shadow-sm ring-1 ring-white/80">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2 text-[11px] font-black text-gray-700" title={`今日待复习 ${summary.dueToday} 张`}>
                <Layers3 size={13} className="text-gray-400" />
                <span className="hidden sm:inline">待复习</span>
                <span>{summary.dueToday}</span>
              </span>
            {cloud.enabled && cloud.user ? (
              <button
                type="button"
                onClick={cloud.onManualSync}
                disabled={syncBusy}
                title={syncTitle}
                className={`grid h-8 w-[94px] grid-cols-[14px_1fr_auto] items-center gap-1.5 rounded-xl px-2 text-[11px] font-black transition-colors disabled:cursor-wait disabled:opacity-70 ${syncPillClass}`}
              >
                <Cloud size={14} className={syncIconClass} />
                <span className="whitespace-nowrap">{syncLabel}</span>
                <span className="font-mono text-[10px] font-black tabular-nums text-gray-400">{syncTimeLabel}</span>
              </button>
            ) : (
              <span className={`grid h-8 w-[78px] grid-cols-[14px_1fr] items-center gap-1.5 rounded-xl px-2 text-[11px] font-black ${syncPillClass}`} title={syncTitle || cloud.message}>
                {cloud.enabled ? <Cloud size={14} className={syncIconClass} /> : <CloudOff size={14} className={syncIconClass} />}
                <span className="whitespace-nowrap">{syncLabel}</span>
              </span>
            )}
            <Link to="/profile" className="flex h-8 max-w-[104px] min-w-[48px] items-center rounded-xl px-2 transition-colors hover:bg-gray-50" title={profile.nickname}>
              <span className="block truncate text-[11px] font-black text-gray-800">{profile.nickname}</span>
            </Link>
            {cloud.enabled && !cloud.user && (
              <button type="button" onClick={openAuthDialog} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2 text-[11px] font-black text-gray-700 transition-colors hover:bg-gray-50">
                <LogIn size={13} /> 登录
              </button>
            )}
            {cloud.enabled && cloud.user && (
              <button type="button" onClick={cloud.onSignOut} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2 text-[11px] font-black text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900" title={`退出 ${cloud.accountLabel}`}>
                <LogOut size={13} />
                <span className="hidden xl:inline">退出</span>
              </button>
            )}
            </div>
            {latestSyncAt && <span className="sr-only">最近同步 {formatSyncTime(latestSyncAt)}</span>}
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-5 pb-3 lg:hidden">
          {navItems.map((item) => (
            <ToolbarButton key={item.to} to={item.disabled ? '/decks' : item.to} icon={item.icon} label={item.label} disabled={item.disabled} />
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        {children}
      </main>
    </div>
  )
}

function Dashboard({ data, onOpenCreateDeck, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const summary = stats(data)
  const dueCards = data.cards.filter((card) => card.review.dueDate <= todayKey())
  const deckRows = data.decks.map((deck) => {
    const cards = data.cards.filter((card) => card.deckId === deck.id)
    return {
      ...deck,
      total: cards.length,
      due: cards.filter((card) => card.review.dueDate <= todayKey()).length,
      newCount: cards.filter((card) => card.review.reps === 0).length,
    }
  })

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">统计</h1>
          <p className="text-xs text-gray-500 mt-1">按卡组查看当前复习负载。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onOpenCreateDeck()} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">
            新建卡组
          </button>
          <button onClick={() => studyDeckId && navigate(`/study/${studyDeckId}`)} className="h-10 px-4 rounded-xl bg-[#007aff] text-white text-sm font-bold shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={!studyDeckId}>
            开始学习
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl bg-white/90 border border-white shadow-sm p-5">
          <p className="text-xs font-bold text-gray-500 mb-2">今日待复习</p>
          <p className="text-3xl font-black text-gray-950">{summary.dueToday}</p>
        </div>
        <div className="rounded-2xl bg-white/90 border border-white shadow-sm p-5">
          <p className="text-xs font-bold text-gray-500 mb-2">已开始学习</p>
          <p className="text-3xl font-black text-gray-950">{summary.learned}</p>
        </div>
        <div className="rounded-2xl bg-white/90 border border-white shadow-sm p-5">
          <p className="text-xs font-bold text-gray-500 mb-2">成熟卡片</p>
          <p className="text-3xl font-black text-gray-950">{summary.mastered}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
        <div className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">卡组统计</h2>
            <Link to="/decks" className="text-xs font-bold text-green-600 hover:text-green-700">回到卡组</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-bold">目录</th>
                <th className="text-right px-4 py-2 font-bold">新卡</th>
                <th className="text-right px-4 py-2 font-bold">到期</th>
                <th className="text-right px-4 py-2 font-bold">总数</th>
              </tr>
            </thead>
            <tbody>
              {deckRows.map((deck) => (
                <tr key={deck.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <strong className="block font-bold text-gray-900">{deck.name}</strong>
                    <span className="mt-1 block text-[11px] font-bold text-gray-400">{getDeckPath(deck)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-blue-600 font-bold">{deck.newCount}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-bold">{deck.due}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-bold">{deck.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">今日清单</h2>
            <span className="text-xs font-bold text-gray-400">{dueCards.length} 项</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {dueCards.length === 0 && <p className="text-sm text-gray-400 text-center py-10">没有到期卡片</p>}
            {dueCards.map((card) => (
              <button key={card.id} onClick={() => navigate(`/study/${card.deckId}`)} className="w-full text-left flex justify-between items-center px-4 py-3 border-t border-gray-100 hover:bg-gray-50 group">
                <div className="pr-4">
                  <h4 className="font-bold text-sm text-gray-900 mb-1 line-clamp-1">{card.front}</h4>
                  <p className="text-[11px] text-gray-500 line-clamp-1">{card.back}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-600 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </Shell>
  )
}

function Home() {
  return <Navigate to="/decks" replace />
}

function Profile({ data, cloud, studyDeckId, onUpdateProfile, onRedeemReward }) {
  const profile = getProfile(data, cloud)
  const rewardState = getRewardState(data)
  const summary = stats(data)
  const [form, setForm] = useState({
    nickname: profile.nickname,
    bio: profile.bio,
    examDate: profile.examDate,
    dailyGoalMinutes: profile.dailyGoalMinutes,
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    setForm({
      nickname: profile.nickname,
      bio: profile.bio,
      examDate: profile.examDate,
      dailyGoalMinutes: profile.dailyGoalMinutes,
    })
  }, [profile.bio, profile.dailyGoalMinutes, profile.examDate, profile.nickname])

  function handleSubmit(event) {
    event.preventDefault()
    onUpdateProfile({
      nickname: form.nickname.trim() || '学习者',
      avatarUrl: '',
      bio: form.bio.trim(),
      examDate: form.examDate,
      dailyGoalMinutes: Math.max(5, Number(form.dailyGoalMinutes) || 45),
    })
    setMessage('已保存')
    window.setTimeout(() => setMessage(''), 1600)
  }

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-950">个人中心</h1>
          <p className="mt-1 text-xs text-gray-500">管理昵称、学习目标和成就点兑换。</p>
        </div>
        <div className="rounded-2xl bg-white/90 px-4 py-2 text-right shadow-sm ring-1 ring-white">
          <p className="text-xl font-black text-gray-950">{rewardState.availablePoints}</p>
          <p className="text-[11px] font-bold text-gray-400">可用成就点</p>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-white">
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-300">Profile</p>
              <h2 className="mt-1 text-xl font-black text-gray-950">{form.nickname || profile.nickname}</h2>
              <p className="mt-1 text-xs font-bold text-gray-400">{cloud.enabled ? cloud.message : '本地浏览器数据'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-gray-800">昵称</span>
              <input
                value={form.nickname}
                onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
                placeholder="给自己起个学习名"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-gray-800">考试日期</span>
              <input
                type="date"
                value={form.examDate}
                onChange={(event) => setForm((current) => ({ ...current, examDate: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-gray-800">每日专注目标</span>
              <input
                type="number"
                min="5"
                step="5"
                value={form.dailyGoalMinutes}
                onChange={(event) => setForm((current) => ({ ...current, dailyGoalMinutes: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-gray-800">个人签名</span>
            <textarea
              value={form.bio}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              rows={3}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold leading-6 text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
              placeholder="写一句给复习中的自己看的话"
            />
          </label>

          <div className="mt-5 flex items-center justify-end gap-3">
            {message && <span className="text-xs font-black text-green-600">{message}</span>}
            <button type="submit" className="h-10 rounded-xl bg-gray-950 px-5 text-sm font-black text-white hover:bg-gray-800">
              保存资料
            </button>
          </div>
        </form>

        <aside className="space-y-5">
          <section className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-white">
            <h2 className="text-sm font-black text-gray-950">学习资产</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gray-50 px-3 py-3">
                <p className="text-2xl font-black text-gray-950">{summary.mastered}</p>
                <p className="text-[11px] font-bold text-gray-400">已掌握卡片</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3">
                <p className="text-2xl font-black text-gray-950">{rewardState.earnedItems.length}</p>
                <p className="text-[11px] font-bold text-gray-400">已获成就</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3">
                <p className="text-2xl font-black text-gray-950">{rewardState.totalPoints}</p>
                <p className="text-[11px] font-bold text-gray-400">累计点数</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3">
                <p className="text-2xl font-black text-gray-950">{rewardState.spentPoints}</p>
                <p className="text-[11px] font-bold text-gray-400">已兑换</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-white">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-950">奖励兑换</h2>
              <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-black text-green-700">{rewardState.availablePoints} 点可用</span>
            </div>
            <div className="mt-4 space-y-3">
              {REWARD_OPTIONS.map((reward) => {
                const redeemed = rewardState.redeemedRewards.some((item) => item.rewardId === reward.id)
                const affordable = rewardState.availablePoints >= reward.cost
                return (
                  <div key={reward.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-gray-950">{reward.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500">{reward.description}</p>
                      </div>
                      <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-gray-500">{reward.badge}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRedeemReward(reward.id)}
                      disabled={redeemed || !affordable}
                      className="mt-3 h-9 w-full rounded-xl bg-gray-950 text-xs font-black text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {redeemed ? '已兑换' : `${reward.cost} 点兑换`}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        </aside>
      </section>

      <AchievementPanel data={data} />
    </Shell>
  )
}

function PixelItemIcon({ name, earned }) {
  const badge = PIXEL_ITEM_BADGES[name] ?? PIXEL_ITEM_BADGES.card
  const rows = badge.pixels
  const palette = earned ? badge.palette : {
    d: '#9ca3af',
    g: '#d1d5db',
    l: '#f3f4f6',
    y: '#e5e7eb',
    w: '#f9fafb',
    b: '#d1d5db',
    r: '#d1d5db',
    o: '#e5e7eb',
    p: '#d1d5db',
    c: '#e5e7eb',
    k: '#9ca3af',
  }

  return (
    <div className={`grid h-16 w-16 shrink-0 place-items-center border-2 border-gray-900 bg-[#1f2937] p-1 shadow-[4px_4px_0_#d1d5db] ${earned ? '' : 'opacity-70'}`} aria-hidden="true">
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: `repeat(${rows[0].length}, 5px)`,
          imageRendering: 'pixelated',
        }}
      >
        {rows.join('').split('').map((pixel, index) => (
          <span
            key={`${name}-${index}`}
            className="h-[5px] w-[5px]"
            style={{ backgroundColor: pixel === '.' ? 'transparent' : palette[pixel] }}
          />
        ))}
      </div>
    </div>
  )
}

function LearningOverviewPanel({ data }) {
  const [now, setNow] = useState(() => Date.now())
  const [selectedDateKey, setSelectedDateKey] = useState(null)
  const [focusRange, setFocusRange] = useState('week')
  const activity = getActivity(data)
  const storedTodaySeconds = getTodaySiteSeconds(data)
  const liveBaseRef = useRef({ todaySeconds: storedTodaySeconds, siteSeconds: activity.siteSeconds, startedAt: now })

  useEffect(() => {
    liveBaseRef.current = { todaySeconds: storedTodaySeconds, siteSeconds: activity.siteSeconds, startedAt: Date.now() }
  }, [activity.siteSeconds, storedTodaySeconds])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const currentDate = new Date(now)
  const liveElapsed = Math.floor((now - liveBaseRef.current.startedAt) / 1000)
  const liveTodaySeconds = liveBaseRef.current.todaySeconds + liveElapsed
  const calendarDays = getMonthCalendarDays(currentDate)
  const activityMap = getCalendarActivityMap(data)
  const summary = stats(data)
  const profile = getStoredProfile(data)
  const goalSeconds = profile.dailyGoalMinutes * 60
  const selectedDetails = selectedDateKey ? getDateStudyDetails(data, selectedDateKey) : null
  const selectedActivity = selectedDateKey ? (activityMap.get(selectedDateKey) ?? { cards: 0, reviews: 0, logs: 0 }) : { cards: 0, reviews: 0, logs: 0 }
  const deckById = new Map(data.decks.map((deck) => [deck.id, deck]))
  const countdownInfo = getCountdownInfo(data, now)
  const focusSummary = getFocusSummary(data, focusRange, currentDate)
  const monthLabel = currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
  const todayLabel = currentDate.toLocaleDateString('zh-CN', { weekday: 'short', month: '2-digit', day: '2-digit' })

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-white bg-white/90 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="border-b border-gray-100 p-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">Calendar</p>
              <h2 className="mt-1 text-lg font-black text-gray-950">{monthLabel}</h2>
            </div>
            <CalendarDays size={20} className="text-[#007aff]" />
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black text-gray-300">
            {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dayActivity = activityMap.get(day.key)
              const active = Boolean(dayActivity?.cards || dayActivity?.reviews || dayActivity?.logs)
              const selected = selectedDateKey === day.key
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => setSelectedDateKey((current) => (current === day.key ? null : day.key))}
                  title={`${getDateLabel(day.key)}：新增 ${dayActivity?.cards ?? 0}，复习 ${dayActivity?.reviews ?? 0}`}
                  className={`relative grid h-8 place-items-center rounded-lg text-xs font-black transition-colors ${selected ? 'bg-gray-950 text-white' : day.isToday ? 'bg-[#007aff] text-white' : day.inMonth ? 'bg-gray-50 text-gray-700 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-50'}`}
                >
                  {day.date.getDate()}
                  {active && <span className={`absolute bottom-1 h-1 w-1 rounded-full ${selected || day.isToday ? 'bg-white' : 'bg-[#34c759]'}`} />}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-[11px] font-bold text-gray-300">点击日期展开当天记录，再点一次收起。</p>
        </div>

        <div className="p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">Today</p>
              <h2 className="mt-1 text-2xl font-black text-gray-950">{todayLabel}</h2>
            </div>
            <div className="rounded-xl bg-gray-950 px-4 py-3 text-right text-white">
              <p className="text-[11px] font-black text-white/50">{countdownInfo.label}</p>
              <p className="mt-1 font-mono text-2xl font-black">{countdownInfo.value}</p>
              <p className="mt-1 text-[10px] font-bold text-white/40">{countdownInfo.detail}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-black text-gray-400">今日停留</p>
                <Target size={16} className="text-gray-300" />
              </div>
              <p className="text-2xl font-black text-gray-950">{formatDuration(liveTodaySeconds, true)}</p>
              <p className="mt-1 text-[11px] font-bold text-gray-400">目标 {Math.round(Math.min(100, (liveTodaySeconds / Math.max(goalSeconds, 1)) * 100))}%</p>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-black text-gray-400">专注次数</p>
                <div className="grid grid-cols-2 rounded-lg bg-white p-0.5 text-[10px] font-black">
                  {[
                    { value: 'week', label: '周' },
                    { value: 'month', label: '月' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFocusRange(option.value)}
                      className={`h-5 rounded-md px-2 ${focusRange === option.value ? 'bg-gray-950 text-white' : 'text-gray-400 hover:text-gray-700'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-2xl font-black text-gray-950">{focusSummary.count}</p>
              <p className="mt-1 text-[11px] font-bold text-gray-400">{focusSummary.label} · 活跃 {focusSummary.days} 天 · 总 {focusSummary.total}</p>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-black text-gray-400">掌握知识点</p>
                <BookOpen size={16} className="text-gray-300" />
              </div>
              <p className="text-2xl font-black text-gray-950">{summary.mastered}</p>
              <p className="mt-1 text-[11px] font-bold text-gray-400">{summary.learned}/{data.cards.length} 已学</p>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-black text-gray-400">今日到期</p>
                <Layers3 size={16} className="text-gray-300" />
              </div>
              <p className="text-2xl font-black text-gray-950">{summary.dueToday}</p>
              <p className="mt-1 text-[11px] font-bold text-gray-400">待复习卡片</p>
            </div>
          </div>
        </div>
      </div>

      {selectedDateKey && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-gray-100 bg-white"
        >
          <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">Selected Day</p>
              <h3 className="mt-1 text-lg font-black text-gray-950">{getDateLabel(selectedDateKey)}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-black text-gray-500">新增 {selectedActivity.cards}</span>
                <span className="rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-black text-gray-500">复习 {selectedActivity.reviews}</span>
                <span className="rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-black text-gray-500">复盘 {selectedActivity.logs}</span>
              </div>
              <button type="button" onClick={() => setSelectedDateKey(null)} className="mt-4 h-8 rounded-lg bg-gray-100 px-3 text-xs font-black text-gray-500 hover:bg-gray-200">
                收起
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {selectedDetails.cards.length === 0 && !selectedDetails.dailyLog?.content?.trim() && selectedDetails.reviews.length === 0 && (
                <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm font-bold text-gray-400 md:col-span-2">这天还没有学习记录。</p>
              )}
              {selectedDetails.cards.slice(0, 6).map((card) => {
                const deck = deckById.get(card.deckId)
                return (
                  <div key={card.id} className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="line-clamp-1 text-sm font-black text-gray-800">{card.front}</p>
                    <p className="mt-1 line-clamp-1 text-xs font-bold text-gray-400">{deck?.name ?? '未归档'} · 新增卡片</p>
                  </div>
                )
              })}
              {selectedDetails.dailyLog?.content?.trim() && (
                <div className="rounded-xl bg-gray-50 px-4 py-3 md:col-span-2">
                  <p className="text-sm font-black text-gray-800">今日复盘</p>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-500">{selectedDetails.dailyLog.content}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </section>
  )
}

function CollapseToggle({ expanded, onToggle, label }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      title={expanded ? `收起${label}` : `展开${label}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
    >
      <ChevronRight size={16} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
    </button>
  )
}

function AchievementPanel({ data, collapsed = false, onToggle }) {
  const achievementState = getAchievementState(data)
  const nextAchievements = achievementState.items.filter((achievement) => !achievement.earned).slice(0, 3)
  const expanded = !collapsed

  return (
    <section className="mb-5 rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
      <div className="h-11 px-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-gray-950">像素物品成就</h2>
          <p className="text-[11px] font-bold text-gray-400 mt-0.5">低门槛，只奖励已经发生的学习动作。</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xl font-black text-gray-950">{achievementState.totalPoints}</p>
            <p className="text-[11px] font-bold text-gray-400">成就点 / {achievementState.maxPoints}</p>
          </div>
          {onToggle && <CollapseToggle expanded={expanded} onToggle={onToggle} label="成就" />}
        </div>
      </div>

      {expanded && <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-0">
        <div className="border-b lg:border-b-0 lg:border-r border-gray-100 p-5">
          <div className="rounded-2xl bg-gray-50 px-4 py-4">
            <p className="text-xs font-black text-gray-400 mb-2">已获得</p>
            <p className="text-4xl font-black text-gray-950">{achievementState.earnedItems.length}</p>
            <p className="mt-1 text-xs font-bold text-gray-400">共 {achievementState.items.length} 枚冒险徽章</p>
          </div>
          {nextAchievements.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-black text-gray-300">下一步</p>
              <div className="flex flex-col gap-2">
                {nextAchievements.map((achievement) => (
                  <div key={achievement.id} className="rounded-lg bg-gray-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-gray-700">{achievement.title}</span>
                      <span className="text-[11px] font-bold text-gray-400">{achievement.progressText}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">{achievement.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-5">
          {achievementState.items.map((achievement) => (
            <div
              key={achievement.id}
              className={`border-2 px-3 py-3 flex items-center gap-3 shadow-[3px_3px_0_#e5e7eb] ${achievement.earned ? 'border-gray-900 bg-[#f4fff4]' : 'border-gray-300 bg-gray-50/80'}`}
            >
              <PixelItemIcon name={achievement.icon} earned={achievement.earned} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className={`text-sm font-black truncate ${achievement.earned ? 'text-gray-950' : 'text-gray-400'}`}>{achievement.title}</h3>
                  <span className={`shrink-0 text-xs font-black ${achievement.earned ? 'text-green-700' : 'text-gray-300'}`}>+{achievement.points}</span>
                </div>
                <p className={`text-xs leading-relaxed line-clamp-2 ${achievement.earned ? 'text-gray-600' : 'text-gray-400'}`}>{achievement.description}</p>
                <p className="mt-1 text-[11px] font-bold text-gray-400">{achievement.earned ? '已达成' : achievement.progressText}</p>
              </div>
            </div>
          ))}
        </div>
      </div>}
    </section>
  )
}

function AchievementSummaryPanel({ data }) {
  const rewardState = getRewardState(data)
  const nextAchievements = rewardState.items.filter((achievement) => !achievement.earned).slice(0, 2)
  const recentEarned = rewardState.earnedItems.slice(-2)
  const previewItems = nextAchievements.length > 0 ? nextAchievements : recentEarned

  return (
    <section className="mb-5 rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[240px_minmax(0,1fr)_180px]">
        <div className="border-b border-gray-100 p-5 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">Achievements</p>
          <h2 className="mt-2 text-sm font-black text-gray-950">成就与奖励</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">这里只放进度摘要，完整物品墙在个人页。</p>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
          {previewItems.length === 0 && <p className="text-sm font-bold text-gray-400">先添加第一张卡片，成就会开始点亮。</p>}
          {previewItems.map((achievement) => (
            <div key={achievement.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3">
              <PixelItemIcon name={achievement.icon} earned={achievement.earned} />
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-900">{achievement.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{achievement.description}</p>
                <p className="mt-1 text-[11px] font-black text-gray-400">{achievement.earned ? '已达成' : achievement.progressText}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-row items-center justify-between gap-3 border-t border-gray-100 p-5 lg:flex-col lg:items-stretch lg:justify-center lg:border-l lg:border-t-0">
          <div>
            <p className="text-3xl font-black text-gray-950">{rewardState.availablePoints}</p>
            <p className="text-xs font-bold text-gray-400">可兑换点数</p>
          </div>
          <Link to="/profile" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gray-950 px-4 text-xs font-black text-white hover:bg-gray-800">
            <Gift size={14} /> 去兑换
          </Link>
        </div>
      </div>
    </section>
  )
}

function DailyReviewPanel({ data, selectedDeckId, onSelectDeck, onSaveDailyLog, onCreateDailyCards, collapsed = false, onToggle }) {
  const dateKey = todayKey()
  const existingLog = getDailyLog(data, dateKey)
  const [draft, setDraft] = useState(existingLog?.content ?? '')
  const [message, setMessage] = useState('')
  const analysis = useMemo(() => parseDailyReview(draft), [draft])
  const targetDeck = data.decks.find((deck) => deck.id === selectedDeckId)
  const expanded = !collapsed

  useEffect(() => {
    setDraft(existingLog?.content ?? '')
    setMessage('')
  }, [existingLog?.content, existingLog?.id, dateKey])

  function handleSave() {
    onSaveDailyLog(dateKey, draft)
    setMessage('已保存')
  }

  function handleCreateCards() {
    if (!selectedDeckId || analysis.cards.length === 0) return
    onSaveDailyLog(dateKey, draft)
    onCreateDailyCards(selectedDeckId, dateKey, analysis.cards)
    setMessage(`已同步 ${analysis.cards.length} 张卡`)
  }

  return (
    <section className="mb-5 rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
      <div className="h-11 px-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-[#007aff]" />
          <h2 className="text-sm font-black text-gray-950">今日复盘</h2>
          <span className="text-xs font-bold text-gray-300">{formatStudyDate(dateKey)}</span>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-xs font-bold text-green-600">{message}</span>}
          <button type="button" onClick={handleSave} className="h-8 px-3 rounded-lg bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200">保存</button>
          {onToggle && <CollapseToggle expanded={expanded} onToggle={onToggle} label="今日复盘" />}
        </div>
      </div>

      {expanded && <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-0">
        <div className="p-5 border-b lg:border-b-0 lg:border-r border-gray-100">
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setMessage('')
            }}
            placeholder={`民法：形成权、意思表示、可撤销民事法律行为
易错：重大误解和欺诈的区分
疑问：形成权和请求权的边界
待整理：适用情形需要拆成专题

Q: 形成权的核心特征是什么？
A: 依一方意思表示即可使法律关系发生、变更或消灭。`}
            className="min-h-[210px] w-full resize-none rounded-2xl bg-gray-50 px-4 py-3 text-sm leading-7 text-gray-900 outline-none focus:ring-2 focus:ring-[#007aff]/15"
          />
        </div>

        <aside className="p-5">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[11px] font-bold text-gray-400 mb-1">线索</p>
              <p className="text-2xl font-black text-gray-950">{analysis.totalClues}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[11px] font-bold text-gray-400 mb-1">可转卡</p>
              <p className="text-2xl font-black text-gray-950">{analysis.cards.length}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[11px] font-bold text-gray-400 mb-1">行数</p>
              <p className="text-2xl font-black text-gray-950">{analysis.lines.length}</p>
            </div>
          </div>

          <label className="mb-3 block">
            <span className="mb-2 block text-xs font-black text-gray-400">归入卡组</span>
            <select
              value={selectedDeckId ?? ''}
              onChange={(event) => onSelectDeck(event.target.value)}
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 outline-none focus:border-[#007aff] focus:bg-white"
            >
              {data.decks.length === 0 && <option value="">选择卡组</option>}
              <DeckSelectOptions decks={data.decks} />
            </select>
          </label>

          <button
            type="button"
            onClick={handleCreateCards}
            disabled={!targetDeck || analysis.cards.length === 0}
            className="mb-4 h-10 w-full rounded-xl bg-[#007aff] text-sm font-bold text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300"
          >
            转入 {targetDeck?.name ?? '当前卡组'} {analysis.cards.length} 张
          </button>

          <div className="space-y-3">
            {analysis.subjectHits.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-black text-gray-300">涉及板块</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.subjectHits.map((hit) => (
                    <span key={hit.section} className="rounded bg-green-50 px-2 py-1 text-[11px] font-black text-green-700">{hit.section} · {hit.count}</span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-[11px] font-black text-gray-300">复盘线索</p>
              <div className="max-h-[150px] overflow-y-auto space-y-2">
                {analysis.totalClues === 0 && <p className="text-xs text-gray-400">写下易错、疑问、待整理或高亮内容后，这里会聚合当天线索。</p>}
                {analysis.clues.flatMap((clue) => clue.items.map((item, index) => (
                  <div key={`${clue.key}-${index}-${item}`} className="rounded-lg bg-gray-50 px-3 py-2">
                    <span className="rounded bg-white px-2 py-0.5 text-[10px] font-black text-gray-500">{clue.label}</span>
                    <p className="mt-1 text-xs leading-relaxed text-gray-700 line-clamp-2">{item}</p>
                  </div>
                )))}
              </div>
            </div>
          </div>
        </aside>
      </div>}
    </section>
  )
}

function Decks({ data, onOpenCreateDeck, onOpenEditDeck, onDeleteDeck, onSaveDailyLog, onCreateDailyCards, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const [selectedDeckId, setSelectedDeckId] = useState(data.decks[0]?.id ?? null)
  const [selectedSection, setSelectedSection] = useState('全部')
  const [collapsedPanels, setCollapsedPanels] = useState({
    daily: true,
    sections: false,
    deckList: false,
    currentDeck: false,
  })

  function toggleDeckPanel(panel) {
    setCollapsedPanels((current) => ({ ...current, [panel]: !current[panel] }))
  }

  function isPanelExpanded(panel) {
    return !collapsedPanels[panel]
  }

  const deckRows = useMemo(() => sortDecksByPath(data.decks).map((deck) => {
    const cards = data.cards.filter((card) => card.deckId === deck.id)
    return {
      ...deck,
      total: cards.length,
      due: cards.filter((card) => card.review.dueDate <= todayKey()).length,
      newCount: cards.filter((card) => card.review.reps === 0).length,
    }
  }), [data.cards, data.decks])

  const sectionRows = useMemo(() => getSectionNames(data.decks)
    .map((section) => {
      const sectionDecks = deckRows.filter((deck) => getDeckSection(deck) === section)
      return {
        section,
        total: sectionDecks.reduce((sum, deck) => sum + deck.total, 0),
        due: sectionDecks.reduce((sum, deck) => sum + deck.due, 0),
        deckCount: sectionDecks.length,
      }
    }), [data.decks, deckRows])

  const visibleDeckRows = useMemo(() => (
    selectedSection === '全部'
      ? deckRows
      : deckRows.filter((deck) => getDeckSection(deck) === selectedSection)
  ), [deckRows, selectedSection])

  useEffect(() => {
    if (selectedSection !== '全部' && !sectionRows.some((section) => section.section === selectedSection)) {
      setSelectedSection('全部')
    }
  }, [sectionRows, selectedSection])

  useEffect(() => {
    if (!visibleDeckRows.some((deck) => deck.id === selectedDeckId)) {
      setSelectedDeckId(visibleDeckRows[0]?.id ?? null)
    }
  }, [selectedDeckId, visibleDeckRows])

  const selectedDeck = visibleDeckRows.find((deck) => deck.id === selectedDeckId) ?? deckRows.find((deck) => deck.id === selectedDeckId)
  const deckCards = data.cards.filter((card) => card.deckId === selectedDeck?.id)
  const emptyDeckListText = selectedSection === '全部'
    ? '还没有卡组。'
    : `${selectedSection} 还没有卡组，可以先开一个章节或专题。`

  function handleDelete(deck) {
    const count = data.cards.filter((card) => card.deckId === deck.id).length
    const confirmed = window.confirm(`确定删除卡组“${deck.name}”吗？该卡组下的 ${count} 张卡片也会一起删除。`)
    if (!confirmed) return
    onDeleteDeck(deck.id)
  }

  function openCreateDeckForCurrentSection() {
    const section = selectedSection !== '全部' && selectedSection !== UNGROUPED_SECTION ? selectedSection : ''
    onOpenCreateDeck(section ? { section } : null)
  }

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">卡组</h1>
          <p className="text-xs text-gray-500 mt-1">按法硕科目、章节和专题组织复习材料。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => selectedDeckId && navigate(`/cards/new/${selectedDeckId}`)} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300" disabled={!selectedDeckId}>添加</button>
          <button onClick={() => navigate('/import')} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300" disabled={!selectedDeckId}>导入</button>
          <button onClick={() => selectedDeckId && navigate(`/study/${selectedDeckId}`)} className="h-10 px-4 rounded-xl bg-[#007aff] text-white text-sm font-bold shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={!selectedDeckId}>学习</button>
        </div>
      </header>

      <LearningOverviewPanel data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_340px] gap-5 items-start">
        <aside className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">学习板块</h2>
            <div className="flex items-center gap-1">
              <BookOpen size={15} className="text-gray-300" />
              <CollapseToggle expanded={isPanelExpanded('sections')} onToggle={() => toggleDeckPanel('sections')} label="学习板块" />
            </div>
          </div>
          {isPanelExpanded('sections') && <div className="p-2 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setSelectedSection('全部')}
              className={`text-left px-3 py-2 rounded text-sm flex items-center justify-between gap-3 ${selectedSection === '全部' ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span>全部</span>
              <span className="text-xs text-gray-400">{data.cards.length}</span>
            </button>
            {sectionRows.map((section) => {
              const isEmpty = section.deckCount === 0
              const isSelected = selectedSection === section.section
              return (
                <button
                  key={section.section}
                  type="button"
                  onClick={() => setSelectedSection(section.section)}
                  className={`text-left px-3 py-2 rounded text-sm ${isSelected ? 'bg-green-50 text-green-700 font-bold' : isEmpty ? 'text-gray-400 hover:bg-gray-50 hover:text-gray-600' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="line-clamp-1">{section.section}</span>
                    <span className="text-xs text-gray-400">{section.total}</span>
                  </span>
                  <span className="mt-1 block text-[11px] text-gray-400">{isEmpty ? '待开架' : `${section.deckCount} 组 · 到期 ${section.due}`}</span>
                </button>
              )
            })}
          </div>}
        </aside>

        <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">{selectedSection === '全部' ? '牌组列表' : `${selectedSection}牌组`}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">{visibleDeckRows.length} 个</span>
              <CollapseToggle expanded={isPanelExpanded('deckList')} onToggle={() => toggleDeckPanel('deckList')} label="牌组列表" />
            </div>
          </div>
          {isPanelExpanded('deckList') && (visibleDeckRows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-400 mb-4">{emptyDeckListText}</p>
              <button onClick={openCreateDeckForCurrentSection} className="h-10 px-4 rounded-xl bg-[#007aff] text-white text-sm font-bold hover:bg-[#006ee6]">新建卡组</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2 font-bold">牌组</th>
                  <th className="text-right px-3 py-2 font-bold">新卡</th>
                  <th className="text-right px-3 py-2 font-bold">到期</th>
                  <th className="text-right px-3 py-2 font-bold">总数</th>
                  <th className="text-right px-4 py-2 font-bold">操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeckRows.map((deck) => (
                  <tr key={deck.id} className={`border-t border-gray-100 hover:bg-gray-50 ${selectedDeckId === deck.id ? 'bg-green-50/60' : ''}`}>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setSelectedDeckId(deck.id)} className="text-left">
                        <strong className="block text-sm text-gray-950">{deck.name}</strong>
                        <span className="mt-1 inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                          <FolderOpen size={11} /> {getDeckPath(deck)}
                        </span>
                        <span className="block text-xs text-gray-500 line-clamp-1 mt-1">{deck.description}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right text-blue-600 font-bold">{deck.newCount}</td>
                    <td className="px-3 py-3 text-right text-red-600 font-bold">{deck.due}</td>
                    <td className="px-3 py-3 text-right text-gray-700 font-bold">{deck.total}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => navigate(`/study/${deck.id}`)} className="h-7 px-2 rounded-lg bg-white text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50">学习</button>
                        <button onClick={() => navigate(`/cards/new/${deck.id}`)} className="h-7 px-2 rounded-lg bg-white text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50">添加</button>
                        <button onClick={() => navigate('/browse', { state: { deckId: deck.id } })} className="h-7 px-2 rounded-lg bg-white text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50">浏览</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </section>

        <aside className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">当前牌组</h2>
            <div className="flex items-center gap-2">
              {selectedDeck && <span className="text-xs font-bold text-gray-400">{deckCards.length} 张</span>}
              <CollapseToggle expanded={isPanelExpanded('currentDeck')} onToggle={() => toggleDeckPanel('currentDeck')} label="当前牌组" />
            </div>
          </div>
          {isPanelExpanded('currentDeck') && <>
          <div className="p-4">
            <div>
              {selectedDeck && (
                <span className="mb-2 inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-[11px] font-black text-green-700">
                  <FolderOpen size={12} /> {getDeckPath(selectedDeck)}
                </span>
              )}
              <h3 className="font-black text-gray-950 mb-2">{selectedDeck?.name ?? '卡片列表'}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{selectedDeck?.description ?? '先选择一个卡组。'}</p>
            </div>
            {selectedDeck && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => navigate(`/study/${selectedDeck.id}`)} className="h-9 rounded-xl bg-[#007aff] text-white text-xs font-bold hover:bg-[#006ee6]">开始学习</button>
                <button onClick={() => navigate(`/cards/new/${selectedDeck.id}`)} className="h-9 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200">添加卡片</button>
                <button onClick={() => onOpenEditDeck(selectedDeck)} className="h-9 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200 flex items-center justify-center gap-1.5">
                  <PencilLine size={14} /> 编辑
                </button>
                <button onClick={() => handleDelete(selectedDeck)} className="h-9 rounded-xl bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 flex items-center justify-center gap-1.5">
                  <Trash2 size={14} /> 删除
                </button>
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 max-h-[360px] overflow-y-auto">
            {deckCards.length === 0 && <p className="text-sm text-gray-400 p-4">当前卡组为空。</p>}
            {deckCards.slice(0, 8).map((card) => (
              <div key={card.id} className="px-4 py-3 border-b border-gray-100">
                <strong className="block text-sm text-gray-900 line-clamp-1 mb-1">{card.front}</strong>
                <p className="text-[11px] text-gray-500 line-clamp-1">{card.back}</p>
              </div>
            ))}
          </div>
          </>}
        </aside>
      </div>

      <div className="mt-5">
        <DailyReviewPanel
          data={data}
          selectedDeckId={selectedDeckId}
          onSelectDeck={setSelectedDeckId}
          onSaveDailyLog={onSaveDailyLog}
          onCreateDailyCards={onCreateDailyCards}
          collapsed={collapsedPanels.daily}
          onToggle={() => toggleDeckPanel('daily')}
        />
      </div>

      <AchievementSummaryPanel data={data} />
    </Shell>
  )
}

function Browse({ data, studyDeckId, cloud, onAddCardAnnotation, onRemoveCardAnnotation, onLinkCards, onUnlinkCards }) {
  const location = useLocation()
  const navigate = useNavigate()
  const initialDeckId = location.state?.deckId ?? data.decks[0]?.id ?? ''
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId)
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [query, setQuery] = useState('')
  const [annotationType, setAnnotationType] = useState(ANNOTATION_TYPES[0])
  const [annotationDraft, setAnnotationDraft] = useState('')
  const [linkTargetId, setLinkTargetId] = useState('')
  const groupedDecks = useMemo(() => groupDecksBySection(data.decks), [data.decks])

  useEffect(() => {
    if (!data.decks.find((deck) => deck.id === selectedDeckId)) {
      setSelectedDeckId(data.decks[0]?.id ?? '')
    }
  }, [data.decks, selectedDeckId])

  const visibleCards = useMemo(() => (
    data.cards
      .filter((card) => !selectedDeckId || card.deckId === selectedDeckId)
      .filter((card) => {
        const keyword = query.trim().toLowerCase()
        if (!keyword) return true
        return `${card.front} ${card.back}`.toLowerCase().includes(keyword)
      })
  ), [data.cards, query, selectedDeckId])
  const visibleCardRows = useMemo(() => visibleCards.slice(0, BROWSE_CARD_RENDER_LIMIT), [visibleCards])

  const selectedCard = visibleCards.find((card) => card.id === selectedCardId) ?? visibleCards[0] ?? null
  const selectedDeck = data.decks.find((deck) => deck.id === selectedDeckId)
  const selectedAnnotations = getCardAnnotations(selectedCard)
  const linkedCards = selectedCard ? getCardLinks(selectedCard).map((id) => data.cards.find((card) => card.id === id)).filter(Boolean) : []
  const relatedSuggestions = getRelatedSuggestions(data, selectedCard)
  const linkableCards = data.cards.filter((card) => card.id !== selectedCard?.id && !getCardLinks(selectedCard).includes(card.id))

  useEffect(() => {
    setSelectedCardId((current) => {
      if (visibleCards.some((card) => card.id === current)) return current
      return visibleCards[0]?.id ?? null
    })
  }, [visibleCards])

  useEffect(() => {
    setAnnotationDraft('')
    setLinkTargetId('')
  }, [selectedCard?.id])

  function handleAddAnnotation() {
    const text = annotationDraft.trim()
    if (!selectedCard || !text) return
    onAddCardAnnotation(selectedCard.id, { type: annotationType, text })
    setAnnotationDraft('')
  }

  function handleLinkCard(targetId = linkTargetId) {
    if (!selectedCard || !targetId) return
    onLinkCards(selectedCard.id, targetId)
    setLinkTargetId('')
  }

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">浏览</h1>
          <p className="text-xs text-gray-500 mt-1">查看当前卡组里的所有卡片，未分组内容也会保留在目录中。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => selectedDeckId && navigate(`/cards/new/${selectedDeckId}`)} className="h-10 px-4 rounded-xl bg-[#007aff] text-white text-sm font-bold shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={!selectedDeckId}>添加卡片</button>
          <button onClick={() => selectedDeckId && navigate(`/study/${selectedDeckId}`)} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300" disabled={!selectedDeckId}>学习</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_340px] gap-4 min-h-[620px]">
        <aside className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">目录</h2>
            <span className="text-xs font-bold text-gray-400">{data.decks.length}</span>
          </div>
          <div className="p-2 flex flex-col gap-1">
            {groupedDecks.map((group) => (
              <div key={group.section}>
                <p className="px-3 py-1 text-[11px] font-black text-gray-300">{group.section}</p>
                {group.decks.map((deck) => {
                  const count = data.cards.filter((card) => card.deckId === deck.id).length
                  return (
                    <button
                      key={deck.id}
                      onClick={() => setSelectedDeckId(deck.id)}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between gap-3 ${selectedDeckId === deck.id ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <span>
                        <span className="block line-clamp-1">{deck.name}</span>
                        {getDeckChapter(deck) && <span className="block text-[11px] text-gray-400 line-clamp-1">{getDeckChapter(deck)}</span>}
                      </span>
                      <span className="text-xs text-gray-400">{count}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-3 border-b border-gray-200 flex items-center gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索问题或答案"
              className="h-9 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-[#007aff] focus:bg-white"
            />
            <span className="text-xs font-bold text-gray-400">{visibleCards.length} 张</span>
          </div>
          <div className="overflow-auto max-h-[580px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-bold">问题</th>
                  <th className="text-left px-3 py-2 font-bold">答案</th>
                  <th className="text-right px-3 py-2 font-bold">到期</th>
                </tr>
              </thead>
              <tbody>
                {visibleCardRows.map((card) => (
                  <tr
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                    className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${selectedCard?.id === card.id ? 'bg-green-50/70' : ''}`}
                  >
                    <td className="px-3 py-2 font-bold text-gray-900 max-w-[220px] truncate">{card.front}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-[220px] truncate">{card.back}</td>
                    <td className="px-3 py-2 text-right text-xs text-gray-400 whitespace-nowrap">{card.review.dueDate}</td>
                  </tr>
                ))}
                {visibleCards.length > visibleCardRows.length && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-xs font-bold text-gray-400">
                      已显示前 {visibleCardRows.length} 张。继续输入关键词可以缩小范围。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {visibleCards.length === 0 && <p className="text-sm text-gray-400 text-center py-10">没有匹配的卡片。</p>}
          </div>
        </section>

        <aside className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">预览</h2>
            <span className="text-xs text-gray-400">{selectedDeck ? getDeckPath(selectedDeck) : '未选择'}</span>
          </div>
          {selectedCard ? (
            <div className="p-4">
              <p className="text-xs font-bold text-gray-400 mb-2">Front</p>
              <CardContent
                card={selectedCard}
                side="front"
                className="text-lg font-black text-gray-950 break-words leading-relaxed"
                fallbackClassName="text-lg font-black text-gray-950 break-words leading-relaxed"
              />
              <div className="my-5 h-px bg-gray-200" />
              <p className="text-xs font-bold text-gray-400 mb-2">Back</p>
              <CardContent
                card={selectedCard}
                side="back"
                className="text-base text-gray-700 break-words leading-relaxed"
                fallbackClassName="text-base text-gray-700 break-words leading-relaxed"
              />
              <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500">间隔 {selectedCard.review.interval} 天</span>
                <span className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500">复习 {selectedCard.review.reps} 次</span>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-950">批注</h3>
                  <span className="text-xs font-bold text-gray-300">{selectedAnnotations.length}</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={annotationType}
                    onChange={(event) => setAnnotationType(event.target.value)}
                    className="h-9 w-24 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs font-bold text-gray-600 outline-none focus:border-[#007aff] focus:bg-white"
                  >
                    {ANNOTATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <input
                    value={annotationDraft}
                    onChange={(event) => setAnnotationDraft(event.target.value)}
                    placeholder="补一句理解、易错或口诀"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-[#007aff] focus:bg-white"
                  />
                  <button type="button" onClick={handleAddAnnotation} className="h-9 px-3 rounded-lg bg-gray-900 text-xs font-bold text-white disabled:bg-gray-300" disabled={!annotationDraft.trim()}>
                    保存
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {selectedAnnotations.length === 0 && <p className="text-xs text-gray-400">还没有批注。可以先记一个疑问，之后在整理页横向查看。</p>}
                  {selectedAnnotations.map((annotation) => (
                    <div key={annotation.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="rounded bg-white px-2 py-0.5 text-[10px] font-black text-green-700">{annotation.type}</span>
                        <button type="button" onClick={() => onRemoveCardAnnotation(selectedCard.id, annotation.id)} className="text-[11px] font-bold text-gray-300 hover:text-red-500">删除</button>
                      </div>
                      <p className="text-xs leading-relaxed text-gray-700">{annotation.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-950">关联卡</h3>
                  <span className="text-xs font-bold text-gray-300">{linkedCards.length}</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={linkTargetId}
                    onChange={(event) => setLinkTargetId(event.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs font-semibold text-gray-600 outline-none focus:border-[#007aff] focus:bg-white"
                  >
                    <option value="">选择一张卡串联</option>
                    {groupDecksBySection(data.decks).map((group) => (
                      <optgroup key={group.section} label={group.section}>
                        {group.decks.flatMap((deck) => data.cards
                          .filter((card) => card.deckId === deck.id && linkableCards.some((item) => item.id === card.id))
                          .map((card) => <option key={card.id} value={card.id}>{deck.name} / {card.front}</option>))}
                      </optgroup>
                    ))}
                  </select>
                  <button type="button" onClick={() => handleLinkCard()} className="h-9 px-3 rounded-lg bg-gray-900 text-xs font-bold text-white disabled:bg-gray-300" disabled={!linkTargetId}>
                    串联
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {linkedCards.length === 0 && <p className="text-xs text-gray-400">可以把要件、例外、案例、对比题串成一条复习线。</p>}
                  {linkedCards.map((card) => (
                    <div key={card.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => setSelectedCardId(card.id)} className="text-left text-xs font-bold leading-relaxed text-gray-800 hover:text-[#007aff]">{card.front}</button>
                        <button type="button" onClick={() => onUnlinkCards(selectedCard.id, card.id)} className="shrink-0 text-[11px] font-bold text-gray-300 hover:text-red-500">断开</button>
                      </div>
                    </div>
                  ))}
                </div>
                {relatedSuggestions.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[11px] font-black text-gray-300">可能相关</p>
                    <div className="flex flex-col gap-2">
                      {relatedSuggestions.map((card) => (
                        <button key={card.id} type="button" onClick={() => handleLinkCard(card.id)} className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-left text-xs font-bold text-gray-500 hover:border-green-200 hover:bg-green-50 hover:text-green-700">
                          {card.front}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">选择一张卡片查看预览。</p>
          )}
        </aside>
      </div>
    </Shell>
  )
}

function Organize({ data, onOpenCreateDeck, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const outlineRows = getDeckOutlineRows(data)
  const annotations = getAnnotationWall(data)
  const ungroupedDecks = data.decks.filter((deck) => getDeckSection(deck) === UNGROUPED_SECTION)
  const professionalDecks = data.decks.filter((deck) => PROFESSIONAL_SECTIONS.includes(getDeckSection(deck)))
  const linkedPairs = data.cards.flatMap((card) => getCardLinks(card).map((targetId) => {
    const target = data.cards.find((item) => item.id === targetId)
    if (!target || card.id > target.id) return null
    return { card, target }
  })).filter(Boolean)

  const workRows = [
    { label: '收集箱', value: ungroupedDecks.reduce((sum, deck) => sum + getDeckCards(data, deck.id).length, 0), detail: `${ungroupedDecks.length} 组未分配` },
    { label: '专业课', value: professionalDecks.reduce((sum, deck) => sum + getDeckCards(data, deck.id).length, 0), detail: `${professionalDecks.length} 组材料` },
    { label: '横向批注', value: annotations.length, detail: '理解与易错' },
    { label: '关联线', value: linkedPairs.length, detail: '卡片串联' },
  ]

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">整理工作台</h1>
          <p className="text-sm text-gray-500 mt-1">收集、归档、串联和批注分开放，日常复习保持简单。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onOpenCreateDeck()} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">新建卡组</button>
          <button onClick={() => navigate('/browse')} className="h-10 px-4 rounded-xl bg-[#007aff] text-sm font-bold text-white shadow-sm hover:bg-[#006ee6]">浏览卡片</button>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {workRows.map((row) => (
          <div key={row.label} className="rounded-2xl bg-white/90 border border-white shadow-sm p-5">
            <p className="text-xs font-bold text-gray-500 mb-2">{row.label}</p>
            <p className="text-3xl font-black text-gray-950">{row.value}</p>
            <p className="mt-1 text-xs font-bold text-gray-300">{row.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_340px] gap-5 items-start">
        <aside className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">默认路径</h2>
            <FolderOpen size={15} className="text-gray-300" />
          </div>
          <div className="p-3 flex flex-col gap-2">
            <button type="button" onClick={() => navigate('/decks')} className="rounded-xl bg-gray-50 px-3 py-3 text-left hover:bg-green-50">
              <span className="flex items-center justify-between text-sm font-black text-gray-900">
                <span>收集箱</span>
                <span className="text-xs text-gray-400">{ungroupedDecks.length}</span>
              </span>
              <span className="mt-1 block text-xs text-gray-400">未分组、待归档、临时材料</span>
            </button>
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <div className="mb-2 flex items-center justify-between text-sm font-black text-gray-900">
                <span>专业课</span>
                <span className="text-xs text-gray-400">{professionalDecks.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {PROFESSIONAL_SECTIONS.map((section) => (
                  <button key={section} type="button" onClick={() => navigate('/decks')} className="rounded-lg bg-white px-2 py-2 text-left text-xs font-bold text-gray-600 hover:text-green-700">
                    {section}
                  </button>
                ))}
              </div>
            </div>
            {['政治', '英语', '规律专题'].map((section) => {
              const decks = data.decks.filter((deck) => getDeckSection(deck) === section)
              return (
                <button key={section} type="button" onClick={() => navigate('/decks')} className="rounded-xl bg-gray-50 px-3 py-3 text-left hover:bg-green-50">
                  <span className="flex items-center justify-between text-sm font-black text-gray-900">
                    <span>{section}</span>
                    <span className="text-xs text-gray-400">{decks.length}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">章节树</h2>
            <span className="text-xs font-bold text-gray-400">{data.decks.length} 组</span>
          </div>
          <div className="max-h-[620px] overflow-y-auto">
            {outlineRows.map((section) => (
              <div key={section.section} className="border-b border-gray-100 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-black text-gray-950">{section.section}</h3>
                  <span className="text-xs font-bold text-gray-400">{section.cardCount} 张</span>
                </div>
                <div className="flex flex-col gap-2">
                  {section.chapters.map((chapter) => (
                    <div key={`${section.section}-${chapter.chapter}`} className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black text-gray-800">{chapter.chapter}</p>
                        <span className="text-xs font-bold text-gray-400">{chapter.cardCount}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {chapter.decks.map((deck) => (
                          <button key={deck.id} type="button" onClick={() => navigate('/browse', { state: { deckId: deck.id } })} className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-gray-500 hover:text-[#007aff]">
                            {deck.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
            <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-950">关联线</h2>
              <span className="text-xs font-bold text-gray-400">{linkedPairs.length}</span>
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {linkedPairs.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">还没有串联卡片。</p>}
              {linkedPairs.map((pair) => (
                <div key={`${pair.card.id}-${pair.target.id}`} className="border-b border-gray-100 px-4 py-3">
                  <p className="text-xs font-bold text-gray-900 line-clamp-1">{pair.card.front}</p>
                  <p className="my-1 text-[11px] font-black text-gray-300">关联到</p>
                  <p className="text-xs font-bold text-gray-600 line-clamp-1">{pair.target.front}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
            <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-950">批注墙</h2>
              <span className="text-xs font-bold text-gray-400">{annotations.length}</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {annotations.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">批注会在这里横向汇总。</p>}
              {annotations.map((annotation) => (
                <button key={annotation.id} type="button" onClick={() => navigate('/browse', { state: { deckId: annotation.card.deckId } })} className="w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-black text-green-700">{annotation.type}</span>
                    <span className="text-[11px] font-bold text-gray-300">{annotation.deck ? getDeckPath(annotation.deck) : UNGROUPED_SECTION}</span>
                  </div>
                  <p className="text-xs font-bold text-gray-900 line-clamp-1">{annotation.card.front}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500 line-clamp-2">{annotation.text}</p>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </Shell>
  )
}

function ImportCards({ data, onCreateCards, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const [selectedDeckId, setSelectedDeckId] = useState(data.decks[0]?.id ?? '')
  const [importMode, setImportMode] = useState('qa')
  const [rawText, setRawText] = useState('')
  const [apkgImport, setApkgImport] = useState(null)
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [message, setMessage] = useState('')
  const parsedTextCards = useMemo(() => (
    importMode === 'markdown' ? parseMarkdownCards(rawText) : parseBulkCards(rawText)
  ), [importMode, rawText])
  const parsedCards = importMode === 'anki' ? (apkgImport?.cards ?? []) : parsedTextCards
  const ankiDeckSummaries = apkgImport?.deckSummaries ?? []

  useEffect(() => {
    if (!data.decks.find((deck) => deck.id === selectedDeckId)) {
      setSelectedDeckId(data.decks[0]?.id ?? '')
    }
  }, [data.decks, selectedDeckId])

  function handleImport() {
    if (!selectedDeckId && importMode !== 'anki') {
      setMessage('请先选择一个卡组。')
      return
    }
    if (parsedCards.length === 0) {
      setMessage('没有识别到可导入的卡片。')
      return
    }

    onCreateCards(selectedDeckId, parsedCards, { autoAnkiDecks: importMode === 'anki' })
    navigate('/browse', { state: { deckId: selectedDeckId } })
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const lowerName = file.name.toLowerCase()
    const isAnkiPackage = lowerName.endsWith('.apkg') || lowerName.endsWith('.colpkg')
    const isTextLike = file.type.startsWith('text/')
      || lowerName.endsWith('.md')
      || lowerName.endsWith('.csv')
      || lowerName.endsWith('.tsv')
      || lowerName.endsWith('.html')
      || lowerName.endsWith('.htm')

    if (isAnkiPackage) {
      const importId = `apkg-${Date.now()}`
      setImportMode('anki')
      setRawText('')
      setApkgImport(null)
      setIsParsingFile(true)
      setMessage('正在解析 Anki 包...')

      try {
        const result = await parseApkgFile(file, {
          importId,
        })
        setApkgImport(result)
        setMessage(`已解析 ${result.cards.length} 张 Anki 卡，将按 ${result.deckSummaries?.length || 1} 个原章节分组。图片、音频会跳过。`)
      } catch (error) {
        setMessage(error?.message || 'Anki 包解析失败。')
      } finally {
        setIsParsingFile(false)
      }
      return
    }

    if (!isTextLike) {
      setMessage('支持 .apkg/.colpkg、TXT、Markdown、CSV、TSV、HTML 文本；图片、PDF、Word 需要先由 AI/OCR 导出成文本。')
      return
    }

    setApkgImport(null)
    if (lowerName.endsWith('.md')) setImportMode('markdown')
    else if (importMode === 'anki') setImportMode('qa')
    setRawText(await file.text())
    setMessage(`已读取 ${file.name}`)
  }

  const selectedDeck = data.decks.find((deck) => deck.id === selectedDeckId)
  const qaSampleText = `Q: 辛亥革命爆发于哪一年？
A: 1911 年。

abandon => 放弃；丢弃
constraint\t限制；约束条件`
  const markdownSampleText = `### 辛亥革命爆发于哪一年？
1911 年。它推翻了清王朝统治，推动中国进入共和时代。
<!-- YANG-ID: xinhai-year -->

#### 死海有什么特点？ #anki-list
- 位置
  - 位于以色列和约旦之间
- 长度
  - 约 74 km
- 盐度
  - 约为海水的 7 倍
  - 密度较高，能让人漂浮`
  const sampleText = importMode === 'markdown' ? markdownSampleText : qaSampleText
  const importVerb = importMode === 'markdown' ? '同步' : '导入'
  const pageSubtitle = importMode === 'anki'
    ? '导入 Anki APKG/COLPKG，按原始牌组章节自动分组，并保留可安全显示的静态 HTML。'
    : importMode === 'markdown'
      ? '把 Markdown 标题同步成背诵卡，重复同步会更新原卡片。'
      : '把 AI 整理好的问题答案导入到一个卡组。'

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">批量导入</h1>
          <p className="text-sm text-gray-500 mt-1">{pageSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/decks')} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">取消</button>
          <button onClick={handleImport} className="h-10 px-5 rounded-xl bg-[#007aff] text-sm font-bold text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={parsedCards.length === 0 || isParsingFile}>
            {importVerb} {parsedCards.length} 张
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
        <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="h-10 rounded-xl bg-gray-100 p-1 flex items-center">
              {[
                { value: 'qa', label: '问答文本' },
                { value: 'markdown', label: 'Markdown' },
                { value: 'anki', label: 'Anki/APKG' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setImportMode(option.value)
                    setMessage('')
                  }}
                  className={`h-8 px-3 rounded-lg text-sm font-bold transition-colors ${importMode === option.value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
              {importMode === 'anki' ? '兜底卡组' : '卡组'}
              <select
                value={selectedDeckId}
                onChange={(event) => setSelectedDeckId(event.target.value)}
                className="h-10 w-72 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 outline-none focus:border-[#007aff] focus:bg-white"
              >
                <DeckSelectOptions decks={data.decks} />
              </select>
            </label>

            <label className="h-10 px-4 rounded-xl bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 cursor-pointer flex items-center gap-2">
              <Upload size={16} />
              读取文件
              <input type="file" accept=".apkg,.colpkg,.txt,.md,.csv,.tsv,.html,.htm,text/*,image/*,.pdf,.doc,.docx" onChange={handleFile} className="hidden" />
            </label>
            {message && <span className="text-xs font-bold text-gray-400">{message}</span>}
          </div>

          {importMode === 'anki' ? (
            <div className="min-h-[520px] bg-white px-5 py-5">
              {apkgImport ? (
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                    <p className="text-sm font-black text-blue-900">Anki 包已就绪</p>
                    <p className="mt-1 text-sm font-bold text-blue-700">
                      原始笔记 {apkgImport.noteCount} 条，卡片 {apkgImport.cardCount} 张，可导入 {apkgImport.cards.length} 张。
                    </p>
                    {ankiDeckSummaries.length > 0 && (
                      <p className="mt-2 text-xs font-bold text-blue-600">将按 Anki 原章节导入到 {ankiDeckSummaries.length} 个卡组。</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: '原始笔记', value: apkgImport.noteCount },
                      { label: '原始卡片', value: apkgImport.cardCount },
                      { label: '可导入', value: apkgImport.cards.length },
                      { label: '章节卡组', value: ankiDeckSummaries.length || 1 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl bg-gray-50 px-4 py-3">
                        <p className="text-2xl font-black text-gray-950">{item.value}</p>
                        <p className="mt-1 text-xs font-bold text-gray-400">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  {apkgImport.warnings.length > 0 && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                      <p className="mb-2 text-xs font-black text-amber-700">媒体提示</p>
                      <div className="space-y-1">
                        {apkgImport.warnings.slice(0, 6).map((warning) => (
                          <p key={warning} className="text-xs font-bold text-amber-700">{warning}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {ankiDeckSummaries.length > 0 && (
                    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                      <p className="mb-2 text-xs font-black text-gray-400">自动识别的章节</p>
                      <div className="grid gap-1.5">
                        {ankiDeckSummaries.slice(0, 10).map((summary) => (
                          <div key={summary.deckName} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                            <span className="min-w-0 truncate text-xs font-bold text-gray-700">{summary.deckPath?.join(' / ') || summary.deckName}</span>
                            <span className="shrink-0 text-xs font-black text-gray-400">{summary.count}</span>
                          </div>
                        ))}
                        {ankiDeckSummaries.length > 10 && (
                          <p className="px-1 text-[11px] font-bold text-gray-300">还有 {ankiDeckSummaries.length - 10} 个章节会一并导入。</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid min-h-[480px] place-items-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-center">
                  <div>
                    <Upload size={30} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-black text-gray-700">{isParsingFile ? '正在解析 Anki 包...' : '选择 .apkg 或 .colpkg 文件'}</p>
                    <p className="mt-2 max-w-md text-xs leading-6 text-gray-400">会读取 Anki 的模板 HTML、字段替换、FrontSide 和 cloze。图片、音频等媒体文件会跳过，不上传。</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <textarea
              value={rawText}
              onChange={(event) => {
                setRawText(event.target.value)
                setMessage('')
              }}
              placeholder={sampleText}
              className="min-h-[520px] w-full resize-none bg-white px-5 py-4 text-[15px] leading-7 text-gray-900 outline-none"
            />
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <p className="text-xs font-black text-gray-400 mb-2">{importMode === 'anki' ? '自动分组' : '目标卡组'}</p>
              {selectedDeck && (
                <span className="mb-2 inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-black text-gray-500">
                  <FolderOpen size={12} /> {getDeckPath(selectedDeck)}
                </span>
              )}
              <h2 className="text-lg font-black text-gray-950">{importMode === 'anki' ? '按 Anki 章节导入' : (selectedDeck?.name ?? '未选择')}</h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                {importMode === 'anki'
                  ? `会按 APKG 内部的 :: 章节路径创建或复用卡组；没有路径的卡片才会落入 ${selectedDeck?.name ?? '兜底卡组'}。`
                  : (selectedDeck?.description ?? '先创建一个卡组。')}
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <div className="p-5">
                <p className="text-xs font-bold text-gray-400 mb-1">识别</p>
                <p className="text-3xl font-black text-gray-950">{parsedCards.length}</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-bold text-gray-400 mb-1">{importMode === 'anki' ? '章节' : '现有'}</p>
                <p className="text-3xl font-black text-gray-950">{importMode === 'anki' ? (ankiDeckSummaries.length || 1) : data.cards.filter((card) => card.deckId === selectedDeckId).length}</p>
              </div>
            </div>
          </section>

          {importMode !== 'anki' && (
            <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center gap-2">
                <Wand2 size={16} className="text-[#007aff]" />
                <h2 className="text-sm font-black text-gray-950">给 AI 的提示词</h2>
              </div>
              <div className="p-5">
                <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-xs leading-6 text-gray-600">{importMode === 'markdown' ? `请把我的笔记整理成适合背诵的 Markdown。
用三级或四级标题写问题，标题下方写答案。
如果一个标题下面是多级列表，并且适合拆成小卡，请在标题后加 #anki-list。
可选：给稳定卡片加一行 <!-- YANG-ID: 唯一ID -->。
只输出 Markdown，不要解释。

${sampleText}` : `请从我上传的图片或文档中提取适合背诵的问答卡片。
只输出卡片，不要解释。
格式如下：

${sampleText}`}</pre>
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
            <div className="h-11 px-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-950">预览</h2>
              <span className="text-xs font-bold text-gray-400">前 8 张</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {parsedCards.length === 0 && <p className="text-sm text-gray-400 text-center py-10">暂无可导入卡片。</p>}
              {parsedCards.slice(0, 8).map((card, index) => (
                <div key={`${card.front}-${index}`} className="p-4 border-b border-gray-100">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-sm font-black text-gray-950 line-clamp-2 flex-1">{card.front}</p>
                    <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-400">{card.template === 'anki' ? 'Anki' : card.template === 'list' ? '列表' : card.sourceKey ? 'MD' : 'QA'}</span>
                  </div>
                  <div className="mt-1 line-clamp-3 text-xs text-gray-500">
                    <CardContent
                      card={card}
                      side="back"
                      className="text-xs text-gray-500 leading-relaxed"
                      fallbackClassName="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap"
                    />
                  </div>
                  {card.source?.path && <p className="mt-2 text-[11px] font-bold text-gray-300 line-clamp-1">{card.source.path.join(' / ')}</p>}
                  {card.source?.type === 'apkg' && <p className="mt-2 text-[11px] font-bold text-gray-300 line-clamp-1">{card.source.deckName} / {card.source.modelName} / {card.source.templateName}</p>}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </Shell>
  )
}

function AddCard({ data, onCreateCard, studyDeckId, cloud }) {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const initialDeckId = data.decks.find((deck) => deck.id === deckId)?.id ?? data.decks[0]?.id ?? ''
  const [form, setForm] = useState({ deckId: initialDeckId, template: 'qa', front: '', back: '', tags: '', favorite: false, flagged: false, comment: '', align: 'left' })
  const [error, setError] = useState('')
  const [expandedPane, setExpandedPane] = useState(null)
  const [showTags, setShowTags] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [showMoreTools, setShowMoreTools] = useState(false)
  const [previewRevealed, setPreviewRevealed] = useState(true)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const frontRef = useRef(null)
  const backRef = useRef(null)
  const imageFileInputRef = useRef(null)
  const activeEditorFieldRef = useRef('back')
  const [activeEditorField, setActiveEditorField] = useState('back')

  useEffect(() => {
    setForm((current) => ({ ...current, deckId: current.deckId || initialDeckId }))
  }, [initialDeckId])

  function updateForm(field, value) {
    setError('')
    setForm((current) => ({ ...current, [field]: value }))
  }

  function markActiveEditorField(field) {
    activeEditorFieldRef.current = field
    setActiveEditorField(field)
  }

  function getActiveEditorField() {
    return activeEditorFieldRef.current === 'front' ? 'front' : 'back'
  }

  const handleSave = useCallback(() => {
    const isHtmlTemplate = form.template === 'html'
    const front = form.front.trim()
    const back = form.back.trim()
    const frontText = isHtmlTemplate ? htmlToPlainText(front) || 'HTML 正面' : front
    const backText = isHtmlTemplate ? htmlToPlainText(back) || 'HTML 背面' : back

    if (!form.deckId) {
      setError('请先选择一个目录。')
      return
    }
    if (!front) {
      setError('问题不能为空。')
      return
    }
    if (!back) {
      setError('答案不能为空。')
      return
    }

    onCreateCard(form.deckId, {
      front: frontText,
      back: backText,
      template: form.template,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      favorite: form.favorite,
      flagged: form.flagged,
      comment: form.comment.trim(),
      align: form.align,
      ...(isHtmlTemplate ? { frontHtml: front, backHtml: back } : {}),
    })
    navigate('/decks')
  }, [form, navigate, onCreateCard])

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [handleSave])

  const currentDeckCards = data.cards.filter((card) => card.deckId === form.deckId)
  const previewItems = [
    {
      id: 'draft-card',
      front: form.template === 'html' ? htmlToPlainText(form.front) || '问题会显示在这里' : form.front || '问题会显示在这里',
      back: form.template === 'html' ? htmlToPlainText(form.back) || '答案会显示在这里' : form.back || '答案会显示在这里',
      frontHtml: form.template === 'html' ? form.front : '',
      backHtml: form.template === 'html' ? form.back : '',
      template: form.template,
      align: form.align,
      isDraft: true,
    },
    ...currentDeckCards,
  ]
  const activePreview = previewItems[Math.min(previewIndex, previewItems.length - 1)] ?? previewItems[0]
  const previewFront = activePreview.front
  const previewBack = activePreview.back
  const previewAlign = activePreview.align ?? 'left'
  const previewAlignClass = ({ left: 'text-left', center: 'text-center', right: 'text-right' })[previewAlign] ?? 'text-left'
  const alignLabel = ({ left: '左对齐', center: '居中', right: '右对齐' })[form.align] ?? '左对齐'
  const editorGridClass = expandedPane === 'editor'
    ? 'grid min-h-[680px] grid-cols-1 gap-5'
    : expandedPane === 'preview'
      ? 'grid min-h-[680px] grid-cols-1 gap-5'
      : 'grid min-h-[680px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] gap-5'
  const editorHidden = expandedPane === 'preview'
  const previewHidden = expandedPane === 'editor'

  function setSelectionText(field, nextText, nextSelectionStart = null, nextSelectionEnd = null) {
    markActiveEditorField(field)
    updateForm(field, nextText)
    window.requestAnimationFrame(() => {
      const ref = field === 'front' ? frontRef : backRef
      ref.current?.focus()
      if (nextSelectionStart !== null && nextSelectionEnd !== null) {
        ref.current?.setSelectionRange(nextSelectionStart, nextSelectionEnd)
      }
    })
  }

  function insertIntoField(field, before, after = '', placeholder = '') {
    const ref = field === 'front' ? frontRef.current : backRef.current
    const value = form[field] ?? ''
    const start = ref?.selectionStart ?? value.length
    const end = ref?.selectionEnd ?? value.length
    const selected = value.slice(start, end) || placeholder
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
    const cursorStart = start + before.length
    const cursorEnd = cursorStart + selected.length
    setSelectionText(field, next, cursorStart, cursorEnd)
  }

  function insertLinePrefix(prefix, numbered = false) {
    const field = getActiveEditorField()
    const ref = field === 'front' ? frontRef.current : backRef.current
    const value = form[field] ?? ''
    const start = ref?.selectionStart ?? value.length
    const end = ref?.selectionEnd ?? value.length
    const selected = value.slice(start, end) || (field === 'front' ? '新问题' : '新条目')
    const lines = selected.split('\n').map((line, index) => `${numbered ? `${index + 1}. ` : prefix}${line.replace(/^[-*\d.)\s]+/, '')}`)
    const next = `${value.slice(0, start)}${lines.join('\n')}${value.slice(end)}`
    setSelectionText(field, next, start, start + lines.join('\n').length)
  }

  function insertVideoLink() {
    const url = window.prompt('输入视频 URL')
    if (!url?.trim()) return
    const label = window.prompt('视频标题')?.trim() || '视频'
    const snippet = `[${label}](${url.trim()})`
    insertIntoField(getActiveEditorField(), snippet, '', '')
    setStatusMessage('已插入视频链接')
  }

  async function handleImageFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const imageUrl = await compressImageFile(file, { maxSize: 1000, quality: 0.76 })
      const label = file.name.replace(/\.[^.]+$/, '') || '图片'
      insertIntoField(getActiveEditorField(), `![${label}](${imageUrl})`, '', '')
      setStatusMessage('已插入本机图片')
    } catch (error) {
      setStatusMessage(error?.message || '图片读取失败')
    }
  }

  function applyEditorTool(tool) {
    const field = getActiveEditorField()
    const actions = {
      bold: () => insertIntoField(field, '**', '**', '加粗内容'),
      underline: () => insertIntoField(field, '<u>', '</u>', '下划线内容'),
      italic: () => insertIntoField(field, '*', '*', '斜体内容'),
      strike: () => insertIntoField(field, '~~', '~~', '删除线内容'),
      list: () => insertLinePrefix('- '),
      ordered: () => insertLinePrefix('', true),
      image: () => imageFileInputRef.current?.click(),
      video: () => insertVideoLink(),
      align: () => {
        const nextAlign = form.align === 'left' ? 'center' : form.align === 'center' ? 'right' : 'left'
        updateForm('align', nextAlign)
        setStatusMessage(`预览已切换为${({ left: '左对齐', center: '居中', right: '右对齐' })[nextAlign]}`)
      },
    }
    actions[tool]?.()
  }

  function speakPreview() {
    const text = `${previewFront}。${previewBack}`.trim()
    if (!text || !window.speechSynthesis) {
      setStatusMessage('当前浏览器不支持朗读')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = /[\u4e00-\u9fa5]/.test(text) ? 'zh-CN' : 'en-US'
    window.speechSynthesis.speak(utterance)
    setStatusMessage('正在朗读预览内容')
  }

  function insertParagraphTemplate() {
    insertIntoField(getActiveEditorField(), '\n\n', '', '新的段落')
  }

  function insertQuickBlock(type) {
    const snippets = {
      rule: '【规则】\n【适用条件】\n【例外】\n【易错】',
      compare: '【对比】\nA：\nB：\n区别：',
      case: '【案例】\n事实：\n争点：\n结论：',
      cloze: '{{c1::需要记住的内容}}',
    }
    insertIntoField(getActiveEditorField(), snippets[type] ?? '', '', '')
    setShowMoreTools(false)
  }

  function movePreview(direction) {
    setPreviewRevealed(true)
    setPreviewIndex((current) => {
      const next = current + direction
      if (next < 0) return previewItems.length - 1
      if (next >= previewItems.length) return 0
      return next
    })
  }

  const editorTools = [
    { icon: Bold, label: '加粗', action: 'bold' },
    { icon: Underline, label: '下划线', action: 'underline' },
    { icon: Italic, label: '斜体', action: 'italic' },
    { icon: Strikethrough, label: '删除线', action: 'strike' },
    { icon: List, label: '项目列表', action: 'list' },
    { icon: ListOrdered, label: '编号列表', action: 'ordered' },
    { icon: Image, label: '插入图片', action: 'image' },
    { icon: Video, label: '插入视频', action: 'video' },
    { icon: AlignLeft, label: alignLabel, action: 'align' },
  ]

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">添加卡片</h1>
          <p className="text-sm text-gray-500 mt-1">编辑正面与背面，右侧实时预览。</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate('/decks')} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">取消</button>
          <button type="button" onClick={handleSave} className="h-10 px-5 rounded-xl bg-[#007aff] text-sm font-bold text-white shadow-sm hover:bg-[#006ee6]">保存</button>
        </div>
      </header>

      <div className={editorGridClass}>
        {!editorHidden && <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
                目录
                <select
                  value={form.deckId}
                  onChange={(event) => updateForm('deckId', event.target.value)}
                  className="h-10 w-72 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 outline-none focus:border-[#007aff] focus:bg-white"
                >
                  {data.decks.length === 0 && <option value="">选择目录</option>}
                  <DeckSelectOptions decks={data.decks} />
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
                模板
                <select
                  value={form.template}
                  onChange={(event) => updateForm('template', event.target.value)}
                  className="h-10 w-36 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 outline-none focus:border-[#007aff] focus:bg-white"
                >
                  <option value="qa">问答题</option>
                  <option value="cloze">填空题</option>
                  <option value="note">摘录题</option>
                  <option value="html">HTML</option>
                </select>
              </label>
            </div>

            <button type="button" onClick={() => setExpandedPane((current) => current === 'editor' ? null : 'editor')} title={expandedPane === 'editor' ? '恢复双栏' : '扩展编辑区'} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg">
              <Maximize2 size={16} />
            </button>
          </div>

          <div className="p-5 flex-1 flex flex-col gap-4">
            <label className="block">
              <span className="block text-xs font-black text-gray-400 mb-2">问题</span>
              <textarea
                ref={frontRef}
                value={form.front}
                onChange={(event) => {
                  markActiveEditorField('front')
                  updateForm('front', event.target.value)
                }}
                onFocus={() => markActiveEditorField('front')}
                onClick={() => markActiveEditorField('front')}
                className="min-h-[170px] w-full resize-none rounded-2xl bg-gray-50 px-4 py-4 text-lg leading-relaxed outline-none focus:ring-2 focus:ring-[#007aff]/20"
                placeholder="输入问题"
              />
            </label>

            <div className="rounded-2xl bg-gray-50 overflow-hidden flex-1 flex flex-col">
              <div className="h-11 bg-white/80 border-b border-gray-100 flex items-center gap-1 px-3 text-gray-400">
                <span className="mr-1 rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-black text-gray-400">
                  {activeEditorField === 'front' ? '编辑问题' : '编辑答案'}
                </span>
                <button type="button" onClick={insertParagraphTemplate} className="h-8 px-2 text-sm font-bold text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">段落</button>
                {editorTools.map(({ icon: Icon, label, action }) => (
                  <button key={action} type="button" onClick={() => applyEditorTool(action)} title={label} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 hover:text-gray-700 rounded-lg">
                    <Icon size={16} />
                  </button>
                ))}
                <input ref={imageFileInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                <button type="button" onClick={() => setShowMoreTools((current) => !current)} title={showMoreTools ? '收起更多工具' : '更多'} aria-pressed={showMoreTools} className="ml-auto w-8 h-8 flex items-center justify-center hover:bg-gray-100 hover:text-gray-700 rounded-lg">
                  <MoreVertical size={16} />
                </button>
              </div>
              {showMoreTools && (
                <div className="border-b border-gray-100 bg-white/70 px-3 py-2 flex flex-wrap gap-2">
                  {[
                    { key: 'rule', label: '规则模板' },
                    { key: 'compare', label: '对比模板' },
                    { key: 'case', label: '案例模板' },
                    { key: 'cloze', label: '填空标记' },
                  ].map((item) => (
                    <button key={item.key} type="button" onClick={() => insertQuickBlock(item.key)} className="h-8 rounded-lg bg-gray-100 px-3 text-xs font-bold text-gray-600 hover:bg-gray-200">
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={backRef}
                value={form.back}
                onChange={(event) => {
                  markActiveEditorField('back')
                  updateForm('back', event.target.value)
                }}
                onFocus={() => markActiveEditorField('back')}
                onClick={() => markActiveEditorField('back')}
                className="min-h-[210px] flex-1 w-full resize-none bg-gray-50 px-4 py-4 text-lg leading-relaxed outline-none"
                placeholder="输入答案"
              />
            </div>

            {showTags && (
              <label className="block">
                <span className="block text-xs font-black text-gray-400 mb-2">标签</span>
                <input
                  value={form.tags}
                  onChange={(event) => updateForm('tags', event.target.value)}
                  placeholder="用逗号分隔，例如：民法, 易错, 形成权"
                  className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-[#007aff] focus:bg-white"
                />
              </label>
            )}

            {showSettings && (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <label className="flex items-center gap-2 font-bold text-gray-700">
                    <input type="checkbox" checked={form.favorite} onChange={(event) => updateForm('favorite', event.target.checked)} />
                    收藏保存
                  </label>
                  <label className="flex items-center gap-2 font-bold text-gray-700">
                    <input type="checkbox" checked={form.flagged} onChange={(event) => updateForm('flagged', event.target.checked)} />
                    标记重点
                  </label>
                  <label className="flex items-center gap-2 font-bold text-gray-700">
                    对齐
                    <select value={form.align} onChange={(event) => updateForm('align', event.target.value)} className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs">
                      <option value="left">左</option>
                      <option value="center">中</option>
                      <option value="right">右</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            {showComment && (
              <label className="block">
                <span className="block text-xs font-black text-gray-400 mb-2">评论</span>
                <textarea
                  value={form.comment}
                  onChange={(event) => updateForm('comment', event.target.value)}
                  placeholder="写下这张卡的制卡理由、易错提醒或待补充点"
                  className="min-h-[90px] w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:border-[#007aff] focus:bg-white"
                />
              </label>
            )}

            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => setShowTags((current) => !current)} aria-pressed={showTags} className="text-sm font-bold text-[#007aff] hover:text-[#006ee6]">{showTags ? '收起标签' : '添加标签'}</button>
              <div className="flex items-center gap-3">
                {statusMessage && <p className="text-xs font-bold text-green-600">{statusMessage}</p>}
                {error && <p className="text-xs font-bold text-red-500">{error}</p>}
                <button type="button" onClick={() => setShowSettings((current) => !current)} title={showSettings ? '收起设置' : '设置'} aria-pressed={showSettings} className={`w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-lg ${showSettings ? 'text-[#007aff]' : 'text-gray-300 hover:text-gray-500'}`}>
                  <Settings size={18} />
                </button>
                <button type="button" onClick={handleSave} className="h-9 w-[150px] rounded-xl bg-[#34c759] text-sm font-bold text-white shadow-sm hover:bg-[#30b454]">
                  保存(Ctrl+S)
                </button>
              </div>
            </div>
          </div>
        </section>}

        {!previewHidden && <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden flex flex-col">
          <div className="h-12 px-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">预览</h2>
            <button type="button" onClick={() => setExpandedPane((current) => current === 'preview' ? null : 'preview')} title={expandedPane === 'preview' ? '恢复双栏' : '扩展预览区'} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg">
              <Maximize2 size={16} />
            </button>
          </div>

          <div className="flex-1 p-8 flex flex-col">
            <div className={`flex-1 ${previewAlignClass}`}>
              <div className="mb-4 flex items-center justify-between gap-3 text-xs font-bold text-gray-300">
                <span>{activePreview.isDraft ? '当前草稿' : '已有卡片预览'}</span>
                <span>{previewIndex + 1}/{previewItems.length}</span>
              </div>
              <CardContent
                card={activePreview}
                side="front"
                className={`text-2xl leading-relaxed font-black break-words ${activePreview.front ? 'text-gray-950' : 'text-gray-300'}`}
                fallbackClassName={`text-2xl leading-relaxed font-black break-words whitespace-pre-wrap ${activePreview.front ? 'text-gray-950' : 'text-gray-300'}`}
              />
              <div className="my-8 h-px bg-gray-200" />
              {previewRevealed ? (
                <CardContent
                  card={activePreview}
                  side="back"
                  className={`text-lg leading-relaxed break-words ${activePreview.back ? 'text-gray-800' : 'text-gray-300'}`}
                  fallbackClassName={`text-lg leading-relaxed break-words whitespace-pre-wrap ${activePreview.back ? 'text-gray-800' : 'text-gray-300'}`}
                />
              ) : (
                <p className="text-lg font-bold text-gray-300">答案已隐藏</p>
              )}
              {activePreview.isDraft && form.tags.trim() && <p className="mt-6 text-xs font-bold text-gray-400">标签：{form.tags}</p>}
              {activePreview.isDraft && form.comment.trim() && <p className="mt-3 rounded-xl bg-gray-50 p-3 text-left text-xs leading-relaxed text-gray-500">评论：{form.comment}</p>}
              {activePreview.isDraft && (form.favorite || form.flagged) && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                  {form.favorite && <span className="rounded-lg bg-yellow-50 px-2 py-1 text-yellow-700">已收藏</span>}
                  {form.flagged && <span className="rounded-lg bg-red-50 px-2 py-1 text-red-600">重点标记</span>}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-end gap-4 text-gray-300 mb-5">
                <button type="button" onClick={speakPreview} title="朗读" className="hover:text-gray-500"><Volume2 size={18} /></button>
                <button type="button" onClick={() => updateForm('favorite', !form.favorite)} title={form.favorite ? '取消收藏' : '收藏'} aria-pressed={form.favorite} className={form.favorite ? 'text-yellow-500' : 'hover:text-gray-500'}><Star size={18} fill={form.favorite ? 'currentColor' : 'none'} /></button>
                <button type="button" onClick={() => updateForm('flagged', !form.flagged)} title={form.flagged ? '取消标记' : '标记'} aria-pressed={form.flagged} className={form.flagged ? 'text-red-500' : 'hover:text-gray-500'}><Flag size={18} fill={form.flagged ? 'currentColor' : 'none'} /></button>
                <button type="button" onClick={() => setShowComment((current) => !current)} title={showComment ? '收起评论' : '评论'} aria-pressed={showComment || Boolean(form.comment.trim())} className={showComment || form.comment.trim() ? 'text-[#007aff]' : 'hover:text-gray-500'}><MessageSquare size={18} /></button>
                <button type="button" onClick={() => setShowSettings((current) => !current)} title={showSettings ? '收起设置' : '设置'} aria-pressed={showSettings} className={showSettings ? 'text-[#007aff]' : 'hover:text-gray-500'}><Settings size={18} /></button>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div />
                <button type="button" onClick={() => setPreviewRevealed((current) => !current)} className="h-10 w-[150px] rounded-xl bg-[#ff9f0a] text-sm font-bold text-white hover:bg-[#f59600]">
                  {previewRevealed ? '隐藏答案' : '显示答案'}
                </button>
                <div className="flex items-center justify-end gap-3 text-sm text-gray-700">
                  <button type="button" onClick={() => movePreview(-1)} className="h-8 px-3 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1">
                    <ChevronLeft size={14} /> 上一张
                  </button>
                  <span className="font-bold">{previewIndex + 1}/{previewItems.length}</span>
                  <button type="button" onClick={() => movePreview(1)} className="h-8 px-3 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1">
                    下一张 <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>}
      </div>
    </Shell>
  )
}

function Study({ data, onReviewCard, studyDeckId, cloud }) {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const [revealed, setRevealed] = useState(false)
  const [session, setSession] = useState({ reviewed: 0, grades: { 0: 0, 1: 0, 2: 0, 3: 0 } })
  const [studyMode, setStudyMode] = useState('due')
  const [drillScope, setDrillScope] = useState('deck')
  const [drillSeed, setDrillSeed] = useState(() => Math.random())
  const [drillTargetDeckId, setDrillTargetDeckId] = useState(deckId ?? '')
  const [drillTargetChapterKey, setDrillTargetChapterKey] = useState('')
  const [dismissedDrillCardIds, setDismissedDrillCardIds] = useState(() => new Set())
  const canGradeRef = useRef(false)
  const deck = data.decks.find((item) => item.id === deckId) ?? data.decks[0]
  const today = todayKey()
  const deckById = useMemo(() => new Map(data.decks.map((item) => [item.id, item])), [data.decks])
  const masteredTodayCardIds = useMemo(() => new Set(getReviewLogs(data)
    .filter((log) => log.grade >= 2 && log.reviewedAt && new Date(log.reviewedAt).toISOString().slice(0, 10) === today)
    .map((log) => log.cardId)), [data, today])

  const studyCards = useMemo(() => {
    if (!deck) return []
    return data.cards
      .filter((card) => card.deckId === deck.id)
      .sort((a, b) => (a.review?.dueDate ?? today).localeCompare(b.review?.dueDate ?? today))
  }, [data.cards, deck, today])

  const drillDeckOptions = useMemo(() => sortDecksByPath(data.decks).map((item) => ({
    id: item.id,
    label: getDeckOptionLabel(item),
    count: data.cards.filter((card) => card.deckId === item.id).length,
  })).filter((item) => item.count > 0), [data.cards, data.decks])

  const drillChapterOptions = useMemo(() => {
    const chapters = new Map()
    for (const item of sortDecksByPath(data.decks)) {
      const key = getDeckChapterKey(item)
      const current = chapters.get(key) ?? {
        value: key,
        label: getDeckChapterLabel(item),
        deckIds: [],
        count: 0,
      }
      const count = data.cards.filter((card) => card.deckId === item.id).length
      current.deckIds.push(item.id)
      current.count += count
      chapters.set(key, current)
    }
    return Array.from(chapters.values()).filter((item) => item.count > 0)
  }, [data.cards, data.decks])

  useEffect(() => {
    if (!deck) return
    setDrillTargetDeckId(deck.id)
    setDrillTargetChapterKey(getDeckChapterKey(deck))
  }, [deck?.id, deck])

  useEffect(() => {
    setDismissedDrillCardIds(new Set())
  }, [today])

  useEffect(() => {
    if (drillTargetDeckId && drillDeckOptions.some((item) => item.id === drillTargetDeckId)) return
    setDrillTargetDeckId(drillDeckOptions[0]?.id ?? '')
  }, [drillDeckOptions, drillTargetDeckId])

  useEffect(() => {
    if (drillTargetChapterKey && drillChapterOptions.some((item) => item.value === drillTargetChapterKey)) return
    setDrillTargetChapterKey(drillChapterOptions[0]?.value ?? '')
  }, [drillChapterOptions, drillTargetChapterKey])

  const drillCards = useMemo(() => {
    const isAvailableForDrill = (card) => !dismissedDrillCardIds.has(card.id) && !masteredTodayCardIds.has(card.id)

    if (drillScope === 'all') return [...data.cards]
      .filter(isAvailableForDrill)
      .sort((a, b) => String(a.front).localeCompare(String(b.front), 'zh-CN'))

    if (drillScope === 'chapter') {
      const target = drillChapterOptions.find((item) => item.value === drillTargetChapterKey)
      const targetDeckIds = new Set(target?.deckIds ?? [])
      return data.cards
        .filter((card) => targetDeckIds.has(card.deckId))
        .filter(isAvailableForDrill)
        .sort((a, b) => String(a.front).localeCompare(String(b.front), 'zh-CN'))
    }

    const targetDeckId = drillTargetDeckId || deck?.id
    return data.cards
      .filter((card) => card.deckId === targetDeckId)
      .filter(isAvailableForDrill)
      .sort((a, b) => String(a.front).localeCompare(String(b.front), 'zh-CN'))
  }, [data.cards, deck?.id, dismissedDrillCardIds, drillChapterOptions, drillScope, drillTargetChapterKey, drillTargetDeckId, masteredTodayCardIds])

  const drillCard = useMemo(() => {
    if (drillCards.length === 0) return null
    return drillCards[Math.floor(drillSeed * drillCards.length) % drillCards.length]
  }, [drillCards, drillSeed])

  const queue = studyCards.filter((card) => (card.review?.dueDate ?? today) <= today)
  const dueCard = queue[0] ?? null
  const activeCard = studyMode === 'drill' ? drillCard : dueCard ?? drillCard
  const activeReview = activeCard?.review ?? { dueDate: today, interval: 0, ease: 2.5, reps: 0, lapses: 0, lastGrade: null }
  const activeDeckPath = deck ? getDeckPath(deck) : ''
  const activeCardDeck = activeCard ? deckById.get(activeCard.deckId) : null
  const activeCardDeckLabel = activeCardDeck ? getDeckOptionLabel(activeCardDeck) : activeDeckPath
  const reviewedCards = studyCards.filter((card) => (card.review?.reps ?? 0) > 0).length
  const masteredCards = studyCards.filter((card) => (card.review?.interval ?? 0) >= 7).length
  const newCards = studyCards.filter((card) => (card.review?.reps ?? 0) === 0).length
  const remainingInSession = studyMode === 'drill' ? (activeCard ? 1 : 0) : queue.length || (activeCard ? 1 : 0)
  const sessionTotal = session.reviewed + remainingInSession
  const progressPercent = sessionTotal > 0 ? Math.min(100, Math.round((session.reviewed / sessionTotal) * 100)) : 0
  const activeIsDrill = Boolean(activeCard && (studyMode === 'drill' || !dueCard))
  const lastGrade = STUDY_GRADE_OPTIONS.find((option) => option.grade === activeReview.lastGrade)

  useEffect(() => {
    setRevealed(false)
  }, [activeCard?.id])

  useEffect(() => {
    canGradeRef.current = Boolean(activeCard && revealed)
  }, [activeCard, revealed])

  useEffect(() => {
    setSession({ reviewed: 0, grades: { 0: 0, 1: 0, 2: 0, 3: 0 } })
  }, [deck?.id])

  function drawDrillCard() {
    setStudyMode('drill')
    setRevealed(false)
    setDrillSeed(Math.random())
  }

  function updateDrillScope(nextScope) {
    setDrillScope(nextScope)
    setStudyMode('drill')
    setRevealed(false)
    setDrillSeed(Math.random())
  }

  const handleGrade = useCallback((grade) => {
    if (!activeCard) return
    if (!canGradeRef.current) return
    canGradeRef.current = false
    onReviewCard(activeCard.id, grade)
    if (grade >= 2) {
      setDismissedDrillCardIds((current) => new Set([...current, activeCard.id]))
    }
    setSession((current) => ({
      reviewed: current.reviewed + 1,
      grades: {
        ...current.grades,
        [grade]: (current.grades[grade] ?? 0) + 1,
      },
    }))
    setRevealed(false)
    if (activeIsDrill) setDrillSeed(Math.random())
  }, [activeCard, activeIsDrill, onReviewCard])

  useEffect(() => {
    function handleStudyShortcut(event) {
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (!activeCard) return

      if ((event.key === ' ' || event.key === 'Enter') && !revealed) {
        event.preventDefault()
        setRevealed(true)
        return
      }

      if (!revealed) return
      const grade = Number(event.key) - 1
      if (grade >= 0 && grade <= 3) {
        event.preventDefault()
        handleGrade(grade)
      }
    }

    window.addEventListener('keydown', handleStudyShortcut)
    return () => window.removeEventListener('keydown', handleStudyShortcut)
  }, [activeCard, handleGrade, revealed])

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">{deck?.name ?? '学习模式'}</h1>
          <p className="text-xs text-gray-500 mt-1">{activeDeckPath || '还没有可学习的卡组'} · 待复习 {queue.length}，本牌组 {studyCards.length} 张。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={drawDrillCard} className="h-10 px-4 rounded-xl bg-[#34c759] text-sm font-bold text-white shadow-sm hover:bg-[#30b454]" disabled={drillCards.length === 0}>抽背</button>
          <button onClick={() => deck && navigate(`/cards/new/${deck.id}`)} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50" disabled={!deck}>添加</button>
          <button onClick={() => navigate('/decks')} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">结束</button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full">
        <section className="mb-4 rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
            {[
              { label: '本轮', value: session.reviewed, detail: sessionTotal ? `${progressPercent}%` : '待开始' },
              { label: '到期', value: queue.length, detail: activeIsDrill ? '抽背中' : '当前队列' },
              { label: '已学', value: reviewedCards, detail: `${newCards} 张新卡` },
              { label: '稳固', value: masteredCards, detail: '间隔 7 天+' },
            ].map((item) => (
              <div key={item.label} className="px-4 py-3">
                <p className="text-[11px] font-black text-gray-300">{item.label}</p>
                <p className="mt-1 text-2xl font-black text-gray-950">{item.value}</p>
                <p className="mt-0.5 text-[11px] font-bold text-gray-400">{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="h-1 bg-gray-100">
            <div className="h-full bg-[#34c759] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </section>

        <section className="mb-4 rounded-2xl bg-white/90 border border-white shadow-sm p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-950">抽背卡片</h2>
              <p className="mt-1 text-xs font-bold text-gray-400">不等到期也能复习，评分后同样会写入记忆曲线。</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-xl bg-gray-100 p-1 text-xs font-black">
                <button
                  type="button"
                  onClick={() => setStudyMode('due')}
                  className={`h-8 rounded-lg px-3 ${studyMode === 'due' ? 'bg-white text-[#007aff] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  到期
                </button>
                <button
                  type="button"
                  onClick={() => setStudyMode('drill')}
                  className={`h-8 rounded-lg px-3 ${studyMode === 'drill' ? 'bg-white text-[#007aff] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                  disabled={drillCards.length === 0}
                >
                  抽背
                </button>
              </div>

              <select
                value={drillScope}
                onChange={(event) => updateDrillScope(event.target.value)}
                className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-blue-400"
              >
                <option value="all">全库随机</option>
                <option value="chapter">指定章节</option>
                <option value="deck">指定卡组</option>
              </select>

              {drillScope === 'chapter' && (
                <select
                  value={drillTargetChapterKey}
                  onChange={(event) => {
                    setDrillTargetChapterKey(event.target.value)
                    drawDrillCard()
                  }}
                  className="h-9 min-w-[180px] rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-blue-400"
                >
                  {drillChapterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label} · {option.count}</option>
                  ))}
                </select>
              )}

              {drillScope === 'deck' && (
                <select
                  value={drillTargetDeckId}
                  onChange={(event) => {
                    setDrillTargetDeckId(event.target.value)
                    drawDrillCard()
                  }}
                  className="h-9 min-w-[180px] rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-blue-400"
                >
                  {drillDeckOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label} · {option.count}</option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={drawDrillCard}
                className="h-9 rounded-xl bg-gray-900 px-4 text-xs font-black text-white hover:bg-gray-800 disabled:bg-gray-300"
                disabled={drillCards.length === 0}
              >
                抽一张
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-400">
            <span className="rounded-lg bg-gray-100 px-2 py-1">当前抽背池 {drillCards.length} 张</span>
            <span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-700">Good/Easy 当天不再出现</span>
            {activeIsDrill && <span className="rounded-lg bg-green-50 px-2 py-1 text-green-700">正在抽背：{activeCardDeckLabel}</span>}
          </div>
        </section>

        {!activeCard && (
          <div className="rounded-2xl bg-white/90 border border-white shadow-sm p-16 text-center">
            <p className="text-sm text-gray-400 mb-4">当前范围还没有可抽背的卡片。</p>
            {data.cards.length > 0 && <p className="mb-5 text-xs font-bold text-gray-300">今天已经点过 Good/Easy 的卡会留到明天或下次到期再出现。</p>}
            {deck && <button onClick={() => navigate(`/cards/new/${deck.id}`)} className="h-10 px-4 rounded-xl bg-[#007aff] text-white text-sm font-bold hover:bg-[#006ee6]">添加第一张卡</button>}
          </div>
        )}
        {activeCard && (
          <motion.div key={activeCard.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white/90 border border-white shadow-sm mb-4 min-h-[460px] flex flex-col text-center overflow-hidden">
            <div className="h-10 border-b border-gray-200 px-4 flex items-center justify-between gap-3 text-xs text-gray-400">
              <span>{activeIsDrill ? 'Drill' : 'Front'}</span>
              <span className="truncate text-right">{activeCardDeckLabel} · 到期 {activeReview.dueDate}</span>
            </div>

            <div className="flex-1 p-10 flex flex-col justify-center">
              <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-xs font-black">
                {activeCard.favorite && <span className="rounded-lg bg-yellow-50 px-2 py-1 text-yellow-700">收藏</span>}
                {activeCard.flagged && <span className="rounded-lg bg-red-50 px-2 py-1 text-red-600">重点</span>}
                {lastGrade && <span className={`rounded-lg px-2 py-1 ${lastGrade.badgeClass}`}>上次 {lastGrade.title}</span>}
                {activeCard.tags?.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-lg bg-gray-100 px-2 py-1 text-gray-500">{tag}</span>
                ))}
              </div>
              <CardContent
                card={activeCard}
                side="front"
                className="mx-auto max-w-full text-3xl font-black text-gray-950 leading-relaxed break-words"
                fallbackClassName="mx-auto max-w-full text-3xl font-black text-gray-950 leading-relaxed break-words whitespace-pre-wrap"
              />

              {!revealed ? (
                <button type="button" onClick={() => setRevealed(true)} title="显示答案" className="mt-12 mx-auto h-11 w-[170px] rounded-xl bg-[#ff9f0a] text-white text-sm font-bold hover:bg-[#f59600]">显示答案</button>
              ) : (
                <div className="mt-10 pt-8 border-t border-gray-200">
                  <p className="text-xs font-bold text-gray-400 mb-4">Back</p>
                  <CardContent
                    card={activeCard}
                    side="back"
                    className="mx-auto max-w-full text-xl text-gray-800 leading-relaxed break-words"
                    fallbackClassName="mx-auto max-w-full text-xl text-gray-800 leading-relaxed break-words whitespace-pre-wrap"
                  />
                  {activeCard.comment && <p className="mt-5 rounded-xl bg-gray-50 px-4 py-3 text-left text-sm leading-relaxed text-gray-500">{activeCard.comment}</p>}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {revealed && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {STUDY_GRADE_OPTIONS.map((option) => (
              <button
                key={option.grade}
                type="button"
                onClick={() => handleGrade(option.grade)}
                title={option.title}
                className={`min-h-16 rounded-xl border px-3 py-3 text-left font-black transition-colors ${option.className}`}
              >
                <span className="block text-base">{option.label}</span>
                <span className="mt-1 block text-xs opacity-75">{option.detail}</span>
                <span className="mt-2 block text-[11px] opacity-60">{option.result} · {session.grades[option.grade] ?? 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}

export default function App() {
  const location = useLocation()
  const initial = useMemo(() => loadData(), [])
  const [data, setData] = useState(initial)
  const [deckDialog, setDeckDialog] = useState({ open: false, mode: 'create', deck: null })
  const cloud = useCloudSync(data, setData)
  const studyDeckId = data.decks[0]?.id ?? null
  const focusSessionRef = useRef(null)
  const lastActiveAtRef = useRef(Date.now())
  const lastActivityTickAtRef = useRef(Date.now())
  const activeStudyDeckId = useMemo(() => {
    const match = location.pathname.match(/^\/study\/([^/]+)/)
    return match?.[1] ?? null
  }, [location.pathname])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!activeStudyDeckId) {
      focusSessionRef.current = null
      return
    }
    if (focusSessionRef.current === activeStudyDeckId) return
    focusSessionRef.current = activeStudyDeckId
    setData((current) => addFocusSession(current, activeStudyDeckId))
  }, [activeStudyDeckId])

  useEffect(() => {
    function markActive() {
      lastActiveAtRef.current = Date.now()
    }

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach((eventName) => window.addEventListener(eventName, markActive, { passive: true }))
    return () => events.forEach((eventName) => window.removeEventListener(eventName, markActive))
  }, [])

  useEffect(() => {
    lastActivityTickAtRef.current = Date.now()
  }, [activeStudyDeckId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const tickedAt = Date.now()
      const deltaSeconds = Math.max(1, Math.min(ACTIVITY_TICK_SECONDS, Math.floor((tickedAt - lastActivityTickAtRef.current) / 1000)))
      lastActivityTickAtRef.current = tickedAt
      if (tickedAt - lastActiveAtRef.current > ACTIVITY_IDLE_TIMEOUT_MS) return

      setData((current) => {
        const trackedDeckId = activeStudyDeckId && current.decks.some((deck) => deck.id === activeStudyDeckId) ? activeStudyDeckId : null
        return addActivitySeconds(current, deltaSeconds, trackedDeckId)
      })
    }, ACTIVITY_TICK_SECONDS * 1000)

    return () => window.clearInterval(timer)
  }, [activeStudyDeckId])

  function openCreateDeckDialog(initialValue = null) {
    setDeckDialog({ open: true, mode: 'create', deck: initialValue })
  }

  function openEditDeckDialog(deck) {
    setDeckDialog({ open: true, mode: 'edit', deck })
  }

  function closeDeckDialog() {
    setDeckDialog((current) => ({ ...current, open: false }))
  }

  function submitDeck(formValue) {
    startTransition(() => {
      setData((current) => {
        if (deckDialog.mode === 'edit' && deckDialog.deck) {
          return {
            ...current,
            decks: current.decks.map((deck) => deck.id === deckDialog.deck.id ? { ...deck, ...formValue } : deck),
          }
        }

        return {
          ...current,
          decks: [
            ...current.decks,
            {
              id: `deck-${Date.now()}`,
              createdAt: Date.now(),
              ...formValue,
            },
          ],
        }
      })
    })
    closeDeckDialog()
  }

  function deleteDeck(deckId) {
    startTransition(() => {
      setData((current) => ({
        ...current,
        decks: current.decks.filter((deck) => deck.id !== deckId),
        cards: current.cards.filter((card) => card.deckId !== deckId),
        reviewLogs: current.reviewLogs.filter((log) => {
          const card = current.cards.find((item) => item.id === log.cardId)
          return card ? card.deckId !== deckId : true
        }),
      }))
    })
  }

  function createCard(deckId, cardValue = {}) {
    startTransition(() => {
      setData((current) => ({
        ...current,
        cards: [
          {
            id: `card-${Date.now()}`,
            deckId,
            front: cardValue.front ?? '新建问题',
            back: cardValue.back ?? '把这里替换成答案或解释。',
            template: cardValue.template ?? 'qa',
            tags: cardValue.tags ?? [],
            favorite: Boolean(cardValue.favorite),
            flagged: Boolean(cardValue.flagged),
            comment: cardValue.comment ?? '',
            align: cardValue.align ?? 'left',
            ...(cardValue.frontHtml ? { frontHtml: cardValue.frontHtml } : {}),
            ...(cardValue.backHtml ? { backHtml: cardValue.backHtml } : {}),
            ...(cardValue.cardCss ? { cardCss: cardValue.cardCss } : {}),
            ...(cardValue.sourceKey ? { sourceKey: cardValue.sourceKey } : {}),
            ...(cardValue.source ? { source: cardValue.source } : {}),
            createdAt: Date.now(),
            review: { dueDate: todayKey(), interval: 0, ease: 2.5, reps: 0, lapses: 0, lastGrade: null },
          },
          ...current.cards,
        ],
      }))
    })
  }

  function createCards(deckId, cardValues, options = {}) {
    startTransition(() => {
      setData((current) => {
        const createdAt = Date.now()
        const fallbackDeck = current.decks.find((deck) => deck.id === deckId) ?? current.decks[0] ?? null
        const autoAnkiDecks = Boolean(options.autoAnkiDecks)
        const deckByKey = new Map(current.decks.map((deck) => [getDeckIdentityKey(deck), deck]))
        const createdDecks = []
        const resolveDeckIdForCard = (card) => {
          if (!autoAnkiDecks || card?.source?.type !== 'apkg') return deckId

          const target = getAnkiDeckTarget(card, fallbackDeck)
          const key = getDeckIdentityKey(target)
          const existingDeck = deckByKey.get(key)
          if (existingDeck) return existingDeck.id

          const nextDeck = {
            id: `deck-${createdAt}-anki-${createdDecks.length}`,
            name: target.name,
            description: target.description,
            section: target.section,
            chapter: target.chapter,
            color: getStableDeckColor(key),
            createdAt: createdAt + createdDecks.length,
          }
          deckByKey.set(key, nextDeck)
          createdDecks.push(nextDeck)
          return nextDeck.id
        }
        const syncedCards = new Map(
          current.cards
            .filter((card) => (autoAnkiDecks || card.deckId === deckId) && card.sourceKey)
            .map((card) => [card.sourceKey, card]),
        )
        const updatedSourceKeys = new Set()
        const cards = cardValues.map((card, index) => {
          const targetDeckId = resolveDeckIdForCard(card)
          const importedCard = {
            deckId: targetDeckId,
            front: card.front,
            back: card.back,
            template: card.template ?? 'qa',
            ...(card.tags ? { tags: card.tags } : {}),
            ...(card.favorite ? { favorite: card.favorite } : {}),
            ...(card.flagged ? { flagged: card.flagged } : {}),
            ...(card.comment ? { comment: card.comment } : {}),
            ...(card.align ? { align: card.align } : {}),
            ...(card.frontHtml ? { frontHtml: card.frontHtml } : {}),
            ...(card.backHtml ? { backHtml: card.backHtml } : {}),
            ...(card.cardCss ? { cardCss: card.cardCss } : {}),
            ...(card.sourceKey ? { sourceKey: card.sourceKey } : {}),
            ...(card.source ? { source: card.source } : {}),
          }
          const existingCard = card.sourceKey ? syncedCards.get(card.sourceKey) : null

          if (existingCard) {
            updatedSourceKeys.add(card.sourceKey)
            return {
              ...existingCard,
              ...importedCard,
              updatedAt: createdAt + index,
            }
          }

          return {
            id: `card-${createdAt}-${index}`,
            ...importedCard,
            createdAt: createdAt + index,
            review: { dueDate: todayKey(), interval: 0, ease: 2.5, reps: 0, lapses: 0, lastGrade: null },
          }
        })
        const untouchedCards = current.cards.filter((card) => !((autoAnkiDecks || card.deckId === deckId) && updatedSourceKeys.has(card.sourceKey)))

        return {
          ...current,
          decks: createdDecks.length > 0 ? [...current.decks, ...createdDecks] : current.decks,
          cards: [...cards, ...untouchedCards],
        }
      })
    })
  }

  function saveDailyLog(dateKey, content) {
    startTransition(() => {
      setData((current) => {
        const logs = getDailyLogs(current)
        const existingLog = logs.find((log) => log.date === dateKey)
        const nextLog = {
          id: existingLog?.id ?? `daily-${dateKey}`,
          date: dateKey,
          content,
          createdAt: existingLog?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        }

        return {
          ...current,
          dailyLogs: existingLog
            ? logs.map((log) => (log.date === dateKey ? nextLog : log))
            : [nextLog, ...logs],
        }
      })
    })
  }

  function createDailyCards(deckId, dateKey, cardValues) {
    createCards(deckId, cardValues.map((card, index) => ({
      ...card,
      template: card.template ?? 'qa',
      sourceKey: makeDailyCardSourceKey(dateKey, card, index),
      source: {
        type: 'daily-log',
        date: dateKey,
      },
    })))
  }

  function addCardAnnotation(cardId, annotationValue) {
    startTransition(() => {
      setData((current) => ({
        ...current,
        cards: current.cards.map((card) => (card.id === cardId ? {
          ...card,
          annotations: [
            {
              id: `annotation-${Date.now()}`,
              type: annotationValue.type,
              text: annotationValue.text,
              createdAt: Date.now(),
            },
            ...getCardAnnotations(card),
          ],
        } : card)),
      }))
    })
  }

  function removeCardAnnotation(cardId, annotationId) {
    startTransition(() => {
      setData((current) => ({
        ...current,
        cards: current.cards.map((card) => (card.id === cardId ? {
          ...card,
          annotations: getCardAnnotations(card).filter((annotation) => annotation.id !== annotationId),
        } : card)),
      }))
    })
  }

  function linkCards(cardId, targetId) {
    if (cardId === targetId) return
    startTransition(() => {
      setData((current) => ({
        ...current,
        cards: current.cards.map((card) => {
          if (card.id === cardId) return { ...card, links: Array.from(new Set([...getCardLinks(card), targetId])) }
          if (card.id === targetId) return { ...card, links: Array.from(new Set([...getCardLinks(card), cardId])) }
          return card
        }),
      }))
    })
  }

  function unlinkCards(cardId, targetId) {
    startTransition(() => {
      setData((current) => ({
        ...current,
        cards: current.cards.map((card) => {
          if (card.id === cardId) return { ...card, links: getCardLinks(card).filter((id) => id !== targetId) }
          if (card.id === targetId) return { ...card, links: getCardLinks(card).filter((id) => id !== cardId) }
          return card
        }),
      }))
    })
  }

  function reviewCard(cardId, grade) {
    startTransition(() => {
      setData((current) => ({
        ...current,
        cards: current.cards.map((card) => (card.id === cardId ? { ...card, review: scheduleReview(card.review, grade) } : card)),
        reviewLogs: [{ id: `log-${Date.now()}`, cardId, grade, reviewedAt: Date.now() }, ...current.reviewLogs].slice(0, 100),
      }))
    })
  }

  function updateProfile(profileValue) {
    startTransition(() => {
      setData((current) => ({
        ...current,
        profile: {
          ...getStoredProfile(current),
          ...profileValue,
          updatedAt: Date.now(),
        },
      }))
    })
  }

  function redeemReward(rewardId) {
    startTransition(() => {
      setData((current) => {
        const reward = REWARD_OPTIONS.find((item) => item.id === rewardId)
        if (!reward) return current

        const rewardState = getRewardState(current)
        const alreadyRedeemed = rewardState.redeemedRewards.some((item) => item.rewardId === rewardId)
        if (alreadyRedeemed || rewardState.availablePoints < reward.cost) return current

        return {
          ...current,
          profile: {
            ...getStoredProfile(current),
            redeemedRewards: [
              ...rewardState.redeemedRewards,
              { rewardId, redeemedAt: Date.now() },
            ],
            updatedAt: Date.now(),
          },
        }
      })
    })
  }

  const existingNames = data.decks
    .filter((deck) => (deckDialog.mode === 'edit' && deckDialog.deck ? deck.id !== deckDialog.deck.id : true))
    .map((deck) => deck.name)

  return (
    <>
      <DeckDialog
        open={deckDialog.open}
        mode={deckDialog.mode}
        initialValue={deckDialog.deck}
        existingNames={existingNames}
        onClose={closeDeckDialog}
        onSubmit={submitDeck}
      />

      <Routes>
        <Route path="/" element={<Home data={data} cloud={cloud} />} />
        <Route path="/app" element={<Dashboard data={data} onOpenCreateDeck={openCreateDeckDialog} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/decks" element={<Decks data={data} onOpenCreateDeck={openCreateDeckDialog} onOpenEditDeck={openEditDeckDialog} onDeleteDeck={deleteDeck} onSaveDailyLog={saveDailyLog} onCreateDailyCards={createDailyCards} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/browse" element={<Browse data={data} studyDeckId={studyDeckId} cloud={cloud} onAddCardAnnotation={addCardAnnotation} onRemoveCardAnnotation={removeCardAnnotation} onLinkCards={linkCards} onUnlinkCards={unlinkCards} />} />
        <Route path="/organize" element={<Organize data={data} onOpenCreateDeck={openCreateDeckDialog} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/import" element={<ImportCards data={data} onCreateCards={createCards} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/profile" element={<Profile data={data} cloud={cloud} studyDeckId={studyDeckId} onUpdateProfile={updateProfile} onRedeemReward={redeemReward} />} />
        <Route path="/cards/new/:deckId" element={<AddCard data={data} onCreateCard={createCard} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/study/:deckId" element={<Study data={data} onReviewCard={reviewCard} studyDeckId={studyDeckId} cloud={cloud} />} />
      </Routes>
    </>
  )
}
