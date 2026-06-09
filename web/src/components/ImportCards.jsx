import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, FolderOpen, Loader2, PencilLine, Upload, Wand2 } from 'lucide-react'
import { importApkgFileInBatches, parseApkgPreview } from '../apkgImport.js'
import { parseBulkCards, parseMarkdownCards } from '../cardImport.js'
import { buildCardValueFromTemplate } from '../lib/cardHtml.js'
import { getCardTemplates } from '../lib/cardTemplates.js'
import { getAnkiDeckTarget, getStableDeckColor, summarizeAnkiDeckTargets, getDeckIdentityKey, getDeckOptionLabel, getDeckPath, getDeckSection, getDeckChapter, normalizePathPart } from '../lib/deckUtils.js'
import Shell from './Shell.jsx'
import CardContent from './CardContent.jsx'
import DeckSelectOptions from './DeckSelectOptions.jsx'
import TemplateManager from './TemplateManager.jsx'
import { createUserAnkiPackManifest, loadUserAnkiPacksAsData, makeUserAnkiPackId, putUserAnkiPackChunk } from '../lib/userAnkiPackStore.js'

const IMPORT_FILE_ACCEPT = '.apkg,.colpkg,.txt,.md,.csv,.tsv,.html,.htm,text/*,image/*,.pdf,.doc,.docx'

function hashText(value = '') {
  const text = String(value ?? '')
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function makeLightPreviewText(card = {}, side = 'front') {
  const raw = side === 'front'
    ? (card.front || card.rawFront || card.frontHtml || '')
    : (card.back || card.rawBack || card.backHtml || '')
  return stripHtmlText(raw).slice(0, 1200) || (side === 'front' ? 'Anki 正面预览' : 'Anki 背面预览')
}

function createDeckResolver({ data, fallbackDeck, mode, selectedDeckId, packId }) {
  const existingByKey = new Map((data.decks || []).map((deck) => [getDeckIdentityKey(deck), deck]))
  const createdByKey = new Map()

  return {
    resolve(card) {
      if (mode === 'selected') return selectedDeckId
      const target = getAnkiDeckTarget(card, fallbackDeck)
      const key = getDeckIdentityKey(target)
      const existingDeck = existingByKey.get(key)
      if (existingDeck?.id) return existingDeck.id
      const createdDeck = createdByKey.get(key)
      if (createdDeck?.id) return createdDeck.id
      const deck = {
        id: `deck-${packId}-${hashText(key)}`,
        name: target.name,
        description: target.description,
        section: target.section,
        chapter: target.chapter,
        color: getStableDeckColor(key),
        createdAt: Date.now() + createdByKey.size,
        updatedAt: Date.now() + createdByKey.size,
        source: { type: 'user-apkg-pack', userAnkiPack: packId },
      }
      createdByKey.set(key, deck)
      return deck.id
    },
    getCreatedDecks() {
      return Array.from(createdByKey.values())
    },
  }
}


function isImportedAnkiGeneratedDeck(deck = {}) {
  const sourceType = String(deck?.source?.type || deck?.type || '').toLowerCase()
  const id = String(deck?.id || '')
  const pathText = [deck?.section, deck?.chapter, deck?.name, deck?.description, deck?.source?.deckName]
    .filter(Boolean)
    .join(' / ')

  return Boolean(
    deck?.userAnkiPack
    || deck?.source?.userAnkiPack
    || deck?.builtinDyl
    || deck?.source?.nativeTemplate
    || deck?.source?.lazyNativeAnkiRender
    || deck?.source?.deckName
    || Array.isArray(deck?.source?.deckPath)
    || ['user-apkg-pack', 'builtin-dyl', 'apkg', 'anki', 'anki-import', 'anki-pack'].includes(sourceType)
    || /^deck-(?:user-)?apkg/i.test(id)
    || /^deck-user-anki/i.test(id)
    || /从\s*Anki\s*原卡组|APKG|Anki\s*导入|原卡组/.test(pathText)
  )
}

function makeImportDeckToken(value = '') {
  return normalizePathPart(value).toLowerCase()
}

function getDeletedImportDeckIds(data = {}) {
  return new Set([
    ...(Array.isArray(data?.profile?.deletedUserAnkiDeckIds) ? data.profile.deletedUserAnkiDeckIds : []),
    ...(Array.isArray(data?.profile?.deletedDeckIds) ? data.profile.deletedDeckIds : []),
  ].map((id) => String(id || '')).filter(Boolean))
}

function getDeletedImportDeckTokens(data = {}) {
  const profile = data?.profile || {}
  return new Set([
    ...(Array.isArray(profile.deletedDeckSections) ? profile.deletedDeckSections : []),
    ...(Array.isArray(profile.deletedDeckGroups) ? profile.deletedDeckGroups : []),
    ...(Array.isArray(profile.deletedDeckPaths) ? profile.deletedDeckPaths : []),
    ...(Array.isArray(profile.deletedDeckNames) ? profile.deletedDeckNames : []),
  ].map(makeImportDeckToken).filter(Boolean))
}

function getImportDeckTokens(deck = {}) {
  const section = getDeckSection(deck)
  const chapter = getDeckChapter(deck)
  const name = deck?.name || ''
  const sourceDeckPath = Array.isArray(deck?.source?.deckPath)
    ? deck.source.deckPath.join(' / ')
    : ''

  const rawTokens = [
    section,
    chapter,
    name,
    getDeckPath(deck),
    getDeckOptionLabel(deck),
    section && name ? `${section} / ${name}` : '',
    section && chapter ? `${section} / ${chapter}` : '',
    sourceDeckPath,
    deck?.source?.deckName,
    ...(chapter ? String(chapter).split('/').map((part) => normalizePathPart(part)) : []),
    ...(Array.isArray(deck?.source?.deckPath) ? deck.source.deckPath.map((part) => normalizePathPart(part)) : []),
  ]

  return rawTokens.map(makeImportDeckToken).filter(Boolean)
}

function isDeletedImportTargetDeck(deck = {}, data = {}) {
  const deletedIds = getDeletedImportDeckIds(data)
  if (deletedIds.has(String(deck?.id || ''))) return true

  const deletedTokens = getDeletedImportDeckTokens(data)
  if (deletedTokens.size === 0) return false

  const deckTokens = getImportDeckTokens(deck)
  return deckTokens.some((token) => {
    if (deletedTokens.has(token)) return true
    // 删除的是上层目录时，也隐藏其子路径；反过来不成立，避免误删短词。
    for (const deletedToken of deletedTokens) {
      if (deletedToken.length >= 2 && token.startsWith(`${deletedToken} / `)) return true
    }
    return false
  })
}

function getImportTargetDecks(data = {}) {
  const decks = Array.isArray(data?.decks) ? data.decks : []
  return decks.filter((deck) => (
    deck?.id
    && !deck?.deletedAt
    && !isImportedAnkiGeneratedDeck(deck)
    && !isDeletedImportTargetDeck(deck, data)
  ))
}


function stripHtmlText(value = '') {
  if (typeof document === 'undefined') return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const element = document.createElement('div')
  element.innerHTML = String(value ?? '')
  return (element.textContent || element.innerText || '').replace(/\s+/g, ' ').trim()
}

function makePlainAnkiCard(card) {
  const front = stripHtmlText(card.rawFront || card.frontHtml || card.front || '') || card.front || 'Anki 卡片'
  const back = stripHtmlText(card.rawBack || card.backHtml || card.back || '') || card.back || ''
  const {
    frontHtml,
    backHtml,
    cardCss,
    cardJs,
    htmlSections,
    ...rest
  } = card

  return {
    ...rest,
    front,
    back,
    rawFront: front,
    rawBack: back,
    template: 'qa',
  }
}

function makeTemplateAnkiCard(card, template, fallbackTemplateId) {
  const front = card.rawFront ?? card.front ?? stripHtmlText(card.frontHtml ?? '')
  const back = card.rawBack ?? card.back ?? stripHtmlText(card.backHtml ?? '')
  const value = buildCardValueFromTemplate({
    ...card,
    front,
    back,
    rawFront: front,
    rawBack: back,
    template: template?.id ?? fallbackTemplateId,
  }, template)

  return {
    ...card,
    ...value,
    front: value.front ?? front,
    back: value.back ?? back,
    rawFront: front,
    rawBack: back,
    template: template?.id ?? fallbackTemplateId,
  }
}

function ImportCards({ data, onCreateCards, onUserAnkiPacksChanged, onSaveCardTemplate, onDeleteCardTemplate, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const [selectedDeckId, setSelectedDeckId] = useState(() => getImportTargetDecks(data)[0]?.id ?? '')
  const [importMode, setImportMode] = useState('qa')
  const [selectedTemplateId, setSelectedTemplateId] = useState('qa')
  const [templateMode, setTemplateMode] = useState('plain')
  const [ankiDeckMode, setAnkiDeckMode] = useState('auto')
  const [ankiContentMode, setAnkiContentMode] = useState('package')
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false)
  const fileInputRef = useRef(null)
  const [selectedAnkiFile, setSelectedAnkiFile] = useState(null)
  const [rawText, setRawText] = useState('')
  const [apkgImport, setApkgImport] = useState(null)
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const [message, setMessage] = useState('')
  const [previewSide, setPreviewSide] = useState('front')

  const cardTemplates = useMemo(() => getCardTemplates(data), [data])
  const importTargetDecks = useMemo(() => getImportTargetDecks(data), [data])
  const firstImportTargetDeckId = importTargetDecks[0]?.id ?? data.decks[0]?.id ?? ''
  const plainTemplates = useMemo(() => cardTemplates.filter((template) => template.mode !== 'html'), [cardTemplates])
  const htmlTemplates = useMemo(() => cardTemplates.filter((template) => template.mode === 'html'), [cardTemplates])
  const shouldShowTemplatePicker = importMode !== 'anki' || ankiContentMode === 'template'
  const visibleTemplates = templateMode === 'html' ? cardTemplates : (plainTemplates.length ? plainTemplates : cardTemplates)
  const selectedTemplateBase = visibleTemplates.find((template) => template.id === selectedTemplateId)
    ?? visibleTemplates[0]
    ?? cardTemplates[0]
  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateBase) return selectedTemplateBase
    if (templateMode !== 'html' || selectedTemplateBase.mode === 'html') return selectedTemplateBase

    return {
      ...selectedTemplateBase,
      mode: 'html',
      frontCode: selectedTemplateBase.frontCode || '{{正面}}',
      backCode: selectedTemplateBase.backCode || '{{反面}}',
      css: selectedTemplateBase.css || '',
      js: selectedTemplateBase.js || '',
    }
  }, [selectedTemplateBase, templateMode])

  const rawParsedTextCards = useMemo(() => (
    importMode === 'markdown' ? parseMarkdownCards(rawText) : parseBulkCards(rawText)
  ), [importMode, rawText])

  const parsedTextCards = useMemo(() => rawParsedTextCards.map((card) => {
    const cardTemplate = card.template
      ? (cardTemplates.find((template) => template.id === card.template) ?? selectedTemplate)
      : selectedTemplate
    const cardTemplateId = cardTemplate?.id ?? selectedTemplate?.id ?? selectedTemplateId
    const value = buildCardValueFromTemplate({
      ...card,
      template: cardTemplateId,
      front: card.front ?? '',
      back: card.back ?? '',
    }, cardTemplate)
    return { ...card, ...value, template: cardTemplateId }
  }), [cardTemplates, rawParsedTextCards, selectedTemplate, selectedTemplateId])

  const parsedAnkiCards = useMemo(() => {
    const cards = apkgImport?.cards ?? []
    if (importMode !== 'anki') return []
    if (ankiContentMode === 'plain') return cards.map(makePlainAnkiCard)
    if (ankiContentMode === 'template') {
      return cards.map((card) => makeTemplateAnkiCard(card, selectedTemplate, selectedTemplateId))
    }
    return cards
  }, [ankiContentMode, apkgImport, importMode, selectedTemplate, selectedTemplateId])

  const parsedCards = importMode === 'anki' ? parsedAnkiCards : parsedTextCards
  const importableCount = importMode === 'anki' ? Number(apkgImport?.cardCount ?? parsedCards.length) : parsedCards.length
  const previewCards = importMode === 'anki' ? (apkgImport?.cards ?? []) : parsedCards
  const ankiDeckSummaries = useMemo(() => apkgImport?.deckSummaries ?? [], [apkgImport])

  useEffect(() => {
    if (!importTargetDecks.find((deck) => deck.id === selectedDeckId)) {
      setSelectedDeckId(firstImportTargetDeckId ?? '')
    }
  }, [firstImportTargetDeckId, importTargetDecks, selectedDeckId])

  useEffect(() => {
    if (visibleTemplates.some((template) => template.id === selectedTemplateId)) return
    const preferredHtmlTemplate = htmlTemplates.find((template) => template.id === 'quiz-choice-control-center')
    setSelectedTemplateId(
      templateMode === 'html'
        ? (preferredHtmlTemplate?.id ?? visibleTemplates[0]?.id ?? 'html')
        : (visibleTemplates[0]?.id ?? 'qa'),
    )
  }, [htmlTemplates, selectedTemplateId, templateMode, visibleTemplates])

  async function handleImport() {
    const needDeck = importMode !== 'anki' || ankiDeckMode === 'selected'
    if (needDeck && !selectedDeckId) {
      setMessage('请先选择一个卡组。')
      return
    }
    if (importableCount === 0) {
      setMessage('没有识别到可导入的卡片。')
      return
    }

    if (importMode === 'anki') {
      if (!selectedAnkiFile) {
        setMessage('请先重新选择 APKG/COLPKG 文件。')
        return
      }
      const packId = makeUserAnkiPackId(selectedAnkiFile.name)
      const fallbackDeck = importTargetDecks.find((deck) => deck.id === selectedDeckId) ?? data.decks.find((deck) => deck.id === selectedDeckId) ?? importTargetDecks[0] ?? data.decks[0] ?? null
      const deckResolver = createDeckResolver({
        data,
        fallbackDeck,
        mode: ankiDeckMode,
        selectedDeckId,
        packId,
      })
      let chunkIndex = 0
      setIsImporting(true)
      setImportProgress({ stage: '准备分块导入 Anki 包', percent: 1, processed: 0, total: importableCount })
      setMessage('正在分块导入 APKG：只写入数据，不在导入页渲染 iframe。')
      try {
        await createUserAnkiPackManifest({
          packId,
          fileName: selectedAnkiFile.name,
          deckSummaries: apkgImport?.deckSummaries ?? [],
          cardCount: apkgImport?.cardCount ?? 0,
          noteCount: apkgImport?.noteCount ?? 0,
          templates: apkgImport?.templates ?? [],
        })

        const result = await importApkgFileInBatches(selectedAnkiFile, {
          importId: apkgImport?.importId ?? `apkg-${Date.now()}`,
          renderMode: 'native',
          batchSize: 25,
          onProgress: (progress) => {
            const total = Number(progress.total || importableCount || 1)
            const processed = Number(progress.processed || 0)
            const percent = progress.percent !== undefined
              ? progress.percent
              : Math.min(99, Math.round((processed / Math.max(1, total)) * 100))
            setImportProgress({
              stage: progress.stage || '正在导入 Anki 卡片',
              percent: Math.max(1, Math.min(99, Math.round(percent))),
              processed,
              total,
            })
          },
          onBatch: async ({ cards, templates, processed, total }) => {
            const cardsWithDecks = cards.map((card) => ({
              ...card,
              deckId: ankiDeckMode === 'selected' ? selectedDeckId : deckResolver.resolve(card),
            }))
            await putUserAnkiPackChunk({
              packId,
              chunkIndex,
              cards: cardsWithDecks,
              decks: deckResolver.getCreatedDecks(),
              templates,
              processed,
              total,
            })
            chunkIndex += 1
          },
        })

        setImportProgress({ stage: '正在刷新目录索引', percent: 100, processed: result.importedCount || importableCount, total: result.cardCount || importableCount })
        const bundle = await loadUserAnkiPacksAsData()
        onUserAnkiPacksChanged?.(bundle)
        setMessage(`已导入 ${result.importedCount || importableCount} 张 Anki 卡。`)
        window.setTimeout(() => {
          setIsImporting(false)
          navigate('/browse', { state: { deckId: ankiDeckMode === 'selected' ? selectedDeckId : undefined, refreshDirectoryAt: Date.now() } })
        }, 80)
      } catch (error) {
        setIsImporting(false)
        setImportProgress(null)
        setMessage(error?.message || 'APKG 分块导入失败。')
      }
      return
    }

    setIsImporting(true)
    setMessage(`正在${importVerb} ${parsedCards.length} 张卡片，请稍等...`)
    window.setTimeout(() => {
      onCreateCards(selectedDeckId, parsedCards, {
        autoAnkiDecks: false,
      })
      window.setTimeout(() => {
        setIsImporting(false)
        navigate('/browse', { state: { deckId: selectedDeckId, refreshDirectoryAt: Date.now() } })
      }, 80)
    }, 30)
  }

  async function handleChosenFile(file) {
    if (!file) return

    const lowerName = file.name.toLowerCase()
    const isAnkiPackage = lowerName.endsWith('.apkg') || lowerName.endsWith('.colpkg')
    const isTextLike = file.type.startsWith('text/')
      || lowerName.endsWith('.txt')
      || lowerName.endsWith('.md')
      || lowerName.endsWith('.csv')
      || lowerName.endsWith('.tsv')
      || lowerName.endsWith('.html')
      || lowerName.endsWith('.htm')

    if (isAnkiPackage) {
      const importId = `apkg-${Date.now()}`
      setImportMode('anki')
      setAnkiContentMode('package')
      setSelectedAnkiFile(file)
      setRawText('')
      setApkgImport(null)
      setIsParsingFile(true)
      setImportProgress({ stage: '准备解析 Anki 包', percent: 2, processed: 0, total: 0 })
      setMessage('正在解析 Anki 包...')

      try {
        const result = await parseApkgPreview(file, {
          importId,
          previewLimit: 5,
          renderMode: 'plain',
          onProgress: (progress) => {
            setImportProgress({
              stage: progress.stage || '正在处理文件',
              percent: Math.max(0, Math.min(100, Math.round(progress.percent ?? 0))),
              processed: progress.processed ?? progress.imported ?? 0,
              total: progress.total ?? 0,
            })
          },
        })
        const fallbackDeck = importTargetDecks.find((deck) => deck.id === selectedDeckId) ?? data.decks.find((deck) => deck.id === selectedDeckId) ?? importTargetDecks[0] ?? data.decks[0] ?? null
        const targetCount = summarizeAnkiDeckTargets(result.deckSummaries ?? [], fallbackDeck).length || 1
        setApkgImport(result)
        setImportProgress({ stage: '解析完成', percent: 100, processed: result.cards.length, total: result.cardCount })
        setMessage(`已读取 ${result.cardCount} 张 Anki 卡；导入时将分块写入，当前只生成 ${result.cards.length} 张轻量预览。`)
      } catch (error) {
        setImportProgress(null)
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
    setSelectedAnkiFile(null)
    setImportProgress(null)
    if (lowerName.endsWith('.md')) setImportMode('markdown')
    else if (importMode === 'anki') setImportMode('qa')
    const text = await file.text()
    setRawText(text)
    const choiceHint = /(?:答案|正确答案|参考答案)\s*[:：]\s*[A-H]{1,8}/i.test(text) && /(^|\n|\s)[A-H]\s*[\.．、:：]/i.test(text)
    if (choiceHint) {
      setTemplateMode('html')
      setSelectedTemplateId('quiz-choice-control-center')
    }
    setMessage(`已读取 ${file.name}${choiceHint ? '，检测到选择题并已切到选择题模板。' : ''}`)
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    await handleChosenFile(file)
  }

  function handleDropFile(event) {
    event.preventDefault()
    setIsDraggingFile(false)
    const file = event.dataTransfer?.files?.[0]
    handleChosenFile(file)
  }

  const selectedDeck = importTargetDecks.find((deck) => deck.id === selectedDeckId) ?? null
  const ankiTargetSummaries = useMemo(() => summarizeAnkiDeckTargets(ankiDeckSummaries, selectedDeck), [ankiDeckSummaries, selectedDeck])
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
  const quizChoiceSampleText = `【单选】下列关于正当防卫的说法，正确的是哪一项？
A. 只要主观上认为有危险，就一定成立正当防卫
B. 必须存在现实的不法侵害
C. 防卫对象可以是任何第三人
D. 防卫行为没有限度要求
答案：B
标签：刑法总论｜正当防卫
解析：正当防卫要求存在现实的不法侵害，假想防卫不能直接成立正当防卫。`
  const sampleText = selectedTemplate?.id === 'quiz-choice-control-center'
    ? quizChoiceSampleText
    : importMode === 'markdown'
      ? markdownSampleText
      : qaSampleText
  const importVerb = importMode === 'markdown' ? '同步' : '导入'
  const pageSubtitle = importMode === 'anki'
    ? '导入 Anki APKG/COLPKG，默认按原生 Anki 模板渲染；也可转纯文本或网站模板。'
    : importMode === 'markdown'
      ? '把 Markdown 标题同步成背诵卡，重复同步会更新原卡片。'
      : '把 AI 整理好的问题答案导入到一个卡组。'

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-950">批量制卡</h1>
          <p className="text-sm text-gray-500 mt-1">{pageSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <a href="https://anki-card-maker-xi.vercel.app/" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"><ExternalLink size={15} /> AI制卡器</a>
          <button onClick={() => navigate('/decks')} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">取消</button>
          <button onClick={handleImport} className="h-10 px-5 rounded-xl bg-[#007aff] text-sm font-bold text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300" disabled={importableCount === 0 || isParsingFile || isImporting}>
            {isImporting ? <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" />处理中...</span> : `${importVerb} ${importableCount} 张`}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-5 items-start">
        <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
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

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-10 px-4 rounded-xl bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 cursor-pointer flex items-center gap-2"
              >
                {isParsingFile ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                读取文件
              </button>
              <input ref={fileInputRef} type="file" accept={IMPORT_FILE_ACCEPT} onChange={handleFile} className="hidden" />
              {message && <span className="text-xs font-bold text-gray-400">{message}</span>}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
              <div className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_auto] xl:items-center">
                <label className="flex min-w-0 items-center gap-2 text-sm font-bold text-gray-800">
                  卡组
                  <select
                    value={selectedDeckId}
                    onChange={(event) => setSelectedDeckId(event.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none focus:border-[#007aff]"
                  >
                    <DeckSelectOptions decks={importTargetDecks} />
                  </select>
                </label>

                {importMode === 'anki' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-gray-400">分组</span>
                    {[
                      { value: 'auto', label: '按 APKG 原目录' },
                      { value: 'selected', label: '全部到所选卡组' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAnkiDeckMode(option.value)}
                        className={`h-8 rounded-lg px-3 text-xs font-black transition-colors ${ankiDeckMode === option.value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {importMode === 'anki' ? (
                  <>
                    <span className="text-xs font-black text-gray-400">导入格式</span>
                    {[
                      { value: 'package', label: '原生 Anki' },
                      { value: 'plain', label: '纯文本' },
                      { value: 'template', label: '网站模板' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setAnkiContentMode(option.value)
                          if (option.value === 'template') setTemplateMode('html')
                          setMessage('')
                        }}
                        className={`h-8 rounded-lg px-3 text-xs font-black transition-colors ${ankiContentMode === option.value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <span className="text-xs font-black text-gray-400">导入格式</span>
                    {[
                      { value: 'plain', label: '纯文本' },
                      { value: 'html', label: 'HTML' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setTemplateMode(option.value)
                          setMessage('')
                        }}
                        className={`h-8 rounded-lg px-3 text-xs font-black transition-colors ${templateMode === option.value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </>
                )}

                {shouldShowTemplatePicker && (
                  <>
                    <select
                      value={selectedTemplate?.id ?? selectedTemplateId}
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                      className="h-8 min-w-48 rounded-lg border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 outline-none focus:border-[#007aff]"
                    >
                      {visibleTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {templateMode === 'html' && template.mode !== 'html' ? `${template.name}（HTML）` : template.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setTemplateManagerOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-50 px-3 text-xs font-black text-blue-600 hover:bg-blue-100"
                  title="打开模板编辑窗口"
                >
                  <PencilLine size={13} /> 编辑模板
                </button>
              </div>

              {importMode === 'anki' && (
                <p className="mt-3 text-[11px] font-bold leading-5 text-gray-400">
                  原生 Anki 会保留 APKG 自带字段、正反面模板和 CSS；导入时只写入数据，不批量渲染 iframe，学习页打开当前卡时再渲染。
                </p>
              )}
            </div>
          </div>

          {importMode === 'anki' ? (
            <div className="min-h-[520px] bg-white px-5 py-5">
              {apkgImport ? (
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                    <p className="text-sm font-black text-blue-900">Anki 包已就绪</p>
                    <p className="mt-1 text-sm font-bold text-blue-700">
                      原始笔记 {apkgImport.noteCount} 条，卡片 {apkgImport.cardCount} 张，可导入 {importableCount} 张。
                    </p>
                    {ankiTargetSummaries.length > 0 && ankiDeckMode === 'auto' && (
                      <p className="mt-2 text-xs font-bold text-blue-600">将按 Anki 原目录导入到 {ankiTargetSummaries.length} 个卡组。</p>
                    )}
                    {ankiDeckMode === 'selected' && (
                      <p className="mt-2 text-xs font-bold text-blue-600">将全部导入到：{selectedDeck ? getDeckPath(selectedDeck) : '未选择卡组'}。</p>
                    )}
                  </div>
                  {importProgress && importProgress.percent < 100 && (
                    <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3">
                      <div className="mb-2 flex items-center justify-between text-xs font-black text-blue-600">
                        <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{importProgress.stage}</span>
                        <span>{importProgress.percent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${importProgress.percent}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: '原始笔记', value: apkgImport.noteCount },
                      { label: '原始卡片', value: apkgImport.cardCount },
                      { label: '可导入', value: importableCount },
                      { label: ankiDeckMode === 'auto' ? '目标卡组' : '指定卡组', value: ankiDeckMode === 'auto' ? (ankiTargetSummaries.length || 1) : 1 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl bg-gray-50 px-4 py-3">
                        <p className="text-2xl font-black text-gray-950">{item.value}</p>
                        <p className="mt-1 text-xs font-bold text-gray-400">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  {apkgImport.warnings?.length > 0 && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                      <p className="mb-2 text-xs font-black text-amber-700">媒体/模板提示</p>
                      <div className="space-y-1">
                        {apkgImport.warnings.slice(0, 6).map((warning) => (
                          <p key={warning} className="text-xs font-bold text-amber-700">{warning}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {ankiTargetSummaries.length > 0 && (
                    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                      <p className="mb-2 text-xs font-black text-gray-400">APKG 内部目录预览</p>
                      <div className="grid gap-1.5">
                        {ankiTargetSummaries.slice(0, 10).map((summary) => (
                          <div key={getDeckIdentityKey(summary)} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                            <span className="min-w-0 truncate text-xs font-bold text-gray-700">{getDeckOptionLabel(summary)}</span>
                            <span className="shrink-0 text-xs font-black text-gray-400">{summary.count}</span>
                          </div>
                        ))}
                        {ankiTargetSummaries.length > 10 && (
                          <p className="px-1 text-[11px] font-bold text-gray-300">还有 {ankiTargetSummaries.length - 10} 个目录会一并导入。</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => { event.preventDefault(); setIsDraggingFile(true) }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleDropFile}
                  className={`grid min-h-[480px] w-full place-items-center rounded-2xl border border-dashed text-center transition-colors ${isDraggingFile ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-200 hover:bg-blue-50/50'}`}
                >
                  <div>
                    {isParsingFile ? <Loader2 size={30} className="mx-auto mb-3 animate-spin text-blue-500" /> : <Upload size={30} className="mx-auto mb-3 text-gray-300" />}
                    <p className="text-sm font-black text-gray-700">{isParsingFile ? '正在解析 Anki 包...' : '点击或拖入 .apkg / .colpkg 文件'}</p>
                    <p className="mt-2 max-w-md text-xs leading-6 text-gray-400">会读取 Anki 的模板、字段、CSS。可以选择按原目录导入，也可以全部导入到指定卡组。</p>
                    {importProgress && (
                      <div className="mx-auto mt-5 w-full max-w-sm text-left">
                        <div className="mb-2 flex items-center justify-between text-[11px] font-black text-blue-600">
                          <span>{importProgress.stage}</span>
                          <span>{importProgress.percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${importProgress.percent}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
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
              <p className="text-xs font-black text-gray-400 mb-2">{importMode === 'anki' ? '导入设置' : '目标卡组'}</p>
              {selectedDeck && (
                <span className="mb-2 inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-black text-gray-500">
                  <FolderOpen size={12} /> {getDeckPath(selectedDeck)}
                </span>
              )}
              <h2 className="text-lg font-black text-gray-950">{importMode === 'anki' ? (ankiDeckMode === 'auto' ? '按 APKG 原目录' : '指定卡组导入') : (selectedDeck?.name ?? '未选择')}</h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                {importMode === 'anki'
                  ? (ankiDeckMode === 'auto'
                    ? '会尽量复用 APKG 内部 :: 路径生成卡组；没有路径的卡片才落入兜底卡组。'
                    : `会忽略 APKG 内部路径，全部放到 ${selectedDeck?.name ?? '所选卡组'}。`)
                  : (selectedDeck?.description ?? '先创建一个卡组。')}
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <div className="p-5">
                <p className="text-xs font-bold text-gray-400 mb-1">识别</p>
                <p className="text-3xl font-black text-gray-950">{importableCount}</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-bold text-gray-400 mb-1">{importMode === 'anki' ? '目录' : '现有'}</p>
                <p className="text-3xl font-black text-gray-950">{importMode === 'anki' ? (ankiTargetSummaries.length || 1) : data.cards.filter((card) => card.deckId === selectedDeckId).length}</p>
              </div>
            </div>
          </section>

          {shouldShowTemplatePicker && selectedTemplate && (
            <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
              <div className="p-5">
                <p className="text-xs font-black text-gray-400 mb-2">当前模板</p>
                <h2 className="text-sm font-black text-gray-950">{selectedTemplate.name}</h2>
                <p className="mt-2 text-xs leading-5 text-gray-500">{selectedTemplate.description || '按所选模板批量生成卡片。'}</p>
                {importMode === 'anki' && ankiContentMode === 'template' && (
                  <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold leading-5 text-blue-700">会把 APKG 卡片的正反面文本重新套用到该模板。适合想统一你网站内样式时使用。</p>
                )}
              </div>
            </section>
          )}

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
            <div className="min-h-11 px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-gray-950">预览</h2>
                <p className="mt-1 text-[11px] font-bold text-gray-400">前 5 张轻量预览；APKG 不在导入页批量渲染</p>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { value: 'front', label: '正面' },
                  { value: 'back', label: '背面' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreviewSide(option.value)}
                    className={`h-8 rounded-lg px-3 text-xs font-black transition-colors ${previewSide === option.value ? 'bg-[#007aff] text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-800'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[680px] overflow-y-auto bg-gray-50/60">
              {previewCards.length === 0 && <p className="text-sm text-gray-400 text-center py-10">暂无可导入卡片。</p>}
              {previewCards.slice(0, 5).map((card, index) => (
                <div key={`${card.sourceKey ?? card.front}-${index}`} className="p-4 border-b border-gray-100">
                  <div className="mb-3 flex items-center gap-2">
                    <p className="text-sm font-black text-gray-950 line-clamp-2 flex-1">卡片 {index + 1} / {importableCount}</p>
                    <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[10px] font-black text-gray-400">{card.source?.type === 'apkg' ? 'APKG 原生' : card.template === 'list' ? '列表' : card.sourceKey ? 'MD' : 'QA'}</span>
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
                    {importMode === 'anki' ? (
                      <p className="text-sm leading-7 text-gray-700 whitespace-pre-wrap">{makeLightPreviewText(card, previewSide)}</p>
                    ) : (
                      <CardContent
                        card={card}
                        side={previewSide}
                        className="text-sm text-gray-700 leading-relaxed"
                        fallbackClassName="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
                      />
                    )}
                  </div>
                  {card.source?.path && <p className="mt-2 text-[11px] font-bold text-gray-300 line-clamp-1">{card.source.path.join(' / ')}</p>}
                  {card.source?.type === 'apkg' && <p className="mt-2 text-[11px] font-bold text-gray-300 line-clamp-1">{card.source.deckName} / {card.source.modelName} / {card.source.templateName}</p>}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <TemplateManager
        open={templateManagerOpen}
        data={data}
        selectedTemplateId={selectedTemplate?.id ?? selectedTemplateId}
        onSelectTemplate={(templateId) => {
          const nextTemplate = cardTemplates.find((template) => template.id === templateId)
          if (nextTemplate?.mode === 'html') setTemplateMode('html')
          else setTemplateMode('plain')
          if (importMode === 'anki') setAnkiContentMode('template')
          setSelectedTemplateId(templateId)
          setTemplateManagerOpen(false)
        }}
        onSaveTemplate={onSaveCardTemplate}
        onDeleteTemplate={onDeleteCardTemplate}
        onClose={() => setTemplateManagerOpen(false)}
      />
    </Shell>
  )
}

export default ImportCards
