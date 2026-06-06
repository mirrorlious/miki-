import { Link } from 'react-router-dom'
import { Gift } from 'lucide-react'
import { getRewardState } from '../lib/achievement.js'
import PixelItemIcon from './PixelItemIcon.jsx'

function AchievementSummaryPanel({ data }) {
  const rewardState = getRewardState(data)
  const nextAchievements = rewardState.items.filter((achievement) => !achievement.earned).slice(0, 2)
  const recentEarned = rewardState.earnedItems.slice(-2)
  const previewItems = nextAchievements.length > 0 ? nextAchievements : recentEarned

  return (
    <section className="mb-5 rounded-2xl bg-white/90 border border-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[240px_minmax(0,1fr)_180px]">
        <div className="border-b border-gray-100 p-5 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">Achievements</p>
          <h2 className="mt-2 text-sm font-black text-gray-950">成就与奖励</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">这里只放进度摘要，完整物品墙在个人页。</p>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
          {previewItems.length === 0 && <p className="text-sm font-bold text-gray-400">先添加第一张卡片，成就会开始点亮。</p>}
          {previewItems.map((achievement) => (
            <div key={achievement.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3">
              <PixelItemIcon name={achievement.icon} earned={achievement.earned} />
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-900">{achievement.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{achievement.description}</p>
                <p className="mt-1 text-[11px] font-black text-gray-400">{achievement.earned ? '已达成' : achievement.progressText}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-row items-center justify-between gap-3 border-t border-gray-100 p-5 lg:flex-col lg:items-stretch lg:justify-center lg:border-l lg:border-t-0">
          <div>
            <p className="text-3xl font-black text-gray-950">{rewardState.availablePoints}</p>
            <p className="text-xs font-bold text-gray-400">可兑换点数</p>
          </div>
          <Link to="/profile" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gray-950 px-4 text-xs font-black text-white hover:bg-gray-800">
            <Gift size={14} /> 去兑换
          </Link>
        </div>
      </div>
    </section>
  )
}


export default AchievementSummaryPanel