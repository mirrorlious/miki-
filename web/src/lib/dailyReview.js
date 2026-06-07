import { DEFAULT_DECK_SECTIONS } from './constants.js'
import { parseBulkCards } from '../cardImport.js'

function parseDailyReview(content) {
  const lines = String(content ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const cards = parseBulkCards(content)
  const buckets = [
    { key: 'mistakes', label: '易错', patterns: ['易错', '错题', '误区', '混淆', '注意'] },
    { key: 'questions', label: '疑问', patterns: ['疑问', '问题', '不懂', '为什么', '待问'] },
    { key: 'pending', label: '待整理', patterns: ['待整理', '整理', '归档', '整合', '专题'] },
    { key: 'highlights', label: '高亮', patterns: ['高亮', '重点', '标记', '背诵', '记住'] },
  ]

  const clues = buckets.map((bucket) => ({
    ...bucket,
    items: lines.filter((line) => bucket.patterns.some((pattern) => line.includes(pattern))),
  }))
  const subjectHits = DEFAULT_DECK_SECTIONS
    .map((section) => ({
      section,
      count: lines.filter((line) => line.includes(section)).length,
    }))
    .filter((item) => item.count > 0)

  return {
    lines,
    cards,
    clues,
    subjectHits,
    totalClues: clues.reduce((sum, clue) => sum + clue.items.length, 0),
  }
}

export { parseDailyReview }