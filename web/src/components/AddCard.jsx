import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link as LinkWithRef, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight, PencilLine, Plus, Star, Trash2, Video, Volume2, Image, Bold, Italic, Underline, Strikethrough, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Maximize2, Search, Sparkles, GripHorizontal, Layers3, Wand2, Flag, MessageSquare, MoreVertical, Settings, ExternalLink, Upload } from 'lucide-react'
import { sanitizeCardHtml, buildCardValueFromTemplate, looksLikeHtml } from '../lib/cardHtml.js'
import { SYSTEM_CARD_TEMPLATES, normalizeCardTemplate, getCardTemplates } from '../lib/cardTemplates.js'
import CardContent from './CardContent.jsx'
import CollapseToggle from './CollapseToggle.jsx'
import TemplateManager from './TemplateManager.jsx'
import DeckSelectOptions from './DeckSelectOptions.jsx'
import Shell from './Shell.jsx'
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
      setError('请填写背诵卡内容。')
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
    const text = `${previewFront}
${previewBack}`.trim()
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
          <h1 className="text-2xl font-black text-gray-950">添加卡片</h1><p className="mt-1 text-xs text-gray-500">单张制卡、粘贴 HTML/富文本，并实时预览。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/import')} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"><Upload size={15} /> 批量制卡</button>
          <a href="https://anki-card-maker-xi.vercel.app/" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"><ExternalLink size={15} /> AI制卡器</a>
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

            <button type="button" onClick={() => setExpandedPane((current) => current === 'editor' ? null : 'editor') } title={expandedPane === 'editor' ? '恢复双栏' : '扩展编辑区'} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg">
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
                      <option value="center">居中</option>
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
                    <ChevronLeft size={14} /> 上一张                  </button>
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

export default AddCard
