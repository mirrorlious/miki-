import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { stripSelectionBlockingStylesFromCss } from './ankiHtml'
import { ankiHtmlToText, renderAnkiCardSides } from './lib/ankiTemplateEngine.js'
import { buildApkgStructuredRender } from './lib/apkgRenderRegistry.js'

const FIELD_SEPARATOR = '\x1f'
const MAX_SIDE_HTML_LENGTH = 36000
const MAX_CARD_CSS_LENGTH = 120000
const MAX_CARD_RICH_CONTENT_LENGTH = 76000
const MAX_STORED_SECTIONS_PER_CARD = 8
const DEFAULT_APKG_PREVIEW_LIMIT = 5
const DEFAULT_APKG_BATCH_SIZE = 500
const MAX_APKG_BATCH_SIZE = 500
const MAX_STORED_SECTION_HTML_LENGTH = 14000
const PARSE_YIELD_EVERY = 30
const SCRIPT_CALL_PATTERN = /^(?:decrypt|render|show|load|init)[a-zA-Z0-9_$]*\(\)$/i

const STATIC_EXAM_CARD_CSS = `
.miki-apkg-card {
  box-sizing: border-box;
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding: 18px 20px;
  color: #111827;
  font-size: 15px;
  line-height: 1.85;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
.miki-apkg-topbar {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 4px 0 14px;
}
.miki-apkg-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 12px;
  background: #f4f7fb;
  color: #4473b7;
  font-weight: 700;
}
.miki-apkg-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}
.miki-apkg-control {
  text-align: center;
  margin-bottom: 22px;
}
.miki-apkg-control-pill {
  border: 0;
  border-radius: 999px;
  padding: 9px 22px;
  background: #35c971;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 8px 20px rgba(53, 201, 113, 0.22);
}
.miki-apkg-question {
  margin: 18px 0 26px;
  font-weight: 700;
  color: #111827;
  white-space: pre-wrap;
}
.miki-apkg-question-type {
  color: #1677ff;
  margin-right: 4px;
}
.miki-apkg-options {
  display: grid;
  gap: 10px;
  margin: 18px 0 26px;
}
.miki-apkg-option {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 14px;
  border: 1.5px solid #111827;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  user-select: none;
}
.miki-apkg-option:hover {
  background: #f8fafc;
  border-color: #1677ff;
}
.miki-apkg-option input {
  width: 16px;
  height: 16px;
  margin: 0;
}
.miki-apkg-option-letter {
  font-weight: 800;
}
.miki-apkg-option-text {
  font-weight: 600;
}
.miki-apkg-source-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}
.miki-apkg-pill {
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border: 1.5px solid #1677ff;
  border-radius: 5px;
  color: #1677ff;
  background: #eff6ff;
  font-weight: 700;
}
.miki-apkg-back-title {
  text-align: center;
  color: #ef4444;
  font-size: 16px;
  margin: 0 0 16px;
}
.miki-apkg-section {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 16px;
  margin: 12px 0;
  background: #fff;
}
.miki-apkg-section h3 {
  color: #0f766e;
  font-size: 15px;
  margin: 0 0 8px;
}
.miki-apkg-section-content {
  color: #111827;
  white-space: normal;
}
.miki-anki-readable-fallback {
  padding: 16px;
  color: #111827;
  line-height: 1.85;
  white-space: pre-wrap;
}
`



function hashText(value = '') {
  const text = String(value ?? '')
  let hash = 2166136261
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
  return stripLeakedCssFromMarkup(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
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
    .replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/gi, 'none'))
}

function normalizeText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

const CSS_DECLARATION_PATTERN = /(?:^|[\s;{])(?:-webkit-|-moz-)?(?:align-items|animation|appearance|backdrop-filter|background(?:-color)?|border(?:-radius|-color|-width)?|box-shadow|color|cursor|display|filter|flex(?:-direction)?|font(?:-family|-size|-weight)?|gap|grid-template-columns|height|justify-content|left|letter-spacing|line-height|margin(?:-[a-z]+)?|max-height|max-width|min-height|min-width|opacity|overflow(?:-[xy])?|padding(?:-[a-z]+)?|pointer-events|position|right|text-align|text-decoration|top|transform|transition|user-select|vertical-align|white-space|width|z-index)\s*:\s*[^;<>]{1,240};?/gi
const CSS_SELECTOR_BLOCK_PATTERN = /(?:^|[\s>])(?:@media[^{}]*|@keyframes[^{}]*|[.#][a-zA-Z0-9_-]+(?:[\s.#:[\]="'()a-zA-Z0-9_-]+)?|(?:html|body|main|section|article|button|input|label|table|tbody|thead|tr|td|th|div|span|p|ul|ol|li|h[1-6])(?:[\s.#:[\]="'()a-zA-Z0-9_-]+)?)\s*\{[^{}]{0,1800}\}/gi
const CSS_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g

function cssDeclarationCount(value = '') {
  return (String(value).match(CSS_DECLARATION_PATTERN) || []).length
}

function looksLikeCssNoise(value = '') {
  const text = normalizeText(String(value).replace(/<[^>]*>/g, ' '))
  if (!text) return false
  const declarationCount = cssDeclarationCount(text)
  const hasSelector = /(?:^|\s)[.#][a-zA-Z0-9_-]+(?:[\s.#:[\]="'()a-zA-Z0-9_-]+)?\s*\{/.test(text)
    || /(?:^|\s)@(?:media|keyframes)\b/i.test(text)
  const hasCssComment = /\/\*[\s\S]*?\*\//.test(text)
  const cssWordCount = (text.match(/\b(?:backdrop-filter|border-radius|box-shadow|font-size|line-height|user-select|overflow-y|background-color|transition|display|padding|margin|cursor)\b/gi) || []).length
  if (declarationCount >= 4) return true
  if (hasSelector && declarationCount >= 1) return true
  if (hasCssComment && (declarationCount >= 1 || cssWordCount >= 2)) return true
  return false
}

function stripLeakedCssFromPlainText(value = '') {
  let text = String(value)
  if (!looksLikeCssNoise(text)) return text

  text = text.replace(CSS_COMMENT_PATTERN, ' ')
  for (let pass = 0; pass < 10; pass += 1) {
    const previous = text
    text = text.replace(CSS_SELECTOR_BLOCK_PATTERN, ' ')
    if (text === previous) break
  }
  text = text.replace(CSS_DECLARATION_PATTERN, ' ')
  return text.replace(/\s{2,}/g, ' ').trim()
}

function stripLeakedCssFromMarkup(markup = '') {
  let html = String(markup)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')

  // 一些 APKG 会把模板 CSS 作为普通文本塞进字段里；这里只剔除明显 CSS 噪声，不碰题干 HTML 结构。
  if (typeof document !== 'undefined' && /</.test(html)) {
    const template = document.createElement('template')
    template.innerHTML = html
    template.content.querySelectorAll('style').forEach((node) => node.remove())
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
    const nodes = []
    let node = walker.nextNode()
    while (node) {
      nodes.push(node)
      node = walker.nextNode()
    }
    nodes.forEach((textNode) => {
      if (looksLikeCssNoise(textNode.nodeValue)) {
        textNode.nodeValue = stripLeakedCssFromPlainText(textNode.nodeValue)
      }
    })
    html = template.innerHTML
  }

  if (looksLikeCssNoise(html)) {
    html = stripLeakedCssFromPlainText(html)
  }

  return html
}

function isCssOnlyContent(value = '') {
  const raw = String(value ?? '')
  const stripped = stripLeakedCssFromMarkup(raw)
  const beforeText = normalizeText(raw.replace(/<[^>]*>/g, ' '))
  const afterText = normalizeText(stripped.replace(/<[^>]*>/g, ' '))
  return beforeText.length > 0 && afterText.length === 0 && looksLikeCssNoise(beforeText)
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
    const fieldName = field?.name ?? `Field${index + 1}`
    const rawValue = values[index] ?? ''
    // Anki 模板 CSS 必须走 model.css/template.css，不应该混进卡片字段正文。
    fields[fieldName] = /(?:^|\b)(?:css|style|样式|模板样式)(?:\b|$)/i.test(fieldName)
      ? ''
      : stripLeakedCssFromMarkup(rawValue)
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
  const lowerName = String(name ?? '').toLowerCase()
  if (/(?:^|\b)(?:css|style|样式|模板样式)(?:\b|$)/i.test(lowerName)) return -Infinity
  if (isCssOnlyContent(value)) return -Infinity

  const text = stripHtml(value)
  if (isScriptCallText(text) || looksLikeCssNoise(text)) return -Infinity

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
    .filter((item) => item.text && item.text !== avoid && item.score > -Infinity && !looksLikeCssNoise(item.text))
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
    .find((text) => text && text !== avoid && !isScriptCallText(text) && !looksLikeCssNoise(text)) ?? ''
}

function pickSideText({ renderedHtml, fields, note, side, avoidText = '' }) {
  const renderedText = stripHtml(renderedHtml)
  if (!isScriptCallText(renderedText) && !looksLikeCssNoise(renderedText)) {
    const cleanRenderedText = removeKnownPrefixText(renderedText, avoidText)
    if (cleanRenderedText) return cleanRenderedText
  }

  const fieldText = pickFieldText(fields, side, avoidText)
  if (fieldText) return fieldText

  const anyFieldText = pickAnyFieldText(fields, avoidText)
  if (anyFieldText) return anyFieldText

  const sortFieldText = stripHtml(note.sfld)
  if (sortFieldText && sortFieldText !== normalizeText(avoidText) && !isScriptCallText(sortFieldText) && !looksLikeCssNoise(sortFieldText)) return sortFieldText

  return ''
}

function makeStoredSideHtml(renderedHtml, fallbackText) {
  const safeHtml = stripUnsafeTemplateParts(renderedHtml).trim()
  if (!safeHtml || safeHtml.length > MAX_SIDE_HTML_LENGTH) return ''

  const text = stripHtml(safeHtml)
  if (!text || isScriptCallText(text) || looksLikeCssNoise(text)) return ''
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
    return html && text && !looksLikeCssNoise(text) ? { id: `content-${id}`, label, html, text } : null
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
    return html && text && !looksLikeCssNoise(text) ? { id, label, html, text } : null
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


function trimStoredHtml(html = '', maxLength = MAX_SIDE_HTML_LENGTH) {
  const value = String(html ?? '').trim()
  if (!value) return ''
  if (value.length <= maxLength) return value
  const clipped = value.slice(0, maxLength)
  const lastBreak = Math.max(
    clipped.lastIndexOf('</p>'),
    clipped.lastIndexOf('</div>'),
    clipped.lastIndexOf('<br>'),
    clipped.lastIndexOf('<br/>'),
    clipped.lastIndexOf('<br />'),
  )
  return `${(lastBreak > maxLength * 0.45 ? clipped.slice(0, lastBreak + 5) : clipped).trim()}<p class="anki-import-truncated">内容较长，已保留可阅读文本并压缩 HTML。</p>`
}

function compactStoredSections(sections = []) {
  return sections.slice(0, MAX_STORED_SECTIONS_PER_CARD).map((section) => {
    const html = trimStoredHtml(section?.html, MAX_STORED_SECTION_HTML_LENGTH)
    const text = normalizeText(section?.text).slice(0, 1200)
    return {
      id: section?.id,
      label: section?.label,
      text,
      ...(html ? { html } : {}),
    }
  }).filter((section) => section.id && section.label && (section.html || section.text))
}

function shouldKeepRichCard() {
  // 用户明确需要 APKG 卡片保留原始静态 HTML 和选择题交互。
  // 不再按数量切换为纯文本；只在单张卡 HTML 极端过长时做安全裁剪。
  return true
}

function yieldToBrowser() {
  return new Promise((resolve) => window.setTimeout(resolve, 0))
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


function makeAnkiTemplateRecord({ model, template, modelName, templateName, templateId }) {
  const css = makeStoredCss(model?.css ?? '')
  const fields = Array.isArray(model?.flds)
    ? model.flds.map((field) => String(field?.name ?? '').trim()).filter(Boolean)
    : []
  const cardOrd = Number(template?.ord ?? 0) || 0
  const modelId = String(model?.id ?? model?.mid ?? (templateId.split('-').slice(2, -1).join('-') || ''))
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
    css,
    js: '',
    fields,
    apkgModelId: modelId,
    apkgCardOrd: cardOrd,
    apkgModelName: modelName,
    apkgTemplateName: templateName,
    updatedAt: Date.now(),
  }
}


const APKG_EXAM_CARD_CSS = `
.miki-apkg-card { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #111827; line-height: 1.75; }
.miki-apkg-card * { box-sizing: border-box; }
.miki-apkg-topbar { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 6px 0 28px; }
.miki-apkg-tab { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 8px 18px; border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.22); background: rgba(255,255,255,0.92); box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08); color: #2563eb; font-weight: 800; font-size: 14px; }
.miki-apkg-badge { min-width: 24px; height: 24px; padding: 0 8px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: #ef4444; color: #fff; font-size: 12px; font-weight: 900; }
.miki-apkg-control { display: flex; justify-content: center; margin: -14px 0 30px; }
.miki-apkg-control-pill { border: 0; border-radius: 999px; padding: 9px 22px; background: #39d486; color: #fff; font-weight: 900; box-shadow: 0 12px 28px rgba(34, 197, 94, 0.28); }
.miki-apkg-question { margin: 0 auto; max-width: 980px; font-size: 16px; font-weight: 750; line-height: 2; letter-spacing: 0.01em; }
.miki-apkg-question-type { color: #007aff; font-weight: 900; margin-right: 4px; }
.miki-apkg-options { margin: 28px auto 18px; max-width: 980px; display: grid; gap: 12px; }
.miki-apkg-option { display: flex; align-items: flex-start; gap: 10px; width: 100%; min-height: 46px; border: 1.5px solid #1f2937; border-radius: 5px; padding: 10px 14px; background: #fff; color: #111827; font-size: 15px; font-weight: 700; cursor: pointer; }
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
`

const UI_NOISE_WORDS = [
  '通知中心', 'Control Center', '检查更新', '全部(0)', '紧急(0)', '重要(0)', '普通(0)',
  '正在加载通知', '上次更新', '从未', '动画', '2025', '题目类型', '随机选项', '纯色模式',
  '核心凸显', '重置统计', '牌组层级', '选项还原', '选项代入', '套卷模式', '开始学习',
]

function stripAnkiUiNoiseText(value = '') {
  let text = normalizeText(value)
  if (!text) return ''

  text = text
    .replace(/^(?:题目材料|题目主体|通知中心\s*\d*|Control Center|\s)+/i, '')
    .replace(/(?:通知中心|Control Center|检查更新|全部\(0\)|紧急\(0\)|重要\(0\)|普通\(0\)|正在加载通知|上次更新|从未|动画|题目类型\s*\?|随机选项\s*\?|纯色模式|核心凸显|重置统计|牌组层级|选项还原|选项代入|套卷模式)[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  const questionStart = text.search(/(?:【[^】]{1,16}】|\[\s*[^\]]{1,16}\s*\]|\d{1,4}[\.、．]|[一二三四五六七八九十]+[、.．])/)
  if (questionStart > 0) text = text.slice(questionStart).trim()
  return text
}

function stripAnkiUiNoiseHtml(markup = '') {
  let html = stripUnsafeTemplateParts(markup)
  if (!html) return ''

  if (typeof document === 'undefined' || !/<[a-z][\s\S]*>/i.test(html)) {
    return stripAnkiUiNoiseText(stripHtml(html))
  }

  const template = document.createElement('template')
  template.innerHTML = html
  template.content.querySelectorAll('script, style, noscript, audio, video, source, img').forEach((node) => node.remove())
  template.content.querySelectorAll('*').forEach((node) => {
    const text = normalizeText(node.textContent || '')
    if (!text) return
    const hasOnlyUiNoise = UI_NOISE_WORDS.some((word) => text === word || text.startsWith(word)) && text.length < 180
    const isControlPanel = /(?:通知中心|Control Center|检查更新|全部\(0\)|紧急\(0\)|重要\(0\)|普通\(0\)|题目类型\s*\?|随机选项\s*\?)/.test(text)
    if (hasOnlyUiNoise || isControlPanel) node.remove()
  })
  return template.innerHTML
}

function normalizeOptionText(value = '') {
  return stripAnkiUiNoiseText(value)
    .replace(/^[:：,，;；\s]+/, '')
    .replace(/\s*(?:法制史|刑法学|民法学|宪法学|法理学|第\d+卷|通知中心|Control Center|检查更新|全部\(0\)|紧急\(0\)|重要\(0\)|普通\(0\)|正在加载通知|上次更新|题目类型)[\s\S]*$/i, '')
    .trim()
}

function extractChoiceQuestion(text = '') {
  const clean = stripAnkiUiNoiseText(text)
    .replace(/([A-H])\s*[\.．、]\s*/g, ' $1. ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return { questionText: '', choices: [] }

  const optionPattern = /(?:^|\s)([A-H])\s*[\.．、]\s*([\s\S]*?)(?=(?:\s+[A-H]\s*[\.．、]\s*)|$)/g
  const choices = []
  let firstOptionIndex = -1
  let match = optionPattern.exec(clean)
  while (match) {
    if (firstOptionIndex < 0) firstOptionIndex = match.index
    const optionText = normalizeOptionText(match[2])
    if (optionText && optionText.length <= 260) {
      choices.push({ letter: match[1], text: optionText })
    }
    match = optionPattern.exec(clean)
  }

  const questionText = firstOptionIndex >= 0 ? clean.slice(0, firstOptionIndex).trim() : clean
  return { questionText: stripAnkiUiNoiseText(questionText), choices }
}

function findBestQuestionSource({ fields, renderedQuestionHtml }) {
  const entries = Object.entries(fields)
  const preferredNames = [/题目主体/i, /题干/i, /题目/i, /选择题/i, /Front/i, /Question/i, /Stem/i]
  const candidates = [
    { name: 'rendered', html: renderedQuestionHtml, score: 5 },
    ...entries.map(([name, html]) => ({ name, html, score: 0 })),
  ].map((item) => {
    const text = stripAnkiUiNoiseText(stripHtml(item.html))
    const { choices } = extractChoiceQuestion(text)
    let score = item.score + Math.min(text.length, 400) / 80
    if (preferredNames.some((pattern) => pattern.test(item.name))) score += 12
    if (choices.length >= 2) score += 18
    if (/【[^】]+】|\[[^\]]+\]|\d{1,4}[\.、．]/.test(text)) score += 6
    if (/通知中心|Control Center|检查更新/.test(text)) score -= 10
    if (looksLikeCssNoise(text) || isScriptCallText(text)) score = -Infinity
    return { ...item, text, score, choices }
  })
    .filter((item) => item.text && item.score > -Infinity)
    .sort((a, b) => b.score - a.score)

  return candidates[0] ?? { html: renderedQuestionHtml, text: stripAnkiUiNoiseText(stripHtml(renderedQuestionHtml)), choices: [] }
}

function extractSourcePills(fields, deckPath = [], tags = []) {
  const text = normalizeText([
    ...Object.values(fields).map((value) => stripHtml(value)),
    ...deckPath,
    ...tags,
  ].join(' '))
  const pills = []
  const push = (value) => {
    const clean = normalizeText(value).replace(/[【】\[\]]/g, '')
    if (clean && clean.length <= 60 && !pills.includes(clean) && !/通知中心|Control Center|检查更新/.test(clean)) pills.push(clean)
  }

  ;(text.match(/[\u4e00-\u9fa5A-Za-z0-9]{1,12}[（(][^）)]{2,36}[）)]/g) || []).forEach(push)
  ;(text.match(/第\d{1,4}卷/g) || []).forEach(push)
  deckPath.slice(-3).forEach(push)
  tags.slice(0, 4).forEach(push)
  return pills.slice(0, 4)
}

function inferQuestionType(questionText = '') {
  const match = String(questionText).match(/[【\[]\s*([^】\]]{1,12})\s*[】\]]/)
  return match?.[1] ?? ''
}

function removeQuestionTypeMarker(questionText = '') {
  return String(questionText).replace(/^[【\[]\s*[^】\]]{1,12}\s*[】\]]\s*/, '').trim()
}

function buildStaticExamFrontHtml({ fields, renderedQuestionHtml, deckPath, tags }) {
  const source = findBestQuestionSource({ fields, renderedQuestionHtml })
  const extracted = extractChoiceQuestion(source.text)
  const questionText = extracted.questionText || source.text
  const choices = extracted.choices.length >= 2 ? extracted.choices : source.choices
  if (!questionText || choices.length < 2) return null

  const questionType = inferQuestionType(questionText)
  const questionMain = removeQuestionTypeMarker(questionText)
  const inputType = /多选|不定项|多项/i.test(questionType) ? 'checkbox' : 'radio'
  const groupName = `miki-apkg-choice-${Math.random().toString(36).slice(2, 9)}`
  const sourcePills = extractSourcePills(fields, deckPath, tags)

  return {
    text: normalizeText(`${questionText} ${choices.map((item) => `${item.letter}. ${item.text}`).join(' ')}`),
    html: `
<div class="miki-apkg-card miki-apkg-front">
  <div class="miki-apkg-topbar">
    <span class="miki-apkg-tab">题目主体</span>
    <span class="miki-apkg-tab">通知中心 <span class="miki-apkg-badge">${Math.max(1, choices.length + 3)}</span></span>
  </div>
  <div class="miki-apkg-control"><button class="miki-apkg-control-pill" type="button">Control Center</button></div>
  <div class="miki-apkg-question">${questionType ? `<span class="miki-apkg-question-type">【${escapeHtml(questionType)}】</span>` : ''}${escapeHtml(questionMain)}</div>
  <div class="miki-apkg-options">
    ${choices.map((choice) => `
      <label class="miki-apkg-option">
        <input type="${inputType}" name="${groupName}" value="${escapeHtml(choice.letter)}" />
        <span class="miki-apkg-option-letter">${escapeHtml(choice.letter)}.</span>
        <span class="miki-apkg-option-text">${escapeHtml(choice.text)}</span>
      </label>
    `).join('')}
  </div>
  ${sourcePills.length ? `<div class="miki-apkg-source-pills">${sourcePills.map((pill) => `<span class="miki-apkg-pill">${escapeHtml(pill)}</span>`).join('')}</div>` : ''}
</div>`,
  }
}

function buildStaticExamBackHtml({ answerSections, answerHtml, fields, frontText }) {
  const sections = Array.isArray(answerSections) && answerSections.length > 0 ? answerSections : makeFieldSections(fields)
  const cleanSections = sections
    .map((section) => {
      const text = normalizeOptionText(removeKnownPrefixText(section?.text ?? stripHtml(section?.html), frontText))
      const html = stripAnkiUiNoiseHtml(section?.html || escapeHtml(text))
      return text ? { ...section, text, html } : null
    })
    .filter(Boolean)

  if (cleanSections.length > 0) {
    const backText = normalizeText(cleanSections.map((section) => section.text).join(' '))
    const backHtml = `
<div class="miki-apkg-card miki-apkg-back">
  <h2 class="miki-apkg-back-title">答案 / 解析</h2>
  ${cleanSections.map((section) => `
    <section class="miki-apkg-section">
      <h3>${escapeHtml(section.label || '解析')}</h3>
      <div class="miki-apkg-section-content">${section.html || escapeHtml(section.text)}</div>
    </section>
  `).join('')}
</div>`
    return { text: backText, html: backHtml }
  }

  const rawText = normalizeOptionText(removeKnownPrefixText(stripHtml(answerHtml), frontText))
  if (!rawText) return null
  return {
    text: rawText,
    html: `<div class="miki-apkg-card miki-apkg-back"><h2 class="miki-apkg-back-title">答案 / 解析</h2><div class="miki-apkg-section"><div class="miki-apkg-section-content">${escapeHtml(rawText)}</div></div></div>`,
  }
}


function htmlToPlainTextFast(html = '') {
  return normalizeText(String(html ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' '))
}

function looksLikeScriptOnlyAnkiHtml(html = '') {
  const raw = String(html ?? '').trim()
  if (!raw) return true
  const text = htmlToPlainTextFast(raw)
  if (!text && !/<(?:img|video|audio|canvas|svg|table|input|button|label)\b/i.test(raw)) return true
  if (/^(?:decrypt|render|show|load|init)[a-zA-Z0-9_$]*\(\)\s*;?$/i.test(text)) return true
  if (text.length <= 8 && /<script\b|\bon[a-z]+\s*=|javascript:/i.test(raw)) return true
  return false
}

function makeReadableFallbackHtml(text = '') {
  const clean = normalizeText(text)
  if (!clean) return ''
  return `<div class="miki-anki-readable-fallback">${escapeHtml(clean).replace(/\n/g, '<br />')}</div>`
}

function pickStoredAnkiSideHtml({ rawHtml = '', cleanHtml = '', text = '' } = {}) {
  const clean = String(cleanHtml ?? '').trim()
  const raw = String(rawHtml ?? '').trim()
  if (clean && !looksLikeScriptOnlyAnkiHtml(clean)) return clean
  if (raw && !looksLikeScriptOnlyAnkiHtml(raw)) return raw
  return makeReadableFallbackHtml(text)
}


function extractNativeAnkiScripts(...htmlParts) {
  const scripts = []
  for (const html of htmlParts) {
    String(html ?? '').replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, code) => {
      const clean = String(code ?? '').trim()
      if (clean) scripts.push(clean)
      return ''
    })
  }
  return scripts.join('\n;\n')
}

function stripNativeAnkiScriptTags(html = '') {
  return String(html ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
}

function normalizeApkgRenderMode(value = '') {
  const mode = String(value || '').toLowerCase()
  if (mode === 'smart' || mode === 'structured' || mode === 'choice') return 'smart'
  if (mode === 'plain') return 'plain'
  return 'native'
}


function templateAllowsRuntimeScript(template = {}) {
  const html = `${template?.qfmt || ''}\n${template?.afmt || ''}`
  return /<script\b|\son[a-z]+\s*=|javascript:/i.test(html)
}

function makeLazyImportedAnkiCard({ card, note, model, template, deck, fields, tags, importId, packageKey, fileName }) {
  const deckName = deck?.name ?? 'Anki 导入'
  const deckPath = splitAnkiDeckPath(deckName)
  const modelName = model?.name ?? 'Anki 模板'
  const templateName = template?.name ?? `模板 ${Number(card.ord) + 1}`
  const templateId = `anki-template-${String(note.mid)}-${Number(card.ord) || 0}`
  const templateRecord = makeAnkiTemplateRecord({ model, template, modelName, templateName, templateId })
  const frontText = normalizeText(
    pickFieldText(fields, 'front')
      || stripHtml(note.sfld)
      || pickAnyFieldText(fields)
      || 'Anki 正面',
  )
  const backText = normalizeText(pickFieldText(fields, 'back', frontText) || '')
  const stablePackageKey = packageKey || cleanPackageKeyPart(fileName || importId || 'apkg')
  const stableCardKey = `apkg:${stablePackageKey}:${note.id}:${card.id}:${card.ord}`
  const hasRuntimeScript = templateAllowsRuntimeScript(template)
  const ankiPayload = {
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
  }

  return {
    hasScriptFallback: hasRuntimeScript,
    skipped: false,
    template: templateRecord,
    card: {
      id: `anki-${stablePackageKey}-${card.id}`,
      front: frontText,
      back: backText,
      rawFront: '',
      rawBack: '',
      template: templateId,
      templateId,
      tags,
      anki: ankiPayload,
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
        nativeTemplate: true,
        lazyNativeAnkiRender: true,
        nativeRenderMode: 'native',
        allowAnkiJs: hasRuntimeScript,
      },
    },
    deckSummary: {
      deckName,
      deckPath,
      key: deckPath.join('::') || deckName,
    },
  }
}

function buildImportedAnkiCard({ card, note, model, template, deck, fields, tags, importId, packageKey, fileName, renderMode = 'native' }) {
  const deckName = deck?.name ?? 'Anki 导入'
  const deckPath = splitAnkiDeckPath(deckName)
  const modelName = model?.name ?? 'Anki 模板'
  const templateName = template?.name ?? `模板 ${Number(card.ord) + 1}`
  const templateId = `anki-template-${String(note.mid)}-${Number(card.ord) || 0}`
  const normalizedRenderMode = normalizeApkgRenderMode(renderMode)

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

  const cleanFrontHtml = trimStoredHtml(rendered.frontHtml)
  const cleanBackHtml = trimStoredHtml(rendered.backHtml)
  const initialFrontText = normalizeText(rendered.frontText || ankiHtmlToText(cleanFrontHtml) || note.sfld || '')
  const initialBackText = normalizeText(rendered.backText || ankiHtmlToText(cleanBackHtml) || '')

  const answerSections = normalizedRenderMode === 'smart' ? [
    ...extractToggleSections(rendered.rawBackHtml || rendered.backHtml || ''),
    ...makeFieldSections(fields),
  ] : []

  const structuredRender = normalizedRenderMode === 'smart' ? buildApkgStructuredRender({
    fields,
    renderedQuestionHtml: rendered.rawFrontHtml || rendered.frontHtml || cleanFrontHtml || note.sfld || '',
    renderedBackHtml: rendered.rawBackHtml || rendered.backHtml || cleanBackHtml || '',
    deckPath,
    tags,
    modelName,
    templateName,
  }) : null

  const staticFront = normalizedRenderMode === 'smart'
    ? (structuredRender
      ? { html: structuredRender.frontHtml, text: structuredRender.frontText }
      : buildStaticExamFrontHtml({
        fields,
        renderedQuestionHtml: rendered.rawFrontHtml || rendered.frontHtml || cleanFrontHtml || note.sfld || '',
        deckPath,
        tags,
      }))
    : null
  const staticBack = normalizedRenderMode === 'smart'
    ? (structuredRender
      ? { html: structuredRender.backHtml, text: structuredRender.backText }
      : buildStaticExamBackHtml({
        answerSections,
        answerHtml: rendered.rawBackHtml || rendered.backHtml || cleanBackHtml || '',
        fields,
        frontText: staticFront?.text || initialFrontText,
      }))
    : null

  const fallbackFrontHtml = trimStoredHtml(pickStoredAnkiSideHtml({ rawHtml: rendered.rawFrontHtml, cleanHtml: cleanFrontHtml, text: initialFrontText }))
  const fallbackBackHtml = trimStoredHtml(pickStoredAnkiSideHtml({ rawHtml: rendered.rawBackHtml, cleanHtml: cleanBackHtml, text: initialBackText }))
  const frontHtml = trimStoredHtml(staticFront?.html || fallbackFrontHtml)
  const backHtml = trimStoredHtml(staticBack?.html || fallbackBackHtml)
  const frontText = normalizeText(staticFront?.text || initialFrontText || ankiHtmlToText(frontHtml) || note.sfld || '')
  const backText = normalizeText(staticBack?.text || initialBackText || ankiHtmlToText(backHtml) || '')

  if (!frontText && !frontHtml) return { skipped: true, hasScriptFallback: false }

  const usedStaticExamRenderer = normalizedRenderMode === 'smart' && Boolean(staticFront?.html || staticBack?.html)
  const nativeCardJs = normalizedRenderMode === 'native'
    ? extractNativeAnkiScripts(rendered.rawFrontHtml, rendered.rawBackHtml)
    : ''
  const cardCss = makeStoredCss(`${rendered.css || templateRecord.css || ''}
${usedStaticExamRenderer ? STATIC_EXAM_CARD_CSS : ''}
${structuredRender?.css || ''}`)
  const stablePackageKey = packageKey || cleanPackageKeyPart(fileName || importId || 'apkg')
  const stableCardKey = `apkg:${stablePackageKey}:${note.id}:${card.id}:${card.ord}`
  const ankiPayload = {
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
  }

  return {
    hasScriptFallback: /<script\b|\bon[a-z]+\s*=|javascript:/i.test(`${rendered.rawFrontHtml}\n${rendered.rawBackHtml}`),
    skipped: false,
    template: templateRecord,
    card: {
      id: `anki-${stablePackageKey}-${card.id}`,
      front: frontText || 'Anki 正面',
      back: backText || '',
      rawFront: usedStaticExamRenderer
        ? frontHtml
        : (normalizedRenderMode === 'native'
          ? stripNativeAnkiScriptTags(rendered.rawFrontHtml || frontHtml || frontText)
          : (looksLikeScriptOnlyAnkiHtml(rendered.rawFrontHtml) ? frontHtml : (rendered.rawFrontHtml || frontHtml || frontText))),
      rawBack: usedStaticExamRenderer
        ? backHtml
        : (normalizedRenderMode === 'native'
          ? stripNativeAnkiScriptTags(rendered.rawBackHtml || backHtml || backText)
          : (looksLikeScriptOnlyAnkiHtml(rendered.rawBackHtml) ? backHtml : (rendered.rawBackHtml || backHtml || backText))),
      frontHtml,
      backHtml,
      cardCss,
      cardJs: nativeCardJs,
      template: templateId,
      templateId,
      tags,
      anki: ankiPayload,
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
        nativeTemplate: normalizedRenderMode === 'native',
        nativeRenderMode: normalizedRenderMode,
        staticExamRenderer: usedStaticExamRenderer,
        ankiStudioChoiceRenderer: Boolean(structuredRender?.renderer?.includes('ankistudio')),
        apkgStructuredRenderer: structuredRender?.renderer || '',
        apkgFieldAnalysis: structuredRender?.fieldAnalysis || null,
        allowAnkiJs: normalizedRenderMode === 'native' && Boolean(nativeCardJs),
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
  if (!collectionFile) {
    throw new Error('这个 APKG 里没有找到 collection.anki2 / collection.anki21。')
  }

  const collectionPromise = collectionFile.async('uint8array', (meta) => {
    const rawPercent = Math.max(0, Math.min(100, Math.round(meta?.percent ?? 0)))
    onProgress?.({
      stage: '读取 Anki 数据库',
      processed: rawPercent,
      imported: 0,
      total: 100,
      percent: 14 + Math.round(rawPercent * 0.18),
    })
  })

  const [SQL, collectionBuffer] = await Promise.all([
    getSql(),
    collectionPromise,
  ])

  onProgress?.({ stage: '打开 Anki SQLite 数据库', processed: 0, imported: 0, total: 0, percent: 34 })
  return new SQL.Database(collectionBuffer)
}

function makeApkgStats() {
  return {
    deckNames: new Set(),
    deckSummaries: new Map(),
    templates: new Map(),
    scriptFallbackCount: 0,
    skippedCards: 0,
    parsedCards: 0,
  }
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
      stats.templates.set(templateId, makeAnkiTemplateRecord({
        model,
        template,
        modelName,
        templateName,
        templateId,
      }))
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
  const deckName = result.deckSummary.deckName
  const deckSummaryKey = result.deckSummary.key
  stats.deckNames.add(deckName)
  const deckSummary = stats.deckSummaries.get(deckSummaryKey) ?? { deckName, deckPath: result.deckSummary.deckPath, count: 0 }
  deckSummary.count += 1
  stats.deckSummaries.set(deckSummaryKey, deckSummary)
  if (result.template?.id) stats.templates.set(result.template.id, result.template)
}

function makeApkgWarnings(stats, totalCards) {
  return [
    stats.scriptFallbackCount > 0 ? `检测到 ${stats.scriptFallbackCount} 张卡含脚本/动态逻辑；将使用 iframe 沙盒运行，避免污染主站。` : '',
    totalCards >= 500 ? `大包已按每批最多 ${MAX_APKG_BATCH_SIZE} 张处理；按 Anki 字段 + 模板原生渲染，媒体文件先跳过。` : '',
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

export async function parseApkgPreview(file, options = {}) {
  const importId = options.importId ?? `apkg-${Date.now()}`
  const packageKey = options.packageKey ?? makeApkgPackageKey(file, importId)
  const previewLimit = Math.max(1, Number(options.previewLimit ?? DEFAULT_APKG_PREVIEW_LIMIT))
  const onProgress = options.onProgress
  const db = await openApkgDatabase(file, { onProgress })
  try {
    onProgress?.({ stage: '读取卡组、笔记和模板表', processed: 0, imported: 0, total: 0, percent: 40 })
    const { decks, models, notesById, cards } = readAnkiData(db)
    const stats = makeApkgStats()
    seedDeckSummariesFromRawCards(stats, cards, decks)
    seedTemplateRecordsFromModels(stats, models)
    // 预览阶段只生成前几张轻量索引；正式导入也只保存 Anki 原始字段和模板，学习时再渲染当前卡。
    stats.parsedCards = cards.length

    const previewCards = []
    let scanned = 0
    const scanLimit = cards.length
    for (let cardIndex = 0; cardIndex < cards.length && previewCards.length < previewLimit; cardIndex += 1) {
      const card = cards[cardIndex]
      const note = notesById.get(Number(card.nid))
      scanned = cardIndex + 1
      if (!note) continue
      const model = models[String(note.mid)]
      const template = model?.tmpls?.[Number(card.ord)] ?? model?.tmpls?.[0] ?? null
      const deck = decks[String(card.did)]
      const fields = splitFields(note, model)
      const tags = normalizeTags(note.tags)
      const result = makeLazyImportedAnkiCard({ card, note, model, template, deck, fields, tags, importId, packageKey, fileName: file.name })
      if (!result.skipped && result.card) previewCards.push(result.card)

      const previewPercent = Math.min(96, 48 + Math.round((previewCards.length / previewLimit) * 44))
      onProgress?.({
        stage: `生成前 ${previewLimit} 张轻量预览`,
        processed: Math.min(previewCards.length, previewLimit),
        imported: previewCards.length,
        total: previewLimit,
        percent: previewPercent,
      })
      if (cardIndex > 0 && cardIndex % 10 === 0 && typeof window !== 'undefined') await yieldToBrowser()
    }

    if (previewCards.length < previewLimit && scanned >= scanLimit) {
      stats.skippedCards = Math.max(0, previewLimit - previewCards.length)
    }

    onProgress?.({ stage: '预览准备完成', processed: cards.length, imported: previewCards.length, total: cards.length, percent: 100 })
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
    options.onProgress?.({ stage: '开始写入 Anki 原始数据', processed: 0, imported: 0, total: cards.length, percent: 0 })
    const stats = makeApkgStats()
    let batch = []
    let processed = 0

    for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
      const card = cards[cardIndex]
      const note = notesById.get(Number(card.nid))
      if (!note) continue
      const model = models[String(note.mid)]
      const template = model?.tmpls?.[Number(card.ord)] ?? model?.tmpls?.[0] ?? null
      const deck = decks[String(card.did)]
      const fields = splitFields(note, model)
      const tags = normalizeTags(note.tags)
      const result = makeLazyImportedAnkiCard({ card, note, model, template, deck, fields, tags, importId, packageKey, fileName: file.name })
      recordApkgResult(stats, result)
      processed += 1

      if (!result.skipped && result.card) batch.push(result.card)

      if (batch.length >= batchSize) {
        const currentBatch = batch
        batch = []
        await options.onBatch?.({
          importId,
          cards: currentBatch,
          templates: Array.from(stats.templates.values()),
          processed,
          imported: stats.parsedCards,
          total: cards.length,
          deckSummaries: Array.from(stats.deckSummaries.values()),
        })
        options.onProgress?.({ stage: '写入 Anki 原始数据', processed, imported: stats.parsedCards, total: cards.length })
        if (typeof window !== 'undefined') await yieldToBrowser()
      } else if (cardIndex > 0 && cardIndex % PARSE_YIELD_EVERY === 0 && typeof window !== 'undefined') {
        options.onProgress?.({ stage: '写入 Anki 原始数据', processed, imported: stats.parsedCards, total: cards.length })
        await yieldToBrowser()
      }
    }

    if (batch.length > 0) {
      await options.onBatch?.({
        importId,
        cards: batch,
        templates: Array.from(stats.templates.values()),
        processed,
        imported: stats.parsedCards,
        total: cards.length,
        deckSummaries: Array.from(stats.deckSummaries.values()),
      })
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
      if (cardIndex > 0 && cardIndex % PARSE_YIELD_EVERY === 0) {
        options.onProgress?.({
          stage: '正在生成 Anki 轻量索引',
          processed: cardIndex,
          imported: rawCards.length,
          total: cards.length,
          percent: Math.min(98, 42 + Math.round((cardIndex / Math.max(1, cards.length)) * 56)),
        })
        if (typeof window !== 'undefined') await yieldToBrowser()
      }
      const card = cards[cardIndex]
      const note = notesById.get(Number(card.nid))
      if (!note) continue
      const model = models[String(note.mid)]
      const template = model?.tmpls?.[Number(card.ord)] ?? model?.tmpls?.[0] ?? null
      const deck = decks[String(card.did)]
      const fields = splitFields(note, model)
      const tags = normalizeTags(note.tags)
      const result = makeLazyImportedAnkiCard({ card, note, model, template, deck, fields, tags, importId, packageKey, fileName: file.name })
      recordApkgResult(stats, result)
      if (!result.skipped && result.card) rawCards.push(result.card)
    }

    options.onProgress?.({ stage: 'Anki 解析完成', processed: cards.length, imported: rawCards.length, total: cards.length, percent: 100 })
    return finalizeApkgResult({ importId, cards: rawCards.filter((card) => card.front), stats, notesById, totalCards: cards.length })
  } finally {
    db.close()
  }
}
