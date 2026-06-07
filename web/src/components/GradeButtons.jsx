import { memo } from 'react'

export default function GradeButtons({
  options,
  sessionGrades,
  onGrade,
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
  )
}