import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const FIELD_SEPARATOR = '\x1f'

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
  if (typeof document === 'undefined') {
    return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const element = document.createElement('div')
  element.innerHTML = String(html)
  return (element.textContent || element.innerText || '').replace(/\s+/g, ' ').trim()
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
      const frontHtml = renderTemplate(template?.qfmt || '{{Front}}', context)
      const backHtml = renderTemplate(template?.afmt || '{{Back}}', {
        ...context,
        frontSide: frontHtml,
        revealed: true,
      })
      const frontText = stripHtml(frontHtml) || String(note.sfld ?? '').trim() || Object.values(fields).find(Boolean) || 'Anki 卡片'
      const backText = stripHtml(backHtml) || Object.values(fields).filter(Boolean).slice(1).join('\n') || frontText

      deckNames.add(deckName)

      rawCards.push({
        id: `anki-${card.id}`,
        front: frontText,
        back: backText,
        frontHtml,
        backHtml,
        cardCss: model?.css ?? '',
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
      warnings: [],
    }
  } finally {
    db.close()
  }
}
