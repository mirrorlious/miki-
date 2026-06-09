import { NavLink } from 'react-router-dom'

export default function ToolbarButton({ to, icon: Icon, label, disabled = false, compactExpand = false }) {
  const baseClass = compactExpand
    ? 'group/nav h-9 shrink-0 overflow-hidden rounded-lg text-sm font-bold flex items-center gap-2 transition-all duration-300 ease-out w-9 px-2.5 hover:w-[76px] focus-visible:w-[76px]'
    : 'h-9 shrink-0 whitespace-nowrap px-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors'
  const labelClass = compactExpand
    ? 'inline-block max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover/nav:max-w-[48px] group-hover/nav:opacity-100 group-focus-visible/nav:max-w-[48px] group-focus-visible/nav:opacity-100'
    : ''
  const iconClass = compactExpand
    ? 'shrink-0 transition-transform duration-300 ease-out group-hover/nav:-rotate-6 group-focus-visible/nav:-rotate-6'
    : 'shrink-0'

  if (disabled) {
    return (
      <span className={`${baseClass} text-gray-300 cursor-not-allowed`} title={label} aria-label={label}>
        <Icon size={16} className={iconClass} />
        <span className={labelClass}>{label}</span>
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      title={label}
      aria-label={label}
      className={({ isActive }) => `${baseClass} ${isActive ? 'bg-white text-[#007aff] shadow-sm' : 'text-gray-500 hover:bg-white/70 hover:text-gray-900'}`}
    >
      <Icon size={16} className={iconClass} />
      <span className={labelClass}>{label}</span>
    </NavLink>
  )
}
