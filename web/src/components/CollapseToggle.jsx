import { ChevronRight } from 'lucide-react'

export default function CollapseToggle({ expanded, onToggle, label }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      title={expanded ? `收起${label}` : `展开${label}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
    >
      <ChevronRight size={16} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
    </button>
  )
}