var localCacheDisabled = false
var quotaWarningShown = false

import { STORAGE_KEY } from '../data.js'

function makeLocalCacheData(data) {
  return {
    ...data,
    cards: Array.isArray(data.cards)
      ? data.cards.map((card) => {
        const lightCard = { ...card }
        delete lightCard.frontHtml
        delete lightCard.backHtml
        delete lightCard.cardCss
        delete lightCard.htmlSections
        return lightCard
      })
      : [],
  }
}

function persistDataToLocalCache(data) {
  if (localCacheDisabled) return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
      localCacheDisabled = true
      if (!quotaWarningShown) {
        console.warn('Local cache write skipped — browser storage is full. Subsequent saves will skip localStorage for this session.', error)
        quotaWarningShown = true
      }
      return false
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(makeLocalCacheData(data)))
      return true
    } catch (_fallbackError) {
      // lightweight write also failed, quota exceeded
      localCacheDisabled = true
      if (!quotaWarningShown) {
        console.warn('Local cache write skipped — browser storage is full.', _fallbackError)
        quotaWarningShown = true
      }
      return false
    }
  }
  return false
}

export { makeLocalCacheData, persistDataToLocalCache }
