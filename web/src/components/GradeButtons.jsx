import { memo, useState } from 'react'
import { ChevronDown, ChevronUp, Dock, PanelBottom } from 'lucide-react'

function GradeButtons({
  options,
  sessionGrades,
  onGrade,
  floating = false,
  onChangeFloating,
}) {
  const [collapsed, setCollapsed] = useState(false)

  const ModeSwitch = ({ compact = false }) => (
    <div className={`flex items-center gap-1 rounded-full bg-gray-100 p-1 ${compact ? '' : 'shrink-0'}`}>
      <button
        type="button"
        onClick={() => {
          setCollapsed(false)
          onChangeFloating?.(true)
        }}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black transition ${floating && !collapsed ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-700'}`}
        title="评分栏改为底部浮动"
      >
        <Dock size={12} /> 浮动
      </button>
      <button
        type="button"
        onClick={() => {
          setCollapsed(false)
          onChangeFloating?.(false)
        }}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black transition ${!floating && !collapsed ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-700'}`}
        title="评分栏改为嵌入显示"
      >
        <PanelBottom size={12} /> 嵌入
      </button>
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black transition ${collapsed ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-700'}`}
        title="收起评分栏"
      >
        <ChevronDown size={12} /> 收起
      </button>
    </div>
  )

  if (!floating) {
    if (collapsed) {
      return (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-700 shadow-sm hover:bg-gray-50"
            title="展开嵌入评分栏"
          >
            <ChevronUp size={14} /> 展开评分栏
          </button>
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-gray-100 bg-white/85 p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">评分栏</span>
            <span className="ml-2 text-[11px] font-bold text-gray-400">嵌入显示中，不悬浮，不遮挡解析</span>
          </div>
          <ModeSwitch />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {options.map((option) => (
            <button
              key={option.grade}
              type="button"
              onClick={() => onGrade(option.grade)}
              title={option.title}
              className={`min-h-16 rounded-xl border px-3 py-3 text-left font-black transition-colors ${option.className}`}
            >
              <span className="block text-base">{option.label}</span>
              <span className="mt-1 block text-xs opacity-75">{option.detail}</span>
              <span className="mt-2 block text-[11px] opacity-80">下次：{option.dueLabel}</span>
              <span className="mt-1 block text-[11px] opacity-60">本轮 {sessionGrades[option.grade] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (collapsed) {
    return (
      <div className="study-grade-dock pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(10px+env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto flex max-w-3xl flex-wrap justify-center gap-2 rounded-full border border-white/80 bg-white/90 p-1.5 shadow-lg shadow-gray-900/10 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black text-gray-700 hover:bg-gray-100"
            title="展开评分栏"
          >
            <ChevronUp size={14} /> 展开评分
          </button>
          <button
            type="button"
            onClick={() => onChangeFloating?.(false)}
            className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
            title="切换为嵌入显示"
          >
            改为嵌入
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="study-grade-dock pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(10px+env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto max-w-5xl rounded-[22px] border border-white/80 bg-white/86 p-2 shadow-2xl shadow-gray-900/12 backdrop-blur-2xl ring-1 ring-gray-100/70">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 px-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">评分栏</span>
            <span className="text-[11px] font-bold text-gray-400">浮动显示中，已预留底部安全区</span>
          </div>
          <ModeSwitch />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {options.map((option) => (
            <button
              key={option.grade}
              type="button"
              onClick={() => onGrade(option.grade)}
              title={option.title}
              className={`min-h-[76px] rounded-2xl border px-3 py-2.5 text-left font-black transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${option.className}`}
            >
              <span className="block text-base leading-none">{option.label}</span>
              <span className="mt-1 block truncate text-xs opacity-75">{option.detail}</span>
              <span className="mt-1.5 block text-[11px] opacity-80">下次：{option.dueLabel}</span>
              <span className="mt-0.5 block text-[11px] opacity-60">本轮 {sessionGrades[option.grade] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default memo(GradeButtons)
