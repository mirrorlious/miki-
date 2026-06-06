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