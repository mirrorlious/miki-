import { memo, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import ToolbarButton from './components/ToolbarButton.jsx'
import PixelItemIcon from './components/PixelItemIcon.jsx'
import CollapseToggle from './components/CollapseToggle.jsx'
import CardContent from './components/CardContent.jsx'
import AuthDialog from './components/AuthDialog.jsx'
import Shell from './components/Shell.jsx'
import StudyCardView from './components/StudyCardView.jsx'
import StudyStatsPanel from './components/StudyStatsPanel.jsx'
import { motion } from 'framer-motion'
import StudyNotePanel from './components/StudyNotePanel.jsx'
import GradeButtons from './components/GradeButtons.jsx'
import StudyHeader from './components/StudyHeader.jsx'
import DeckDialog from './components/DeckDialog.jsx'
import Dashboard from './components/Dashboard.jsx'
import Decks from './components/Decks.jsx'
import Organize from './components/Organize.jsx'
import ImportCards from './components/ImportCards.jsx'
import Browse from './components/BrowsePage.jsx'
import KnowledgeMap from './components/KnowledgeMap.jsx'
import Profile from './components/Profile.jsx'
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
import DeckSelectOptions from './components/DeckSelectOptions.jsx'
import AddCard from './components/AddCard.jsx'

import { compressImageFile } from './lib/imageUtils.js'
import { tokenizeForRelated } from './lib/textUtils.js'
import { getDateLabel, formatCountdown, formatCountdownWithDays, getCountdownInfo, formatStudyDate } from './lib/dateUtils.js'
import { makeLocalCacheData, persistDataToLocalCache } from './lib/storageUtils.js'
import { getReviewReps, getCardReviewReps, makeNewCardReview, hasStartedCard, getReviewDueTime, isReviewDue, formatReviewDueLabel, makeDailyCardSourceKey } from './lib/reviewUtils.js'
import { escapeHtmlText, makeTemplateFieldHtml, applyCardTemplateCode, buildCardValueFromTemplate } from './lib/cardHtml.js'
import { DECK_COLOR_OPTIONS, DEFAULT_DECK_SECTIONS, UNGROUPED_SECTION, PROFESSIONAL_SECTIONS, ANNOTATION_TYPES, CHAPTER_MILESTONE_SECONDS, BUILTIN_DYL_PACK_ID, REWARD_OPTIONS } from './lib/constants.js'
import { getDeckSection, getDeckChapter, getStableDeckColor, getDeckScopeParts, getDeckPath, getDeckOptionLabel, normalizePathPart, getSectionNames, sortDecksByPath, groupDecksBySection, getDeckChapterKey, getDeckChapterLabel, getDeckCards, getDeckOutlineRows, normalizeImportedAnkiCards, getAnkiDeckTarget, getDeckIdentityKey } from './lib/deckUtils.js'
import { getActiveStudyDays, getTopChapterTimeRows, addFocusSession, getReviewLogs, addActivitySeconds, getDailyLogs, ACTIVITY_TICK_SECONDS, ACTIVITY_IDLE_TIMEOUT_MS } from './lib/activity.js'
import { getInitialTheme, ThemeContext } from './lib/theme.js'
import { getStoredProfile } from './lib/profile.js'
import { getStoredCardTemplates, normalizeCardTemplate } from './lib/cardTemplates.js'
import { getRewardState } from './lib/achievement.js'
import { getCardAnnotations, getCardLinks, getCardFlagColor, makeScopeNode, getAnnotationWall, getCardAnnotationCount, getLinkedPairCount, isBuiltinDylItem, buildBrowseScopeTree, flattenScopeTree, findBestScopeNodeForDeck, isCardDue, isNewCard, getCardReviewStateLabel, hasStoredCardHtml, getCardHtmlSections } from './lib/browseUtils.js'
import { stripBuiltinDylItems, makeBuiltinCardOverride, mergeBuiltinDylData } from './lib/builtinDylUtils.js'
// --- Lib imports above, local constants below ---

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
function Home() {
  return <Navigate to="/decks" replace />
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
    <StudyNotePanel
      note={studyNoteDraft}
      onChangeNote={setStudyNoteDraft}
      onSave={saveStudyNote}
      dirty={studyNoteDirty}
      canUpdate={Boolean(onUpdateCardMeta)}
    />
  ) : null

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <StudyHeader
        deckName={deck?.name}
        deckPath={activeDeckPath}
        dueCount={queue.length}
        cardCount={studyCards.length}
        drillCount={drillCards.length}
        onDrawDrill={drawDrillCard}
        onNavigateAdd={() => deck && navigate(`/cards/new/${deck.id}`)}
        onNavigateDecks={() => navigate('/decks')}
        canAdd={Boolean(deck)}
      />

      <div className="shell-stretch max-w-3xl mx-auto w-full">

        <StudyStatsPanel
          reviewed={session.reviewed}
          dueCount={queue.length}
          isDrill={activeIsDrill}
          progressPercent={progressPercent}
          reviewedCount={reviewedCards}
          newCardCount={newCards}
          masteredCount={masteredCards}
          sessionTotal={sessionTotal}
        />

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
          <StudyCardView
            card={activeCard}
            hasHtml={activeCardHasHtml}
            section={studyHtmlSection}
            revealed={revealed}
            tabs={studyHtmlTabs}
            htmlSection={activeHtmlSection}
            lastGrade={lastGrade}
            isDrill={activeIsDrill}
            deckLabel={activeCardDeckLabel}
            stateLabel={activeCardStateLabel}
            notePanel={studyNotePanel}
            onSelectSection={selectStudyHtmlSection}
            onReveal={revealAnswer}
          />
        )}
        {activeCard && !activeCardHasHtml && (
          <section className="mb-4 rounded-2xl bg-white/90 border border-white shadow-sm p-4">
            {studyNotePanel}
          </section>
        )}
        {revealed && <GradeButtons options={gradeOptionsWithDue} sessionGrades={session.grades} onGrade={handleGrade} />}
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
    // Browse/Organize 等页面不需要每 10 秒刷新整份 data。
    // 否则会触发 localStorage、云同步 diff、目录树和卡片列表重算。
    if (!activeStudyDeckId) return undefined

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

  function normalizeDeckPathParts(parts = []) {
    return Array.isArray(parts)
      ? parts.map((part) => normalizePathPart(part)).filter(Boolean)
      : []
  }

  function startsWithPath(parts = [], prefix = []) {
    if (!prefix.length) return true
    if (parts.length < prefix.length) return false
    return prefix.every((part, index) => normalizePathPart(parts[index]).toLowerCase() === normalizePathPart(part).toLowerCase())
  }

  function replacePathPrefix(parts = [], sourceParts = [], targetParts = []) {
    const cleanParts = normalizeDeckPathParts(parts)
    const cleanSource = normalizeDeckPathParts(sourceParts)
    const cleanTarget = normalizeDeckPathParts(targetParts)
    if (!cleanTarget.length) return cleanParts
    if (cleanSource.length && startsWithPath(cleanParts, cleanSource)) {
      return [...cleanTarget, ...cleanParts.slice(cleanSource.length)]
    }
    return [...cleanTarget, ...cleanParts.slice(-1)]
  }

  function deckFromFullParts(deck, parts = []) {
    const cleanParts = normalizeDeckPathParts(parts)
    if (cleanParts.length === 0) return deck
    if (cleanParts.length === 1) {
      return {
        ...deck,
        section: getDeckSection(deck),
        chapter: getDeckChapter(deck),
        name: cleanParts[0] || deck.name,
        updatedAt: Date.now(),
      }
    }
    return {
      ...deck,
      section: cleanParts[0],
      chapter: cleanParts.length > 2 ? cleanParts.slice(1, -1).join(' / ') : '',
      name: cleanParts[cleanParts.length - 1] || deck.name,
      updatedAt: Date.now(),
    }
  }

  function moveBrowseScope({ deckIds = [], cardIds = [], sourceParts = [], targetParts = [] } = {}) {
    const deckIdSet = new Set(deckIds)
    const cardIdSet = new Set(cardIds)
    const cleanSource = normalizeDeckPathParts(sourceParts)
    const cleanTarget = normalizeDeckPathParts(targetParts)
    if (cleanTarget.length === 0) return

    startTransition(() => {
      setData((current) => {
        const nextDecks = current.decks.map((deck) => {
          if (!deckIdSet.has(deck.id)) return deck
          const fullParts = getDeckScopeParts(deck)
          const nextParts = replacePathPrefix(fullParts, cleanSource, cleanTarget)
          return deckFromFullParts(deck, nextParts)
        })

        const nextCards = current.cards.map((card) => {
          if (!cardIdSet.has(card.id) && !deckIdSet.has(card.deckId)) return card
          const sourcePath = Array.isArray(card?.source?.deckPath)
            ? card.source.deckPath.map(normalizePathPart).filter(Boolean)
            : []
          if (sourcePath.length === 0) return card
          const nextDeckPath = replacePathPrefix(sourcePath, cleanSource, cleanTarget)
          return {
            ...card,
            source: {
              ...card.source,
              deckPath: nextDeckPath,
              deckName: nextDeckPath.join('::'),
            },
            updatedAt: Date.now(),
          }
        })

        return { ...current, decks: nextDecks, cards: nextCards }
      })
    })
  }

  function mergeBrowseDecks({ sourceDeckIds = [], targetDeckId = '' } = {}) {
    const sourceSet = new Set(sourceDeckIds.filter((id) => id && id !== targetDeckId))
    if (!targetDeckId || sourceSet.size === 0) return

    startTransition(() => {
      setData((current) => {
        const targetDeck = current.decks.find((deck) => deck.id === targetDeckId)
        if (!targetDeck) return current
        const targetPath = getDeckScopeParts(targetDeck)
        return {
          ...current,
          decks: current.decks.filter((deck) => !sourceSet.has(deck.id)),
          cards: current.cards.map((card) => {
            if (!sourceSet.has(card.deckId)) return card
            return {
              ...card,
              deckId: targetDeckId,
              source: card.source ? {
                ...card.source,
                deckPath: targetPath,
                deckName: targetPath.join('::'),
              } : card.source,
              updatedAt: Date.now(),
            }
          }),
        }
      })
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

  function deleteCards(cardIds = []) {
    const ids = new Set((Array.isArray(cardIds) ? cardIds : [cardIds]).filter(Boolean))
    if (ids.size === 0) return

    startTransition(() => {
      setData((current) => ({
        ...current,
        cards: current.cards.filter((card) => !ids.has(card.id)),
        reviewLogs: current.reviewLogs.filter((log) => !ids.has(log.cardId)),
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
            ...(cardValue.cardJs ? { cardJs: cardValue.cardJs } : {}),
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
            ...(card.cardJs ? { cardJs: card.cardJs } : {}),
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
        <Route path="/browse" element={<Browse data={appData} studyDeckId={studyDeckId} cloud={cloud} onAddCardAnnotation={addCardAnnotation} onRemoveCardAnnotation={removeCardAnnotation} onLinkCards={linkCards} onUnlinkCards={unlinkCards} onUpdateCardMeta={updateCardMeta} onOpenCreateDeck={openCreateDeckDialog} onOpenEditDeck={openEditDeckDialog} onDeleteDeck={deleteDeck} onDeleteCards={deleteCards} onMoveScope={moveBrowseScope} onMergeDecks={mergeBrowseDecks} />} />
        <Route path="/map" element={<KnowledgeMap data={appData} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/organize" element={<Organize data={appData} onOpenCreateDeck={openCreateDeckDialog} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/import" element={<ImportCards data={appData} onCreateCards={createCards} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/profile" element={<Profile data={appData} cloud={cloud} studyDeckId={studyDeckId} onUpdateProfile={updateProfile} onRedeemReward={redeemReward} />} />
        <Route path="/cards/new/:deckId" element={<AddCard data={appData} onCreateCard={createCard} onSaveCardTemplate={saveCardTemplate} onDeleteCardTemplate={deleteCardTemplate} studyDeckId={studyDeckId} cloud={cloud} />} />
        <Route path="/study/:deckId" element={<Study data={appData} onReviewCard={reviewCard} onUpdateCardMeta={updateCardMeta} studyDeckId={studyDeckId} cloud={cloud} />} />
        </Routes>
      </ErrorBoundary>
    </ThemeContext.Provider>
  )
 }
