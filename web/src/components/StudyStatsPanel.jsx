import { memo } from 'react'

const STAT_ITEMS = [
  {
    key: 'round',
    label: '本轮',
    getValue: (p) => p.reviewed,
    getDetail: (p) => (p.sessionTotal ? `${p.progressPercent}%` : '待开始'),
  },
  {
    key: 'due',
    label: '到期',
    getValue: (p) => p.dueCount,
    getDetail: (p) => (p.isDrill ? '抽背中' : '当前队列'),
  },
  {
    key: 'learned',
    label: '已学',
    getValue: (p) => p.reviewedCount,
    getDetail: (p) => `${p.newCardCount} 张新卡`,
  },
  {
    key: 'stable',
    label: '稳固',
    getValue: (p) => p.masteredCount,
    getDetail: () => '间隔 7 天+',
  },
]

export default function StudyStatsPanel({
  reviewed,
  dueCount,
  isDrill,
  progressPercent,
  reviewedCount,
  newCardCount,
  masteredCount,
  sessionTotal,
}) {
  const props = {
    reviewed,
    dueCount,
    isDrill,
    progressPercent,
    reviewedCount,
    newCardCount,
    masteredCount,
    sessionTotal,
  }

  return (
    <section className="mb-4 rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
        {STAT_ITEMS.map((item) => (
          <div key={item.key} className="px-4 py-3">
            <p className="text-[11px] font-black text-gray-300">{item.label}</p>
            <p className="mt-1 text-2xl font-black text-gray-950">{item.getValue(props)}</p>
            <p className="mt-0.5 text-[11px] font-bold text-gray-400">{item.getDetail(props)}</p>
          </div>
        ))}
      </div>
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-[#34c759] transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </section>
  )
}
