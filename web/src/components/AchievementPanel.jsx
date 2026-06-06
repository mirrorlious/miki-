import { getAchievementState } from '../lib/achievement.js'
import PixelItemIcon from './PixelItemIcon.jsx'
import CollapseToggle from './CollapseToggle.jsx'

function AchievementPanel({ data, collapsed = false, onToggle }) {
  const achievementState = getAchievementState(data)
  const nextAchievements = achievementState.items.filter((achievement) => !achievement.earned).slice(0, 3)
  const expanded = !collapsed

  return (
    <section className="mb-5 rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
      <div className="h-11 px-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-gray-950">像素物品成就</h2>
          <p className="text-[11px] font-bold text-gray-400 mt-0.5">低门槛，只奖励已经发生的学习动作。</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xl font-black text-gray-950">{achievementState.totalPoints}</p>
            <p className="text-[11px] font-bold text-gray-400">成就点 / {achievementState.maxPoints}</p>
          </div>
          {onToggle && <CollapseToggle expanded={expanded} onToggle={onToggle} label="成就" />}
        </div>
      </div>

      {expanded && <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-0">
        <div className="border-b lg:border-b-0 lg:border-r border-gray-100 p-5">
          <div className="rounded-2xl bg-gray-50 px-4 py-4">
            <p className="text-xs font-black text-gray-400 mb-2">已获得</p>
            <p className="text-4xl font-black text-gray-950">{achievementState.earnedItems.length}</p>
            <p className="mt-1 text-xs font-bold text-gray-400">共 {achievementState.items.length} 枚冒险徽章</p>
          </div>
          {nextAchievements.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-black text-gray-300">下一步</p>
              <div className="flex flex-col gap-2">
                {nextAchievements.map((achievement) => (
                  <div key={achievement.id} className="rounded-lg bg-gray-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-gray-700">{achievement.title}</span>
                      <span className="text-[11px] font-bold text-gray-400">{achievement.progressText}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">{achievement.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-5">
          {achievementState.items.map((achievement) => (
            <div
              key={achievement.id}
              className={`border-2 px-3 py-3 flex items-center gap-3 shadow-[3px_3px_0_#e5e7eb] ${achievement.earned ? 'border-gray-900 bg-[#f4fff4]' : 'border-gray-300 bg-gray-50/80'}`}
            >
              <PixelItemIcon name={achievement.icon} earned={achievement.earned} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className={`text-sm font-black truncate ${achievement.earned ? 'text-gray-950' : 'text-gray-400'}`}>{achievement.title}</h3>
                  <span className={`shrink-0 text-xs font-black ${achievement.earned ? 'text-green-700' : 'text-gray-300'}`}>+{achievement.points}</span>
                </div>
                <p className={`text-xs leading-relaxed line-clamp-2 ${achievement.earned ? 'text-gray-600' : 'text-gray-400'}`}>{achievement.description}</p>
                <p className="mt-1 text-[11px] font-bold text-gray-400">{achievement.earned ? '已达成' : achievement.progressText}</p>
              </div>
            </div>
          ))}
        </div>
      </div>}
    </section>
  )
}


export default AchievementPanel