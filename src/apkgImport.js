import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const FIELD_SEPARATOR = '\x1f'
const MAX_SIDE_HTML_LENGTH = 24000
const MAX_CARD_CSS_LENGTH = 6000
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
    .replace(/\[sound:[^\]]+\]/gi, '')
}

function normalizeText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
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

function scoreFieldForSide(name, value, side) {
  const text = stripHtml(value)
  if (isScriptCallText(text)) return -Infinity

  const lowerName = String(name ?? '').toLowerCase()
  let score = Math.min(text.length, 200) / 40
  if (side === 'front' && /(front|question|prompt|term|word|q|正面|问题|题目|词)/i.test(lowerName)) score += 8
  if (side === 'back' && /(back|answer|definition|explain|meaning|a|背面|答案|解释|释义|定义)/i.test(lowerName)) score += 8
  if (/(hint|tag|tags|deck|extra|note|id|guid|media|audio|sound|image|图片|音频)/i.test(lowerName)) score -= 4
  return score
}

function pickFieldText(fields, side, avoidText = '') {
  const avoid = normalizeText(avoidText)
  return Object.entries(fields)
    .map(([name, value]) => ({
      text: stripHtml(value),
      score: scoreFieldForSide(name, value, side),
    }))
    .filter((item) => item.text && item.text !== avoid && item.score > -Infinity)
    .sort((a, b) => b.score - a.score)[0]?.text ?? ''
}

function pickAnyFieldText(fields, avoidText = '') {
  const avoid = normalizeText(avoidText)
  return Object.values(fields)
    .map((value) => stripHtml(value))
    .find((text) => text && text !== avoid && !isScriptCallText(text)) ?? ''
}

function pickSideText({ renderedHtml, fields, note, side, avoidText = '' }) {
  const renderedText = stripHtml(renderedHtml)
  if (!isScriptCallText(renderedText)) return renderedText

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
  if (normalizeText(text) === normalizeText(fallbackText) && !/<(?:table|ul|ol|strong|em|b|i|ruby|rt|br)\b/i.test(safeHtml)) return ''

  return safeHtml
}

function makeStoredCss(css = '') {
  const safeCss = String(css)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/@import[^;]+;/gi, '')
    .trim()
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
  html = html.replace(/{{(?:text:|type:)?([^}]+)}}/g, (_, rawName) => {
    const name = rawName.trim()
    if (name.startsWith('#') || name.startsWith('/') || name.startsWith('^')) return ''
    return fields[name] ?? ''
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
    let scriptFallbackCount = 0
    let skippedCards = 0

    for (const card of cards) {
      const note = notesById.get(Number(card.nid))
      if (!note) continue

      const model = models[String(note.mid)]
      const template = model?.tmpls?.[Number(card.ord)] ?? model?.tmpls?.[0] ?? null
      const deck = decks[String(card.did)]
      const deckName = deck?.name ?? 'Anki 导入'
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
      const renderedBackHtml = renderTemplate(template?.afmt || '{{Back}}', {
        ...context,
        frontSide: renderedFrontHtml,
        revealed: true,
      })
      if (isScriptCallText(renderedFrontHtml) || isScriptCallText(renderedBackHtml)) scriptFallbackCount += 1

      const frontText = pickSideText({ renderedHtml: renderedFrontHtml, fields, note, side: 'front' })
      const backText = pickSideText({ renderedHtml: renderedBackHtml, fields, note, side: 'back', avoidText: frontText })
      if (!frontText || !backText) {
        skippedCards += 1
        continue
      }
      const frontHtml = makeStoredSideHtml(renderedFrontHtml, frontText)
      const backHtml = makeStoredSideHtml(renderedBackHtml, backText)
      const cardCss = frontHtml || backHtml ? makeStoredCss(model?.css) : ''

      deckNames.add(deckName)

      rawCards.push({
        id: `anki-${card.id}`,
        front: frontText,
        back: backText,
        frontHtml,
        backHtml,
        cardCss,
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
          modelName,
          templateName,
        },
      })
    }

    return {
      importId,
      cards: rawCards.filter((card) => card.front && card.back),
      deckNames: Array.from(deckNames).sort((a, b) => a.localeCompare(b, 'zh-CN')),
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
