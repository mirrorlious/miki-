import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import {
  stripAnswerSectionFromHtml,
  stripAnswerSectionFromText,
  stripSelectionBlockingStylesFromCss,
} from './ankiHtml'

const FIELD_SEPARATOR = '\x1f'
const MAX_SIDE_HTML_LENGTH = 120000
const MAX_CARD_CSS_LENGTH = 10000
const MAX_CARD_RICH_CONTENT_LENGTH = 180000
const SCRIPT_CALL_PATTERN = /^(?:decrypt|render|show|load|init)[a-zA-Z0-9_$]*\(\)$/i

let sqlPromise = null

function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (fileName) => (fileName.endsWith('.wasm') ? sqlWasmUrl : fileName),
    })
  }
  return sqlPromise
}

function rowsFromQuery(db, sql) {
  const result = db.exec(sql)[0]
  if (!result) return []
  return result.values.map((row) => result.columns.reduce((item, column, index) => {
    item[column] = row[index]
    return item
  }, {}))
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function normalizeTags(value = '') {
  return String(value)
    .trim()
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function stripUnsafeTemplateParts(html = '') {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, '')
    .replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?(?:template|html|body)\b[^>]*>/gi, '')
    .replace(/<source\b[^>]*>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/\[sound:[^\]]+\]/gi, '')
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/gi, 'none')
}

function normalizeText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

function splitAnkiDeckPath(deckName = '') {
  return String(deckName)
    .split('::')
    .map((part) => normalizeText(part))
    .filter(Boolean)
}

function extractCollectionFile(zip) {
  const candidates = ['collection.anki21', 'collection.anki2', 'collection.anki21b']
  for (const name of candidates) {
    const file = zip.file(name)
    if (file) return file
  }

  return zip.file(/collection\.anki(?:2|21|21b)$/i)[0] ?? null
}

function splitFields(note, model) {
  const values = String(note.flds ?? '').split(FIELD_SEPARATOR)
  const fieldDefs = Array.isArray(model?.flds) ? model.flds : []
  return fieldDefs.reduce((fields, field, index) => {
    fields[field.name] = values[index] ?? ''
    return fields
  }, {})
}

function stripHtml(html = '') {
  const safeHtml = stripUnsafeTemplateParts(html)
  if (typeof document === 'undefined') {
    return normalizeText(safeHtml.replace(/<[^>]*>/g, ' '))
  }
  const element = document.createElement('div')
  element.innerHTML = safeHtml
  return normalizeText(element.textContent || element.innerText || '')
}

function isScriptCallText(value = '') {
  const text = normalizeText(stripHtml(value))
  return !text || SCRIPT_CALL_PATTERN.test(text)
}

function removeKnownPrefixText(text = '', prefix = '') {
  const cleanText = normalizeText(text)
  const cleanPrefix = normalizeText(prefix)
  if (!cleanText || !cleanPrefix) return cleanText
  if (cleanText === cleanPrefix) return ''
  if (cleanText.startsWith(cleanPrefix)) return normalizeText(cleanText.slice(cleanPrefix.length))
  return cleanText
}

function textCoverage(text = '', target = '') {
  const cleanText = normalizeText(text)
  const cleanTarget = normalizeText(target)
  if (!cleanText || !cleanTarget) return 0
  if (cleanText.includes(cleanTarget)) return 1
  if (cleanTarget.includes(cleanText)) return cleanText.length / cleanTarget.length

  const sample = cleanTarget.slice(0, Math.min(120, cleanTarget.length))
  if (sample.length >= 20 && cleanText.includes(sample)) return sample.length / cleanTarget.length

  let commonPrefix = 0
  const limit = Math.min(cleanText.length, cleanTarget.length)
  while (commonPrefix < limit && cleanText[commonPrefix] === cleanTarget[commonPrefix]) commonPrefix += 1
  return commonPrefix / cleanTarget.length
}

function htmlCoverage(html = '', target = '') {
  return textCoverage(stripHtml(html), target)
}

function looksLikeRichHtml(value = '') {
  return /<(?:table|ul|ol|strong|em|b|i|ruby|rt|br|div|span|p|section|article|h[1-6]|style)\b/i.test(String(value))
    || /\s(?:class|style)=/i.test(String(value))
}

function scoreFieldForSide(name, value, side) {
  const text = stripHtml(value)
  if (isScriptCallText(text)) return -Infinity

  const lowerName = String(name ?? '').toLowerCase()
  let score = Math.min(text.length, 200) / 40
  if (side === 'front' && /(题干|题目|问题|正面|原文|考点|front|question|prompt|stem)/i.test(lowerName)) score += 12
  if (side === 'back' && /(答案|解析|背面|反面|详解|说明|解释|answer|back|explain|analysis|solution)/i.test(lowerName)) score += 12
  if (side === 'front' && /(front|question|prompt|term|word|q|正面|问题|题目|词)/i.test(lowerName)) score += 8
  if (side === 'back' && /(back|answer|definition|explain|meaning|a|背面|答案|解释|释义|定义)/i.test(lowerName)) score += 8
  if (/(hint|tag|tags|deck|extra|note|id|guid|media|audio|sound|image|图片|音频)/i.test(lowerName)) score -= 4
  return score
}

function pickFieldCandidate(fields, side, avoidText = '') {
  const avoid = normalizeText(avoidText)
  return Object.entries(fields)
    .map(([name, value]) => {
      const text = removeKnownPrefixText(stripHtml(value), avoid)
      return {
        name,
        raw: String(value ?? ''),
        text,
        score: scoreFieldForSide(name, value, side),
      }
    })
    .filter((item) => item.text && item.text !== avoid && item.score > -Infinity)
    .sort((a, b) => b.score - a.score)[0] ?? null
}

function pickFieldText(fields, side, avoidText = '') {
  return pickFieldCandidate(fields, side, avoidText)?.text ?? ''
}

function pickFieldHtml(fields, side, avoidText = '') {
  const candidate = pickFieldCandidate(fields, side, avoidText)
  if (!candidate || !looksLikeRichHtml(candidate.raw)) return ''
  return candidate.raw
}

function pickAnyFieldText(fields, avoidText = '') {
  const avoid = normalizeText(avoidText)
  return Object.values(fields)
    .map((value) => stripHtml(value))
    .find((text) => text && text !== avoid && !isScriptCallText(text)) ?? ''
}

function pickSideText({ renderedHtml, fields, note, side, avoidText = '' }) {
  const renderedText = stripHtml(renderedHtml)
  if (!isScriptCallText(renderedText)) {
    const cleanRenderedText = removeKnownPrefixText(renderedText, avoidText)
    if (cleanRenderedText) return cleanRenderedText
  }

  const fieldText = pickFieldText(fields, side, avoidText)
  if (fieldText) return fieldText

  const anyFieldText = pickAnyFieldText(fields, avoidText)
  if (anyFieldText) return anyFieldText

  const sortFieldText = stripHtml(note.sfld)
  if (sortFieldText && sortFieldText !== normalizeText(avoidText) && !isScriptCallText(sortFieldText)) return sortFieldText

  return ''
}

function makeStoredSideHtml(renderedHtml, fallbackText) {
  const safeHtml = stripUnsafeTemplateParts(renderedHtml).trim()
  if (!safeHtml || safeHtml.length > MAX_SIDE_HTML_LENGTH) return ''

  const text = stripHtml(safeHtml)
  if (!text || isScriptCallText(text)) return ''
  const hasRichMarkup = looksLikeRichHtml(safeHtml)
  if (normalizeText(text) === normalizeText(fallbackText) && !hasRichMarkup) return ''

  return safeHtml
}

function pickSideHtml({ renderedHtml, fields, side, fallbackText }) {
  const renderedSideHtml = makeStoredSideHtml(renderedHtml, fallbackText)
  const fieldSideHtml = makeStoredSideHtml(pickFieldHtml(fields, side, fallbackText), fallbackText)

  if (side === 'front' && renderedSideHtml && fieldSideHtml) {
    const renderedCoverage = htmlCoverage(renderedSideHtml, fallbackText)
    const fieldCoverage = htmlCoverage(fieldSideHtml, fallbackText)
    if (fieldCoverage > renderedCoverage + 0.15 || (renderedCoverage < 0.35 && fieldCoverage > renderedCoverage)) {
      return fieldSideHtml
    }
  }

  return renderedSideHtml || fieldSideHtml
}

function getFieldByNames(fields, names) {
  const entries = Object.entries(fields)
  for (const name of names) {
    const match = entries.find(([fieldName]) => String(fieldName).toLowerCase() === String(name).toLowerCase())
    if (match && stripHtml(match[1])) return match[1]
  }
  return ''
}

function findMatchingTag(markup = '', openStart = 0, tagName = 'div') {
  const openMatch = String(markup).slice(openStart).match(/^<([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/)
  if (!openMatch) return { innerStart: openStart, innerEnd: markup.length }

  const innerStart = openStart + openMatch[0].length
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/gi
  tagPattern.lastIndex = innerStart
  let depth = 1
  let match = tagPattern.exec(markup)
  while (match) {
    if (match[1].toLowerCase() === tagName.toLowerCase()) {
      const isClosing = markup[match.index + 1] === '/'
      const isSelfClosing = match[0].trimEnd().endsWith('/>')
      if (isClosing) depth -= 1
      else if (!isSelfClosing) depth += 1
      if (depth === 0) return { innerStart, innerEnd: match.index }
    }
    match = tagPattern.exec(markup)
  }
  return { innerStart, innerEnd: markup.length }
}

function extractDivInnerById(markup = '', contentId = '') {
  const pattern = new RegExp(`<div\\b(?=[^>]*\\bid=["']${contentId}["'])[^>]*>`, 'i')
  const match = String(markup).match(pattern)
  if (!match || match.index == null) return ''
  const bounds = findMatchingTag(markup, match.index, 'div')
  return markup.slice(bounds.innerStart, bounds.innerEnd)
}

function extractToggleSections(markup = '') {
  const labels = new Map()
  String(markup).replace(/<button\b[^>]*showContent\((\d+)\)[^>]*>([\s\S]*?)<\/button>/gi, (_, id, labelHtml) => {
    const label = stripHtml(labelHtml)
    if (label) labels.set(id, label)
    return ''
  })

  return Array.from(labels.entries()).map(([id, label]) => {
    const html = stripUnsafeTemplateParts(extractDivInnerById(markup, `content${id}`)).trim()
    const text = stripHtml(html)
    return html && text ? { id: `content-${id}`, label, html, text } : null
  }).filter(Boolean)
}

function makeFieldSections(fields) {
  const specs = [
    ['analysis', '考试分析原文', ['原文', '分析原文', '考试分析原文']],
    ['choice', '选择题', ['选择题']],
    ['answer', '答案与解析', ['答案与解析', '解析', '答案', 'Back']],
    ['source-note', '我的笔记', ['我的笔记', 'DYL笔记', '笔记', 'Note']],
  ]

  return specs.map(([id, label, names]) => {
    const html = stripUnsafeTemplateParts(getFieldByNames(fields, names)).trim()
    const text = stripHtml(html)
    return html && text ? { id, label, html, text } : null
  }).filter(Boolean)
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderSectionHtml(section) {
  return `<section class="anki-html-section"><h3>${escapeHtml(section.label)}</h3>${section.html}</section>`
}

function renderSectionsHtml(sections) {
  return sections.map(renderSectionHtml).join('')
}

function makeStoredCss(css = '') {
  const safeCss = stripSelectionBlockingStylesFromCss(
    String(css)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/@import[^;]+;/gi, '')
      .replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/gi, 'none'),
  ).trim()
  return safeCss.length <= MAX_CARD_CSS_LENGTH ? safeCss : ''
}

function processConditionals(template, fields) {
  let html = template
  for (let pass = 0; pass < 6; pass += 1) {
    const previous = html
    html = html.replace(/{{#([^}]+)}}([\s\S]*?){{\/\1}}/g, (_, rawName, inner) => {
      const value = fields[rawName.trim()]
      return String(value ?? '').trim() ? inner : ''
    })
    html = html.replace(/{{\^([^}]+)}}([\s\S]*?){{\/\1}}/g, (_, rawName, inner) => {
      const value = fields[rawName.trim()]
      return String(value ?? '').trim() ? '' : inner
    })
    if (html === previous) break
  }
  return html
}

function renderCloze(value, clozeIndex, revealed) {
  return String(value ?? '').replace(/{{c(\d+)::(.*?)(?:::(.*?))?}}/g, (_, rawIndex, text, hint) => {
    if (Number(rawIndex) !== clozeIndex) return text
    if (revealed) return `<span class="anki-cloze anki-cloze-revealed">${text}</span>`
    return `<span class="anki-cloze">${hint || '...'}</span>`
  })
}

function renderTemplate(template, context) {
  const { fields, tags, deckName, templateName, frontSide = '', clozeIndex = 1, revealed = false } = context
  let html = processConditionals(String(template ?? ''), fields)

  html = html.replace(/{{FrontSide}}/g, frontSide)
  html = html.replace(/{{Tags}}/g, tags.join(' '))
  html = html.replace(/{{Deck}}/g, deckName)
  html = html.replace(/{{Card}}/g, templateName)
  html = html.replace(/{{cloze:([^}]+)}}/g, (_, rawName) => renderCloze(fields[rawName.trim()] ?? '', clozeIndex, revealed))
  html = html.replace(/{{([^}]+)}}/g, (_, rawName) => {
    const name = rawName.trim()
    if (name.startsWith('#') || name.startsWith('/') || name.startsWith('^')) return ''
    if (/^tts\b/i.test(name)) return ''
    const fieldName = name.includes(':') ? name.split(':').pop().trim() : name
    return fields[fieldName] ?? ''
  })

  return html.trim()
}

function readAnkiData(db) {
  const collection = rowsFromQuery(db, 'SELECT decks, models FROM col LIMIT 1')[0]
  const decks = parseJson(collection?.decks ?? '{}', {})
  const models = parseJson(collection?.models ?? '{}', {})
  const notes = rowsFromQuery(db, 'SELECT id, guid, mid, tags, flds, sfld FROM notes')
  const cards = rowsFromQuery(db, 'SELECT id, nid, did, ord, reps, lapses, ivl, due FROM cards')
  const notesById = new Map(notes.map((note) => [Number(note.id), note]))

  return { decks, models, notesById, cards }
}

export async function parseApkgFile(file, options = {}) {
  const importId = options.importId ?? `apkg-${Date.now()}`
  const zip = await JSZip.loadAsync(file)
  const collectionFile = extractCollectionFile(zip)
  if (!collectionFile) {
    throw new Error('这个 APKG 里没有找到 collection.anki2 / collection.anki21。')
  }

  const [SQL, collectionBuffer] = await Promise.all([
    getSql(),
    collectionFile.async('uint8array'),
  ])

  const db = new SQL.Database(collectionBuffer)
  try {
    const { decks, models, notesById, cards } = readAnkiData(db)
    const rawCards = []
    const deckNames = new Set()
    const deckSummaries = new Map()
    let scriptFallbackCount = 0
    let skippedCards = 0

    for (const card of cards) {
      const note = notesById.get(Number(card.nid))
      if (!note) continue

      const model = models[String(note.mid)]
      const template = model?.tmpls?.[Number(card.ord)] ?? model?.tmpls?.[0] ?? null
      const deck = decks[String(card.did)]
      const deckName = deck?.name ?? 'Anki 导入'
      const deckPath = splitAnkiDeckPath(deckName)
      const modelName = model?.name ?? 'Anki 模板'
      const templateName = template?.name ?? `模板 ${Number(card.ord) + 1}`
      const fields = splitFields(note, model)
      const tags = normalizeTags(note.tags)
      const context = {
        fields,
        tags,
        deckName,
        templateName,
        clozeIndex: Number(card.ord) + 1,
      }
      const renderedFrontHtml = renderTemplate(template?.qfmt || '{{Front}}', context)
      const renderedQuestionHtml = stripAnswerSectionFromHtml(renderedFrontHtml)
      const renderedBackHtml = renderTemplate(template?.afmt || '{{Back}}', {
        ...context,
        frontSide: renderedFrontHtml,
        revealed: true,
      })
      const renderedBackAnswerHtml = renderTemplate(template?.afmt || '{{Back}}', {
        ...context,
        frontSide: '',
        revealed: true,
      })
      const answerHtml = renderedBackAnswerHtml || renderedBackHtml
      if (isScriptCallText(renderedQuestionHtml) || isScriptCallText(answerHtml)) scriptFallbackCount += 1

      const frontText = stripAnswerSectionFromText(pickSideText({ renderedHtml: renderedQuestionHtml, fields, note, side: 'front' }))
      const htmlSections = extractToggleSections(answerHtml)
      const answerSections = htmlSections.length > 0 ? htmlSections : makeFieldSections(fields)
      const sectionBackText = normalizeText(htmlSections
        .map((section) => removeKnownPrefixText(section.text, frontText) || section.text)
        .join(' '))
      const fieldSectionBackText = normalizeText(answerSections
        .map((section) => removeKnownPrefixText(section.text, frontText) || section.text)
        .join(' '))
      const backText = fieldSectionBackText || sectionBackText || pickSideText({ renderedHtml: answerHtml, fields, note, side: 'back', avoidText: frontText })
      if (!frontText || !backText) {
        skippedCards += 1
        continue
      }
      let frontHtml = stripAnswerSectionFromHtml(pickSideHtml({ renderedHtml: renderedQuestionHtml, fields, side: 'front', fallbackText: frontText }))
      let backHtml = answerSections.length > 0
        ? (makeStoredSideHtml(renderSectionsHtml(answerSections), backText) || makeStoredSideHtml(renderSectionHtml(answerSections[0]), backText))
        : pickSideHtml({ renderedHtml: answerHtml, fields, side: 'back', fallbackText: backText })
      let cardCss = frontHtml || backHtml ? makeStoredCss(model?.css) : ''
      if (frontHtml.length + backHtml.length + cardCss.length > MAX_CARD_RICH_CONTENT_LENGTH) {
        cardCss = ''
      }
      if (frontHtml.length + backHtml.length > MAX_CARD_RICH_CONTENT_LENGTH && answerSections.length > 0) {
        backHtml = ''
      }
      if (frontHtml.length + backHtml.length > MAX_CARD_RICH_CONTENT_LENGTH) {
        if (backHtml.length >= frontHtml.length) backHtml = ''
        else frontHtml = ''
      }
      if (frontHtml.length + backHtml.length > MAX_CARD_RICH_CONTENT_LENGTH) {
        frontHtml = ''
        backHtml = ''
      }

      deckNames.add(deckName)
      const deckSummaryKey = deckPath.join('::') || deckName
      const deckSummary = deckSummaries.get(deckSummaryKey) ?? { deckName, deckPath, count: 0 }
      deckSummary.count += 1
      deckSummaries.set(deckSummaryKey, deckSummary)

      rawCards.push({
        id: `anki-${card.id}`,
        front: frontText,
        back: backText,
        frontHtml,
        backHtml,
        cardCss,
        ...(answerSections.length > 0 ? { htmlSections: answerSections } : {}),
        template: 'anki',
        tags,
        sourceKey: `apkg:${note.id}:${card.id}:${card.ord}`,
        source: {
          type: 'apkg',
          importId,
          fileName: file.name,
          ankiNoteId: String(note.id),
          ankiCardId: String(card.id),
          ankiDeckId: String(card.did),
          deckName,
          deckPath,
          modelName,
          templateName,
        },
      })
    }

    return {
      importId,
      cards: rawCards.filter((card) => card.front && card.back),
      deckNames: Array.from(deckNames).sort((a, b) => a.localeCompare(b, 'zh-CN')),
      deckSummaries: Array.from(deckSummaries.values()).sort((a, b) => a.deckName.localeCompare(b.deckName, 'zh-CN')),
      noteCount: notesById.size,
      cardCount: cards.length,
      warnings: [
        scriptFallbackCount > 0 ? `检测到 ${scriptFallbackCount} 张卡依赖 Anki 脚本，已改用可读取的字段文本。` : '',
        skippedCards > 0 ? `跳过 ${skippedCards} 张无法提取文本的脚本/加密卡。` : '',
      ].filter(Boolean),
    }
  } finally {
    db.close()
  }
}
