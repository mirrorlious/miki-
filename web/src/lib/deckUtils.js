function getDeckSection(deck) {
  return deck?.section?.trim() || UNGROUPED_SECTION
}

function getDeckChapter(deck) {
  return deck?.chapter?.trim() || ''
}

}
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
const BROWSE_CARD_RENDER_LIMIT = 48
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

export { getDeckSection, getDeckChapter, getStableDeckColor }
