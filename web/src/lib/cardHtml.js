import DOMPurify from 'dompurify'
import { stripAnswerSectionFromHtml, stripAnswerSectionFromText, makeHtmlTextSelectable, stripSelectionBlockingStylesFromCss } from '../ankiHtml.js'
import { SYSTEM_CARD_TEMPLATES } from './cardTemplates.js'

function getCardSideHtml(card, side) {
  return side === 'front' ? card?.frontHtml : card?.backHtml
}

function getCardSideText(card, side) {
  return side === 'front' ? card?.front : card?.back
}

function looksLikeHtml(value = '') {
  return /<\/?[a-z][\s\S]*>/i.test(String(value))
}

function htmlToPlainText(html = '') {
  if (typeof document === 'undefined') return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const element = document.createElement('div')
  element.innerHTML = String(html)
  return (element.textContent || element.innerText || '').replace(/\s+/g, ' ').trim()
}

function sanitizeCssScopeId(value = '') {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'card'
}

function scopeAnkiCss(css = '', scopeSelector = '.anki-card-content') {
  const cleanCss = stripSelectionBlockingStylesFromCss(
    String(css)
      .replace(/<\/?style[^>]*>/gi, '')
      .replace(/@import[^;]+;/gi, ''),
  ).trim()

  if (!cleanCss) return ''

  return cleanCss.replace(/(^|})\s*([^@{}][^{}]*)\{/g, (match, boundary, selectorText) => {
    const scopedSelectors = selectorText
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => {
        if (/^(?:from|to|\d+(?:\.\d+)?%)$/i.test(selector)) return selector
        if (/^(?:html|body|\.card|#qa|#content)$/i.test(selector)) return scopeSelector
        if (selector.startsWith(scopeSelector)) return selector
        return `${scopeSelector} ${selector}`
      })
      .join(', ')

    return scopedSelectors ? `${boundary} ${scopedSelectors} {` : match
  })
}

function sanitizeCardHtml(html) {
  const normalizedHtml = String(html ?? '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?(?:template|html|body)[^>]*>/gi, '')
  const safeHtml = DOMPurify.sanitize(normalizedHtml, {
    ADD_TAGS: ['audio', 'video', 'source'],
    ADD_ATTR: ['alt', 'class', 'colspan', 'controls', 'decoding', 'height', 'href', 'loading', 'rel', 'rowspan', 'src', 'style', 'target', 'title', 'width'],
  })
  return makeHtmlTextSelectable(safeHtml)
    .replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy"')
    .replace(/<img\b(?![^>]*\bdecoding=)/gi, '<img decoding="async"')
}

function isScriptCallText(value = '') {
  return /^(?:decrypt|render|show|load|init)[a-zA-Z0-9_$]*\(\)$/i.test(String(value ?? '').replace(/\s+/g, ' ').trim())
}


function escapeHtmlText(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function makeTemplateFieldHtml(value = '') {
  const text = String(value ?? '')
  if (!text) return ''
  if (looksLikeHtml(text)) {
    // Mixed rich text often comes from the in-app editor as plain text + small HTML tags.
    // Keep real HTML, but preserve line breaks when the content is not already block-formatted.
    const hasBlockHtml = /<(?:p|div|section|article|ul|ol|li|table|blockquote|h[1-6]|br)\b/i.test(text)
    return hasBlockHtml ? text : text.replace(/\n/g, '<br>')
  }
  return escapeHtmlText(text).replace(/\n/g, '<br>')
}

function applyCardTemplateCode(code = '', fields = {}) {
  const fieldHtml = {
    Front: makeTemplateFieldHtml(fields.front),
    Back: makeTemplateFieldHtml(fields.back),
  }
  return String(code || '')
    .replace(/{{\s*FrontSide\s*}}/gi, fieldHtml.Front)
    .replace(/{{\s*(?:Front|front|问题|题目|正面)\s*}}/gi, fieldHtml.Front)
    .replace(/{{\s*(?:Back|back|答案|解析|背面|反面)\s*}}/gi, fieldHtml.Back)
}

function buildCardValueFromTemplate(form, template) {
  const selectedTemplate = template ?? SYSTEM_CARD_TEMPLATES[0]
  const isHtmlTemplate = selectedTemplate.mode === 'html'
  const front = String(form.front ?? '').trim()
  const back = String(form.back ?? '').trim()
  const frontHtml = isHtmlTemplate ? applyCardTemplateCode(selectedTemplate.frontCode || '{{Front}}', { front, back }) : ''
  const backHtml = isHtmlTemplate ? applyCardTemplateCode(selectedTemplate.backCode || '{{Back}}', { front, back }) : ''
  const frontText = isHtmlTemplate ? htmlToPlainText(frontHtml) || htmlToPlainText(front) || 'HTML 正面' : front
  const backText = isHtmlTemplate ? htmlToPlainText(backHtml) || htmlToPlainText(back) || back : back

  const isBuiltInSystemTemplate = SYSTEM_CARD_TEMPLATES.some((item) => item.id === selectedTemplate.id)

  return {
    front: frontText,
    back: backText,
    rawFront: front,
    rawBack: back,
    template: selectedTemplate.id,
    ...(frontHtml ? { frontHtml } : {}),
    ...(backHtml ? { backHtml } : {}),
    ...(isHtmlTemplate && selectedTemplate.css && !isBuiltInSystemTemplate ? { cardCss: selectedTemplate.css } : {}),
    ...(isHtmlTemplate && selectedTemplate.js && !isBuiltInSystemTemplate ? { cardJs: selectedTemplate.js } : {}),
  }
}

export { getCardSideHtml, getCardSideText, looksLikeHtml, htmlToPlainText, escapeHtmlText, makeTemplateFieldHtml, applyCardTemplateCode, buildCardValueFromTemplate, sanitizeCssScopeId, scopeAnkiCss, sanitizeCardHtml, isScriptCallText }