import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { stripAnswerSectionFromHtml, stripAnswerSectionFromText } from '../ankiHtml.js'
import { getCardSideHtml, getCardSideText, looksLikeHtml, sanitizeCssScopeId, scopeAnkiCss, sanitizeCardHtml, isScriptCallText, buildCardValueFromTemplate } from '../lib/cardHtml.js'
import { SYSTEM_CARD_TEMPLATES } from '../lib/cardTemplates.js'
import { renderAnkiCardSides } from '../lib/ankiTemplateEngine.js'
import AnkiSandboxFrame from './AnkiSandboxFrame.jsx'
import { getUserAnkiPackCardById } from '../lib/userAnkiPackStore.js'

function stripScriptWrapper(code = '') {
  return String(code ?? '')
    .replace(/^\s*<script[^>]*>\s*/i, '')
    .replace(/\s*<\/script>\s*$/i, '')
    .trim()
}


function looksLikeCssText(value = '') {
  const text = String(value ?? '').trim()
  if (!text) return false
  if (/<(?:div|p|span|table|img|section|article|main|h[1-6]|ul|ol|li|br|hr|button|input|label|style)\b/i.test(text)) return false
  return /\/\*[\s\S]*?\*\//.test(text)
    || /(?:^|\n)\s*(?:\.|#|body\b|html\b|\.card\b|@media\b|@font-face\b)/i.test(text)
    || /[.#]?[a-z0-9_-]+(?:\s+[.#]?[a-z0-9_-]+|[:.#][a-z0-9_-]+)?\s*\{[\s\S]*?:[\s\S]*?\}/i.test(text)
}

function splitStylePayloadFromHtml(html = '') {
  const cssBlocks = []
  let body = String(html ?? '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[^>]*>([\s\S]*?)<\/head>/gi, (_, head) => {
      String(head || '').replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_styleTag, css) => {
        if (String(css || '').trim()) cssBlocks.push(String(css || ''))
        return ''
      })
      return ''
    })
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
      if (String(css || '').trim()) cssBlocks.push(String(css || ''))
      return ''
    })
    .replace(/<\/?(?:html|body)\b[^>]*>/gi, '')

  const firstBodyTagIndex = body.search(/<(?:div|p|span|table|img|section|article|main|h[1-6]|ul|ol|li|br|hr|button|input|label|svg|math)\b/i)
  if (firstBodyTagIndex > 0) {
    const prefix = body.slice(0, firstBodyTagIndex).trim()
    if (looksLikeCssText(prefix)) {
      cssBlocks.push(prefix)
      body = body.slice(firstBodyTagIndex)
    }
  } else if (firstBodyTagIndex < 0 && looksLikeCssText(body)) {
    cssBlocks.push(body)
    body = ''
  }

  return { html: body.trim(), css: cssBlocks.join('\n').trim() }
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

function pickNonEmptyField(source = {}, names = []) {
  for (const name of names) {
    const value = source?.[name]
    if (value !== undefined && value !== null && String(value).trim()) return value
  }
  return ''
}

function resolveRenderableCard(card, systemTemplate, htmlOverride) {
  if (!card || htmlOverride || systemTemplate?.mode !== 'html') return card

  const ankiFields = card?.anki?.fields && typeof card.anki.fields === 'object' ? card.anki.fields : {}
  const fieldFront = pickNonEmptyField(ankiFields, ['Front', 'front', '正面', '题目', '问题', 'Q', 'Question', 'question', '内容', '正文', 'content'])
  const fieldBack = pickNonEmptyField(ankiFields, ['Back', 'back', '反面', '背面', '答案', '解析', 'A', 'Answer', 'answer'])
  const rawFront = fieldFront || card.rawFront || card.sourceFront || card.front || ''
  const rawBack = fieldBack || card.rawBack || card.sourceBack || card.back || ''

  // When old cards already have frozen frontHtml/backHtml, rebuild from raw fields with the latest system template.
  // This is what makes template edits affect existing cards without resetting review data.
  if (String(rawFront || rawBack).trim()) {
    return {
      ...card,
      ...buildCardValueFromTemplate({ ...ankiFields, front: rawFront, back: rawBack }, systemTemplate),
      favorite: card.favorite,
      flagged: card.flagged,
      flag: card.flag,
      tags: card.tags,
      comment: card.comment,
      annotations: card.annotations,
      review: card.review,
      reviews: card.reviews,
      reps: card.reps,
      ease: card.ease,
      due: card.due,
      interval: card.interval,
      suspended: card.suspended,
    }
  }

  return card
}


function escapeFallbackHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br />')
}

function htmlToReadableText(html = '') {
  const raw = String(html ?? '')
  if (!raw) return ''
  if (typeof document !== 'undefined') {
    const element = document.createElement('div')
    element.innerHTML = raw
    return String(element.textContent || element.innerText || '').replace(/\s+/g, ' ').trim()
  }
  return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function looksLikeBlankAnkiShell(html = '') {
  const raw = String(html ?? '').trim()
  if (!raw) return true
  const text = htmlToReadableText(raw)
  if (!text && !/<(?:img|video|audio|canvas|svg|table|input|button|label)\b/i.test(raw)) return true
  if (/^(?:decrypt|render|show|load|init)[a-zA-Z0-9_$]*\(\)\s*;?$/i.test(text)) return true
  if (text.length <= 8 && /<script\b|\bon[a-z]+\s*=|javascript:/i.test(raw)) return true
  return false
}

function buildReadableFallbackHtml(card, side, text = '') {
  const explicitText = String(text || (side === 'front' ? card?.front : card?.back) || '').trim()
  const storedHtml = side === 'front' ? card?.frontHtml : card?.backHtml
  if (storedHtml && !looksLikeBlankAnkiShell(storedHtml)) return storedHtml
  if (!explicitText) return ''
  return `<div class="miki-anki-readable-fallback">${escapeFallbackHtml(explicitText)}</div>`
}

function isNativeAnkiCard(card) {
  return card?.source?.type === 'apkg' && (card?.source?.nativeTemplate || card?.source?.userAnkiPack)
}

function getNativeAnkiRawHtml(card, side) {
  const raw = side === 'front' ? (card?.rawFront || '') : (card?.rawBack || '')
  const html = side === 'front' ? (card?.frontHtml || '') : (card?.backHtml || '')
  if (card?.source?.staticExamRenderer) return html || raw
  if (html && looksLikeBlankAnkiShell(raw)) return html
  if (html && /decrypt(?:Front|Back)?\s*\(|decrypt(?:Front|Back)?\b|AnkiStudio/i.test(String(raw))) return html
  return raw || html
}


function extractInlineScripts(...htmlParts) {
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

function stripInlineScripts(html = '') {
  return String(html ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
}

function shouldRunNativeCardJs(card) {
  return Boolean(card?.source?.allowAnkiJs && (card?.cardJs || card?.nativeTemplateRecord))
}

function renderLazyNativeAnkiCardSide(card, side) {
  const templateRecord = card?.nativeTemplateRecord
  const fields = card?.anki?.fields && typeof card.anki.fields === 'object' ? card.anki.fields : null
  if (!templateRecord || !fields) return null

  try {
    const templateName = card?.anki?.templateName || templateRecord.apkgTemplateName || templateRecord.name || 'Anki 模板'
    const rendered = renderAnkiCardSides({
      model: { css: templateRecord.css || card?.cardCss || '' },
      template: {
        qfmt: templateRecord.frontCode || '{{Front}}',
        afmt: templateRecord.backCode || '{{Back}}',
        name: templateName,
      },
      fields,
      tags: card?.tags || card?.anki?.tags || [],
      deckName: card?.anki?.deckName || card?.source?.deckName || '',
      templateName,
      cardOrd: Number(card?.anki?.cardOrd) || Number(templateRecord.apkgCardOrd) || 0,
    })
    const rawHtml = side === 'front' ? rendered.rawFrontHtml : rendered.rawBackHtml
    const cleanHtml = side === 'front' ? rendered.frontHtml : rendered.backHtml
    const text = side === 'front' ? rendered.frontText : rendered.backText
    return {
      html: stripInlineScripts(rawHtml || cleanHtml || ''),
      css: rendered.css || templateRecord.css || card?.cardCss || '',
      js: extractInlineScripts(rendered.rawFrontHtml, rendered.rawBackHtml),
      text,
    }
  } catch (error) {
    console.warn('Anki 模板懒渲染失败。', error)
    return null
  }
}

const CardContent = memo(function CardContent({ card, side, className = '', fallbackClassName = '', placeholder = '', htmlOverride = '', textOverride = '' }) {
  const [hydratedCard, setHydratedCard] = useState(null)
  const needsHydration = Boolean(card?.source?.lazyUserAnkiCard && card?.source?.userAnkiPack)

  useEffect(() => {
    let cancelled = false
    setHydratedCard(null)
    if (!needsHydration || !card?.id) return undefined
    ;(async () => {
      try {
        const fullCard = await getUserAnkiPackCardById(card.id, card.source?.userAnkiPack, card.source?.userAnkiChunk ?? card.userAnkiChunk)
        if (!cancelled && fullCard) setHydratedCard(fullCard)
      } catch (error) {
        console.warn('用户 Anki 卡片正文懒加载失败。', error)
      }
    })()
    return () => { cancelled = true }
  }, [card?.id, card?.source?.userAnkiPack, needsHydration])

  const baseCard = useMemo(() => {
    if (!hydratedCard) return card
    return {
      ...hydratedCard,
      review: card?.review ?? hydratedCard.review,
      favorite: card?.favorite ?? hydratedCard.favorite,
      flagged: card?.flagged ?? hydratedCard.flagged,
      flagColor: card?.flagColor ?? hydratedCard.flagColor,
      comment: card?.comment ?? hydratedCard.comment,
      annotations: card?.annotations ?? hydratedCard.annotations,
      links: card?.links ?? hydratedCard.links,
      source: { ...(hydratedCard.source || {}), ...(card?.source || {}), lazyUserAnkiCard: false },
    }
  }, [card, hydratedCard])

  const systemTemplate = SYSTEM_CARD_TEMPLATES.find((template) => template.id === baseCard?.template)
  const renderCard = useMemo(
    () => resolveRenderableCard(baseCard, systemTemplate, htmlOverride),
    [baseCard, systemTemplate, htmlOverride],
  )

  const explicitHtml = htmlOverride || getCardSideHtml(renderCard, side)
  const rawText = textOverride || getCardSideText(renderCard, side) || placeholder
  const text = side === 'front' ? (stripAnswerSectionFromText(rawText) || rawText) : rawText
  const html = explicitHtml || (renderCard?.template === 'html' && looksLikeHtml(text) ? text : '')
  const fallbackText = isScriptCallText(text)
    ? '这张 Anki 卡依赖脚本或加密模板，无法直接显示。请删除后用新版导入重新尝试。'
    : text
  const resolvedCardCss = systemTemplate?.mode === 'html'
    ? (systemTemplate.css ?? '')
    : (renderCard?.cardCss ?? '')
  const resolvedCardJs = systemTemplate?.mode === 'html'
    ? (systemTemplate.js ?? '')
    : (renderCard?.cardJs ?? '')
  const contentRef = useRef(null)
  const scopeKey = `${renderCard?.id ?? 'preview'}-${side}-${renderCard?.template ?? ''}`
  const isSystemHtmlTemplate = systemTemplate?.mode === 'html'
  useScopedCardScript(contentRef, !isNativeAnkiCard(renderCard) && html ? resolvedCardJs : '', `${scopeKey}-${html}`)

  if (isNativeAnkiCard(renderCard)) {
    const lazyNativeRender = renderLazyNativeAnkiCardSide(renderCard, side)
    const nativeHtml = lazyNativeRender?.html || getNativeAnkiRawHtml(renderCard, side) || html
    const nativeCss = lazyNativeRender?.css || resolvedCardCss
    const nativeJs = lazyNativeRender?.js || resolvedCardJs
    const fallbackHtml = buildReadableFallbackHtml(renderCard, side, lazyNativeRender?.text || fallbackText)
    const frameHtml = looksLikeBlankAnkiShell(nativeHtml) ? (fallbackHtml || nativeHtml) : nativeHtml
    if (frameHtml || fallbackHtml) {
      return (
        <AnkiSandboxFrame
          html={frameHtml}
          css={nativeCss}
          js={shouldRunNativeCardJs(renderCard) ? nativeJs : ''}
          fallbackHtml={fallbackHtml}
          title={`${renderCard?.id ?? 'Anki'}-${side}`}
          className={className}
        />
      )
    }
    if (needsHydration && !hydratedCard) {
      return <p className={fallbackClassName || className}>正在读取这张 Anki 卡片正文…</p>
    }
  }

  if (html) {
    // 系统 HTML 模板本身负责正/背面显示。
    // 不要再对系统模板的正面 HTML 做 stripAnswerSectionFromHtml，
    // 否则隐藏 raw-back 中的“答案”会把后面的 quiz-card 锚点一起截掉，导致正面 JS 直接 Early Return。
    const stylePayload = splitStylePayloadFromHtml(html)
    const sanitizedHtml = sanitizeCardHtml(stylePayload.html)
    const safeHtml = side === 'front' && !isSystemHtmlTemplate
      ? stripAnswerSectionFromHtml(sanitizedHtml)
      : sanitizedHtml
    const hasRenderableHtml = Boolean(safeHtml.trim())
    const scopeId = sanitizeCssScopeId(`${renderCard?.id ?? 'preview'}-${side}`)
    const scopedCss = scopeAnkiCss([resolvedCardCss, stylePayload.css].filter(Boolean).join('\n'), `[data-anki-card="${scopeId}"]`)

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

    if (stylePayload.css && htmlOverride) {
      return <p className={fallbackClassName || className}>这段样式已隔离应用，未检测到可显示正文。</p>
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
  if (prevCard?.rawFront !== nextCard?.rawFront) return false
  if (prevCard?.rawBack !== nextCard?.rawBack) return false
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
