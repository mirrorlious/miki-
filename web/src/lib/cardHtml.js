import DOMPurify from 'dompurify'
import { stripAnswerSectionFromHtml, stripAnswerSectionFromText, makeHtmlTextSelectable, stripSelectionBlockingStylesFromCss } from '../ankiHtml.js'

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


export { getCardSideHtml, getCardSideText, looksLikeHtml, sanitizeCssScopeId, scopeAnkiCss, sanitizeCardHtml, isScriptCallText }