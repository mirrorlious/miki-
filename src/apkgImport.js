import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const FIELD_SEPARATOR = '\x1f'
const DEFAULT_MAX_INLINE_MEDIA_BYTES = 180 * 1024
const MEDIA_REF_PATTERN = /\b(?:src|href)=["']([^"']+)["']|\[sound:([^\]]+)\]/gi

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

function normalizeName(value = '') {
  try {
    return decodeURIComponent(String(value).trim())
  } catch {
    return String(value).trim()
  }
}

function basename(value = '') {
  return normalizeName(value).split('/').pop()
}

function isExternalMediaRef(value = '') {
  return /^(?:https?:|data:|blob:|#|mailto:)/i.test(value)
}

function inferMimeType(name = '') {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.m4a')) return 'audio/mp4'
  if (lower.endsWith('.mp4')) return 'video/mp4'
  return 'application/octet-stream'
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function defaultResolveMediaUrl({ blob }) {
  if (blob.size > DEFAULT_MAX_INLINE_MEDIA_BYTES) return null
  return {
    url: await blobToDataUrl(blob),
    mode: 'inline',
  }
}

function extractCollectionFile(zip) {
  const candidates = ['collection.anki21', 'collection.anki2', 'collection.anki21b']
  for (const name of candidates) {
    const file = zip.file(name)
    if (file) return file
  }

  return zip.file(/collection\.anki(?:2|21|21b)$/i)[0] ?? null
}

function extractMediaMapping(zip) {
  const mediaFile = zip.file('media')
  if (!mediaFile) return {}
  return mediaFile.async('string').then((content) => parseJson(content, {}))
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

function collectMediaNames(html) {
  const names = new Set()
  for (const match of String(html ?? '').matchAll(MEDIA_REF_PATTERN)) {
    const rawName = match[1] || match[2]
    if (!rawName || isExternalMediaRef(rawName)) continue
    names.add(normalizeName(rawName))
  }
  return names
}

function replaceMediaRefs(html, resolvedMedia) {
  return String(html ?? '')
    .replace(/\bsrc=(["'])([^"']+)\1/gi, (match, quote, rawName) => {
      const name = normalizeName(rawName)
      const media = resolvedMedia.get(name) ?? resolvedMedia.get(basename(name))
      if (!media?.url) return match
      return `src=${quote}${media.url}${quote}`
    })
    .replace(/\bhref=(["'])([^"']+)\1/gi, (match, quote, rawName) => {
      const name = normalizeName(rawName)
      const media = resolvedMedia.get(name) ?? resolvedMedia.get(basename(name))
      if (!media?.url) return match
      return `href=${quote}${media.url}${quote}`
    })
    .replace(/\[sound:([^\]]+)\]/gi, (match, rawName) => {
      const name = normalizeName(rawName)
      const media = resolvedMedia.get(name) ?? resolvedMedia.get(basename(name))
      if (!media?.url) return match
      return `<audio controls src="${media.url}" class="anki-audio"></audio>`
    })
}

function buildMediaIndex(zip, mapping) {
  const index = new Map()

  for (const [zipName, originalName] of Object.entries(mapping)) {
    const file = zip.file(zipName)
    if (!file) continue
    const cleanName = normalizeName(originalName)
    const media = {
      zipName,
      name: cleanName,
      file,
      mimeType: inferMimeType(cleanName),
    }
    index.set(cleanName, media)
    index.set(basename(cleanName), media)
  }

  return index
}

async function resolveUsedMedia(usedMediaNames, mediaIndex, resolveMediaUrl) {
  const resolvedMedia = new Map()
  const warnings = []
  const usedMedia = []

  for (const name of usedMediaNames) {
    const media = mediaIndex.get(name) ?? mediaIndex.get(basename(name))
    if (!media) {
      warnings.push(`未找到媒体：${name}`)
      continue
    }

    try {
      const blob = await media.file.async('blob')
      const result = await (resolveMediaUrl ?? defaultResolveMediaUrl)({
        name: media.name,
        zipName: media.zipName,
        blob,
        mimeType: media.mimeType,
      })
      if (!result?.url) {
        warnings.push(`媒体过大或未上传：${media.name}`)
        continue
      }
      const item = {
        originalName: media.name,
        zipName: media.zipName,
        mimeType: media.mimeType,
        size: blob.size,
        mode: result.mode ?? 'url',
        url: result.url,
        storagePath: result.storagePath ?? '',
      }
      resolvedMedia.set(media.name, item)
      resolvedMedia.set(basename(media.name), item)
      usedMedia.push(item)
    } catch (error) {
      warnings.push(`${media.name} 处理失败：${error?.message || '未知错误'}`)
    }
  }

  return { resolvedMedia, usedMedia, warnings }
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

  const [SQL, collectionBuffer, mediaMapping] = await Promise.all([
    getSql(),
    collectionFile.async('uint8array'),
    extractMediaMapping(zip),
  ])

  const db = new SQL.Database(collectionBuffer)
  try {
    const { decks, models, notesById, cards } = readAnkiData(db)
    const mediaIndex = buildMediaIndex(zip, mediaMapping)
    const rawCards = []
    const usedMediaNames = new Set()
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
      for (const name of collectMediaNames(frontHtml)) usedMediaNames.add(name)
      for (const name of collectMediaNames(backHtml)) usedMediaNames.add(name)

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

    const mediaResult = await resolveUsedMedia(usedMediaNames, mediaIndex, options.resolveMediaUrl)
    const importedCards = rawCards.map((card) => {
      const frontHtml = replaceMediaRefs(card.frontHtml, mediaResult.resolvedMedia)
      const backHtml = replaceMediaRefs(card.backHtml, mediaResult.resolvedMedia)
      return {
        ...card,
        frontHtml,
        backHtml,
        media: mediaResult.usedMedia
          .filter((media) => frontHtml.includes(media.url) || backHtml.includes(media.url))
          .map(({ originalName, zipName, mimeType, size, mode, storagePath, url }) => ({
            originalName,
            zipName,
            mimeType,
            size,
            mode,
            storagePath,
            url,
          })),
      }
    })

    return {
      importId,
      cards: importedCards.filter((card) => card.front && card.back),
      deckNames: Array.from(deckNames).sort((a, b) => a.localeCompare(b, 'zh-CN')),
      noteCount: notesById.size,
      cardCount: cards.length,
      mediaCount: Object.keys(mediaMapping).length,
      usedMediaCount: usedMediaNames.size,
      resolvedMediaCount: mediaResult.usedMedia.length,
      warnings: mediaResult.warnings.slice(0, 20),
    }
  } finally {
    db.close()
  }
}
