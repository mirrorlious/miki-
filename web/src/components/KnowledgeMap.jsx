import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, BookOpen, CheckCircle2, GitBranch, Layers3, Plus, Search, Target, Trash2, X } from 'lucide-react'
import Shell from './Shell.jsx'
import { compactCardText, getCardReviewStateLabel, isCardDue, isNewCard } from '../lib/browseUtils.js'
import { getDeckChapter, getDeckOptionLabel, getDeckPath, getDeckSection } from '../lib/deckUtils.js'

const TOPIC_STORAGE_KEY = 'miki:knowledge-filter-topics:v1'
const INITIAL_RESULT_RENDER_LIMIT = 60
const RESULT_RENDER_STEP = 60
const INITIAL_ELEMENT_RENDER_LIMIT = 32
const ELEMENT_RENDER_STEP = 32
const AUTO_RENDER_DELAY = 45

const CONDITION_MODES = [
  { value: 'and', label: 'AND', tone: 'bg-blue-50 text-blue-700 border-blue-200', hint: '必须包含' },
  { value: 'or', label: 'OR', tone: 'bg-violet-50 text-violet-700 border-violet-200', hint: '任一包含' },
  { value: 'not', label: 'NOT', tone: 'bg-red-50 text-red-700 border-red-200', hint: '排除' },
]

const REVIEW_ELEMENTS = [
  { id: 'review:due', group: 'review', label: '待复习', value: '待复习', terms: ['待复习', '到期', 'due'] },
  { id: 'review:weak', group: 'review', label: '薄弱', value: '薄弱', terms: ['薄弱', '模糊', '忘记', 'wrong', 'again', 'hard'] },
  { id: 'review:mastered', group: 'review', label: '已掌握', value: '已掌握', terms: ['已掌握', '掌握', 'mastered'] },
  { id: 'review:new', group: 'review', label: '新卡', value: '新卡', terms: ['新卡', '未学习', 'new'] },
]

const STRUCTURE_RULES = [
  { id: 'structure:constitutive', group: 'structure', label: '构成要件型', terms: ['构成要件', '主体', '客体', '主观方面', '客观方面', '犯罪构成'] },
  { id: 'structure:condition', group: 'structure', label: '成立条件型', terms: ['成立条件', '起因条件', '时间条件', '对象条件', '限度条件', '条件'] },
  { id: 'structure:concept', group: 'structure', label: '概念特征型', terms: ['概念', '特征', '含义', '定义', '性质'] },
  { id: 'structure:compare', group: 'structure', label: '易混对比型', terms: ['易混', '区分', '区别', '对比', '辨析', 'vs', '与', '还是'] },
  { id: 'structure:effect', group: 'structure', label: '法律效果型', terms: ['法律效果', '效力', '后果', '责任', '承担'] },
  { id: 'structure:article', group: 'structure', label: '法条型', terms: ['法条', '第', '条', '规定', '刑法', '民法典', '宪法'] },
  { id: 'structure:penalty', group: 'structure', label: '处罚规则型', terms: ['处罚', '量刑', '刑罚', '从重', '从轻', '减轻', '免除', '数罪并罚'] },
]

const LEGAL_TOPIC_TERMS = [
  '正当防卫', '紧急避险', '假想防卫', '防卫挑拨', '特殊防卫', '单位犯罪', '共同犯罪', '犯罪构成', '犯罪主体', '犯罪客体',
  '主观方面', '客观方面', '故意', '过失', '结果加重犯', '转化犯', '牵连犯', '想象竞合', '数罪并罚', '不作为犯罪',
  '抢劫罪', '盗窃罪', '诈骗罪', '侵占罪', '敲诈勒索罪', '绑架罪', '非法拘禁', '交通肇事', '危险驾驶', '洗钱罪',
  '民事法律关系', '意思表示', '代理', '表见代理', '无权代理', '物权变动', '善意取得', '占有', '抵押权', '质权', '留置权',
  '合同效力', '违约责任', '侵权责任', '无因管理', '不当得利', '人格权', '婚姻家庭', '继承', '宪法监督', '国家机构',
  '法的渊源', '法律关系', '法律责任', '法律解释', '法律推理', '法制史', '司法制度', '立法制度',
]

const GROUP_META = {
  chapter: { title: '章节元素', subtitle: '来自卡组、章节、路径', accent: 'bg-blue-50 text-blue-700' },
  topic: { title: '考点元素', subtitle: '从标题和正文提取', accent: 'bg-indigo-50 text-indigo-700' },
  cover: { title: '遮盖词元素', subtitle: '优先提取 ak-cover / cloze', accent: 'bg-emerald-50 text-emerald-700' },
  structure: { title: '结构类型', subtitle: '按法硕答题结构自动判断', accent: 'bg-orange-50 text-orange-700' },
  review: { title: '复习状态', subtitle: '按当前复习状态筛选', accent: 'bg-red-50 text-red-700' },
}

const GROUP_KEYS = Object.keys(GROUP_META)

function makeElementRenderLimits(value = INITIAL_ELEMENT_RENDER_LIMIT) {
  return GROUP_KEYS.reduce((limits, group) => ({ ...limits, [group]: value }), {})
}

const NORMALIZED_LEGAL_TOPIC_TERMS = LEGAL_TOPIC_TERMS.map((label) => ({ label, key: normalizeText(label) }))
const NORMALIZED_STRUCTURE_RULES = STRUCTURE_RULES.map((rule) => ({
  ...rule,
  searchKeys: uniqueStrings([rule.label, ...rule.terms]).map(normalizeText).filter(Boolean),
}))


function normalizeText(value = '') {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[【】\[\]（）()《》<>.,，。:：;；!！?？、|｜/\\"'“”‘’`~\-_—=+*#@$%^&]+/g, '')
}

function looseIncludes(haystack, needle) {
  const a = normalizeText(haystack)
  const b = normalizeText(needle)
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}

function stripHtml(value = '') {
  return String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>|<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function takeText(value = '', max = 80) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function uniqueStrings(values = []) {
  const seen = new Set()
  const output = []
  for (const value of values) {
    const clean = String(value ?? '').replace(/\s+/g, ' ').trim()
    if (!clean) continue
    const key = normalizeText(clean)
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push(clean)
  }
  return output
}

function getCardHtmlValue(card) {
  const sectionHtml = Array.isArray(card?.htmlSections)
    ? card.htmlSections.map((section) => `${section?.label ?? ''} ${section?.text ?? ''} ${section?.html ?? ''}`).join('\n')
    : ''
  return [card?.frontHtml, card?.backHtml, sectionHtml, card?.front, card?.back].filter(Boolean).join('\n')
}

function extractCoverTerms(rawHtml = '') {
  const value = String(rawHtml ?? '')
  const terms = []
  const coverRegexes = [
    /<[^>]*(?:class|data-type)=["'][^"']*(?:ak-cover|cloze|cover)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi,
    /\{\{c\d+::([\s\S]*?)(?:::.*?)?\}\}/gi,
    /\[\[([\s\S]{1,40}?)\]\]/g,
  ]
  for (const regex of coverRegexes) {
    let match
    while ((match = regex.exec(value)) !== null) {
      const text = stripHtml(match[1])
      if (text && text.length <= 48) terms.push(text)
    }
  }
  return uniqueStrings(terms).slice(0, 80)
}

function inferDeckPathParts(card, deck) {
  const sourcePath = Array.isArray(card?.source?.deckPath) ? card.source.deckPath : []
  const sourceName = String(card?.source?.deckName ?? '').split('::')
  return uniqueStrings([
    getDeckSection(deck),
    getDeckChapter(deck),
    deck?.name,
    getDeckPath(deck),
    getDeckOptionLabel(deck),
    ...sourcePath,
    ...sourceName,
  ]).filter((part) => part && part !== '未分组')
}

function inferTitle(card, plainText) {
  const direct = card?.title || card?.name || card?.frontText || card?.front
  const candidates = [direct, plainText]
  for (const candidate of candidates) {
    const text = stripHtml(candidate)
      .split(/\n|。|；|;|\s{2,}/)
      .map((item) => item.trim())
      .find(Boolean)
    if (text) return takeText(text, 72)
  }
  return '未命名卡片'
}

function inferStructureTypes(normalizedText) {
  const key = String(normalizedText ?? '')
  if (!key) return []
  return NORMALIZED_STRUCTURE_RULES
    .filter((rule) => rule.searchKeys.some((termKey) => termKey && key.includes(termKey)))
    .map((rule) => rule.label)
}

function getReviewInfo(card) {
  const reps = Number(card?.review?.reps ?? 0) || 0
  const interval = Number(card?.review?.interval ?? 0) || 0
  const grade = Number(card?.review?.lastGrade)
  const weak = Boolean(card?.flagged || card?.flagColor || Number(card?.review?.lapses ?? 0) > 0 || grade === 0 || grade === 1)
  const due = isCardDue(card)
  const fresh = isNewCard(card) || reps === 0
  const mastered = !due && !weak && reps > 0 && interval >= 7
  const labels = []
  if (due) labels.push('待复习', '到期', 'due')
  if (weak) labels.push('薄弱', '模糊', '忘记', 'wrong', 'hard')
  if (mastered) labels.push('已掌握', '掌握', 'mastered')
  if (fresh) labels.push('新卡', '未学习', 'new')
  return { due, weak, mastered, fresh, labels }
}

function makeElementId(group, label) {
  return `${group}:${normalizeText(label).slice(0, 50)}`
}

function makeElement(group, label, extra = {}) {
  const clean = String(label ?? '').replace(/\s+/g, ' ').trim()
  const terms = uniqueStrings([clean, ...(extra.terms ?? [])])
  const searchKeys = terms.map(normalizeText).filter(Boolean)
  return {
    id: extra.id ?? makeElementId(group, clean),
    group,
    label: clean,
    value: clean,
    terms,
    searchKeys,
    searchText: normalizeText([clean, ...terms].join(' ')),
    count: extra.count ?? 0,
    sampleCardIds: extra.sampleCardIds ?? [],
  }
}

function enrichCards(data) {
  const decks = Array.isArray(data?.decks) ? data.decks : []
  const cards = Array.isArray(data?.cards) ? data.cards : []
  const deckById = new Map(decks.map((deck) => [deck.id, deck]))

  return cards.map((card) => {
    const deck = deckById.get(card?.deckId) ?? null
    const htmlValue = getCardHtmlValue(card)
    const plainText = stripHtml(htmlValue)
    const coverTerms = extractCoverTerms(htmlValue)
    const pathParts = inferDeckPathParts(card, deck)
    const title = inferTitle(card, plainText)
    const blob = `${title} ${plainText} ${pathParts.join(' ')}`
    const blobKey = normalizeText(blob)
    const structureTypes = inferStructureTypes(blobKey)
    const review = getReviewInfo(card)
    const topicTerms = uniqueStrings([
      title.replace(/^\d+[.、．]\s*/, ''),
      ...NORMALIZED_LEGAL_TOPIC_TERMS.filter((term) => term.key && blobKey.includes(term.key)).map((term) => term.label),
      ...coverTerms,
    ]).filter((term) => term.length >= 2).slice(0, 48)

    const searchableText = uniqueStrings([
      title,
      plainText,
      ...pathParts,
      ...coverTerms,
      ...structureTypes,
      ...review.labels,
    ]).join(' ')
    const searchableKey = normalizeText(searchableText)

    return {
      card,
      deck,
      id: card?.id,
      title,
      plainText,
      preview: compactCardText(plainText || `${card?.front ?? ''} ${card?.back ?? ''}`, 160),
      pathLabel: deck ? getDeckPath(deck) : (pathParts[0] ?? '未分组'),
      pathParts,
      coverTerms,
      topicTerms,
      structureTypes,
      review,
      searchableText,
      searchableKey,
    }
  }).filter((item) => item.id)
}

function collectElements(enrichedCards) {
  const buckets = new Map()
  const structureIdByLabel = new Map(STRUCTURE_RULES.map((rule) => [rule.label, rule.id]))
  const reviewIdByLabel = new Map(REVIEW_ELEMENTS.map((item) => [item.label, item.id]))

  function push(group, label, cardId, terms = []) {
    const clean = String(label ?? '').replace(/\s+/g, ' ').trim()
    if (!clean || clean.length > 48) return
    const stableId = group === 'structure' ? structureIdByLabel.get(clean) : group === 'review' ? reviewIdByLabel.get(clean) : null
    const id = stableId ?? makeElementId(group, clean)
    const existing = buckets.get(id) ?? makeElement(group, clean, { id, terms })
    existing.count += 1
    if (existing.sampleCardIds.length < 6) existing.sampleCardIds.push(cardId)
    existing.terms = uniqueStrings([...existing.terms, clean, ...terms])
    existing.searchKeys = existing.terms.map(normalizeText).filter(Boolean)
    existing.searchText = normalizeText([existing.label, ...existing.terms].join(' '))
    buckets.set(id, existing)
  }

  for (const item of enrichedCards) {
    item.pathParts.forEach((part) => push('chapter', part, item.id))
    item.topicTerms.forEach((part) => push('topic', part, item.id))
    item.coverTerms.forEach((part) => push('cover', part, item.id))
    item.structureTypes.forEach((part) => push('structure', part, item.id, STRUCTURE_RULES.find((rule) => rule.label === part)?.terms ?? []))
    item.review.labels.slice(0, 4).forEach((part) => {
      if (['待复习', '薄弱', '已掌握', '新卡'].includes(part)) push('review', part, item.id)
    })
  }

  const fixed = [...STRUCTURE_RULES.map((rule) => makeElement('structure', rule.label, { id: rule.id, terms: rule.terms })), ...REVIEW_ELEMENTS]
  for (const element of fixed) {
    const id = element.id
    const existing = buckets.get(id)
    const count = enrichedCards.filter((card) => matchesElement(card, element)).length
    buckets.set(id, { ...element, count: existing?.count || count, sampleCardIds: existing?.sampleCardIds ?? [] })
  }

  return Array.from(buckets.values())
    .filter((element) => element.count > 0 || element.group === 'structure' || element.group === 'review')
    .sort((a, b) => {
      const groupOrder = ['chapter', 'topic', 'cover', 'structure', 'review']
      const g = groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group)
      if (g) return g
      return b.count - a.count || a.label.localeCompare(b.label, 'zh-CN')
    })
}

function matchesElement(cardItem, element) {
  const cardKey = cardItem?.searchableKey || normalizeText(cardItem?.searchableText)
  const termKeys = element?.searchKeys?.length
    ? element.searchKeys
    : [element?.value, element?.label, ...(element?.terms ?? [])].map(normalizeText).filter(Boolean)
  if (!cardKey || !termKeys.length) return false
  return termKeys.some((termKey) => termKey && cardKey.includes(termKey))
}

function cycleMode(mode) {
  if (mode === 'and') return 'or'
  if (mode === 'or') return 'not'
  return 'and'
}

function modeMeta(mode) {
  return CONDITION_MODES.find((item) => item.value === mode) ?? CONDITION_MODES[0]
}

function filterCards(enrichedCards, conditions) {
  if (!conditions.length) return []
  const andItems = conditions.filter((item) => item.mode === 'and')
  const orItems = conditions.filter((item) => item.mode === 'or')
  const notItems = conditions.filter((item) => item.mode === 'not')

  return enrichedCards.filter((card) => {
    if (andItems.some((element) => !matchesElement(card, element))) return false
    if (orItems.length > 0 && !orItems.some((element) => matchesElement(card, element))) return false
    if (notItems.some((element) => matchesElement(card, element))) return false
    return true
  })
}

function countBy(items, predicate) {
  return items.reduce((sum, item) => sum + (predicate(item) ? 1 : 0), 0)
}

function topTerms(cards, limit = 8) {
  const counts = new Map()
  for (const item of cards) {
    const terms = uniqueStrings([...item.coverTerms, ...item.topicTerms, ...item.structureTypes, ...item.pathParts.slice(-2)])
    for (const term of terms) {
      if (term.length < 2 || term.length > 24) continue
      counts.set(term, (counts.get(term) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

function topChapter(cards) {
  const counts = new Map()
  for (const item of cards) {
    const label = item.pathLabel || '未分组'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
}

function getCardTone(item) {
  if (item.review.due) return 'text-red-600 bg-red-50'
  if (item.review.weak) return 'text-orange-600 bg-orange-50'
  if (item.review.mastered) return 'text-green-700 bg-green-50'
  return 'text-blue-600 bg-blue-50'
}

function getCardStateLabel(item) {
  if (item.review.due) return '待复习'
  if (item.review.weak) return '薄弱'
  if (item.review.mastered) return '已掌握'
  if (item.review.fresh) return '新卡'
  return getCardReviewStateLabel(item.card)
}

function ElementButton({ element, onAdd, onAddMode, menuOpen, onToggleMenu }) {
  const meta = GROUP_META[element.group] ?? GROUP_META.topic
  return (
    <div className="relative rounded-xl border border-gray-100 bg-white transition hover:border-blue-200 hover:bg-blue-50/40">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          draggable
          onDragStart={(event) => event.dataTransfer.setData('application/miki-element', JSON.stringify(element))}
          onClick={() => onAdd(element)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-xs font-black text-gray-950">{element.label}</span>
        </button>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${meta.accent}`}>{element.count}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleMenu(element.id)
          }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-700"
          aria-label="元素操作"
        >
          ⋯
        </button>
      </div>
      {menuOpen && (
        <div className="absolute right-2 top-9 z-20 w-32 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 text-xs font-bold text-gray-600 shadow-xl">
          <button type="button" onClick={() => onAddMode(element, 'and')} className="block w-full px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-700">必须包含</button>
          <button type="button" onClick={() => onAddMode(element, 'or')} className="block w-full px-3 py-2 text-left hover:bg-violet-50 hover:text-violet-700">任一包含</button>
          <button type="button" onClick={() => onAddMode(element, 'not')} className="block w-full px-3 py-2 text-left hover:bg-red-50 hover:text-red-700">排除这个</button>
        </div>
      )}
    </div>
  )
}

function ConditionChip({ condition, onToggle, onRemove }) {
  const meta = modeMeta(condition.mode)
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${meta.tone}`}>
      <button type="button" onClick={() => onToggle(condition.id)} className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px]">{meta.label}</button>
      <span>{condition.label}</span>
      <button type="button" onClick={() => onRemove(condition.id)} className="rounded-full p-0.5 hover:bg-white/80" aria-label="删除条件">
        <X size={13} />
      </button>
    </span>
  )
}

function KnowledgeMap({ data, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [conditions, setConditions] = useState([])
  const [savedTopics, setSavedTopics] = useState([])
  const [message, setMessage] = useState('')
  const [resultView, setResultView] = useState('list')
  const [openElementMenuId, setOpenElementMenuId] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState(() => ({ topic: true, cover: true, structure: true, review: true }))
  const [elementRenderLimits, setElementRenderLimits] = useState(() => makeElementRenderLimits())
  const [cardRenderLimit, setCardRenderLimit] = useState(INITIAL_RESULT_RENDER_LIMIT)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TOPIC_STORAGE_KEY) || '[]')
      setSavedTopics(Array.isArray(saved) ? saved.slice(0, 12) : [])
    } catch {
      setSavedTopics([])
    }
  }, [])

  const dataDecks = Array.isArray(data?.decks) ? data.decks : []
  const dataCards = Array.isArray(data?.cards) ? data.cards : []
  const enrichedCards = useMemo(() => enrichCards({ decks: dataDecks, cards: dataCards }), [dataDecks, dataCards])
  const elements = useMemo(() => collectElements(enrichedCards), [enrichedCards])
  const elementById = useMemo(() => new Map(elements.map((element) => [element.id, element])), [elements])
  const filteredElements = useMemo(() => {
    const keyword = normalizeText(query)
    if (!keyword) return elements
    return elements.filter((element) => (element.searchText || normalizeText(`${element.label} ${element.terms.join(' ')}`)).includes(keyword))
  }, [elements, query])
  const groupTotals = useMemo(() => {
    const totals = makeElementRenderLimits(0)
    for (const element of filteredElements) totals[element.group] = (totals[element.group] ?? 0) + 1
    return totals
  }, [filteredElements])

  useEffect(() => {
    setElementRenderLimits(makeElementRenderLimits())
  }, [query, elements.length])

  useEffect(() => {
    const hasMore = GROUP_KEYS.some((group) => (elementRenderLimits[group] ?? 0) < (groupTotals[group] ?? 0))
    if (!hasMore) return undefined
    const timer = window.setTimeout(() => {
      setElementRenderLimits((current) => {
        const next = { ...current }
        for (const group of GROUP_KEYS) {
          const total = groupTotals[group] ?? 0
          if ((next[group] ?? 0) < total) next[group] = Math.min(total, (next[group] ?? 0) + ELEMENT_RENDER_STEP)
        }
        return next
      })
    }, AUTO_RENDER_DELAY)
    return () => window.clearTimeout(timer)
  }, [elementRenderLimits, groupTotals])

  const groupedElements = useMemo(() => {
    const grouped = makeElementRenderLimits(0)
    for (const group of GROUP_KEYS) grouped[group] = []
    for (const element of filteredElements) {
      if (!grouped[element.group]) grouped[element.group] = []
      const limit = elementRenderLimits[element.group] ?? INITIAL_ELEMENT_RENDER_LIMIT
      if (grouped[element.group].length < limit) grouped[element.group].push(element)
    }
    return grouped
  }, [filteredElements, elementRenderLimits])

  const matchedCards = useMemo(() => filterCards(enrichedCards, conditions), [enrichedCards, conditions])

  useEffect(() => {
    setCardRenderLimit(INITIAL_RESULT_RENDER_LIMIT)
  }, [conditions, enrichedCards.length])

  useEffect(() => {
    if (cardRenderLimit >= matchedCards.length) return undefined
    const timer = window.setTimeout(() => {
      setCardRenderLimit((current) => Math.min(matchedCards.length, current + RESULT_RENDER_STEP))
    }, AUTO_RENDER_DELAY)
    return () => window.clearTimeout(timer)
  }, [cardRenderLimit, matchedCards.length])

  const visibleCards = useMemo(() => matchedCards.slice(0, cardRenderLimit), [matchedCards, cardRenderLimit])
  const summaryTerms = useMemo(() => topTerms(matchedCards), [matchedCards])
  const chapterSummary = useMemo(() => topChapter(matchedCards), [matchedCards])
  const dueCount = useMemo(() => countBy(matchedCards, (item) => item.review.due), [matchedCards])
  const weakCount = useMemo(() => countBy(matchedCards, (item) => item.review.weak), [matchedCards])
  const masteredCount = useMemo(() => countBy(matchedCards, (item) => item.review.mastered), [matchedCards])
  const topicTitle = conditions.length ? conditions.map((item) => item.label).slice(0, 5).join(' + ') : '从左侧选择知识元素'

  function addCondition(element, mode = 'and') {
    if (!element?.id) return
    setConditions((current) => {
      if (current.some((item) => item.id === element.id)) return current
      return [...current, { ...element, mode }]
    })
  }

  function removeCondition(id) {
    setConditions((current) => current.filter((item) => item.id !== id))
  }

  function toggleCondition(id) {
    setConditions((current) => current.map((item) => item.id === id ? { ...item, mode: cycleMode(item.mode) } : item))
  }

  function handleDrop(event) {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/miki-element')
    if (!raw) return
    try {
      const element = JSON.parse(raw)
      addCondition(element)
    } catch {
      // Ignore malformed drag data.
    }
  }

  function saveTopic() {
    if (!conditions.length) {
      setMessage('先选择几个元素，再保存专题。')
      return
    }
    const topic = {
      id: `topic-${Date.now()}`,
      title: topicTitle,
      conditions: conditions.map(({ id, mode }) => ({ id, mode })),
      createdAt: Date.now(),
    }
    const next = [topic, ...savedTopics].slice(0, 12)
    setSavedTopics(next)
    try {
      localStorage.setItem(TOPIC_STORAGE_KEY, JSON.stringify(next))
      setMessage('专题已保存到本机。')
    } catch {
      setMessage('保存失败：浏览器本地空间可能已满。')
    }
  }

  function loadTopic(topic) {
    const loaded = topic.conditions
      .map((item) => {
        const element = elementById.get(item.id)
        return element ? { ...element, mode: item.mode ?? 'and' } : null
      })
      .filter(Boolean)
    setConditions(loaded)
    setMessage(loaded.length ? `已载入专题：${topic.title}` : '这个专题里的元素暂时匹配不到当前数据。')
  }

  function clearSavedTopic(id) {
    const next = savedTopics.filter((topic) => topic.id !== id)
    setSavedTopics(next)
    try {
      localStorage.setItem(TOPIC_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore storage failures.
    }
  }

  function toggleElementGroup(group) {
    setCollapsedGroups((current) => ({ ...current, [group]: !current[group] }))
  }

  function addConditionWithMode(element, mode) {
    addCondition(element, mode)
    setOpenElementMenuId('')
  }

  function startReviewGroup() {
    if (!matchedCards.length) return
    const firstDeckId = matchedCards[0]?.card?.deckId || studyDeckId
    try {
      sessionStorage.setItem('miki:map:selectedCardIds', JSON.stringify(matchedCards.map((item) => item.id)))
      sessionStorage.setItem('miki:map:selectedTitle', topicTitle)
    } catch {
      // The current Study page does not consume this yet; keep navigation safe.
    }
    if (firstDeckId) navigate(`/study/${firstDeckId}`)
    else navigate('/study')
  }

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId} wide>
      <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-[0.22em] text-blue-600">topic radar</p>
          <h1 className="text-2xl font-black text-gray-950">专题筛卡器</h1>
          <p className="mt-1 text-xs text-gray-500">把知识元素拼成复习专题，重点看右侧筛出的卡片，而不是画一张空导图。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/browse')} className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">回到浏览</button>
          <button onClick={startReviewGroup} className="h-10 rounded-xl bg-[#007aff] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={!matchedCards.length}>开始复习这组卡</button>
        </div>
      </header>

      <section
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="mb-4 rounded-2xl border border-white bg-white/95 p-4 shadow-sm"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black text-gray-400">当前专题</p>
                <h2 className="mt-1 truncate text-xl font-black text-gray-950">{topicTitle}</h2>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-black">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">命中 {matchedCards.length}</span>
                <span className="rounded-full bg-red-50 px-3 py-1 text-red-600">待复习 {dueCount}</span>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-600">薄弱 {weakCount}</span>
                <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">掌握 {masteredCount}</span>
              </div>
            </div>

            {conditions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {conditions.map((condition) => <ConditionChip key={condition.id} condition={condition} onToggle={toggleCondition} onRemove={removeCondition} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 px-4 py-4 text-sm font-bold text-gray-500">
                从左侧点击或拖入元素；默认 AND，点击 chip 上的 AND/OR/NOT 可切换逻辑。
              </div>
            )}

            {savedTopics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="self-center text-[11px] font-black text-gray-400">已保存</span>
                {savedTopics.slice(0, 6).map((topic) => (
                  <span key={topic.id} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-600">
                    <button type="button" onClick={() => loadTopic(topic)}>{topic.title}</button>
                    <button type="button" onClick={() => clearSavedTopic(topic.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                  </span>
                ))}
              </div>
            )}

            {message && <p className="mt-2 text-xs font-bold text-blue-600">{message}</p>}
          </div>

          <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
            <button type="button" onClick={() => setConditions([])} className="h-10 rounded-xl bg-gray-100 px-4 text-xs font-black text-gray-600 hover:bg-gray-200">清空条件</button>
            <button type="button" onClick={saveTopic} className="h-10 rounded-xl bg-gray-950 px-4 text-xs font-black text-white hover:bg-black">保存专题</button>
            <button type="button" onClick={startReviewGroup} disabled={!matchedCards.length} className="h-10 rounded-xl bg-[#007aff] px-4 text-xs font-black text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300">开始学习</button>
          </div>
        </div>
      </section>

      <div className="grid min-h-[660px] grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-white bg-white/90 shadow-sm">
          <div className="border-b border-gray-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-gray-950">元素库</h2>
                <p className="text-[11px] font-bold text-gray-400">上下分层选择；点元素加入，也可用 ⋯ 指定 AND / OR / NOT。</p>
              </div>
              <Layers3 size={17} className="text-blue-500" />
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-300" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索：单位犯罪 / 薄弱 / 主体" className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-[#007aff] focus:bg-white" />
            </div>
          </div>

          <div className="max-h-[calc(100vh-285px)] overflow-auto p-3 space-y-3">
            {Object.entries(GROUP_META).map(([group, meta]) => {
              const shown = groupedElements[group]?.length ?? 0
              const total = groupTotals[group] ?? 0
              const searching = Boolean(normalizeText(query))
              const open = searching || !collapsedGroups[group]
              return (
                <section key={group} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-2">
                  <button
                    type="button"
                    onClick={() => toggleElementGroup(group)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left hover:bg-white"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-black text-gray-950">{meta.title}</span>
                      <span className="block truncate text-[10px] font-bold text-gray-400">{meta.subtitle}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${meta.accent}`}>{shown}/{total}</span>
                      <span className="text-sm font-black text-gray-300">{open ? '⌄' : '›'}</span>
                    </span>
                  </button>

                  {open && (
                    <div className="mt-1 grid grid-cols-1 gap-1.5">
                      {(groupedElements[group] ?? []).map((element) => (
                        <ElementButton
                          key={element.id}
                          element={element}
                          onAdd={addCondition}
                          onAddMode={addConditionWithMode}
                          menuOpen={openElementMenuId === element.id}
                          onToggleMenu={(id) => setOpenElementMenuId((current) => current === id ? '' : id)}
                        />
                      ))}
                      {(groupedElements[group] ?? []).length === 0 && <p className="rounded-xl bg-white px-3 py-5 text-center text-xs font-bold text-gray-400">暂无匹配元素</p>}
                      {total > shown && <p className="px-2 py-1 text-center text-[10px] font-bold text-gray-400">正在分批加载 {shown}/{total} 个元素…</p>}
                    </div>
                  )}
                </section>
              )
            })}

            <div className="rounded-2xl bg-blue-50/60 p-3 text-[11px] font-bold leading-5 text-blue-700">
              目录式上下选择更适合拖拽：先展开“章节/考点/结构/状态”，再点元素或用 ⋯ 加入专题条件。
            </div>
          </div>
        </aside>

        <main className="overflow-hidden rounded-2xl border border-white bg-white/90 shadow-sm">
          <div className="border-b border-gray-200 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black text-gray-400">筛选结果</p>
                <h2 className="mt-1 text-xl font-black text-gray-950">{matchedCards.length} 张卡</h2>
                <p className="mt-1 text-xs text-gray-500">结果区是主舞台：先看命中卡，再决定是否继续加条件。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setResultView('list')} className={`h-9 rounded-xl px-3 text-xs font-black ${resultView === 'list' ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>列表</button>
                <button type="button" onClick={() => setResultView('grid')} className={`h-9 rounded-xl px-3 text-xs font-black ${resultView === 'grid' ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>卡片</button>
                <button type="button" onClick={startReviewGroup} disabled={!matchedCards.length} className="h-9 rounded-xl bg-[#007aff] px-3 text-xs font-black text-white disabled:bg-gray-300">开始复习</button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
              <div className="rounded-2xl bg-gray-50/80 p-3">
                <h3 className="mb-2 text-xs font-black text-gray-900">共同点总结</h3>
                <div className="flex flex-wrap gap-1.5">
                  {summaryTerms.map((term) => <span key={term.label} className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-gray-600">{term.label} · {term.count}</span>)}
                  {summaryTerms.length === 0 && <span className="text-xs font-bold text-gray-400">命中卡片后自动显示高频元素。</span>}
                </div>
              </div>

              <div className="rounded-2xl bg-gray-50/80 p-3">
                <h3 className="mb-2 text-xs font-black text-gray-900">主要集中</h3>
                <div className="space-y-1.5">
                  {chapterSummary.map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-600">
                      <span className="min-w-0 truncate">{label}</span>
                      <span className="shrink-0 text-gray-400">{count}</span>
                    </div>
                  ))}
                  {chapterSummary.length === 0 && <p className="text-xs font-bold text-gray-400">组合条件后显示集中章节。</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="max-h-[calc(100vh-360px)] overflow-auto p-4">
            <div className={resultView === 'grid' ? 'grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3' : 'space-y-3'}>
              {visibleCards.map((item) => {
                const hitLabels = conditions.filter((condition) => matchesElement(item, condition)).map((condition) => condition.label).slice(0, 6)
                return (
                  <article key={item.id} className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-blue-100 hover:shadow-md ${resultView === 'list' ? 'grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center' : ''}`}>
                    <div className="min-w-0">
                      <div className="mb-2 flex items-start gap-2">
                        <h3 className="min-w-0 flex-1 line-clamp-2 text-base font-black leading-6 text-gray-950">{item.title}</h3>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${getCardTone(item)}`}>{getCardStateLabel(item)}</span>
                      </div>
                      <p className="truncate text-[11px] font-bold text-gray-400">{item.pathLabel}</p>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">{item.preview}</p>
                      {hitLabels.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{hitLabels.map((label) => <span key={label} className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-600">{label}</span>)}</div>}
                    </div>
                    <div className={`flex gap-2 ${resultView === 'list' ? 'xl:flex-col' : 'mt-3'}`}>
                      <button type="button" onClick={() => navigate('/browse', { state: { deckId: item.card.deckId } })} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-gray-600 hover:bg-gray-200">去浏览</button>
                      <button type="button" onClick={() => item.card.deckId && navigate(`/study/${item.card.deckId}`)} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-100">学这张</button>
                    </div>
                  </article>
                )
              })}
            </div>

            {matchedCards.length > visibleCards.length && <p className="py-4 text-center text-xs font-bold text-gray-400">正在分批加载 {visibleCards.length}/{matchedCards.length} 张卡，不会一次性塞满页面。</p>}
            {conditions.length > 0 && matchedCards.length === 0 && <p className="py-16 text-center text-sm font-bold text-gray-400">没有卡片同时符合这些条件，试着把部分 AND 切成 OR。</p>}
            {conditions.length === 0 && <p className="py-16 text-center text-sm font-bold text-gray-400">还没有专题条件，点击左侧元素后这里会实时显示筛选结果。</p>}
          </div>
        </main>
      </div>
    </Shell>
  )
}

export default KnowledgeMap
