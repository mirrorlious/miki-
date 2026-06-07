import { REWARD_OPTIONS, UNGROUPED_SECTION, CHAPTER_MILESTONE_SECONDS } from './constants.js'
import { getDailyLog, getReviewLogs, getActivity, getActiveStudyDays, getTopChapterTimeRows } from './activity.js'
import { getCardAnnotationCount, getLinkedPairCount } from './browseUtils.js'
import { getDeckSection } from './deckUtils.js'
import { todayKey } from '../data.js'
import { getStoredProfile } from './profile.js'

const ACHIEVEMENTS = [
  {
    id: 'first-card',
    title: '知识绿砖',
    description: '铸出第 1 块知识砖',
    points: 10,
    icon: 'card',
    color: '#34c759',
    isEarned: (data) => data.cards.length >= 1,
    progress: (data) => `\/1`,
  },
  {
    id: 'daily-review',
    title: '日历石碑',
    description: '在今天立下一块复盘石碑',
    points: 10,
    icon: 'calendar',
    color: '#007aff',
    isEarned: (data) => Boolean(getDailyLog(data, todayKey())?.content?.trim()),
    progress: (data) => (getDailyLog(data, todayKey())?.content?.trim() ? '1/1' : '0/1'),
  },
  {
    id: 'first-review',
    title: '复习罗盘',
    description: '点亮第 1 次复习评分',
    points: 15,
    icon: 'review',
    color: '#ff9f0a',
    isEarned: (data) => getReviewLogs(data).length >= 1,
    progress: (data) => `\/1`,
  },
  {
    id: 'first-note',
    title: '批注卷轴',
    description: '写下第 1 条理解批注',
    points: 10,
    icon: 'note',
    color: '#af52de',
    isEarned: (data) => getCardAnnotationCount(data) >= 1,
    progress: (data) => `\/1`,
  },
  {
    id: 'first-link',
    title: '线索锁链',
    description: '把 2 张相关卡片扣成一环',
    points: 15,
    icon: 'link',
    color: '#5ac8fa',
    isEarned: (data) => getLinkedPairCount(data) >= 1,
    progress: (data) => `\/1`,
  },
  {
    id: 'first-folder',
    title: '归档宝箱',
    description: '把 1 个卡组放进板块宝箱',
    points: 10,
    icon: 'folder',
    color: '#5856d6',
    isEarned: (data) => data.decks.some((deck) => getDeckSection(deck) !== UNGROUPED_SECTION),
    progress: (data) => `\/1`,
  },
  {
    id: 'three-days',
    title: '三日营火',
    description: '连续点起 3 天学习火光',
    points: 20,
    icon: 'flame',
    color: '#ff3b30',
    isEarned: (data) => getActiveStudyDays(data).length >= 3,
    progress: (data) => `\/3`,
  },
  {
    id: 'first-focus',
    title: '专注初响',
    description: '开启第 1 次学习专注',
    points: 10,
    icon: 'focus',
    color: '#007aff',
    isEarned: (data) => getActivity(data).focusSessions >= 1,
    progress: (data) => `\/1`,
  },
  {
    id: 'chapter-clock',
    title: '章节沙漏',
    description: '任一章节累计学习 10 分钟',
    points: 20,
    icon: 'timer',
    color: '#af52de',
    isEarned: (data) => getTopChapterTimeRows(data, 1).some((row) => row.seconds >= CHAPTER_MILESTONE_SECONDS),
    progress: (data) => `\/10 分钟`,
  },
]

export function getAchievementState(data) {
  const items = ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    earned: achievement.isEarned(data),
    progressText: achievement.progress(data),
  }))

  return {
    items,
    earnedItems: items.filter((achievement) => achievement.earned),
    totalPoints: items.filter((achievement) => achievement.earned).reduce((sum, achievement) => sum + achievement.points, 0),
    maxPoints: items.reduce((sum, achievement) => sum + achievement.points, 0),
  }

}


function getRewardState(data) {
  const achievementState = getAchievementState(data)
  const profile = getStoredProfile(data)
  const redeemedRewards = profile.redeemedRewards
  const spentPoints = redeemedRewards.reduce((sum, item) => {
    const reward = REWARD_OPTIONS.find((option) => option.id === item.rewardId)
    return sum + (reward?.cost ?? 0)
  }, 0)

  return {
    ...achievementState,
    spentPoints,
    availablePoints: Math.max(0, achievementState.totalPoints - spentPoints),
    redeemedRewards,
  }
  }

export { getRewardState }
