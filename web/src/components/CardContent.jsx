import { memo, useEffect, useRef } from 'react'
import { stripAnswerSectionFromHtml, stripAnswerSectionFromText } from '../ankiHtml.js'
import { getCardSideHtml, getCardSideText, looksLikeHtml, sanitizeCssScopeId, scopeAnkiCss, sanitizeCardHtml, isScriptCallText } from '../lib/cardHtml.js'
import { SYSTEM_CARD_TEMPLATES } from '../lib/cardTemplates.js'


function stripScriptWrapper(code = '') {
  return String(code ?? '')
    .replace(/^\s*<script[^>]*>\s*/i, '')
    .replace(/\s*<\/script>\s*$/i, '')
    .trim()
}

function getScopedElementById(root, id) {
  if (!root || !id) return null
  if (typeof CSS !== 'undefined' && CSS.escape) return root.querySelector(`#${CSS.escape(id)}`)
  return Array.from(root.querySelectorAll('[id]')).find((element) => element.id === id) ?? null
}

function makeScopedDocument(root) {
  return {
    readyState: 'complete',
    getElementById: (id) => getScopedElementById(root, id),
    querySelector: (selector) => root?.querySelector(selector) ?? null,
    querySelectorAll: (selector) => root?.querySelectorAll(selector) ?? [],
    createElement: (...args) => document.createElement(...args),
    createTextNode: (...args) => document.createTextNode(...args),
    addEventListener: (type, listener) => {
      if (type === 'DOMContentLoaded') window.setTimeout(listener, 0)
      else document.addEventListener(type, listener)
    },
    removeEventListener: (...args) => document.removeEventListener(...args),
  }
}

function useScopedCardScript(rootRef, scriptCode, scopeKey) {
  useEffect(() => {
    const root = rootRef.current
    const code = stripScriptWrapper(scriptCode)
    if (!root || !code) return undefined

    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      try {
        const scopedDocument = makeScopedDocument(root)
        const runner = new Function('document', 'window', 'localStorage', 'sessionStorage', code)
        runner(scopedDocument, window, window.localStorage, window.sessionStorage)
      } catch (error) {
        console.warn('Card template script failed.', error)
      }
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [rootRef, scriptCode, scopeKey])
}

const CardContent = memo(function CardContent({ card, side, className = '', fallbackClassName = '', placeholder = '', htmlOverride = '', textOverride = '' }) {
  const explicitHtml = htmlOverride || getCardSideHtml(card, side)
  const rawText = textOverride || getCardSideText(card, side) || placeholder
  const text = side === 'front' ? (stripAnswerSectionFromText(rawText) || rawText) : rawText
  const html = explicitHtml || (card?.template === 'html' && looksLikeHtml(text) ? text : '')
  const fallbackText = isScriptCallText(text)
    ? '这张 Anki 卡依赖脚本或加密模板，无法直接显示。请删除后用新版导入重新尝试。'
    : text
  const systemTemplate = SYSTEM_CARD_TEMPLATES.find((template) => template.id === card?.template)
  const resolvedCardCss = card?.cardCss ?? systemTemplate?.css ?? ''
  const resolvedCardJs = card?.cardJs ?? systemTemplate?.js ?? ''
  const contentRef = useRef(null)
  const scopeKey = `${card?.id ?? 'preview'}-${side}-${card?.template ?? ''}`
  useScopedCardScript(contentRef, html ? resolvedCardJs : '', `${scopeKey}-${html}`)

  if (html) {
    const safeHtml = side === 'front'
      ? stripAnswerSectionFromHtml(sanitizeCardHtml(html))
      : sanitizeCardHtml(html)
    const hasRenderableHtml = Boolean(safeHtml.trim())
    const scopeId = sanitizeCssScopeId(`${card?.id ?? 'preview'}-${side}`)
    const scopedCss = scopeAnkiCss(resolvedCardCss, `[data-anki-card="${scopeId}"]`)

    if (hasRenderableHtml) {
      return (
        <>
          {scopedCss && <style>{scopedCss}</style>}
          <div
            ref={contentRef}
            data-anki-card={scopeId}
            className={`anki-card-content ${className}`}
            style={{ contentVisibility: 'auto', containIntrinsicSize: '520px' }}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </>
      )
    }
  }

  return <p className={fallbackClassName || className}>{fallbackText}</p>
  }, areCardContentPropsEqual)

function areCardContentPropsEqual(prevProps, nextProps) {
  if (prevProps.side !== nextProps.side) return false
  if (prevProps.className !== nextProps.className) return false
  if (prevProps.fallbackClassName !== nextProps.fallbackClassName) return false
  if (prevProps.placeholder !== nextProps.placeholder) return false
  if (prevProps.htmlOverride !== nextProps.htmlOverride) return false
  if (prevProps.textOverride !== nextProps.textOverride) return false
  const prevCard = prevProps.card
  const nextCard = nextProps.card
  if (prevCard?.id !== nextCard?.id) return false
  if (prevCard?.template !== nextCard?.template) return false
  if (prevCard?.cardCss !== nextCard?.cardCss) return false
  if (prevCard?.cardJs !== nextCard?.cardJs) return false
  if (prevCard?.frontHtml !== nextCard?.frontHtml) return false
  if (prevCard?.backHtml !== nextCard?.backHtml) return false
  if (prevCard?.front !== nextCard?.front) return false
  if (prevCard?.back !== nextCard?.back) return false
  const prevSections = prevCard?.htmlSections
  const nextSections = nextCard?.htmlSections
  if (Array.isArray(prevSections) !== Array.isArray(nextSections)) return false
  if (Array.isArray(prevSections) && Array.isArray(nextSections)) {
    if (prevSections.length !== nextSections.length) return false
    for (let i = 0; i < prevSections.length; i++) {
      if (prevSections[i]?.id !== nextSections[i]?.id) return false
      if (prevSections[i]?.html !== nextSections[i]?.html) return false
      if (prevSections[i]?.text !== nextSections[i]?.text) return false
    }
  }
  return true
}



export default CardContent