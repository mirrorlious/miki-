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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(makeLocalCacheData(data)))
      console.warn('Local cache was too large, saved a lightweight copy without Anki HTML/CSS.', error)
    } catch (fallbackError) {
      console.warn('Local cache write skipped because browser storage is full.', fallbackError)
    }
  }
}

export { makeLocalCacheData, persistDataToLocalCache }