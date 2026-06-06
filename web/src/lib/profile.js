function getStoredProfile(data) {
  const profile = data?.profile && typeof data.profile === 'object' ? data.profile : {}
  return {
    name: profile.name ?? '',
    nickname: profile.nickname ?? profile.name ?? '',
    bio: profile.bio ?? '',
    examDate: profile.examDate ?? '',
    dailyGoalMinutes: Number(profile.dailyGoalMinutes) || 45,
    redeemedRewards: Array.isArray(profile.redeemedRewards) ? profile.redeemedRewards : [],
  }
}

function getProfile(data, cloud) {
  const stored = getStoredProfile(data)
  const fallbackName = cloud?.user?.displayName || cloud?.accountLabel || '学习者'
  const nickname = stored.nickname.trim() || stored.name.trim() || fallbackName
  return {
    ...stored,
    nickname,
  }
}

export { getStoredProfile, getProfile }
