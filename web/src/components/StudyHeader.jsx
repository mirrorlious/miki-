import { memo } from 'react'

export default function StudyHeader({
  deckName,
  deckPath,
  dueCount,
  cardCount,
  drillCount,
  onDrawDrill,
  onNavigateAdd,
  onNavigateDecks,
  canAdd,
}) {
  return (
    <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-black text-gray-950">{deckName ?? '学习模式'}</h1>
        <p className="text-xs text-gray-500 mt-1">{deckPath || '还没有可学习的卡组'} · 待复习 {dueCount}，本牌组 {cardCount} 张。</p>
      </div>
      <div className="flex gap-2">
        <button onClick={onDrawDrill} className="h-10 px-4 rounded-xl bg-[#34c759] text-sm font-bold text-white shadow-sm hover:bg-[#30b454]" disabled={drillCount === 0}>抽背</button>
        <button onClick={onNavigateAdd} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50" disabled={!canAdd}>添加</button>
        <button onClick={onNavigateDecks} className="h-10 px-4 rounded-xl bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50">结束</button>
      </div>
    </header>
  )
}