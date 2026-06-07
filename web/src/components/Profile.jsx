import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, Edit, Gift, LogOut, Settings, User as UserIcon, Sparkles } from 'lucide-react'
import { stats } from '../data.js'
import { getRewardState } from '../lib/achievement.js'
import { REWARD_OPTIONS } from '../lib/constants.js'
import { getProfile } from '../lib/profile.js'
import Shell from './Shell.jsx'
import PixelItemIcon from './PixelItemIcon.jsx'
import AchievementPanel from './AchievementPanel.jsx'

function Profile({ data, cloud, studyDeckId, onUpdateProfile, onRedeemReward }) {
  const profile = getProfile(data, cloud)
  const rewardState = getRewardState(data)
  const summary = stats(data)
  const [form, setForm] = useState({
    nickname: profile.nickname,
    bio: profile.bio,
    examDate: profile.examDate,
    dailyGoalMinutes: profile.dailyGoalMinutes,
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    setForm({
      nickname: profile.nickname,
      bio: profile.bio,
      examDate: profile.examDate,
      dailyGoalMinutes: profile.dailyGoalMinutes,
    })
  }, [profile.bio, profile.dailyGoalMinutes, profile.examDate, profile.nickname])

  function handleSubmit(event) {
    event.preventDefault()
    onUpdateProfile({
      nickname: form.nickname.trim() || '学习者',
      avatarUrl: '',
      bio: form.bio.trim(),
      examDate: form.examDate,
      dailyGoalMinutes: Math.max(5, Number(form.dailyGoalMinutes) || 45),
    })
    setMessage('已保存')
    window.setTimeout(() => setMessage(''), 1600)
  }

  return (
    <Shell data={data} cloud={cloud} studyDeckId={studyDeckId}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-950">个人中心</h1>
          <p className="mt-1 text-xs text-gray-500">管理昵称、学习目标和成就点兑换。</p>
        </div>
        <div className="rounded-2xl bg-white/90 px-4 py-2 text-right shadow-sm ring-1 ring-white">
          <p className="text-xl font-black text-gray-950">{rewardState.availablePoints}</p>
          <p className="text-[11px] font-bold text-gray-400">可用成就点</p>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-white">
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-300">Profile</p>
              <h2 className="mt-1 text-xl font-black text-gray-950">{form.nickname || profile.nickname}</h2>
              <p className="mt-1 text-xs font-bold text-gray-400">{cloud.enabled ? cloud.message : '本地浏览器数据'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-gray-800">昵称</span>
              <input
                value={form.nickname}
                onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
                placeholder="给自己起个学习名"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-gray-800">考试日期</span>
              <input
                type="date"
                value={form.examDate}
                onChange={(event) => setForm((current) => ({ ...current, examDate: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-gray-800">每日专注目标</span>
              <input
                type="number"
                min="5"
                step="5"
                value={form.dailyGoalMinutes}
                onChange={(event) => setForm((current) => ({ ...current, dailyGoalMinutes: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-gray-800">个人签名</span>
            <textarea
              value={form.bio}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              rows={3}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold leading-6 text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
              placeholder="写一句给复习中的自己看的话"
            />
          </label>

          <div className="mt-5 flex items-center justify-end gap-3">
            {message && <span className="text-xs font-black text-green-600">{message}</span>}
            <button type="submit" className="h-10 rounded-xl bg-gray-950 px-5 text-sm font-black text-white hover:bg-gray-800">
              保存资料
            </button>
          </div>
        </form>

        <aside className="space-y-5">
          <section className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-white">
            <h2 className="text-sm font-black text-gray-950">学习资产</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gray-50 px-3 py-3">
                <p className="text-2xl font-black text-gray-950">{summary.mastered}</p>
                <p className="text-[11px] font-bold text-gray-400">已掌握卡片</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3">
                <p className="text-2xl font-black text-gray-950">{rewardState.earnedItems.length}</p>
                <p className="text-[11px] font-bold text-gray-400">已获成就</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3">
                <p className="text-2xl font-black text-gray-950">{rewardState.totalPoints}</p>
                <p className="text-[11px] font-bold text-gray-400">累计点数</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3">
                <p className="text-2xl font-black text-gray-950">{rewardState.spentPoints}</p>
                <p className="text-[11px] font-bold text-gray-400">已兑换</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-white">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-950">奖励兑换</h2>
              <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-black text-green-700">{rewardState.availablePoints} 点可用</span>
            </div>
            <div className="mt-4 space-y-3">
              {REWARD_OPTIONS.map((reward) => {
                const redeemed = rewardState.redeemedRewards.some((item) => item.rewardId === reward.id)
                const affordable = rewardState.availablePoints >= reward.cost
                return (
                  <div key={reward.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-gray-950">{reward.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500">{reward.description}</p>
                      </div>
                      <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-gray-500">{reward.badge}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRedeemReward(reward.id)}
                      disabled={redeemed || !affordable}
                      className="mt-3 h-9 w-full rounded-xl bg-gray-950 text-xs font-black text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {redeemed ? '已兑换' : `${reward.cost} 点兑换`}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        </aside>
      </section>

      <AchievementPanel data={data} />
    </Shell>
  )
}


export default Profile