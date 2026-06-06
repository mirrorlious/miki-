import { useState, useEffect } from 'react'

const DECK_COLOR_OPTIONS = [
  { value: 'sun', label: '暖黄', cardClass: 'bg-yellow-50/80 border-yellow-100/50', pillClass: 'bg-yellow-100 text-yellow-700' },
  { value: 'sea', label: '浅蓝', cardClass: 'bg-blue-50/80 border-blue-100/50', pillClass: 'bg-blue-100 text-blue-700' },
  { value: 'rose', label: '浅粉', cardClass: 'bg-rose-50/80 border-rose-100/50', pillClass: 'bg-rose-100 text-rose-700' },
  { value: 'mint', label: '薄荷', cardClass: 'bg-emerald-50/80 border-emerald-100/50', pillClass: 'bg-emerald-100 text-emerald-700' },
]
const DEFAULT_DECK_SECTIONS = ['法理', '宪法', '民法', '刑法', '法制史', '政治', '英语', '规律专题']
const PROFESSIONAL_SECTIONS = ['法理', '宪法', '民法', '刑法', '法制史']

function getDeckSection(deck) { return deck?.section?.trim() || '未分组' }
function getDeckChapter(deck) { return deck?.chapter?.trim() || '' }
function getStableDeckColor(value = '') {
  const colors = DECK_COLOR_OPTIONS.map(o => o.value)
  const hash = Array.from(String(value)).reduce((s, c) => s + c.charCodeAt(0), 0)
  return colors[hash % colors.length] ?? 'sun'
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


export default DeckDialog