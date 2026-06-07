import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronDown, ExternalLink, FileText, Upload, FolderOpen, Sparkles, Check, X, Loader, Wand2, PencilLine } from 'lucide-react'
import { parseApkgFile } from '../apkgImport.js'
import { parseBulkCards, parseMarkdownCards } from '../cardImport.js'
import { buildCardValueFromTemplate } from '../lib/cardHtml.js'
import { getCardTemplates } from '../lib/cardTemplates.js'
import { getDeckSection, getDeckChapter, getStableDeckColor, summarizeAnkiDeckTargets, getDeckIdentityKey, getDeckOptionLabel, getDeckPath } from '../lib/deckUtils.js'
import Shell from './Shell.jsx'
import ToolbarButton from './ToolbarButton.jsx'
import CardContent from './CardContent.jsx'
import DeckSelectOptions from './DeckSelectOptions.jsx'
import TemplateManager from './TemplateManager.jsx'

function ImportCards({ data, onCreateCards, onSaveCardTemplate, onDeleteCardTemplate, studyDeckId, cloud }) {
  const navigate = useNavigate()
  const [selectedDeckId, setSelectedDeckId] = useState(data.decks[0]?.id ?? '')
  const [importMode, setImportMode] = useState('qa')
  const [selectedTemplateId, setSelectedTemplateId] = useState('qa')
  const [templateMode, setTemplateMode] = useState('plain')
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false)
  const [rawText, setRawText] = useState('')
  const [apkgImport, setApkgImport] = useState(null)
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [message, setMessage] = useState('')
  const cardTemplates = useMemo(() => getCardTemplates(data), [data])
  const plainTemplates = useMemo(() => cardTemplates.filter((template) => template.mode !== 'html'), [cardTemplates])
  const htmlTemplates = useMemo(() => cardTemplates.filter((template) => template.mode === 'html'), [cardTemplates])
  const visibleTemplates = templateMode === 'html' ? cardTemplates : plainTemplates
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
    const value = buildCardValueFromTemplate({
      ...card,
      template: selectedTemplate?.id ?? selectedTemplateId,
      front: card.front ?? '',
      back: card.back ?? '',
    }, selectedTemplate)
    return { ...card, ...value, template: selectedTemplate?.id ?? selectedTemplateId }
  }), [rawParsedTextCards, selectedTemplate, selectedTemplateId])
  const parsedCards = importMode === 'anki' ? (apkgImport?.cards ?? []) : parsedTextCards
  const ankiDeckSummaries = useMemo(() => apkgImport?.deckSummaries ?? [], [apkgImport])

  useEffect(() => {
    if (!data.decks.find((deck) => deck.id === selectedDeckId)) {
      setSelectedDeckId(data.decks[0]?.id ?? '')
    }
  }, [data.decks, selectedDeckId])

  useEffect(() => {
    if (visibleTemplates.some((template) => template.id === selectedTemplateId)) return
    const preferredHtmlTemplate = htmlTemplates.find((template) => template.id === 'quiz-choice-control-center')
    setSelectedTemplateId(
      templateMode === 'html'
        ? (preferredHtmlTemplate?.id ?? visibleTemplates[0]?.id ?? 'html')
        : (visibleTemplates[0]?.id ?? 'qa'),
    )
  }, [htmlTemplates, selectedTemplateId, templateMode, visibleTemplates])

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
        const fallbackDeck = data.decks.find((deck) => deck.id === selectedDeckId) ?? data.decks[0] ?? null
        const targetCount = summarizeAnkiDeckTargets(result.deckSummaries ?? [], fallbackDeck).length || 1
        setApkgImport(result)
        setMessage(`已解析 ${result.cards.length} 张 Anki 卡，将按 ${targetCount} 个大科目分组。图片、音频会跳过。`)
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
    ? '导入 Anki APKG/COLPKG，按 A 刑法学、B 民法学这类大科目自动分组，并保留可安全显示的静态 HTML。'
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

            {importMode !== 'anki' && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-1.5">
                <span className="px-1 text-xs font-black text-gray-400">模板类型</span>
                {[
                  { value: 'plain', label: '普通' },
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
                <button
                  type="button"
                  onClick={() => setTemplateManagerOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-50 px-3 text-xs font-black text-blue-600 hover:bg-blue-100"
                  title="打开模板编辑窗口"
                >
                  <PencilLine size={13} /> 编辑模板
                </button>
              </div>
            )}

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
                    {ankiTargetSummaries.length > 0 && (
                      <p className="mt-2 text-xs font-bold text-blue-600">将按 Anki 大科目导入到 {ankiTargetSummaries.length} 个卡组。</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: '原始笔记', value: apkgImport.noteCount },
                      { label: '原始卡片', value: apkgImport.cardCount },
                      { label: '可导入', value: apkgImport.cards.length },
                      { label: '大科目', value: ankiTargetSummaries.length || 1 },
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
                  {ankiTargetSummaries.length > 0 && (
                    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                      <p className="mb-2 text-xs font-black text-gray-400">自动识别的大科目</p>
                      <div className="grid gap-1.5">
                        {ankiTargetSummaries.slice(0, 10).map((summary) => (
                          <div key={getDeckIdentityKey(summary)} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                            <span className="min-w-0 truncate text-xs font-bold text-gray-700">{getDeckOptionLabel(summary)}</span>
                            <span className="shrink-0 text-xs font-black text-gray-400">{summary.count}</span>
                          </div>
                        ))}
                        {ankiTargetSummaries.length > 10 && (
                          <p className="px-1 text-[11px] font-bold text-gray-300">还有 {ankiTargetSummaries.length - 10} 个大科目会一并导入。</p>
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
                  ? `会按 APKG 内部的 :: 路径自动归到 A 刑法学、B 民法学这类大科目；没有路径的卡片才会落入 ${selectedDeck?.name ?? '兜底卡组'}。`
                  : (selectedDeck?.description ?? '先创建一个卡组。')}
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <div className="p-5">
                <p className="text-xs font-bold text-gray-400 mb-1">识别</p>
                <p className="text-3xl font-black text-gray-950">{parsedCards.length}</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-bold text-gray-400 mb-1">{importMode === 'anki' ? '大科目' : '现有'}</p>
                <p className="text-3xl font-black text-gray-950">{importMode === 'anki' ? (ankiTargetSummaries.length || 1) : data.cards.filter((card) => card.deckId === selectedDeckId).length}</p>
              </div>
            </div>
          </section>

          {importMode !== 'anki' && selectedTemplate && (
            <section className="rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
              <div className="p-5">
                <p className="text-xs font-black text-gray-400 mb-2">当前模板</p>
                <h2 className="text-sm font-black text-gray-950">{selectedTemplate.name}</h2>
                <p className="mt-2 text-xs leading-5 text-gray-500">{selectedTemplate.description || '按所选模板批量生成卡片。'}</p>
                {selectedTemplate.id === 'quiz-choice-control-center' && (
                  <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold leading-5 text-blue-700">输入格式建议：题干 + A/B/C/D 选项；答案区写“答案：B”“标签：刑法｜正当防卫”“解析：……”即可。</p>
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

      <TemplateManager
        open={templateManagerOpen}
        data={data}
        selectedTemplateId={selectedTemplate?.id ?? selectedTemplateId}
        onSelectTemplate={(templateId) => {
          const nextTemplate = cardTemplates.find((template) => template.id === templateId)
          if (nextTemplate?.mode === 'html') setTemplateMode('html')
          else setTemplateMode('plain')
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