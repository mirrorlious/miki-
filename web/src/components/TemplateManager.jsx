import { useState } from 'react'
import { PencilLine, Trash2, BookOpen, GripHorizontal, List, Layers3, Maximize2 } from 'lucide-react'
import { getCardSideHtml, getCardSideText, sanitizeCardHtml } from '../lib/cardHtml.js'
import { SYSTEM_CARD_TEMPLATES, normalizeCardTemplate, getCardTemplates } from '../lib/cardTemplates.js'
import CardContent from './CardContent.jsx'

function TemplateManager({ open, data, selectedTemplateId, onSelectTemplate, onSaveTemplate, onDeleteTemplate, onClose }) {
  const templates = useMemo(() => getCardTemplates(data), [data])
  const [activeTemplateId, setActiveTemplateId] = useState(selectedTemplateId || 'qa')
  const [activeTab, setActiveTab] = useState('frontCode')
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? templates[0]
  const [draft, setDraft] = useState(() => normalizeCardTemplate(activeTemplate))

  useEffect(() => {
    if (!open) return
    setActiveTemplateId(selectedTemplateId || 'qa')
  }, [open, selectedTemplateId])

  useEffect(() => {
    if (!open || !activeTemplate) return
    setDraft(normalizeCardTemplate(activeTemplate))
  }, [activeTemplate, open])

  if (!open) return null

  const previewTemplate = normalizeCardTemplate({ ...draft, id: 'template-preview', builtIn: false })
  const previewCard = {
    id: 'template-preview-card',
    ...buildCardValueFromTemplate({
      front: 'Front 示例',
      back: 'Back 示例\n可以放答案、解析、例句或 HTML。',
    }, previewTemplate),
  }
  const tabOptions = [
    { key: 'frontCode', label: '正面' },
    { key: 'backCode', label: '背面' },
    { key: 'css', label: 'CSS' },
    { key: 'js', label: 'JavaScript' },
  ]
  const canDelete = !draft.builtIn && getStoredCardTemplates(data).some((template) => template.id === draft.id)

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value, mode: field === 'frontCode' || field === 'backCode' || field === 'css' || field === 'js' ? 'html' : current.mode }))
  }

  function createTemplateDraft() {
    const next = normalizeCardTemplate({
      id: `template-${Date.now()}`,
      name: '新模板',
      description: '自定义模板',
      mode: 'html',
      frontCode: '<section class="card-front">{{Front}}</section>',
      backCode: '<section class="card-back">{{Back}}</section>',
      css: '.card-front{font-size:24px;font-weight:800}.card-back{font-size:16px;line-height:1.8}',
      js: '',
    })
    setActiveTemplateId(next.id)
    setDraft(next)
    setActiveTab('frontCode')
  }

  function saveDraft() {
    const now = Date.now()
    const saved = normalizeCardTemplate({
      ...draft,
      id: draft.builtIn ? `template-${now}` : draft.id,
      name: draft.builtIn ? `${draft.name} 副本` : draft.name,
      builtIn: false,
      createdAt: draft.builtIn ? now : draft.createdAt,
      updatedAt: now,
    })
    onSaveTemplate(saved)
    setActiveTemplateId(saved.id)
    setDraft(saved)
    onSelectTemplate(saved.id)
  }

  function deleteDraft() {
    if (!canDelete) return
    onDeleteTemplate(draft.id)
    setActiveTemplateId('qa')
    onSelectTemplate('qa')
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/30 p-4 backdrop-blur-sm">
      <div className="mx-auto grid h-full max-w-[1380px] grid-cols-[300px_minmax(0,1fr)_320px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <aside className="border-r border-gray-100 bg-gray-50 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-950">模板列表</h2>
            <button type="button" onClick={createTemplateDraft} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-gray-500 shadow-sm hover:bg-gray-100" title="新建模板">
              <Plus size={15} />
            </button>
          </div>
          <div className="mb-3 flex gap-2">
            <select className="h-9 w-24 rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-gray-500">
              <option>全部</option>
            </select>
            <input className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-xs outline-none focus:border-[#007aff]" placeholder="关键词搜索模板" />
          </div>
          <div className="flex max-h-[calc(100vh-150px)] flex-col gap-2 overflow-auto">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setActiveTemplateId(template.id)}
                className={`rounded-lg border px-3 py-3 text-left ${activeTemplateId === template.id ? 'border-green-200 bg-white shadow-sm' : 'border-gray-200 bg-white/70 hover:bg-white'}`}
              >
                <span className="block text-sm font-black text-gray-950">{template.name} {template.builtIn && <span className="text-[11px] text-green-600">系统模板</span>}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-gray-400">{template.description || 'Front、Back、样式。'}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-col">
          <div className="flex h-14 items-center justify-between gap-3 border-b border-gray-100 px-4">
            <div className="flex min-w-0 items-center gap-2">
              <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} className="h-9 w-56 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-black outline-none focus:border-[#007aff] focus:bg-white" />
              <input value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} className="h-9 w-72 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs font-bold text-gray-500 outline-none focus:border-[#007aff] focus:bg-white" />
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => onSelectTemplate(draft.id)} className="h-9 rounded-lg bg-green-50 px-3 text-xs font-black text-green-700 hover:bg-green-100">套用</button>
              <button type="button" onClick={saveDraft} className="h-9 rounded-lg bg-[#34c759] px-4 text-xs font-black text-white hover:bg-[#30b454]">{draft.builtIn ? '保存副本' : '保存'}</button>
              <button type="button" onClick={deleteDraft} disabled={!canDelete} className="h-9 rounded-lg bg-red-50 px-3 text-xs font-black text-red-600 hover:bg-red-100 disabled:bg-gray-50 disabled:text-gray-300">删除</button>
              <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200" title="关闭">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 border-b border-gray-100 px-4 py-2 text-xs font-bold text-gray-500">
            {tabOptions.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${activeTab === tab.key ? 'bg-green-50 text-green-700' : 'hover:bg-gray-50'}`}
              >
                <span className={`h-2 w-2 rounded-full ${activeTab === tab.key ? 'bg-green-500' : 'bg-gray-200'}`} />
                {tab.label}
              </button>
            ))}
          </div>

          <textarea
            value={draft[activeTab] ?? ''}
            onChange={(event) => updateDraft(activeTab, event.target.value)}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none bg-white px-5 py-4 font-mono text-xs leading-6 text-gray-800 outline-none"
          />
        </main>

        <aside className="border-l border-gray-100 bg-white p-4">
          <h2 className="mb-3 text-sm font-black text-gray-950">模板预览</h2>
          <div className="rounded border border-gray-300 bg-white p-3 shadow-[5px_5px_0_#fbbf24]">
            <CardContent
              card={previewCard}
              side="front"
              className="text-sm leading-relaxed text-gray-950"
              fallbackClassName="text-sm leading-relaxed text-gray-950 whitespace-pre-wrap"
            />
          </div>
          <div className="mt-5 rounded border border-gray-300 bg-white p-3 shadow-[5px_5px_0_#fbbf24]">
            <CardContent
              card={previewCard}
              side="back"
              className="text-sm leading-relaxed text-gray-800"
              fallbackClassName="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap"
            />
          </div>
        </aside>
      </div>
    </div>
  )
}



export default TemplateManager