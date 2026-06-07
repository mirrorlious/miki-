import { memo, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import ToolbarButton from './ToolbarButton.jsx'
import PixelItemIcon from './PixelItemIcon.jsx'
import CollapseToggle from './CollapseToggle.jsx'
import CardContent from './CardContent.jsx'
import AuthDialog from './AuthDialog.jsx'
import Shell from './Shell.jsx'
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
  Moon,
  MoreVertical,
  PencilLine,
  Plus,
  Settings,
  Star,
  Strikethrough,
  Sun,
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
import { parseApkgFile } from '../apkgImport'
import {
  makeHtmlTextSelectable,
  stripAnswerSectionFromHtml,
  stripAnswerSectionFromText,
  stripSelectionBlockingStylesFromCss,
} from '../ankiHtml'
import { parseBulkCards, parseMarkdownCards } from '../cardImport'
import { getDeckChapter, getDeckOptionLabel, getDeckPath, getDeckSection, normalizePathPart, sortDecksByPath } from '../lib/deckUtils.js'
import {
  buildBrowseScopeTree,
  compactCardText,
  findBestScopeNodeForDeck,
  flattenScopeTree,
  getCardAnnotations,
  getCardHtmlSections,
  getCardLinks,
  getCardReviewStateLabel,
  getCardScopeParts,
  getRelatedSuggestions,
  getScopeKey,
  hasStoredCardHtml,
  isBuiltinDylItem,
  isCardDue,
  isNewCard,
} from '../lib/browseUtils.js'
import { loadData, scheduleReview, stats, STORAGE_KEY, todayKey } from '../data'
import { useCloudSync } from '../useCloudSync'
import ErrorBoundary from './ErrorBoundary'

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
const BROWSE_CARD_RENDER_LIMIT = 12
const BROWSE_CARD_COLUMNS_STORAGE_KEY = `${STORAGE_KEY}:browse-card-columns`
const BROWSE_PREVIEW_MODE_STORAGE_KEY = `${STORAGE_KEY}:browse-preview-mode`
const BROWSE_CARD_COLUMN_OPTIONS = [1, 2, 3, 4]
const BROWSE_PREVIEW_MODE_OPTIONS = [
  { value: 'auto', label: '智能' },
  { value: 'html', label: 'HTML' },
  { value: 'text', label: '文本' },
]
const BROWSE_CARD_GRID_CLASSES = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 xl:grid-cols-2',
  3: 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
}
const BUILTIN_DYL_PACK_ID = 'dyl-exam'
const BUILTIN_DYL_DATA_URL = '/bundles/dyl-exam/data.json'
const APP_THEME_STORAGE_KEY = `${STORAGE_KEY}:theme`
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




function getDeckChapterKey(deck) {
  return `${getDeckSection(deck)}|||${getDeckChapter(deck)}`
}

function getDeckChapterLabel(deck) {
  const chapter = getDeckChapter(deck)
  return chapter ? getDeckPath(deck) : `${getDeckSection(deck)} / 未细分`
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



const FLAG_COLOR_OPTIONS = [
  { value: 'red', label: '红旗', menuLabel: '红色' },
  { value: 'orange', label: '橙旗', menuLabel: '橙色' },
  { value: 'green', label: '绿旗', menuLabel: '绿色' },
  { value: 'blue', label: '蓝旗', menuLabel: '蓝色' },
  { value: 'purple', label: '紫旗', menuLabel: '紫色' },
]

function getCardFlagColor(card) {
  if (card?.flagColor) return card.flagColor
  return card?.flagged ? 'red' : ''
}

function isCardFlagged(card) {
  return Boolean(card?.flagged || getCardFlagColor(card))
}

function getFlagColorClass(color, active = true) {
  if (!active) return 'text-gray-300 hover:bg-gray-100 hover:text-red-500'
  if (color === 'orange') return 'bg-orange-50 text-orange-500'
  if (color === 'green') return 'bg-green-50 text-green-600'
  if (color === 'blue') return 'bg-blue-50 text-blue-600'
  if (color === 'purple') return 'bg-purple-50 text-purple-600'
  return 'bg-red-50 text-red-500'
}

function getFlagColorTextClass(color) {
  if (color === 'orange') return 'text-orange-500'
  if (color === 'green') return 'text-green-600'
  if (color === 'blue') return 'text-blue-600'
  if (color === 'purple') return 'text-purple-600'
  return 'text-red-500'
}


function getDeckScopeParts(deck) {
  return [
    getDeckSection(deck),
    ...getDeckChapter(deck).split('/').map(normalizePathPart).filter(Boolean),
    deck?.name,
  ].filter(Boolean)
}


function makeScopeNode(parts) {
  return {
    key: getScopeKey(parts),
    label: parts[parts.length - 1] || '全部卡片',
    pathLabel: parts.join(' / ') || '全部卡片',
    parts,
    depth: parts.length,
    cardIds: new Set(),
    deckIds: new Set(),
    childMap: new Map(),
    children: [],
  }
}








function escapeHtmlText(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function makeTemplateFieldHtml(value = '') {
  const text = String(value ?? '')
  if (!text) return ''
  return looksLikeHtml(text) ? text : escapeHtmlText(text).replace(/\n/g, '<br>')
}

function applyCardTemplateCode(code = '', fields = {}) {
  const fieldHtml = {
    Front: makeTemplateFieldHtml(fields.front),
    Back: makeTemplateFieldHtml(fields.back),
  }
  return String(code || '')
    .replace(/{{\s*(?:Front|问题|正面)\s*}}/gi, fieldHtml.Front)
    .replace(/{{\s*(?:Back|答案|背面)\s*}}/gi, fieldHtml.Back)
}

function buildCardValueFromTemplate(form, template) {
  const selectedTemplate = template ?? SYSTEM_CARD_TEMPLATES[0]
  const isHtmlTemplate = selectedTemplate.mode === 'html'
  const front = String(form.front ?? '').trim()
  const back = String(form.back ?? '').trim()
  const frontHtml = isHtmlTemplate ? applyCardTemplateCode(selectedTemplate.frontCode || '{{Front}}', { front, back }) : ''
  const backHtml = isHtmlTemplate ? applyCardTemplateCode(selectedTemplate.backCode || '{{Back}}', { front, back }) : ''
  const frontText = isHtmlTemplate ? htmlToPlainText(frontHtml) || htmlToPlainText(front) || 'HTML 正面' : front
  const backText = isHtmlTemplate ? htmlToPlainText(backHtml) || htmlToPlainText(back) || back : back

  return {
    front: frontText,
    back: backText,
    template: selectedTemplate.id,
    ...(frontHtml ? { frontHtml } : {}),
    ...(backHtml ? { backHtml } : {}),
    ...(isHtmlTemplate && selectedTemplate.css ? { cardCss: selectedTemplate.css } : {}),
  }
}


function getReviewReps(review) {
  const reps = Number(review?.reps ?? 0)
  return Number.isFinite(reps) ? reps : 0
}

function getCardReviewReps(card) {
  return getReviewReps(card?.review)
}

function makeNewCardReview(review = {}) {
  const { dueAt, ...rest } = review ?? {}
  return {
    ...rest,
    dueDate: '',
    interval: Number(rest.interval ?? 0) || 0,
    ease: Number(rest.ease ?? 2.5) || 2.5,
    reps: 0,
    lapses: Number(rest.lapses ?? 0) || 0,
    lastGrade: rest.lastGrade ?? null,
  }
}

function hasStartedCard(card) {
  return getCardReviewReps(card) > 0
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

function getReviewDueTime(review) {
  if (review?.dueAt) {
    const dueAt = new Date(review.dueAt).getTime()
    if (Number.isFinite(dueAt)) return dueAt
  }
  if (review?.dueDate) {
    const dueDate = new Date(`${review.dueDate}T00:00:00`).getTime()
    if (Number.isFinite(dueDate)) return dueDate
  }
  return 0
}

function isReviewDue(review) {
  const dueTime = getReviewDueTime(review)
  return getReviewReps(review) > 0 && dueTime > 0 && dueTime <= Date.now()
}




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

function formatReviewDueLabel(review) {
  const dueAt = getReviewDueTime(review)
  if (!dueAt) return '现在'
  const diffMs = dueAt - Date.now()
  if (diffMs <= 0) return '现在'
  const minutes = Math.max(1, Math.round(diffMs / 60000))
  if (minutes < 60) return `${minutes}分钟后`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}小时后`
  const days = Math.ceil(minutes / (24 * 60))
  return `${days}天后`
}

function makeLocalCacheData(data) {
  return {
    ...data,
    cards: Array.isArray(data.cards)
      ? data.cards.map((card) => {
        const lightCard = { ...card }
        delete lightCard.frontHtml
        delete lightCard.backHtml
        delete lightCard.cardCss
        delete lightCard.htmlSections
        return lightCard
      })
      : [],
  }
}

function persistDataToLocalCache(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(makeLocalCacheData(data)))
      console.warn('Local cache was too large, saved a lightweight copy without Anki HTML/CSS.', error)
    } catch (fallbackError) {
      console.warn('Local cache write skipped because browser storage is full.', fallbackError)
    }
  }
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'

  try {
    const savedTheme = localStorage.getItem(APP_THEME_STORAGE_KEY)
    if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme
  } catch {
    // Ignore storage failures and fall back to the system preference.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}


function getInitialBrowseCardColumns() {
  if (typeof window === 'undefined') return 2

  try {
    const savedColumns = Number(localStorage.getItem(BROWSE_CARD_COLUMNS_STORAGE_KEY))
    if (BROWSE_CARD_COLUMN_OPTIONS.includes(savedColumns)) return savedColumns
  } catch {
    // Ignore storage failures and use the default compact grid.
  }

  return 2
}

function getInitialBrowsePreviewMode() {
  if (typeof window === 'undefined') return 'auto'

  try {
    const savedMode = localStorage.getItem(BROWSE_PREVIEW_MODE_STORAGE_KEY)
    if (BROWSE_PREVIEW_MODE_OPTIONS.some((option) => option.value === savedMode)) return savedMode
  } catch {
    // Ignore storage failures and use the smart preview.
  }

  return 'auto'
}

function getBrowsePreviewPlainText(card, sections = []) {
  if (!card) return ''
  const sectionText = sections.map((section) => [section.label, section.text].filter(Boolean).join('：')).filter(Boolean).join('\n\n')
  return [card.front, card.back, sectionText]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join('\n\n')
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






function Home() {
  return <Navigate to="/decks" replace />
}

function BrowseWorktable({
  data,
  studyDeckId,
  cloud,
  onUpdateCardMeta,
  onOpenCreateDeck,
  onOpenEditDeck,
  onDeleteDeck,
  onDeleteCards,
  onMoveScope,
  onMergeDecks,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const initialDeckId = location.state?.deckId ?? data.decks[0]?.id ?? ''
  const [selectedScopeKey, setSelectedScopeKey] = useState('all')
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId)
  const [query, setQuery] = useState('')
  const [cardFilter, setCardFilter] = useState('all')
  const [flagColorFilter, setFlagColorFilter] = useState('all')
  const [expandedScopeKeys, setExpandedScopeKeys] = useState(() => new Set(['all']))
  const [contextMenu, setContextMenu] = useState(null)
  const [previewCardId, setPreviewCardId] = useState(null)
  const [previewPending, setPreviewPending] = useState(false)
  const [visibleCount, setVisibleCount] = useState(BROWSE_CARD_RENDER_LIMIT)
  const [cardColumnCount, setCardColumnCount] = useState(getInitialBrowseCardColumns)
  const [previewMode, setPreviewMode] = useState(getInitialBrowsePreviewMode)
  const loadMoreSentinelRef = useRef(null)
  const initializedScopeRef = useRef(false)
  const cardGridClassName = BROWSE_CARD_GRID_CLASSES[cardColumnCount] ?? BROWSE_CARD_GRID_CLASSES[2]
  const selectedFlagOption = flagColorFilter === 'none'
    ? { label: '无旗', menuLabel: '无旗' }
    : flagColorFilter === 'all'
      ? { label: '全部旗色', menuLabel: '全部旗色' }
      : FLAG_COLOR_OPTIONS.find((option) => option.value === flagColorFilter) ?? { label: '旗色', menuLabel: '旗色' }

  const scopeTree = useMemo(() => buildBrowseScopeTree({ decks: data.decks, cards: data.cards }), [data.decks, data.cards])
  const scopeNodes = useMemo(() => flattenScopeTree(scopeTree), [scopeTree])
  const scopeNodeMap = useMemo(() => new Map(scopeNodes.map((node) => [node.key, node])), [scopeNodes])
  const browseDeckById = useMemo(() => new Map(data.decks.map((deck) => [deck.id, deck])), [data.decks])
  const browseCardById = useMemo(() => new Map(data.cards.map((card) => [card.id, card])), [data.cards])
  const selectedScope = scopeNodeMap.get(selectedScopeKey) ?? scopeTree
  const selectedScopeCards = useMemo(() => (
    selectedScope.key === 'all'
      ? data.cards
      : selectedScope.cardIds.map((id) => browseCardById.get(id)).filter(Boolean)
  ), [browseCardById, data.cards, selectedScope.cardIds, selectedScope.key])
  const scopeDeckIds = useMemo(() => Array.from(new Set([
    ...selectedScope.deckIds,
    ...selectedScopeCards.map((card) => card.deckId),
  ].filter(Boolean))), [selectedScope.deckIds, selectedScopeCards])

  useEffect(() => {
    if (initializedScopeRef.current) return
    const initialNode = initialDeckId ? findBestScopeNodeForDeck(scopeNodes, initialDeckId) : null
    if (initialNode) setSelectedScopeKey(initialNode.key)
    initializedScopeRef.current = true
  }, [initialDeckId, scopeNodes])

  useEffect(() => {
    setExpandedScopeKeys((current) => {
      const next = new Set(current)
      next.add('all')
      selectedScope.parts.forEach((_, index) => next.add(getScopeKey(selectedScope.parts.slice(0, index + 1))))
      return next
    })
  }, [selectedScope.parts])

  const normalizedQuery = query.trim().toLowerCase()
  const visibleCards = useMemo(() => (
    selectedScopeCards
      .filter((card) => {
        if (cardFilter === 'favorite') return Boolean(card.favorite)
        if (cardFilter === 'flagged') return isCardFlagged(card)
        return true
      })
      .filter((card) => {
        if (flagColorFilter === 'all') return true
        if (flagColorFilter === 'none') return !getCardFlagColor(card)
        return getCardFlagColor(card) === flagColorFilter
      })
      .filter((card) => {
        if (!normalizedQuery) return true
        const deck = browseDeckById.get(card.deckId)
        const sectionText = getCardHtmlSections(card).map((section) => section.text).join(' ')
        const scopeText = getCardScopeParts(card, browseDeckById).join(' ')
        return `${card.front} ${card.back} ${sectionText} ${scopeText} ${deck ? getDeckOptionLabel(deck) : ''}`.toLowerCase().includes(normalizedQuery)
      })
  ), [browseDeckById, cardFilter, flagColorFilter, normalizedQuery, selectedScopeCards])
  const visibleCardRows = useMemo(() => visibleCards.slice(0, visibleCount), [visibleCards, visibleCount])
  const visibleCardIdSet = useMemo(() => new Set(visibleCards.map((card) => card.id)), [visibleCards])
  const selectedCard = selectedCardId && visibleCardIdSet.has(selectedCardId)
    ? browseCardById.get(selectedCardId)
    : null
  const previewCard = previewCardId ? browseCardById.get(previewCardId) : selectedCard
  const previewReady = Boolean(selectedCard && previewCard && previewCard.id === selectedCard.id && !previewPending)
  const previewHtmlSections = useMemo(() => getCardHtmlSections(previewCard), [previewCard])
  const previewPlainText = useMemo(() => getBrowsePreviewPlainText(previewCard, previewHtmlSections), [previewCard, previewHtmlSections])
  const shouldRenderPreviewSections = previewHtmlSections.length > 0 && (previewMode === 'auto' || previewMode === 'html')
  const selectedScopeDeckId = selectedCard?.deckId ?? scopeDeckIds[0] ?? selectedDeckId ?? data.decks[0]?.id ?? ''
  const contextCard = contextMenu?.type === 'card' ? browseCardById.get(contextMenu.cardId) : null
  const contextScope = contextMenu?.type === 'scope' ? scopeNodeMap.get(contextMenu.scopeKey) : null
  const contextDecks = contextScope ? contextScope.deckIds.map((id) => browseDeckById.get(id)).filter(Boolean) : []
  const editableContextDecks = contextDecks.filter((deck) => !isBuiltinDylItem(deck))
  const contextTargetDeckId = contextCard?.deckId
    ?? (contextScope?.cardIds?.[0] ? browseCardById.get(contextScope.cardIds[0])?.deckId : '')
    ?? contextScope?.deckIds?.[0]
    ?? selectedScopeDeckId

  useEffect(() => {
    setSelectedCardId((current) => {
      if (visibleCardIdSet.has(current)) return current
      return null
    })
  }, [visibleCardIdSet, visibleCards])

  useEffect(() => {
    if (!selectedCard?.id) {
      setPreviewCardId(null)
      setPreviewPending(false)
      return undefined
    }

    if (previewCardId === selectedCard.id && !previewPending) return undefined

    setPreviewPending(true)
    const applyPreview = () => {
      setPreviewCardId(selectedCard.id)
      setPreviewPending(false)
    }
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(applyPreview, { timeout: 180 })
      return () => window.cancelIdleCallback?.(idleId)
    }
    const timer = window.setTimeout(applyPreview, 80)
    return () => window.clearTimeout(timer)
  }, [previewCardId, previewPending, selectedCard?.id])

  useEffect(() => {
    if (selectedCard?.deckId) setSelectedDeckId(selectedCard.deckId)
  }, [selectedCard?.deckId, selectedCard?.id])

  useEffect(() => {
    setVisibleCount(BROWSE_CARD_RENDER_LIMIT)
  }, [visibleCards])

  useEffect(() => {
    try {
      localStorage.setItem(BROWSE_CARD_COLUMNS_STORAGE_KEY, String(cardColumnCount))
    } catch {
      // Ignore storage failures. The grid choice is only a display preference.
    }
  }, [cardColumnCount])

  useEffect(() => {
    try {
      localStorage.setItem(BROWSE_PREVIEW_MODE_STORAGE_KEY, previewMode)
    } catch {
      // Ignore storage failures. The preview choice is only a display preference.
    }
  }, [previewMode])

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && visibleCount < visibleCards.length) {
        setVisibleCount((current) => Math.min(current + 12, visibleCards.length))
      }
    }, { rootMargin: "160px" })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, visibleCards.length])

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null)
    }
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [])

  function selectScope(node) {
    startTransition(() => {
      setSelectedScopeKey(node.key)
      setSelectedCardId(null)
      setSelectedDeckId(node.deckIds[0] ?? data.decks[0]?.id ?? '')
    })
  }

  function toggleScopeExpanded(key) {
    setExpandedScopeKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      next.add('all')
      return next
    })
  }

  function openContextMenu(event, payload) {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ ...payload, x: event.clientX, y: event.clientY })
  }

  function openCreateChapter(node, child = false) {
    const parts = node?.parts ?? []
    const section = parts[0] ?? ''
    const chapterParts = child ? parts.slice(1) : parts.slice(1, -1)
    onOpenCreateDeck?.({
      section,
      chapter: chapterParts.join(' / '),
      name: '',
      description: '',
    })
    setContextMenu(null)
  }

  function deleteContextDecks() {
    if (editableContextDecks.length === 0) return
    const confirmed = window.confirm(`确定删除 ${editableContextDecks.length} 个本地章节/卡组吗？其中的本地卡片也会一起删除。`)
    if (!confirmed) return
    editableContextDecks.forEach((deck) => onDeleteDeck?.(deck.id))
    setContextMenu(null)
  }

  function parseScopePathInput(value = '') {
    return String(value)
      .split(/[\/／>|]+|\s+\/\s+|\s*>\s+/)
      .map((part) => normalizePathPart(part))
      .filter(Boolean)
  }

  function moveContextScope() {
    if (!contextScope || contextScope.key === 'all') return
    if (editableContextDecks.length === 0 && contextScope.cardIds.length === 0) {
      window.alert('这个目录下没有可移动的本地资料。')
      return
    }
    if (!onMoveScope) {
      window.alert('当前版本还没有接入目录移动保存函数。')
      return
    }

    const currentPath = contextScope.parts.join(' / ')
    const defaultTarget = contextScope.parts.slice(0, -1).join(' / ')
    const input = window.prompt(`移动目录：${currentPath}\n\n请输入新的目标路径，例如：刑法 / 正当化事由 / 正当防卫`, defaultTarget || currentPath)
    const targetParts = parseScopePathInput(input)
    if (!input || targetParts.length === 0) return
    if (targetParts.join(' / ') === contextScope.parts.join(' / ')) {
      setContextMenu(null)
      return
    }

    const confirmed = window.confirm(`确定把这个目录移动到：\n${targetParts.join(' / ')}\n\n会同时调整该目录下卡片的 Anki source.deckPath，避免移动后仍显示在旧目录。`)
    if (!confirmed) return

    onMoveScope({
      deckIds: editableContextDecks.map((deck) => deck.id),
      cardIds: contextScope.cardIds,
      sourceParts: contextScope.parts,
      targetParts,
    })
    setSelectedScopeKey('all')
    setContextMenu(null)
  }

  function mergeContextDecks() {
    if (editableContextDecks.length === 0) return
    if (!onMergeDecks) {
      window.alert('当前版本还没有接入目录合并保存函数。')
      return
    }

    const sourceIds = new Set(editableContextDecks.map((deck) => deck.id))
    const candidates = sortDecksByPath(data.decks)
    const hint = candidates.slice(0, 10).map((deck) => `- ${getDeckOptionLabel(deck)}`).join('\n')
    const input = window.prompt(`合并目录：${contextScope?.pathLabel ?? ''}\n\n请输入目标卡组名称或路径关键字。匹配到的第一个卡组会作为合并目标。\n\n示例：\n${hint}`, '')
    if (!input) return
    const keyword = input.trim().toLowerCase()
    const targetDeck = candidates.find((deck) => getDeckOptionLabel(deck).toLowerCase().includes(keyword) || String(deck.name ?? '').toLowerCase().includes(keyword))
    if (!targetDeck) {
      window.alert('没有找到目标卡组。请复制更完整的目录名称再试。')
      return
    }

    const sourceDeckIds = editableContextDecks.map((deck) => deck.id).filter((id) => id !== targetDeck.id)
    if (sourceDeckIds.length === 0) {
      window.alert('目标卡组就在当前目录内，没有需要合并的其它本地卡组。')
      return
    }

    const confirmed = window.confirm(`确定合并到：\n${getDeckOptionLabel(targetDeck)}\n\n将移动 ${sourceDeckIds.length} 个卡组内的卡片，并删除被合并的空卡组。`)
    if (!confirmed) return
    onMergeDecks({ sourceDeckIds, targetDeckId: targetDeck.id })
    setSelectedScopeKey('all')
    setContextMenu(null)
  }

  function exportContextScope() {
    if (!contextScope) return
    const cards = contextScope.cardIds.map((id) => browseCardById.get(id)).filter(Boolean)
    const payload = {
      exportedAt: new Date().toISOString(),
      scope: {
        key: contextScope.key,
        label: contextScope.label,
        pathLabel: contextScope.pathLabel,
        parts: contextScope.parts,
      },
      decks: contextDecks,
      cards,
    }
    const fileName = `${String(contextScope.label || 'miki-scope').replace(/[\\/:*?"<>|]/g, '_') || 'miki-scope'}.json`
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setContextMenu(null)
  }

  function setCardFlagColor(card, color) {
    const nextColor = color || ''
    onUpdateCardMeta?.(card.id, { flagged: Boolean(nextColor), flagColor: nextColor })
    if (!nextColor && cardFilter === 'flagged') {
      setCardFilter('all')
    }
    if (flagColorFilter !== 'all' && (!nextColor || nextColor !== flagColorFilter)) {
      setFlagColorFilter('all')
    }
  }

  function toggleCardFavorite(card) {
    onUpdateCardMeta?.(card.id, { favorite: !card.favorite })
  }

  function deleteCardWithConfirm(card) {
    if (!card?.id || !onDeleteCards) return
    const title = compactCardText(card.front || card.back || card.id, 80)
    const confirmed = window.confirm(`确定删除这张卡片吗？

${title}

删除后会同时移除它的复习记录。`)
    if (!confirmed) return
    onDeleteCards([card.id])
    setSelectedCardId((current) => (current === card.id ? null : current))
    setPreviewCardId((current) => (current === card.id ? null : current))
    setContextMenu(null)
  }

  function renderFavoriteControl(card, size = 'sm') {
    const isLarge = size === 'lg'
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          toggleCardFavorite(card)
        }}
        className={`grid shrink-0 place-items-center ${isLarge ? 'h-8 w-8 rounded-lg' : 'h-6 w-6 rounded-md'} ${card.favorite ? 'bg-yellow-50 text-yellow-500' : 'text-gray-300 hover:bg-gray-100 hover:text-yellow-500'}`}
        aria-label={card.favorite ? '取消星标' : '星标'}
        title={card.favorite ? '取消星标' : '星标'}
      >
        <Star size={isLarge ? 16 : 14} fill={card.favorite ? 'currentColor' : 'none'} />
      </button>
    )
  }

  function renderFlagControl(card, size = 'sm') {
    const flagColor = getCardFlagColor(card)
    const isLarge = size === 'lg'
    return (
      <span
        className="group relative inline-flex shrink-0"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setCardFlagColor(card, flagColor ? '' : 'red')
          }}
          className={`grid place-items-center ${isLarge ? 'h-8 w-8 rounded-lg' : 'h-6 w-6 rounded-md'} ${flagColor ? getFlagColorClass(flagColor) : 'text-gray-300 hover:bg-gray-100 hover:text-red-500'}`}
          aria-label={flagColor ? '取消旗帜' : '添加旗帜'}
          title={flagColor ? '点击取消旗帜，悬停可换颜色' : '点击添加红旗，悬停可选颜色'}
        >
          <Flag size={isLarge ? 16 : 14} fill={flagColor ? 'currentColor' : 'none'} />
        </button>
        <div className={`pointer-events-none absolute right-0 top-full z-40 mt-1 ${isLarge ? 'w-28' : 'w-24'} rounded-lg border border-gray-200 bg-white p-1 text-[11px] font-bold text-gray-600 opacity-0 shadow-xl transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setCardFlagColor(card, '')
            }}
            className={`flex h-7 w-full items-center gap-2 rounded-md px-2 text-left ${flagColor ? 'hover:bg-gray-50' : 'bg-gray-100 text-gray-900'}`}
          >
            <Flag size={13} />
            无色
          </button>
          {FLAG_COLOR_OPTIONS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setCardFlagColor(card, color.value)
              }}
              className={`flex h-7 w-full items-center gap-2 rounded-md px-2 text-left ${flagColor === color.value ? getFlagColorClass(color.value) : 'hover:bg-gray-50'}`}
            >
              <Flag size={13} fill="currentColor" className={getFlagColorTextClass(color.value)} />
              {color.menuLabel}
            </button>
          ))}
        </div>
      </span>
    )
  }

  function navigateToStudyScope() {
    if (!selectedScopeDeckId) return
    const suffix = selectedScope.key === 'all' ? '' : `?scope=${encodeURIComponent(selectedScope.key)}`
    navigate(`/study/${selectedScopeDeckId}${suffix}`, { state: { scopeKey: selectedScope.key } })
  }

  function renderScopeNode(node) {
    const expanded = expandedScopeKeys.has(node.key)
    const selected = selectedScope.key === node.key
    const hasChildren = node.children.length > 0
    return (
      <div key={node.key}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => selectScope(node)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              selectScope(node)
            }
          }}
          onContextMenu={(event) => openContextMenu(event, { type: 'scope', scopeKey: node.key })}
          className={`group flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${selected ? 'bg-green-50 text-green-700 font-black' : 'text-gray-700 hover:bg-gray-50'}`}
          style={{ paddingLeft: `${Math.min(8 + node.depth * 12, 44)}px` }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (hasChildren) toggleScopeExpanded(node.key)
            }}
            className={`grid h-5 w-5 shrink-0 place-items-center rounded text-gray-300 ${hasChildren ? 'hover:bg-white hover:text-gray-600' : 'opacity-0'}`}
            tabIndex={-1}
          >
            <ChevronRight size={13} className={expanded ? 'rotate-90 transition-transform' : 'transition-transform'} />
          </button>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{node.label}</span>
          </span>
          <span className="shrink-0 text-[11px] font-bold text-gray-400">{node.count}</span>
          <button
            type="button"
            onClick={(event) => openContextMenu(event, { type: 'scope', scopeKey: node.key })}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-gray-300 opacity-0 hover:bg-white hover:text-gray-600 group-hover:opacity-100"
            title="目录操作"
          >
            <MoreVertical size={13} />
          </button>
        </div>
        {hasChildren && expanded && (
          <div className="mt-0.5">
            {node.children.map(renderScopeNode)}
          </div>
        )}
      </div>
    )
  }

  const menuStyle = contextMenu ? {
    left: Math.min(contextMenu.x, Math.max(8, window.innerWidth - 232)),
    top: Math.min(contextMenu.y, Math.max(8, window.innerHeight - 320)),
  } : {}

  const scopeDue = useMemo(() => selectedScopeCards.filter(isCardDue).length, [selectedScopeCards])
  const scopeNew = useMemo(() => selectedScopeCards.filter(isNewCard).length, [selectedScopeCards])

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId} wide>
      <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">浏览</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => selectedScopeDeckId && navigate(`/cards/new/${selectedScopeDeckId}`)} className="h-10 rounded-xl bg-[#007aff] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={!selectedScopeDeckId}>添加卡片</button>
          <button onClick={navigateToStudyScope} className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300" disabled={!selectedScopeDeckId}>学习</button>
        </div>
      </header>

      <div className="browse-worktable-grid grid min-h-[720px] w-full grid-cols-1 items-start gap-4 xl:grid-cols-[300px_minmax(620px,1fr)_400px]">
        <aside className="overflow-hidden rounded-2xl border border-white bg-white/90 shadow-sm">
          <div className="flex h-12 items-center justify-between border-b border-gray-200 px-4">
            <div>
              <h2 className="text-sm font-black text-gray-950">目录</h2>
              <p className="text-[11px] font-bold text-gray-400">{scopeTree.count} 张卡片</p>
            </div>
            <button type="button" onClick={() => openCreateChapter(scopeTree, true)} className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200" title="新建章节">
              <Plus size={15} />
            </button>
          </div>
          <div className="max-h-[calc(100vh-160px)] overflow-auto p-2">
            {renderScopeNode(scopeTree)}
          </div>
        </aside>

        <main className="min-w-0">
          <section className="overflow-hidden rounded-2xl border border-white bg-white/90 shadow-sm">
            <div className="border-b border-gray-200 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="关键词或标签搜索卡片"
                  className="h-9 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-[#007aff] focus:bg-white"
                />
                <span className="shrink-0 text-xs font-black text-gray-400">{visibleCards.length}</span>
                <button type="button" onClick={() => openCreateChapter(selectedScope, true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700 hover:bg-green-100" title="插入子章节">
                  <Plus size={16} />
                </button>
                <button type="button" onClick={navigateToStudyScope} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#34c759] text-white hover:bg-[#30b454] disabled:bg-gray-300" disabled={!selectedScopeDeckId} title={`开始学习 ${scopeDue || scopeNew || selectedScope.count}`}>
                  <BookOpen size={16} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-black">
                {[
                  { value: 'all', label: '全部' },
                  { value: 'favorite', label: '星标' },
                  { value: 'flagged', label: '旗帜' },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setCardFilter(filter.value)}
                    className={`h-7 rounded-lg px-2.5 transition-colors ${cardFilter === filter.value ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}
                  >
                    {filter.label}
                  </button>
                ))}
                <span className="mx-1 h-5 w-px bg-gray-200" />
                <details className="group relative inline-flex h-7 shrink-0">
                  <summary className={`flex h-7 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 transition-colors [&::-webkit-details-marker]:hidden ${flagColorFilter !== 'all' || cardFilter === 'flagged' ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}>
                    <Flag size={13} fill={flagColorFilter !== 'all' && flagColorFilter !== 'none' ? 'currentColor' : 'none'} />
                    <span>{cardFilter === 'flagged' && flagColorFilter === 'all' ? '全部旗帜' : selectedFlagOption.label}</span>
                  </summary>
                  <div className="absolute left-0 top-full z-50 mt-1 w-32 rounded-xl border border-gray-200 bg-white p-1.5 text-[11px] font-black text-gray-600 shadow-2xl">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget.closest('details')?.removeAttribute('open')
                        setFlagColorFilter('all')
                      }}
                      className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left ${flagColorFilter === 'all' && cardFilter !== 'flagged' ? 'bg-gray-950 text-white' : 'hover:bg-gray-50'}`}
                    >
                      <Flag size={13} />
                      全部卡片
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget.closest('details')?.removeAttribute('open')
                        setCardFilter('flagged')
                        setFlagColorFilter('all')
                      }}
                      className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left ${cardFilter === 'flagged' && flagColorFilter === 'all' ? 'bg-gray-950 text-white' : 'hover:bg-gray-50'}`}
                    >
                      <Flag size={13} fill="currentColor" />
                      全部旗帜
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget.closest('details')?.removeAttribute('open')
                        setCardFilter('all')
                        setFlagColorFilter('none')
                      }}
                      className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left ${flagColorFilter === 'none' ? 'bg-gray-950 text-white' : 'hover:bg-gray-50'}`}
                    >
                      <Flag size={13} />
                      无旗
                    </button>
                    <div className="my-1 h-px bg-gray-100" />
                    {FLAG_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={(event) => {
                          event.currentTarget.closest('details')?.removeAttribute('open')
                          setCardFilter('flagged')
                          setFlagColorFilter(color.value)
                        }}
                        className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left ${flagColorFilter === color.value ? getFlagColorClass(color.value) : 'hover:bg-gray-50'}`}
                      >
                        <Flag size={13} fill="currentColor" className={getFlagColorTextClass(color.value)} />
                        {color.menuLabel}
                      </button>
                    ))}
                  </div>
                </details>
                <span className="mx-1 hidden h-5 w-px bg-gray-200 sm:inline-block" />
                <span className="text-[11px] font-black text-gray-400">每行</span>
                {BROWSE_CARD_COLUMN_OPTIONS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setCardColumnCount(count)}
                    className={`h-7 rounded-lg px-2.5 ${cardColumnCount === count ? 'bg-[#007aff] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    title={`每行最多 ${count} 张卡片`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[calc(100vh-220px)] overflow-auto bg-gray-50/70 p-3">
              <div className={`grid gap-3 ${cardGridClassName}`}>
                {visibleCardRows.map((card) => (
                    <article
                      key={card.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedCardId(card.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedCardId(card.id)
                        }
                      }}
                      onContextMenu={(event) => openContextMenu(event, { type: 'card', cardId: card.id })}
                      className={`flex min-h-[170px] cursor-pointer flex-col rounded-lg border px-3 py-3 text-left shadow-sm transition-colors ${selectedCard?.id === card.id ? 'border-green-200 bg-green-50/90' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-3 min-w-0 flex-1 text-sm font-black leading-5 text-gray-950">{compactCardText(card.front, 96)}</h3>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black ${isNewCard(card) ? 'bg-blue-50 text-blue-600' : isCardDue(card) ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                          {getCardReviewStateLabel(card)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-5 flex-1 text-xs leading-5 text-gray-500">{compactCardText(card.back, 220)}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[11px] font-bold text-gray-300">{hasStoredCardHtml(card) ? 'HTML' : '文本'} · {getCardScopeParts(card, browseDeckById).at(-1)}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {renderFavoriteControl(card)}
                          {renderFlagControl(card)}
                        </span>
                      </div>
                    </article>
                ))}
              <div ref={loadMoreSentinelRef} className="h-px" />
              </div>
              {visibleCards.length > visibleCardRows.length && (
                <p className="px-3 py-4 text-center text-xs font-bold text-gray-400">已显示前 {visibleCardRows.length} 张，继续搜索可以缩小范围。</p>
              )}
              {visibleCards.length === 0 && <p className="py-12 text-center text-sm text-gray-400">没有匹配的卡片。</p>}
            </div>
          </section>
        </main>

        <aside className="browse-preview-panel self-start overflow-hidden rounded-2xl border border-white bg-white/90 shadow-sm">
          {selectedCard ? (
            <div className="browse-preview-card max-h-[calc(100vh-150px)] overflow-auto p-4">
              <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center justify-between gap-2 bg-white/90 pb-2 backdrop-blur">
                <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 text-[11px] font-black text-gray-500">
                  <span className="px-1 text-gray-400">预览</span>
                  {BROWSE_PREVIEW_MODE_OPTIONS.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setPreviewMode(mode.value)}
                      className={`h-6 rounded-lg px-2 transition-colors ${previewMode === mode.value ? 'bg-white text-gray-950 shadow-sm' : 'hover:bg-white/70 hover:text-gray-700'}`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => selectedScopeDeckId && navigate(`/cards/new/${selectedScopeDeckId}`)}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
                  title="添加卡片"
                  disabled={!selectedScopeDeckId}
                >
                  <Plus size={15} />
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {renderFavoriteControl(selectedCard, 'lg')}
                  {renderFlagControl(selectedCard, 'lg')}
                  <button
                    type="button"
                    onClick={() => deleteCardWithConfirm(selectedCard)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    title="删除这张卡片"
                    disabled={!onDeleteCards}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                </div>
              </div>
              {previewReady ? (
                previewMode === 'text' ? (
                  <div className="browse-preview-plain whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-sm font-bold leading-7 text-gray-800">
                    {previewPlainText || '这张卡没有可显示内容。'}
                  </div>
                ) : shouldRenderPreviewSections ? (
                  <div className="space-y-3">
                    {previewHtmlSections.map((section) => (
                      <section key={section.id} className="browse-preview-section rounded-xl border border-gray-100 bg-white p-3">
                        <h3 className="mb-2 border-b border-gray-100 pb-2 text-xs font-black text-gray-400">{section.label}</h3>
                        <CardContent
                          card={previewCard}
                          side="back"
                          htmlOverride={section.html || ''}
                          textOverride={section.text || ''}
                          className="text-sm leading-relaxed text-gray-700 break-words"
                          fallbackClassName="text-sm leading-relaxed text-gray-700 break-words whitespace-pre-wrap"
                        />
                      </section>
                    ))}
                  </div>
                ) : (
                  <>
                    <CardContent
                      card={previewCard}
                      side="front"
                      className="text-sm font-bold leading-relaxed text-gray-950 break-words"
                      fallbackClassName="text-sm font-bold leading-relaxed text-gray-950 break-words whitespace-pre-wrap"
                    />
                    <div className="my-4 h-px bg-gray-200" />
                    <CardContent
                      card={previewCard}
                      side="back"
                      className="text-sm leading-relaxed text-gray-700 break-words"
                      fallbackClassName="text-sm leading-relaxed text-gray-700 break-words whitespace-pre-wrap"
                    />
                  </>
                )
              ) : (
                <div className="grid min-h-[360px] place-items-center rounded-xl bg-gray-50 text-xs font-bold text-gray-400">
                  正在准备预览...
                </div>
              )}
            </div>
          ) : (
            <div className="grid min-h-[220px] place-items-center p-6 text-center">
              <div className="rounded-2xl bg-gray-50/70 px-5 py-8 ring-1 ring-gray-100">
                <p className="text-sm font-black text-gray-400">选择一张卡片查看预览。</p>
                <p className="mt-2 text-xs font-bold leading-5 text-gray-300">预览区现在不再强行撑满整屏，选中卡片后会展开为阅读面板。</p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {contextMenu && (
        <div className="fixed z-50 w-56 rounded-xl border border-gray-200 bg-white p-1.5 text-xs font-bold text-gray-700 shadow-2xl" style={menuStyle} onClick={(event) => event.stopPropagation()}>
          {contextCard ? (
            <>
              <button type="button" onClick={() => { toggleCardFavorite(contextCard); setContextMenu(null) }} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50">
                <Star size={14} fill={contextCard.favorite ? 'currentColor' : 'none'} className={contextCard.favorite ? 'text-yellow-500' : 'text-gray-400'} />
                {contextCard.favorite ? '取消星标' : '设为星标'}
              </button>
              <button type="button" onClick={() => deleteCardWithConfirm(contextCard)} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-red-600 hover:bg-red-50 disabled:text-gray-300" disabled={!onDeleteCards}>
                <Trash2 size={14} />
                删除这张卡片
              </button>
              <div className="my-1 h-px bg-gray-100" />
              <button type="button" onClick={() => { setCardFlagColor(contextCard, ''); setContextMenu(null) }} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-gray-400 hover:bg-gray-50">
                <Flag size={14} />
                无色
              </button>
              {FLAG_COLOR_OPTIONS.map((color) => (
                <button key={color.value} type="button" onClick={() => { setCardFlagColor(contextCard, color.value); setContextMenu(null) }} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50">
                  <Flag size={14} fill="currentColor" className={getFlagColorTextClass(color.value)} />
                  {color.menuLabel}
                </button>
              ))}
            </>
          ) : (
            <>
              <button type="button" onClick={() => openCreateChapter(contextScope ?? scopeTree, true)} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50">
                <Plus size={14} /> 新建子章节
              </button>
              <button type="button" onClick={() => openCreateChapter(contextScope ?? scopeTree, false)} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50">
                <Layers3 size={14} /> 插入同级章节
              </button>
              <button type="button" onClick={() => contextTargetDeckId && navigate(`/cards/new/${contextTargetDeckId}`)} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50 disabled:text-gray-300" disabled={!contextTargetDeckId}>
                <PencilLine size={14} /> 在这里加卡
              </button>
              <div className="my-1 h-px bg-gray-100" />
              <button type="button" onClick={() => { if (editableContextDecks[0]) onOpenEditDeck?.(editableContextDecks[0]); setContextMenu(null) }} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50 disabled:text-gray-300" disabled={editableContextDecks.length !== 1}>
                <PencilLine size={14} /> 编辑本地目录
              </button>
              <button type="button" onClick={moveContextScope} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50 disabled:text-gray-300" disabled={!contextScope || contextScope.key === 'all' || (editableContextDecks.length === 0 && contextScope.cardIds.length === 0)}>
                <GitBranch size={14} /> 移动目录
              </button>
              <button type="button" onClick={mergeContextDecks} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50 disabled:text-gray-300" disabled={editableContextDecks.length === 0}>
                <Layers3 size={14} /> 合并到卡组
              </button>
              <button type="button" onClick={exportContextScope} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-gray-50 disabled:text-gray-300" disabled={!contextScope || contextScope.count === 0}>
                <Upload size={14} /> 导出目录数据
              </button>
              <button type="button" onClick={deleteContextDecks} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-red-600 hover:bg-red-50 disabled:text-gray-300" disabled={editableContextDecks.length === 0}>
                <Trash2 size={14} /> 删除本地目录
              </button>
              {contextDecks.length > 0 && editableContextDecks.length === 0 && <p className="px-3 py-2 text-[11px] leading-4 text-gray-400">内置资料目录不能直接删除，可以在旁边插入自己的章节。</p>}
            </>
          )}
        </div>
      )}
    </Shell>
  )
}

function Browse({ data, studyDeckId, cloud, onAddCardAnnotation, onRemoveCardAnnotation, onLinkCards, onUnlinkCards, onUpdateCardMeta, onOpenCreateDeck, onOpenEditDeck, onDeleteDeck, onDeleteCards, onMoveScope, onMergeDecks }) {
  const location = useLocation()
  const navigate = useNavigate()
  const initialDeckId = location.state?.deckId ?? data.decks[0]?.id ?? ''
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId)
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [query, setQuery] = useState('')
  const [cardFilter, setCardFilter] = useState('all')
  const [annotationType, setAnnotationType] = useState(ANNOTATION_TYPES[0])
  const [annotationDraft, setAnnotationDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
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
        if (cardFilter === 'favorite') return Boolean(card.favorite)
        if (cardFilter === 'flagged') return Boolean(card.flagged)
        return true
      })
      .filter((card) => {
        const keyword = query.trim().toLowerCase()
        if (!keyword) return true
        const sectionText = getCardHtmlSections(card).map((section) => section.text).join(' ')
        return `${card.front} ${card.back} ${sectionText}`.toLowerCase().includes(keyword)
      })
  ), [cardFilter, data.cards, query, selectedDeckId])
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
      return null
    })
  }, [visibleCards])

  useEffect(() => {
    setAnnotationDraft('')
    setNoteDraft(selectedCard?.comment ?? '')
    setLinkTargetId('')
  }, [selectedCard?.comment, selectedCard?.id])

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

  function toggleCardFavorite(card) {
    onUpdateCardMeta?.(card.id, { favorite: !card.favorite })
  }

  function toggleCardFlagged(card) {
    onUpdateCardMeta?.(card.id, { flagged: !card.flagged })
  }

  function saveCardNote() {
    if (!selectedCard) return
    onUpdateCardMeta?.(selectedCard.id, { comment: noteDraft.trim() })
  }

  if (Array.isArray(data.cards)) {
    return (
      <BrowseWorktable
        data={data}
        studyDeckId={studyDeckId}
        cloud={cloud}
        onAddCardAnnotation={onAddCardAnnotation}
        onRemoveCardAnnotation={onRemoveCardAnnotation}
        onLinkCards={onLinkCards}
        onUnlinkCards={onUnlinkCards}
        onUpdateCardMeta={onUpdateCardMeta}
        onOpenCreateDeck={onOpenCreateDeck}
        onOpenEditDeck={onOpenEditDeck}
        onDeleteDeck={onDeleteDeck}
        onDeleteCards={onDeleteCards}
        onMoveScope={onMoveScope}
        onMergeDecks={onMergeDecks}
      />
    )
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
          <div className="border-b border-gray-200 px-3 py-2">
            <div className="flex items-center gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索问题或答案"
              className="h-9 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-[#007aff] focus:bg-white"
            />
            <span className="text-xs font-bold text-gray-400">{visibleCards.length} 张</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black">
              {[
                { value: 'all', label: '全部' },
                { value: 'favorite', label: '星标' },
                { value: 'flagged', label: '旗帜' },
              ].map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setCardFilter(filter.value)}
                  className={`h-7 rounded-lg px-2 transition-colors ${cardFilter === filter.value ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[580px] overflow-auto bg-gray-50/60 p-2">
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 2xl:grid-cols-3">
              {visibleCardRows.map((card) => (
                <div
                    key={card.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCardId(card.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedCardId(card.id)
                      }
                    }}
                    className={`min-h-[150px] rounded-lg border bg-white px-3 py-3 text-left shadow-sm transition-colors ${selectedCard?.id === card.id ? 'border-green-200 bg-green-50/80' : 'border-gray-200 hover:border-gray-300 hover:bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <strong className="line-clamp-2 text-sm font-black leading-5 text-gray-950">{card.front}</strong>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black ${isNewCard(card) ? 'bg-blue-50 text-blue-600' : isCardDue(card) ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                        {getCardReviewStateLabel(card)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-4 text-xs leading-5 text-gray-500">{card.back}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-gray-300">{hasStoredCardHtml(card) ? 'HTML' : '文本'}</span>
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleCardFavorite(card)
                          }}
                          className={`grid h-7 w-7 place-items-center rounded-lg ${card.favorite ? 'bg-yellow-50 text-yellow-500' : 'text-gray-300 hover:bg-gray-100 hover:text-yellow-500'}`}
                          title={card.favorite ? '取消星标' : '星标'}
                        >
                          <Star size={15} fill={card.favorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleCardFlagged(card)
                          }}
                          className={`grid h-7 w-7 place-items-center rounded-lg ${card.flagged ? 'bg-red-50 text-red-500' : 'text-gray-300 hover:bg-gray-100 hover:text-red-500'}`}
                          title={card.flagged ? '取消旗帜' : '旗帜'}
                        >
                          <Flag size={15} fill={card.flagged ? 'currentColor' : 'none'} />
                        </button>
                      </span>
                    </div>
                  </div>
              ))}
            </div>
            {visibleCards.length > visibleCardRows.length && (
              <p className="px-3 py-4 text-center text-xs font-bold text-gray-400">
                已显示前 {visibleCardRows.length} 张。继续输入关键词可以缩小范围。
              </p>
            )}
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
                  <h3 className="text-sm font-black text-gray-950">我的笔记</h3>
                  <button
                    type="button"
                    onClick={saveCardNote}
                    className="h-7 rounded-lg bg-gray-900 px-3 text-[11px] font-black text-white disabled:bg-gray-300"
                    disabled={noteDraft.trim() === (selectedCard.comment ?? '')}
                  >
                    保存
                  </button>
                </div>
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="写下这张卡自己的理解、易错点或补充材料"
                  className="min-h-[88px] w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-700 outline-none focus:border-[#007aff] focus:bg-white"
                />
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

export default Browse
