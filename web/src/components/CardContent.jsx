import { memo } from 'react'
import { stripAnswerSectionFromHtml, stripAnswerSectionFromText } from '../ankiHtml.js'
import { getCardSideHtml, getCardSideText, looksLikeHtml, sanitizeCssScopeId, scopeAnkiCss, sanitizeCardHtml, isScriptCallText } from '../lib/cardHtml.js'

const CardContent = memo(function CardContent({ card, side, className = '', fallbackClassName = '', placeholder = '', htmlOverride = '', textOverride = '' }) {
  const explicitHtml = htmlOverride || getCardSideHtml(card, side)
  const rawText = textOverride || getCardSideText(card, side) || placeholder
  const text = side === 'front' ? (stripAnswerSectionFromText(rawText) || rawText) : rawText
  const html = explicitHtml || (card?.template === 'html' && looksLikeHtml(text) ? text : '')
  const fallbackText = isScriptCallText(text)
    ? '这张 Anki 卡依赖脚本或加密模板，无法直接显示。请删除后用新版导入重新尝试。'
    : text

  if (html) {
    const safeHtml = side === 'front'
      ? stripAnswerSectionFromHtml(sanitizeCardHtml(html))
      : sanitizeCardHtml(html)
    const hasRenderableHtml = Boolean(safeHtml.trim())
    const scopeId = sanitizeCssScopeId(`${card?.id ?? 'preview'}-${side}`)
    const scopedCss = scopeAnkiCss(card?.cardCss, `[data-anki-card="${scopeId}"]`)

    if (hasRenderableHtml) {
      return (
        <>
          {scopedCss && <style>{scopedCss}</style>}
          <div
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