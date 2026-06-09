// v19: Anki-compatible template rendering for APKG/COLPKG imports.
// 目标：按 Anki 的 note fields + model template(qfmt/afmt/css) 渲染，而不是猜选择题格式。

const CLOZE_RE = /{{c(\d+)::([\s\S]*?)(?:::(.*?))?}}/g

export function normalizeAnkiText(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}


function decodeHtmlEntitiesOnce(value = '') {
  const raw = String(value ?? '')
  if (!/[&](?:lt|gt|amp|quot|#39|apos|nbsp);/i.test(raw)) return raw

  // Anki 字段本来就是 HTML 片段。这里仅在“字段替换阶段”做一次反转义，
  // 避免把 &lt;div&gt; 这种合法字段 HTML 当纯文本显示。
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = raw
    return textarea.value
  }

  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
}

function decodeBasicEntities(value = '') {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
}

export function ankiHtmlToText(html = '') {
  const value = String(html ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|li|tr|h[1-6])>/gi, '\n')

  if (typeof document !== 'undefined') {
    const element = document.createElement('div')
    element.innerHTML = value
    return normalizeAnkiText(element.textContent || element.innerText || '')
  }

  return normalizeAnkiText(decodeBasicEntities(value.replace(/<[^>]*>/g, ' ')))
}

function fieldValue(fields, name = '') {
  const cleanName = String(name ?? '').trim()
  if (!cleanName) return ''
  if (Object.prototype.hasOwnProperty.call(fields, cleanName)) return fields[cleanName] ?? ''
  const match = Object.keys(fields).find((key) => key.toLowerCase() === cleanName.toLowerCase())
  return match ? fields[match] ?? '' : ''
}

function fieldHasValue(fields, name = '') {
  return normalizeAnkiText(ankiHtmlToText(fieldValue(fields, name)) || fieldValue(fields, name)).length > 0
}

function stripClozeMarkup(value = '') {
  return String(value ?? '').replace(CLOZE_RE, (_, _idx, text) => text)
}

function renderCloze(value = '', clozeIndex = 1, revealed = false) {
  return String(value ?? '').replace(CLOZE_RE, (_, rawIndex, text, hint) => {
    const index = Number(rawIndex)
    if (index !== Number(clozeIndex)) return text
    if (revealed) return `<span class="cloze cloze-revealed">${text}</span>`
    return `<span class="cloze">[${hint ? escapeHtml(ankiHtmlToText(hint)) : '...'}]</span>`
  })
}

function processConditionals(template = '', fields = {}) {
  let html = String(template ?? '')
  for (let pass = 0; pass < 12; pass += 1) {
    const previous = html
    html = html.replace(/{{#([^}]+)}}([\s\S]*?){{\/\1}}/g, (_, rawName, inner) => (
      fieldHasValue(fields, rawName.trim()) ? inner : ''
    ))
    html = html.replace(/{{\^([^}]+)}}([\s\S]*?){{\/\1}}/g, (_, rawName, inner) => (
      fieldHasValue(fields, rawName.trim()) ? '' : inner
    ))
    if (html === previous) break
  }
  return html
}

function applyAnkiFilters(rawToken = '', context = {}) {
  const { fields, tags = [], deckName = '', templateName = '', frontSide = '', clozeIndex = 1, revealed = false } = context
  const token = String(rawToken ?? '').trim()
  if (!token || token.startsWith('#') || token.startsWith('^') || token.startsWith('/')) return ''

  if (/^FrontSide$/i.test(token)) return frontSide || ''
  if (/^Tags$/i.test(token)) return tags.join(' ')
  if (/^Deck$/i.test(token)) return deckName
  if (/^Subdeck$/i.test(token)) return String(deckName).split('::').pop() || deckName
  if (/^Card$/i.test(token)) return templateName
  if (/^type:/i.test(token)) return ''
  if (/^tts\b/i.test(token)) return ''

  const parts = token.split(':').map((part) => part.trim()).filter(Boolean)
  const fieldName = parts.length ? parts[parts.length - 1] : token
  const filters = parts.slice(0, -1).map((part) => part.toLowerCase())
  let value = fieldValue(fields, fieldName)

  // 关键：只在字段粒度处理 HTML 实体，不扫 DOM、不做 MutationObserver。
  // Anki 字段允许存 HTML；如果字段被某个链路转成 &lt;div&gt;，这里还原一次。
  value = decodeHtmlEntitiesOnce(value)

  for (let i = filters.length - 1; i >= 0; i -= 1) {
    const filter = filters[i]
    if (filter === 'cloze') value = renderCloze(value, clozeIndex, revealed)
    else if (filter === 'text') value = escapeHtml(ankiHtmlToText(stripClozeMarkup(value)))
    else if (filter === 'hint') value = value ? `<a class="hint" href="#" onclick="this.nextElementSibling.style.display='inline'; this.style.display='none'; return false;">显示提示</a><span class="hint-content" style="display:none">${value}</span>` : ''
    else if (filter === 'furigana' || filter === 'kana' || filter === 'kanji') value = value
    else value = value
  }

  // Anki 模板默认把字段当 HTML 片段插入，不能转义，否则原 APKG 样式和选项结构会碎。
  return value ?? ''
}

export function renderAnkiTemplate(template = '', context = {}) {
  let html = processConditionals(String(template ?? ''), context.fields || {})

  // 注释字段是 Anki 模板里的调试/说明，渲染时不显示。
  html = html.replace(/{{![\s\S]*?}}/g, '')
  html = html.replace(/{{([^}]+)}}/g, (_, token) => applyAnkiFilters(token, context))
  return html.trim()
}

export function extractStyleBlocks(html = '') {
  const cssBlocks = []
  const cleanHtml = String(html ?? '').replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    if (normalizeAnkiText(css)) cssBlocks.push(css)
    return ''
  })
  return { html: cleanHtml, css: cssBlocks.join('\n') }
}

export function prepareAnkiStoredHtml(html = '') {
  return String(html ?? '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, '<span class="anki-media-placeholder">[音频已跳过]</span>')
    .replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, '<span class="anki-media-placeholder">[视频已跳过]</span>')
    .replace(/<source\b[^>]*>/gi, '')
    .replace(/\[sound:([^\]]+)\]/gi, '<span class="anki-media-placeholder">[音频：$1]</span>')
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<\/?(?:html|body|template)\b[^>]*>/gi, '')
    .trim()
}

export function renderAnkiCardSides({ model, template, fields, tags, deckName, templateName, cardOrd }) {
  const clozeIndex = Number(cardOrd) + 1
  const context = { fields, tags, deckName, templateName, clozeIndex, revealed: false }
  const rawFront = renderAnkiTemplate(template?.qfmt || '{{Front}}', context)
  const backContext = { ...context, frontSide: rawFront, revealed: true }
  const rawBack = renderAnkiTemplate(template?.afmt || '{{Back}}', backContext)
  const frontStyle = extractStyleBlocks(rawFront)
  const backStyle = extractStyleBlocks(rawBack)
  const css = [model?.css || '', frontStyle.css, backStyle.css].filter(Boolean).join('\n')

  return {
    rawFrontHtml: rawFront,
    rawBackHtml: rawBack,
    frontHtml: prepareAnkiStoredHtml(frontStyle.html),
    backHtml: prepareAnkiStoredHtml(backStyle.html),
    css,
    frontText: ankiHtmlToText(frontStyle.html) || firstReadableFieldText(fields),
    backText: ankiHtmlToText(backStyle.html) || ankiHtmlToText(rawBack) || '',
  }
}

export function firstReadableFieldText(fields = {}) {
  const values = Object.entries(fields)
    .filter(([name]) => !/^(?:css|style|js|script)$/i.test(String(name).trim()))
    .map(([, value]) => ankiHtmlToText(value))
    .filter(Boolean)
  return values[0] || ''
}
