import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, Plus, PencilLine, Layers3, Search, Sparkles } from 'lucide-react'
import { todayKey, stats } from '../data.js'
import { getDailyLog } from '../lib/activity.js'
import { parseDailyReview } from '../lib/dailyReview.js'
import { formatStudyDate } from '../lib/dateUtils.js'
import CollapseToggle from './CollapseToggle.jsx'
import DeckSelectOptions from './DeckSelectOptions.jsx'

function DailyReviewPanel({ data, selectedDeckId, onSelectDeck, onSaveDailyLog, onCreateDailyCards, collapsed = false, onToggle }) {
  const dateKey = todayKey()
  const existingLog = getDailyLog(data, dateKey)
  const [draft, setDraft] = useState(existingLog?.content ?? '')
  const [message, setMessage] = useState('')
  const analysis = useMemo(() => parseDailyReview(draft), [draft])
  const targetDeck = data.decks.find((deck) => deck.id === selectedDeckId)
  const expanded = !collapsed

  useEffect(() => {
    setDraft(existingLog?.content ?? '')
    setMessage('')
  }, [existingLog?.content, existingLog?.id, dateKey])

  function handleSave() {
    onSaveDailyLog(dateKey, draft)
    setMessage('已保存')
  }

  function handleCreateCards() {
    if (!selectedDeckId || analysis.cards.length === 0) return
    onSaveDailyLog(dateKey, draft)
    onCreateDailyCards(selectedDeckId, dateKey, analysis.cards)
    setMessage(`已同步 ${analysis.cards.length} 张卡`)
  }

  return (
    <section className="mb-5 rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
      <div className="h-11 px-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-[#007aff]" />
          <h2 className="text-sm font-black text-gray-950">今日复盘</h2>
          <span className="text-xs font-bold text-gray-300">{formatStudyDate(dateKey)}</span>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-xs font-bold text-green-600">{message}</span>}
          <button type="button" onClick={handleSave} className="h-8 px-3 rounded-lg bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200">保存</button>
          {onToggle && <CollapseToggle expanded={expanded} onToggle={onToggle} label="今日复盘" />}
        </div>
      </div>

      {expanded && <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-0">
        <div className="p-5 border-b lg:border-b-0 lg:border-r border-gray-100">
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setMessage('')
            }}
            placeholder={`民法：形成权、意思表示、可撤销民事法律行为
易错：重大误解和欺诈的区分
疑问：形成权和请求权的边界
待整理：适用情形需要拆成专题

Q: 形成权的核心特征是什么？
A: 依一方意思表示即可使法律关系发生、变更或消灭。`}
            className="min-h-[210px] w-full resize-none rounded-2xl bg-gray-50 px-4 py-3 text-sm leading-7 text-gray-900 outline-none focus:ring-2 focus:ring-[#007aff]/15"
          />
        </div>

        <aside className="p-5">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[11px] font-bold text-gray-400 mb-1">线索</p>
              <p className="text-2xl font-black text-gray-950">{analysis.totalClues}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[11px] font-bold text-gray-400 mb-1">可转卡</p>
              <p className="text-2xl font-black text-gray-950">{analysis.cards.length}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[11px] font-bold text-gray-400 mb-1">行数</p>
              <p className="text-2xl font-black text-gray-950">{analysis.lines.length}</p>
            </div>
          </div>

          <label className="mb-3 block">
            <span className="mb-2 block text-xs font-black text-gray-400">归入卡组</span>
            <select
              value={selectedDeckId ?? ''}
              onChange={(event) => onSelectDeck(event.target.value)}
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 outline-none focus:border-[#007aff] focus:bg-white"
            >
              {data.decks.length === 0 && <option value="">选择卡组</option>}
              <DeckSelectOptions decks={data.decks} />
            </select>
          </label>

          <button
            type="button"
            onClick={handleCreateCards}
            disabled={!targetDeck || analysis.cards.length === 0}
            className="mb-4 h-10 w-full rounded-xl bg-[#007aff] text-sm font-bold text-white shadow-sm hover:bg-[#006ee6] disabled:bg-gray-300"
          >
            转入 {targetDeck?.name ?? '当前卡组'} {analysis.cards.length} 张
          </button>

          <div className="space-y-3">
            {analysis.subjectHits.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-black text-gray-300">涉及板块</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.subjectHits.map((hit) => (
                    <span key={hit.section} className="rounded bg-green-50 px-2 py-1 text-[11px] font-black text-green-700">{hit.section} · {hit.count}</span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-[11px] font-black text-gray-300">复盘线索</p>
              <div className="max-h-[150px] overflow-y-auto space-y-2">
                {analysis.totalClues === 0 && <p className="text-xs text-gray-400">写下易错、疑问、待整理或高亮内容后，这里会聚合当天线索。</p>}
                {analysis.clues.flatMap((clue) => clue.items.map((item, index) => (
                  <div key={`${clue.key}-${index}-${item}`} className="rounded-lg bg-gray-50 px-3 py-2">
                    <span className="rounded bg-white px-2 py-0.5 text-[10px] font-black text-gray-500">{clue.label}</span>
                    <p className="mt-1 text-xs leading-relaxed text-gray-700 line-clamp-2">{item}</p>
                  </div>
                )))}
              </div>
            </div>
          </div>
        </aside>
      </div>}
    </section>
  )
}


export default DailyReviewPanel