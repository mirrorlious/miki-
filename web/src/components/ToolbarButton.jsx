import { NavLink } from 'react-router-dom'

export default function ToolbarButton({ to, icon: Icon, label, disabled = false }) {
  const baseClass = 'h-9 px-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors'

  if (disabled) {
    return (
      <span className={`${baseClass} text-gray-300 cursor-not-allowed`}>
        <Icon size={16} />
        {label}
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${baseClass} ${isActive ? 'bg-white text-[#007aff] shadow-sm' : 'text-gray-500 hover:bg-white/70 hover:text-gray-900'}`}
    >
      <Icon size={16} />
      {label}
    </NavLink>
  )
}
