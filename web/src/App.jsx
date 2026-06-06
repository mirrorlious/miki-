import { memo, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import ToolbarButton from './components/ToolbarButton.jsx'
import PixelItemIcon from './components/PixelItemIcon.jsx'
import CollapseToggle from './components/CollapseToggle.jsx'
import CardContent from './components/CardContent.jsx'
import AuthDialog from './components/AuthDialog.jsx'
import Shell from './components/Shell.jsx'
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
import { parseApkgFile } from './apkgImport'
import {
  makeHtmlTextSelectable,
  stripAnswerSectionFromHtml,
  stripAnswerSectionFromText,
  stripSelectionBlockingStylesFromCss,
} from './ankiHtml'
import { parseBulkCards, parseMarkdownCards } from './cardImport'
import { loadData, scheduleReview, stats, STORAGE_KEY, todayKey } from './data'
import { useCloudSync } from './useCloudSync'
import ErrorBoundary from './components/ErrorBoundary'

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

function AddCard({ data, onCreateCard, onSaveCardTemplate, onDeleteCardTemplate, studyDeckId, cloud }) {
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
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false)
  const cardTemplates = useMemo(() => getCardTemplates(data), [data])
  const selectedCardTemplate = cardTemplates.find((template) => template.id === form.template) ?? cardTemplates[0]

  useEffect(() => {
    setForm((current) => ({ ...current, deckId: current.deckId || initialDeckId }))
  }, [initialDeckId])

  useEffect(() => {
    if (cardTemplates.some((template) => template.id === form.template)) return
    setForm((current) => ({ ...current, template: 'qa' }))
  }, [cardTemplates, form.template])

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

  function pasteHtmlIntoField(field, html) {
    const safeHtml = sanitizeCardHtml(html).trim()
    if (!safeHtml) return false

    const ref = field === 'front' ? frontRef.current : backRef.current
    const value = form[field] ?? ''
    const start = ref?.selectionStart ?? value.length
    const end = ref?.selectionEnd ?? value.length
    const nextValue = `${value.slice(0, start)}${safeHtml}${value.slice(end)}`
    const nextCursor = start + safeHtml.length

    setError('')
    markActiveEditorField(field)
    setForm((current) => ({ ...current, template: 'html', [field]: nextValue }))
    setStatusMessage('已按 HTML 格式粘贴')
    window.requestAnimationFrame(() => {
      ref?.focus()
      ref?.setSelectionRange(nextCursor, nextCursor)
    })
    return true
  }

  function handleEditorPaste(event, field) {
    markActiveEditorField(field)
    const clipboardHtml = event.clipboardData?.getData('text/html') ?? ''
    const clipboardText = event.clipboardData?.getData('text/plain') ?? ''
    const html = clipboardHtml.trim() || (looksLikeHtml(clipboardText) ? clipboardText : '')
    if (!html) return

    event.preventDefault()
    pasteHtmlIntoField(field, html)
  }

  const handleSave = useCallback(() => {
    const front = form.front.trim()

    if (!form.deckId) {
      setError('请先选择一个目录。')
      return
    }
    if (!front) {
      setError('问题不能为空。')
      return
    }

    const cardValue = buildCardValueFromTemplate(form, selectedCardTemplate)
    onCreateCard(form.deckId, {
      ...cardValue,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      favorite: form.favorite,
      flagged: form.flagged,
      comment: form.comment.trim(),
      align: form.align,
    })
    navigate('/decks')
  }, [form, navigate, onCreateCard, selectedCardTemplate])

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
  const draftCardValue = buildCardValueFromTemplate(form, selectedCardTemplate)
  const previewItems = [
    {
      id: 'draft-card',
      ...draftCardValue,
      front: draftCardValue.front || '问题会显示在这里',
      back: draftCardValue.back || '',
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
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId} wide>
      <TemplateManager
        open={templateManagerOpen}
        data={data}
        selectedTemplateId={form.template}
        onSelectTemplate={(templateId) => {
          updateForm('template', templateId)
          setTemplateManagerOpen(false)
        }}
        onSaveTemplate={onSaveCardTemplate}
        onDeleteTemplate={onDeleteCardTemplate}
        onClose={() => setTemplateManagerOpen(false)}
      />
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">添加卡片</h1>
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
                <span className="inline-flex items-center gap-2">
                  <select
                    value={form.template}
                    onChange={(event) => updateForm('template', event.target.value)}
                    className="h-10 w-44 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 outline-none focus:border-[#007aff] focus:bg-white"
                  >
                    {cardTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setTemplateManagerOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200" title="管理模板">
                    <Settings size={16} />
                  </button>
                </span>
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
                onPaste={(event) => handleEditorPaste(event, 'front')}
                className="min-h-[170px] w-full resize-none rounded-2xl bg-gray-50 px-4 py-4 text-lg leading-relaxed outline-none focus:ring-2 focus:ring-[#007aff]/20"
                placeholder="输入问题，或直接粘贴 HTML / 富文本"
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
                onPaste={(event) => handleEditorPaste(event, 'back')}
                className="min-h-[210px] flex-1 w-full resize-none bg-gray-50 px-4 py-4 text-lg leading-relaxed outline-none"
                placeholder="输入答案，可留空，也可直接粘贴 HTML / 富文本"
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

function Study({ data, onReviewCard, onUpdateCardMeta, studyDeckId, cloud }) {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [revealed, setRevealed] = useState(false)
  const [session, setSession] = useState({ reviewed: 0, grades: { 0: 0, 1: 0, 2: 0, 3: 0 } })
  const [studyMode, setStudyMode] = useState('due')
  const [studyHtmlSection, setStudyHtmlSection] = useState('front')
  const [studyNoteDraft, setStudyNoteDraft] = useState('')
  const [drillScope, setDrillScope] = useState('deck')
  const [drillSeed, setDrillSeed] = useState(() => Math.random())
  const [drillTargetDeckId, setDrillTargetDeckId] = useState(deckId ?? '')
  const [drillTargetChapterKey, setDrillTargetChapterKey] = useState('')
  const [dismissedDrillCardIds, setDismissedDrillCardIds] = useState(() => new Set())
  const canGradeRef = useRef(false)
  const deck = data.decks.find((item) => item.id === deckId) ?? data.decks[0]
  const today = todayKey()
  const deckById = useMemo(() => new Map(data.decks.map((item) => [item.id, item])), [data.decks])
  const studyScopeKey = useMemo(() => new URLSearchParams(location.search).get('scope') ?? location.state?.scopeKey ?? '', [location.search, location.state])
  const studyScopeTree = useMemo(() => buildBrowseScopeTree(data), [data])
  const studyScopeNodes = useMemo(() => flattenScopeTree(studyScopeTree), [studyScopeTree])
  const studyScopeNode = studyScopeKey ? studyScopeNodes.find((node) => node.key === studyScopeKey) : null
  const studyScopeCardIds = useMemo(() => new Set(studyScopeNode?.cardIds ?? []), [studyScopeNode])
  const masteredTodayCardIds = useMemo(() => new Set(getReviewLogs(data)
    .filter((log) => log.grade >= 2 && log.reviewedAt && new Date(log.reviewedAt).toISOString().slice(0, 10) === today)
    .map((log) => log.cardId)), [data, today])

  const studyCards = useMemo(() => {
    if (!deck) return []
    return data.cards
      .filter((card) => (studyScopeNode ? studyScopeCardIds.has(card.id) : card.deckId === deck.id))
      .sort((a, b) => getReviewDueTime(a.review) - getReviewDueTime(b.review))
  }, [data.cards, deck, studyScopeCardIds, studyScopeNode])

  const drillDeckOptions = useMemo(() => sortDecksByPath(data.decks).map((item) => ({
    id: item.id,
    label: getDeckOptionLabel(item),
    count: data.cards.filter((card) => card.deckId === item.id).length,
  })).filter((item) => item.count > 0), [data.cards, data.decks])

  const drillChapterOptions = useMemo(() => studyScopeNodes
    .filter((node) => node.key !== 'all' && node.count > 0 && node.depth >= 2)
    .map((node) => ({
      value: node.key,
      label: node.pathLabel,
      cardIds: node.cardIds,
      count: node.count,
    })), [studyScopeNodes])

  useEffect(() => {
    if (!deck) return
    setDrillTargetDeckId(deck.id)
    const targetScope = studyScopeNode ?? findBestScopeNodeForDeck(studyScopeNodes, deck.id)
    setDrillTargetChapterKey(targetScope?.key ?? drillChapterOptions[0]?.value ?? '')
  }, [deck?.id, deck, drillChapterOptions, studyScopeNode, studyScopeNodes])

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
    const isAvailableForDrill = (card) => hasStartedCard(card) && !dismissedDrillCardIds.has(card.id) && !masteredTodayCardIds.has(card.id)

    if (drillScope === 'all') return [...data.cards]
      .filter(isAvailableForDrill)
      .sort((a, b) => String(a.front).localeCompare(String(b.front), 'zh-CN'))

    if (drillScope === 'chapter') {
      const target = drillChapterOptions.find((item) => item.value === drillTargetChapterKey)
      const targetCardIds = new Set(target?.cardIds ?? [])
      return data.cards
        .filter((card) => targetCardIds.has(card.id))
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

  const queue = studyCards.filter(isCardDue)
  const newQueue = studyCards.filter(isNewCard)
  const dueCard = queue[0] ?? null
  const activeCard = studyMode === 'drill' ? drillCard : dueCard ?? newQueue[0] ?? drillCard
  const activeReview = useMemo(() => (
    activeCard?.review ?? { dueDate: today, interval: 0, ease: 2.5, reps: 0, lapses: 0, lastGrade: null }
  ), [activeCard?.review, today])
  const activeDeckPath = studyScopeNode?.pathLabel ?? (deck ? getDeckPath(deck) : '')
  const activeCardDeck = activeCard ? deckById.get(activeCard.deckId) : null
  const activeCardDeckLabel = activeCardDeck ? getDeckOptionLabel(activeCardDeck) : activeDeckPath
  const reviewedCards = studyCards.filter(hasStartedCard).length
  const masteredCards = studyCards.filter((card) => (card.review?.interval ?? 0) >= 7).length
  const newCards = studyCards.filter(isNewCard).length
  const remainingInSession = studyMode === 'drill' ? (activeCard ? 1 : 0) : (queue.length + newQueue.length) || (activeCard ? 1 : 0)
  const sessionTotal = session.reviewed + remainingInSession
  const progressPercent = sessionTotal > 0 ? Math.min(100, Math.round((session.reviewed / sessionTotal) * 100)) : 0
  const activeIsDrill = Boolean(
    activeCard
      && drillCard
      && activeCard.id === drillCard.id
      && (studyMode === 'drill' || (!dueCard && !newQueue[0])),
  )
  const lastGrade = STUDY_GRADE_OPTIONS.find((option) => option.grade === activeReview.lastGrade)
  const activeCardHasHtml = hasStoredCardHtml(activeCard)
  const activeCardHtmlSections = getCardHtmlSections(activeCard)
  const firstAnswerSectionKey = activeCardHtmlSections[0] ? `section:${activeCardHtmlSections[0].id}` : 'back'
  const activeHtmlSection = activeCardHtmlSections.find((section) => `section:${section.id}` === studyHtmlSection)
  const studyHtmlTabs = [
    { key: 'front', label: '正面' },
    ...(activeCardHtmlSections.length > 0
      ? activeCardHtmlSections.map((section) => ({ key: `section:${section.id}`, label: section.label }))
      : [{ key: 'back', label: '背面' }]),
    { key: 'note', label: '学习笔记' },
  ]
  const activeCardStateLabel = activeCard ? getCardReviewStateLabel(activeCard) : ''
  const activeCardNote = activeCard?.comment ?? ''
  const studyNoteDirty = Boolean(activeCard) && studyNoteDraft.trim() !== activeCardNote
  const gradeOptionsWithDue = useMemo(() => STUDY_GRADE_OPTIONS.map((option) => ({
    ...option,
    dueLabel: formatReviewDueLabel(scheduleReview(activeReview, option.grade)),
  })), [activeReview])

  useEffect(() => {
    setRevealed(false)
    setStudyHtmlSection('front')
    setStudyNoteDraft(activeCard?.comment ?? '')
  }, [activeCard?.comment, activeCard?.id])

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

  const revealAnswer = useCallback(() => {
    setRevealed(true)
    if (activeCardHasHtml) setStudyHtmlSection(firstAnswerSectionKey)
  }, [activeCardHasHtml, firstAnswerSectionKey])

  function selectStudyHtmlSection(section) {
    if (section !== 'front' && section !== 'note' && !revealed) setRevealed(true)
    setStudyHtmlSection(section)
  }

  function saveStudyNote() {
    if (!activeCard || !onUpdateCardMeta) return
    onUpdateCardMeta(activeCard.id, { comment: studyNoteDraft.trim() })
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
        revealAnswer()
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
  }, [activeCard, handleGrade, revealed, revealAnswer])

  const studyNotePanel = activeCard ? (
    <div className="mx-auto w-full max-w-2xl text-left">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-gray-950">我的笔记</h3>
        <button
          type="button"
          onClick={saveStudyNote}
          className="h-8 rounded-lg bg-gray-900 px-3 text-[11px] font-black text-white disabled:bg-gray-300"
          disabled={!studyNoteDirty || !onUpdateCardMeta}
        >
          保存
        </button>
      </div>
      <textarea
        value={studyNoteDraft}
        onChange={(event) => setStudyNoteDraft(event.target.value)}
        placeholder="写下这张卡的理解、易错点或补充材料"
        className="min-h-[110px] w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-700 outline-none focus:border-[#007aff] focus:bg-white"
      />
    </div>
  ) : null

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
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-black text-gray-950">抽背卡片</h2>
              <p className="mt-1 text-xs font-bold text-gray-400">不等到期也能复习，评分后同样会写入记忆曲线。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                className="h-9 w-[120px] rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-blue-400"
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
                  className="h-9 min-w-0 flex-1 basis-[260px] rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-blue-400"
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
                  className="h-9 min-w-0 flex-1 basis-[260px] rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 outline-none focus:border-blue-400"
                >
                  {drillDeckOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label} · {option.count}</option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={drawDrillCard}
                className="h-9 shrink-0 rounded-xl bg-gray-900 px-4 text-xs font-black text-white hover:bg-gray-800 disabled:bg-gray-300"
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
          <motion.div key={activeCard.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl bg-white/90 border border-white shadow-sm mb-4 min-h-[460px] flex flex-col overflow-hidden ${activeCardHasHtml ? 'text-left' : 'text-center'}`}>
            <div className="h-10 border-b border-gray-200 px-4 flex items-center justify-between gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-2">
                {activeIsDrill ? 'Drill' : 'Front'}
                {activeCardHasHtml && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600">HTML</span>}
              </span>
              <span className="truncate text-right">{activeCardDeckLabel} · {activeCardStateLabel}</span>
            </div>

            <div className={`flex-1 flex flex-col ${activeCardHasHtml ? 'justify-start p-4 sm:p-6' : 'justify-center p-10'}`}>
              <div className={`mb-5 flex flex-wrap items-center gap-2 text-xs font-black ${activeCardHasHtml ? 'justify-start' : 'justify-center'}`}>
                {activeCard.favorite && <span className="rounded-lg bg-yellow-50 px-2 py-1 text-yellow-700">收藏</span>}
                {activeCard.flagged && <span className="rounded-lg bg-red-50 px-2 py-1 text-red-600">重点</span>}
                {lastGrade && <span className={`rounded-lg px-2 py-1 ${lastGrade.badgeClass}`}>上次 {lastGrade.title}</span>}
                {activeCard.tags?.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-lg bg-gray-100 px-2 py-1 text-gray-500">{tag}</span>
                ))}
              </div>
              {activeCardHasHtml && (
                <div className="mb-6 flex max-w-full flex-wrap justify-start gap-1 self-stretch rounded-xl bg-gray-100 p-1 text-xs font-black">
                  {studyHtmlTabs.map((section) => (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => selectStudyHtmlSection(section.key)}
                      className={`h-8 rounded-lg px-3 ${studyHtmlSection === section.key ? 'bg-white text-[#007aff] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              )}

              {activeCardHasHtml && studyHtmlSection === 'note' ? (
                studyNotePanel
              ) : activeCardHasHtml && activeHtmlSection && revealed ? (
                <div className="mx-auto w-full max-w-full">
                  <p className="text-xs font-bold text-gray-400 mb-4">{activeHtmlSection.label}</p>
                  <CardContent
                    card={activeCard}
                    side="back"
                    htmlOverride={activeHtmlSection.html}
                    textOverride={activeHtmlSection.text}
                    className="mx-auto w-full max-w-full text-left text-base font-normal text-gray-800 leading-relaxed break-words"
                    fallbackClassName="mx-auto w-full max-w-full text-left text-base font-normal text-gray-800 leading-relaxed break-words whitespace-pre-wrap"
                  />
                </div>
              ) : (
                <>
                  {(!activeCardHasHtml || studyHtmlSection === 'front' || !revealed) && (
                    <CardContent
                      card={activeCard}
                      side="front"
                      className={activeCardHasHtml ? 'mx-auto w-full max-w-full text-left text-base font-normal text-gray-900 leading-relaxed break-words' : 'mx-auto max-w-full text-3xl font-black text-gray-950 leading-relaxed break-words'}
                      fallbackClassName={activeCardHasHtml ? 'mx-auto w-full max-w-full text-left text-base font-normal text-gray-900 leading-relaxed break-words whitespace-pre-wrap' : 'mx-auto max-w-full text-3xl font-black text-gray-950 leading-relaxed break-words whitespace-pre-wrap'}
                    />
                  )}

                  {!revealed ? (
                    <button type="button" onClick={revealAnswer} title="显示答案" className="mt-12 mx-auto h-11 w-[170px] rounded-xl bg-[#ff9f0a] text-white text-sm font-bold hover:bg-[#f59600]">显示答案</button>
                  ) : (
                    (!activeCardHasHtml || studyHtmlSection === 'back') && (
                      <div className={activeCardHasHtml ? '' : 'mt-10 pt-8 border-t border-gray-200'}>
                        <p className="text-xs font-bold text-gray-400 mb-4">Back</p>
                        <CardContent
                          card={activeCard}
                          side="back"
                          className={activeCardHasHtml ? 'mx-auto w-full max-w-full text-left text-base font-normal text-gray-800 leading-relaxed break-words' : 'mx-auto max-w-full text-xl text-gray-800 leading-relaxed break-words'}
                          fallbackClassName={activeCardHasHtml ? 'mx-auto w-full max-w-full text-left text-base font-normal text-gray-800 leading-relaxed break-words whitespace-pre-wrap' : 'mx-auto max-w-full text-xl text-gray-800 leading-relaxed break-words whitespace-pre-wrap'}
                        />
                        {!activeCardHasHtml && activeCard.comment && <p className="mt-5 rounded-xl bg-gray-50 px-4 py-3 text-left text-sm leading-relaxed text-gray-500">{activeCard.comment}</p>}
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {activeCard && !activeCardHasHtml && (
          <section className="mb-4 rounded-2xl bg-white/90 border border-white shadow-sm p-4">
            {studyNotePanel}
          </section>
        )}

        {revealed && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {gradeOptionsWithDue.map((option) => (
              <button
                key={option.grade}
                type="button"
                onClick={() => handleGrade(option.grade)}
                title={option.title}
                className={`min-h-16 rounded-xl border px-3 py-3 text-left font-black transition-colors ${option.className}`}
              >
                <span className="block text-base">{option.label}</span>
                <span className="mt-1 block text-xs opacity-75">{option.detail}</span>
                <span className="mt-2 block text-[11px] opacity-80">下次：{option.dueLabel}</span>
                <span className="mt-1 block text-[11px] opacity-60">本轮 {session.grades[option.grade] ?? 0}</span>
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
  const initial = useMemo(() => normalizeImportedAnkiCards(loadData()), [])
  const [data, setData] = useState(initial)
  const [theme, setTheme] = useState(getInitialTheme)
  const [deckDialog, setDeckDialog] = useState({ open: false, mode: 'create', deck: null })
  const cloud = useCloudSync(data, setData)
  const [builtinDyl, setBuiltinDyl] = useState({ loaded: false, decks: [], cards: [] })
  const signedIn = Boolean(cloud.user)
  const appData = useMemo(() => normalizeImportedAnkiCards(mergeBuiltinDylData(data, builtinDyl, signedIn)), [builtinDyl, data, signedIn])
  const builtinCardMap = useMemo(() => new Map(builtinDyl.cards.map((card) => [card.id, card])), [builtinDyl.cards])
  const studyDeckId = appData.decks[0]?.id ?? null
  const focusSessionRef = useRef(null)
  const lastActiveAtRef = useRef(Date.now())
  const lastActivityTickAtRef = useRef(Date.now())
  const activeStudyDeckId = useMemo(() => {
    const match = location.pathname.match(/^\/study\/([^/]+)/)
    return match?.[1] ?? null
  }, [location.pathname])
  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])
  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(APP_THEME_STORAGE_KEY, theme)
    } catch {
      // Theme persistence is nice to have; the UI can still switch without it.
    }
  }, [theme])

  useEffect(() => {
    setData((current) => normalizeImportedAnkiCards(current))
  }, [data.cards])

  useEffect(() => {
    let cancelled = false
    if (!signedIn) {
      setBuiltinDyl({ loaded: false, decks: [], cards: [] })
      return () => {
        cancelled = true
      }
    }

    fetch(BUILTIN_DYL_DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${BUILTIN_DYL_DATA_URL}`)
        return response.json()
      })
      .then(async (bundle) => {
        let cards = Array.isArray(bundle.cards) ? bundle.cards : []
        if (Array.isArray(bundle.cardChunks) && bundle.cardChunks.length > 0) {
          const bundleUrl = new URL(BUILTIN_DYL_DATA_URL, window.location.origin)
          const chunkCards = await Promise.all(bundle.cardChunks.map(async (chunkPath) => {
            const chunkUrl = new URL(chunkPath, bundleUrl)
            const response = await fetch(chunkUrl)
            if (!response.ok) throw new Error(`Failed to load ${chunkUrl.pathname}`)
            const chunk = await response.json()
            return Array.isArray(chunk.cards) ? chunk.cards : Array.isArray(chunk) ? chunk : []
          }))
          cards = chunkCards.flat()
        }
        if (cancelled) return
        setBuiltinDyl({
          loaded: true,
          decks: Array.isArray(bundle.decks) ? bundle.decks : [],
          cards,
        })
      })
      .catch(() => {
        if (!cancelled) setBuiltinDyl({ loaded: false, decks: [], cards: [] })
      })

    return () => {
      cancelled = true
    }
  }, [signedIn])

  useEffect(() => {
    persistDataToLocalCache(data)
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

  function deleteSection(sectionName) {
    startTransition(() => {
      setData((current) => {
        const deletedDeckIds = new Set(
          current.decks
            .filter((deck) => getDeckSection(deck) === sectionName)
            .map((deck) => deck.id),
        )
        if (deletedDeckIds.size === 0) return current

        const deletedCardIds = new Set(
          current.cards
            .filter((card) => deletedDeckIds.has(card.deckId))
            .map((card) => card.id),
        )

        return {
          ...current,
          decks: current.decks.filter((deck) => !deletedDeckIds.has(deck.id)),
          cards: current.cards.filter((card) => !deletedDeckIds.has(card.deckId)),
          reviewLogs: current.reviewLogs.filter((log) => !deletedCardIds.has(log.cardId)),
        }
      })
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
            ...(cardValue.htmlSections ? { htmlSections: cardValue.htmlSections } : {}),
            ...(cardValue.sourceKey ? { sourceKey: cardValue.sourceKey } : {}),
            ...(cardValue.source ? { source: cardValue.source } : {}),
            createdAt: Date.now(),
            review: makeNewCardReview(),
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
            ...(card.htmlSections ? { htmlSections: card.htmlSections } : {}),
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
            review: makeNewCardReview(),
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
      patchCard(cardId, (card) => ({
        annotations: [
          {
            id: `annotation-${Date.now()}`,
            type: annotationValue.type,
            text: annotationValue.text,
            createdAt: Date.now(),
          },
          ...getCardAnnotations(card),
        ],
      }))
    })
  }

  function removeCardAnnotation(cardId, annotationId) {
    startTransition(() => {
      patchCard(cardId, (card) => ({
        annotations: getCardAnnotations(card).filter((annotation) => annotation.id !== annotationId),
      }))
    })
  }

  function patchCard(cardId, patcher) {
    setData((current) => {
      let found = false
      const cards = current.cards.map((card) => {
        if (card.id !== cardId) return card
        found = true
        const patch = typeof patcher === 'function' ? patcher(card) : patcher
        return { ...card, ...patch, updatedAt: Date.now() }
      })
      if (found) return { ...current, cards }

      const baseCard = builtinCardMap.get(cardId)
      if (!baseCard) return current
      const patch = typeof patcher === 'function' ? patcher(baseCard) : patcher
      return {
        ...current,
        cards: [makeBuiltinCardOverride(baseCard, patch), ...current.cards],
      }
    })
  }

  function updateCardMeta(cardId, patch) {
    startTransition(() => {
      patchCard(cardId, patch)
    })
  }

  function linkCards(cardId, targetId) {
    if (cardId === targetId) return
    startTransition(() => {
      patchCard(cardId, (card) => ({ links: Array.from(new Set([...getCardLinks(card), targetId])) }))
      patchCard(targetId, (card) => ({ links: Array.from(new Set([...getCardLinks(card), cardId])) }))
    })
  }

  function unlinkCards(cardId, targetId) {
    startTransition(() => {
      patchCard(cardId, (card) => ({ links: getCardLinks(card).filter((id) => id !== targetId) }))
      patchCard(targetId, (card) => ({ links: getCardLinks(card).filter((id) => id !== cardId) }))
    })
  }

  function reviewCard(cardId, grade) {
    startTransition(() => {
      const reviewedAt = Date.now()
      setData((current) => {
        let found = false
        const cards = current.cards.map((card) => {
          if (card.id !== cardId) return card
          found = true
          return { ...card, review: scheduleReview(card.review, grade), updatedAt: reviewedAt }
        })

        if (!found) {
          const baseCard = builtinCardMap.get(cardId)
          if (baseCard) {
            cards.unshift(makeBuiltinCardOverride(baseCard, {
              review: scheduleReview(baseCard.review, grade),
              updatedAt: reviewedAt,
            }))
          }
        }

        return {
          ...current,
          cards,
          reviewLogs: [{ id: `log-${reviewedAt}`, cardId, grade, reviewedAt }, ...current.reviewLogs].slice(0, 100),
        }
      })
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

  function saveCardTemplate(templateValue) {
    const template = normalizeCardTemplate({ ...templateValue, builtIn: false, updatedAt: Date.now() })
    startTransition(() => {
      setData((current) => {
        const profile = getStoredProfile(current)
        const templates = getStoredCardTemplates(current)
        const exists = templates.some((item) => item.id === template.id)
        return {
          ...current,
          profile: {
            ...profile,
            cardTemplates: exists
              ? templates.map((item) => (item.id === template.id ? template : item))
              : [template, ...templates],
            updatedAt: Date.now(),
          },
        }
      })
    })
  }

  function deleteCardTemplate(templateId) {
    startTransition(() => {
      setData((current) => ({
        ...current,
        profile: {
          ...getStoredProfile(current),
          cardTemplates: getStoredCardTemplates(current).filter((template) => template.id !== templateId),
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

  const existingNames = appData.decks
    .filter((deck) => (deckDialog.mode === 'edit' && deckDialog.deck ? deck.id !== deckDialog.deck.id : true))
    .map((deck) => deck.name)

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <DeckDialog
        open={deckDialog.open}
        mode={deckDialog.mode}
        initialValue={deckDialog.deck}
        existingNames={existingNames}
        onClose={closeDeckDialog}
        onSubmit={submitDeck}
      />

      <ErrorBoundary>
        <Routes>
        <Route path="/" element={<Home data={appData} cloud={cloud} />} />
        <Route path="/app" element={<Dashboard data={appData} onOpenCreateDeck={openCreateDeckDialog} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/decks" element={<Decks data={appData} onOpenCreateDeck={openCreateDeckDialog} onOpenEditDeck={openEditDeckDialog} onDeleteDeck={deleteDeck} onDeleteSection={deleteSection} onSaveDailyLog={saveDailyLog} onCreateDailyCards={createDailyCards} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/browse" element={<Browse data={appData} studyDeckId={studyDeckId} cloud={cloud} onAddCardAnnotation={addCardAnnotation} onRemoveCardAnnotation={removeCardAnnotation} onLinkCards={linkCards} onUnlinkCards={unlinkCards} onUpdateCardMeta={updateCardMeta} onOpenCreateDeck={openCreateDeckDialog} onOpenEditDeck={openEditDeckDialog} onDeleteDeck={deleteDeck} />} />
        <Route path="/organize" element={<Organize data={appData} onOpenCreateDeck={openCreateDeckDialog} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/import" element={<ImportCards data={appData} onCreateCards={createCards} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/profile" element={<Profile data={appData} cloud={cloud} studyDeckId={studyDeckId} onUpdateProfile={updateProfile} onRedeemReward={redeemReward} />} />
        <Route path="/cards/new/:deckId" element={<AddCard data={appData} onCreateCard={createCard} onSaveCardTemplate={saveCardTemplate} onDeleteCardTemplate={deleteCardTemplate} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/study/:deckId" element={<Study data={appData} onReviewCard={reviewCard} onUpdateCardMeta={updateCardMeta} studyDeckId={studyDeckId} cloud={cloud} />} />
        </Routes>
