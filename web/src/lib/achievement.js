import { ACHIEVEMENTS } from './constants.js'
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

import { REWARD_OPTIONS } from "./constants.js"
import { getStoredProfile } from "./profile.js"

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

export { getAchievementState, getRewardState }
