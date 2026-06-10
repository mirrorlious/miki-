import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { stripSelectionBlockingStylesFromCss } from './ankiHtml'
import { ankiHtmlToText, renderAnkiCardSides } from './lib/ankiTemplateEngine.js'
import { buildApkgStructuredRender } from './lib/apkgRenderRegistry.js'

const FIELD_SEPARATOR = '\x1f'
const DEFAULT_APKG_PREVIEW_LIMIT = 5
const DEFAULT_APKG_BATCH_SIZE = 25
const MAX_APKG_BATCH_SIZE = 500
const MAX_SIDE_HTML_LENGTH = 36000
const MAX_CARD_CSS_LENGTH = 120000
const PARSE_YIELD_EVERY = 30

const STATIC_APKG_CARD_CSS = `
.miki-apkg-card { box-sizing: border-box; width: 100%; max-width: 980px; margin: 0 auto; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.85; }
.miki-apkg-card * { box-sizing: border-box; }
.miki-apkg-topbar { display: flex; justify-content: center; gap: 12px; margin: 6px 0 22px; }
.miki-apkg-tab { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 12px; background: #f4f7fb; color: #2563eb; font-weight: 800; }
.miki-apkg-badge { min-width: 20px; height: 20px; padding: 0 7px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: #ef4444; color: #fff; font-size: 12px; font-weight: 900; }
.miki-apkg-control { display: flex; justify-content: center; margin: -8px 0 24px; }
.miki-apkg-control-pill { border: 0; border-radius: 999px; padding: 9px 22px; background: #39d486; color: #fff; font-weight: 900; }
.miki-apkg-question { margin: 0 auto 24px; max-width: 980px; font-size: 16px; font-weight: 750; line-height: 2; }
.miki-apkg-question-type { color: #007aff; font-weight: 900; margin-right: 4px; }
.miki-apkg-options { margin: 22px auto 18px; max-width: 980px; display: grid; gap: 12px; }
.miki-apkg-option { display: flex; align-items: flex-start; gap: 10px; width: 100%; min-height: 46px; border: 1.5px solid #1f2937; border-radius: 6px; padding: 10px 14px; background: #fff; color: #111827; font-size: 15px; font-weight: 700; cursor: pointer; }
.miki-apkg-option input { flex: 0 0 auto; margin-top: 6px; }
.miki-apkg-option-letter { flex: 0 0 auto; font-weight: 900; }
.miki-apkg-option-text { flex: 1 1 auto; }
.miki-apkg-source-pills { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px auto 0; max-width: 980px; }
.miki-apkg-pill { display: inline-flex; align-items: center; border: 1.5px solid #1e90ff; border-radius: 5px; background: #eff6ff; padding: 6px 10px; color: #007aff; font-size: 14px; font-weight: 850; line-height: 1.55; }
.miki-apkg-back { max-width: 980px; margin: 0 auto; }
.miki-apkg-back-title { margin: 0 0 12px; font-size: 15px; font-weight: 900; color: #007aff; }
.miki-apkg-section { margin: 14px 0; padding: 14px 16px; border-radius: 14px; background: #f8fafc; border: 1px solid #e5e7eb; }
.miki-apkg-section h3 { margin: 0 0 8px; font-size: 14px; color: #2563eb; }
.miki-apkg-section-content { font-size: 15px; line-height: 1.85; }
.miki-anki-readable-fallback { padding: 16px; color: #111827; line-height: 1.85; white-space: pre-wrap; }
`

let sqlPromise = null

function hashText(value = '') {
  let hash = 2166136261
  const text = String(value ?? '')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function cleanPackageKeyPart(value = '') {
  return String(value ?? '')
    .replace(/\.(apkg|colpkg)$/i, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'apkg'
}

function makeApkgPackageKey(file, fallback = '') {
  if (!file) return cleanPackageKeyPart(fallback || `apkg-${Date.now()}`)
  const name = cleanPackageKeyPart(file.name || fallback || 'apkg')
  const signature = `${file.name || ''}:${file.size || 0}:${file.lastModified || 0}`
  return `${name}-${hashText(signature)}`
}

function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile: (fileName) => (fileName.endsWith('.wasm') ? sqlWasmUrl : fileName) })
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
  try { return JSON.parse(value) } catch { return fallback }
}

function normalizeText(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeTags(value = '') {
  return String(value).trim().split(/\s+/).map((tag) => tag.trim()).filter(Boolean)
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripUnsafeHtml(html = '') {
  return String(html ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?(?:template|html|body)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
}

function htmlToText(html = '') {
  const safeHtml = stripUnsafeHtml(html)
  if (typeof document === 'undefined') return normalizeText(safeHtml.replace(/<[^>]*>/g, ' '))
  const element = document.createElement('div')
  element.innerHTML = safeHtml
  return normalizeText(element.textContent || element.innerText || '')
}

function splitAnkiDeckPath(deckName = '') {
  return String(deckName).split('::').map(normalizeText).filter(Boolean)
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
    const fieldName = field?.name ?? `Field${index + 1}`
    fields[fieldName] = values[index] ?? ''
    return fields
  }, {})
}

function pickAnyFieldText(fields = {}) {
  return Object.values(fields).map(htmlToText).find(Boolean) ?? ''
}

function trimStoredHtml(html = '', maxLength = MAX_SIDE_HTML_LENGTH) {
  const value = stripUnsafeHtml(html).trim()
  if (!value) return ''
  if (value.length <= maxLength) return value
  const clipped = value.slice(0, maxLength)
  const lastBreak = Math.max(clipped.lastIndexOf('</p>'), clipped.lastIndexOf('</div>'), clipped.lastIndexOf('<br>'), clipped.lastIndexOf('<br/>'), clipped.lastIndexOf('<br />'))
  return `${(lastBreak > maxLength * 0.45 ? clipped.slice(0, lastBreak + 5) : clipped).trim()}<p class="anki-import-truncated">内容较长，已压缩 HTML。</p>`
}

function makeStoredCss(css = '') {
  const safeCss = stripSelectionBlockingStylesFromCss(
    String(css ?? '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/@import[^;]+;/gi, '')
      .replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/gi, 'none'),
  ).trim()
  return safeCss.length <= MAX_CARD_CSS_LENGTH ? safeCss : ''
}

function makeReadableFallbackHtml(text = '') {
  const clean = normalizeText(text)
  return clean ? `<div class="miki-anki-readable-fallback">${escapeHtml(clean)}</div>` : ''
}

function getFieldNames(model = {}) {
  return Array.isArray(model?.flds) ? model.flds.map((field) => String(field?.name ?? '').trim()).filter(Boolean) : []
}

function makeAnkiTemplateRecord({ model, template, modelName, templateName, templateId }) {
  const fields = getFieldNames(model)
  return {
    id: templateId,
    name: `${modelName} / ${templateName}`,
    description: `从 APKG 模板导入：${modelName} / ${templateName}${fields.length ? `｜字段：${fields.join('、')}` : ''}`,
    source: 'apkg',
    sourceType: 'apkg-template',
    mode: 'html',
    builtIn: false,
    frontCode: String(template?.qfmt || '{{Front}}'),
    backCode: String(template?.afmt || '{{Back}}'),
    css: makeStoredCss(model?.css ?? ''),
    js: '',
    fields,
    apkgModelId: String(model?.id ?? model?.mid ?? templateId.split('-').slice(2, -1).join('-') ?? ''),
    apkgCardOrd: Number(template?.ord ?? 0) || 0,
    apkgModelName: modelName,
    apkgTemplateName: templateName,
    updatedAt: Date.now(),
  }
}

function buildHtmlSections({ frontHtml, backHtml, frontText, backText }) {
  return [
    { id: 'front-rendered', label: '正面', html: frontHtml, text: frontText },
    { id: 'back-rendered', label: '背面', html: backHtml, text: backText },
  ].filter((section) => section.html || section.text)
}

function buildImportedAnkiCard({ card, note, model, template, deck, fields, tags, importId, packageKey, fileName }) {
  const deckName = deck?.name ?? 'Anki 导入'
  const deckPath = splitAnkiDeckPath(deckName)
  const modelName = model?.name ?? 'Anki 模板'
  const templateName = template?.name ?? `模板 ${Number(card.ord) + 1}`
  const templateId = `anki-template-${String(note.mid)}-${Number(card.ord) || 0}`
  const templateRecord = makeAnkiTemplateRecord({ model, template, modelName, templateName, templateId })

  const rendered = renderAnkiCardSides({
    model,
    template,
    fields,
    tags,
    deckName,
    templateName,
    cardOrd: Number(card.ord) || 0,
  })

  let structured = null
  try {
    structured = buildApkgStructuredRender({
      fields,
      renderedQuestionHtml: rendered.rawFrontHtml || rendered.frontHtml || note.sfld || '',
      renderedBackHtml: rendered.rawBackHtml || rendered.backHtml || '',
      deckPath,
      tags,
      modelName,
      templateName,
    })
  } catch (error) {
    console.warn('APKG structured render failed, falling back to static HTML.', error)
  }

  const initialFrontText = normalizeText(rendered.frontText || ankiHtmlToText(rendered.frontHtml) || htmlToText(note.sfld) || pickAnyFieldText(fields) || 'Anki 正面')
  const initialBackText = normalizeText(rendered.backText || ankiHtmlToText(rendered.backHtml) || '')
  const frontText = normalizeText(structured?.frontText || initialFrontText)
  const backText = normalizeText(structured?.backText || initialBackText)
  const frontHtml = trimStoredHtml(structured?.frontHtml || rendered.frontHtml || rendered.rawFrontHtml || makeReadableFallbackHtml(frontText))
  const backHtml = trimStoredHtml(structured?.backHtml || rendered.backHtml || rendered.rawBackHtml || makeReadableFallbackHtml(backText))

  if (!frontText && !frontHtml) return { skipped: true, hasScriptFallback: false }

  const stablePackageKey = packageKey || cleanPackageKeyPart(fileName || importId || 'apkg')
  const stableCardKey = `apkg:${stablePackageKey}:${note.id}:${card.id}:${card.ord}`
  const cardCss = makeStoredCss([
    rendered.css,
    templateRecord.css,
    STATIC_APKG_CARD_CSS,
    structured?.css,
  ].filter(Boolean).join('\n'))

  return {
    hasScriptFallback: /<script\b|\son[a-z]+\s*=|javascript:/i.test(`${rendered.rawFrontHtml || ''}\n${rendered.rawBackHtml || ''}`),
    skipped: false,
    template: templateRecord,
    card: {
      id: `anki-${stablePackageKey}-${card.id}`,
      front: frontText || 'Anki 正面',
      back: backText || '',
      rawFront: frontHtml || frontText,
      rawBack: backHtml || backText,
      frontHtml,
      backHtml,
      cardCss,
      // 故意不绑定 APKG 模板 id，避免学习页再次走新版 lazy/native 渲染覆盖静态 HTML。
      template: 'qa',
      tags,
      htmlSections: buildHtmlSections({ frontHtml, backHtml, frontText, backText }),
      anki: {
        noteId: String(note.id),
        cardId: String(card.id),
        deckId: String(card.did),
        modelId: String(note.mid),
        cardOrd: Number(card.ord) || 0,
        modelName,
        templateName,
        deckName,
        deckPath,
        fields,
        tags,
      },
      sourceKey: stableCardKey,
      source: {
        type: 'apkg',
        importId,
        fileName,
        ankiNoteId: String(note.id),
        ankiCardId: String(card.id),
        ankiDeckId: String(card.did),
        deckName,
        deckPath,
        modelName,
        templateName,
        templateId,
        nativeTemplate: false,
        nativeRenderMode: 'smart',
        staticExamRenderer: true,
        apkgStructuredRenderer: structured?.renderer || '',
        apkgFieldAnalysis: structured?.fieldAnalysis || null,
        allowAnkiJs: false,
      },
    },
    deckSummary: {
      deckName,
      deckPath,
      key: deckPath.join('::') || deckName,
    },
  }
}

async function openApkgDatabase(file, options = {}) {
  const onProgress = options.onProgress
  onProgress?.({ stage: '读取 APKG 压缩包', processed: 0, imported: 0, total: 0, percent: 6 })
  const zip = await JSZip.loadAsync(file)
  onProgress?.({ stage: '定位 Anki collection 数据库', processed: 0, imported: 0, total: 0, percent: 14 })
  const collectionFile = extractCollectionFile(zip)
  if (!collectionFile) throw new Error('这个 APKG 里没有找到 collection.anki2 / collection.anki21。')
  const collectionBuffer = await collectionFile.async('uint8array')
  const SQL = await getSql()
  onProgress?.({ stage: '打开 Anki SQLite 数据库', processed: 0, imported: 0, total: 0, percent: 34 })
  return new SQL.Database(collectionBuffer)
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

function makeApkgStats() {
  return { deckNames: new Set(), deckSummaries: new Map(), templates: new Map(), scriptFallbackCount: 0, skippedCards: 0, parsedCards: 0 }
}

function seedDeckSummariesFromRawCards(stats, cards = [], decks = {}) {
  for (const card of cards) {
    const deck = decks[String(card.did)]
    const deckName = deck?.name ?? 'Anki 导入'
    const deckPath = splitAnkiDeckPath(deckName)
    const key = deckPath.join('::') || deckName
    stats.deckNames.add(deckName)
    const current = stats.deckSummaries.get(key) ?? { deckName, deckPath, count: 0 }
    current.count += 1
    stats.deckSummaries.set(key, current)
  }
}

function seedTemplateRecordsFromModels(stats, models = {}) {
  for (const [modelId, model] of Object.entries(models)) {
    const modelName = model?.name ?? 'Anki 模板'
    const templates = Array.isArray(model?.tmpls) ? model.tmpls : []
    templates.forEach((template, index) => {
      const templateName = template?.name ?? `模板 ${index + 1}`
      const templateId = `anki-template-${modelId}-${index}`
      stats.templates.set(templateId, makeAnkiTemplateRecord({ model, template, modelName, templateName, templateId }))
    })
  }
}

function recordApkgResult(stats, result) {
  if (result?.hasScriptFallback) stats.scriptFallbackCount += 1
  if (result?.skipped) {
    stats.skippedCards += 1
    return
  }
  if (!result?.card) return
  stats.parsedCards += 1
  stats.deckNames.add(result.deckSummary.deckName)
  const current = stats.deckSummaries.get(result.deckSummary.key) ?? { deckName: result.deckSummary.deckName, deckPath: result.deckSummary.deckPath, count: 0 }
  current.count += 1
  stats.deckSummaries.set(result.deckSummary.key, current)
  if (result.template?.id) stats.templates.set(result.template.id, result.template)
}

function makeApkgWarnings(stats, totalCards) {
  return [
    stats.scriptFallbackCount > 0 ? `检测到 ${stats.scriptFallbackCount} 张卡含脚本/动态逻辑；已优先冻结为静态 HTML。` : '',
    totalCards >= 500 ? `大包已分批处理；已恢复导入时生成静态渲染内容。` : '',
    stats.skippedCards > 0 ? `跳过 ${stats.skippedCards} 张无法渲染正面的卡。` : '',
  ].filter(Boolean)
}

function finalizeApkgResult({ importId, cards, stats, notesById, totalCards }) {
  return {
    importId,
    cards,
    templates: Array.from(stats.templates.values()),
    deckNames: Array.from(stats.deckNames).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    deckSummaries: Array.from(stats.deckSummaries.values()).sort((a, b) => a.deckName.localeCompare(b.deckName, 'zh-CN')),
    noteCount: notesById.size,
    cardCount: totalCards,
    importedCount: stats.parsedCards,
    skippedCount: stats.skippedCards,
    warnings: makeApkgWarnings(stats, totalCards),
  }
}

function yieldToBrowser() {
  return new Promise((resolve) => window.setTimeout(resolve, 0))
}

export async function parseApkgPreview(file, options = {}) {
  const importId = options.importId ?? `apkg-${Date.now()}`
  const packageKey = options.packageKey ?? makeApkgPackageKey(file, importId)
  const previewLimit = Math.max(1, Number(options.previewLimit ?? DEFAULT_APKG_PREVIEW_LIMIT))
  const db = await openApkgDatabase(file, { onProgress: options.onProgress })
  try {
    options.onProgress?.({ stage: '读取卡组、笔记和模板表', processed: 0, imported: 0, total: 0, percent: 40 })
    const { decks, models, notesById, cards } = readAnkiData(db)
    const stats = makeApkgStats()
    seedDeckSummariesFromRawCards(stats, cards, decks)
    seedTemplateRecordsFromModels(stats, models)
    const previewCards = []
    for (let cardIndex = 0; cardIndex < cards.length && previewCards.length < previewLimit; cardIndex += 1) {
      const card = cards[cardIndex]
      const note = notesById.get(Number(card.nid))
      if (!note) continue
      const model = models[String(note.mid)]
      const template = model?.tmpls?.[Number(card.ord)] ?? model?.tmpls?.[0] ?? null
      const deck = decks[String(card.did)]
      const fields = splitFields(note, model)
      const tags = normalizeTags(note.tags)
      const result = buildImportedAnkiCard({ card, note, model, template, deck, fields, tags, importId, packageKey, fileName: file.name })
      recordApkgResult(stats, result)
      if (!result.skipped && result.card) previewCards.push(result.card)
      options.onProgress?.({ stage: `生成前 ${previewLimit} 张渲染预览`, processed: previewCards.length, imported: previewCards.length, total: previewLimit, percent: Math.min(96, 48 + Math.round((previewCards.length / previewLimit) * 44)) })
      if (cardIndex > 0 && cardIndex % 10 === 0 && typeof window !== 'undefined') await yieldToBrowser()
    }
    options.onProgress?.({ stage: '预览准备完成', processed: cards.length, imported: previewCards.length, total: cards.length, percent: 100 })
    return finalizeApkgResult({ importId, cards: previewCards, stats, notesById, totalCards: cards.length })
  } finally {
    db.close()
  }
}

export async function importApkgFileInBatches(file, options = {}) {
  const importId = options.importId ?? `apkg-${Date.now()}`
  const packageKey = options.packageKey ?? makeApkgPackageKey(file, importId)
  const batchSize = Math.min(MAX_APKG_BATCH_SIZE, Math.max(1, Number(options.batchSize ?? DEFAULT_APKG_BATCH_SIZE)))
  const db = await openApkgDatabase(file, { onProgress: options.onProgress })
  try {
    const { decks, models, notesById, cards } = readAnkiData(db)
    const stats = makeApkgStats()
    let batch = []
    let processed = 0
    options.onProgress?.({ stage: '开始生成 Anki 静态渲染', processed: 0, imported: 0, total: cards.length, percent: 0 })
    for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
      const card = cards[cardIndex]
      const note = notesById.get(Number(card.nid))
      if (!note) continue
      const model = models[String(note.mid)]
      const template = model?.tmpls?.[Number(card.ord)] ?? model?.tmpls?.[0] ?? null
      const deck = decks[String(card.did)]
      const fields = splitFields(note, model)
      const tags = normalizeTags(note.tags)
      const result = buildImportedAnkiCard({ card, note, model, template, deck, fields, tags, importId, packageKey, fileName: file.name })
      recordApkgResult(stats, result)
      processed += 1
      if (!result.skipped && result.card) batch.push(result.card)
      if (batch.length >= batchSize) {
        const currentBatch = batch
        batch = []
        await options.onBatch?.({ importId, cards: currentBatch, templates: Array.from(stats.templates.values()), processed, imported: stats.parsedCards, total: cards.length, deckSummaries: Array.from(stats.deckSummaries.values()) })
        options.onProgress?.({ stage: '写入 Anki 静态渲染', processed, imported: stats.parsedCards, total: cards.length, percent: Math.min(99, Math.round((processed / Math.max(1, cards.length)) * 100)) })
        if (typeof window !== 'undefined') await yieldToBrowser()
      } else if (cardIndex > 0 && cardIndex % PARSE_YIELD_EVERY === 0 && typeof window !== 'undefined') {
        options.onProgress?.({ stage: '生成 Anki 静态渲染', processed, imported: stats.parsedCards, total: cards.length, percent: Math.min(99, Math.round((processed / Math.max(1, cards.length)) * 100)) })
        await yieldToBrowser()
      }
    }
    if (batch.length > 0) {
      await options.onBatch?.({ importId, cards: batch, templates: Array.from(stats.templates.values()), processed, imported: stats.parsedCards, total: cards.length, deckSummaries: Array.from(stats.deckSummaries.values()) })
    }
    return finalizeApkgResult({ importId, cards: [], stats, notesById, totalCards: cards.length })
  } finally {
    db.close()
  }
}

export async function parseApkgFile(file, options = {}) {
  const importId = options.importId ?? `apkg-${Date.now()}`
  const packageKey = options.packageKey ?? makeApkgPackageKey(file, importId)
  const maxCards = Number(options.maxCards ?? 0)
  const db = await openApkgDatabase(file, { onProgress: options.onProgress })
  try {
    const { decks, models, notesById, cards } = readAnkiData(db)
    const stats = makeApkgStats()
    const rawCards = []
    options.onProgress?.({ stage: '开始解析 Anki 卡片', processed: 0, imported: 0, total: cards.length, percent: 42 })
    for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
      if (maxCards > 0 && rawCards.length >= maxCards) break
      const card = cards[cardIndex]
      const note = notesById.get(Number(card.nid))
      if (!note) continue
      const model = models[String(note.mid)]
      const template = model?.tmpls?.[Number(card.ord)] ?? model?.tmpls?.[0] ?? null
      const deck = decks[String(card.did)]
      const fields = splitFields(note, model)
      const tags = normalizeTags(note.tags)
      const result = buildImportedAnkiCard({ card, note, model, template, deck, fields, tags, importId, packageKey, fileName: file.name })
      recordApkgResult(stats, result)
      if (!result.skipped && result.card) rawCards.push(result.card)
      if (cardIndex > 0 && cardIndex % PARSE_YIELD_EVERY === 0) {
        options.onProgress?.({ stage: '正在生成 Anki 静态渲染', processed: cardIndex, imported: rawCards.length, total: cards.length, percent: Math.min(98, 42 + Math.round((cardIndex / Math.max(1, cards.length)) * 56)) })
        if (typeof window !== 'undefined') await yieldToBrowser()
      }
    }
    options.onProgress?.({ stage: 'Anki 解析完成', processed: cards.length, imported: rawCards.length, total: cards.length, percent: 100 })
    return finalizeApkgResult({ importId, cards: rawCards.filter((card) => card.front), stats, notesById, totalCards: cards.length })
  } finally {
    db.close()
  }
}
