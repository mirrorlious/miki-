import { memo, useEffect, useMemo, useRef, useState } from 'react'

function escapeTitle(value = 'Anki Card') {
  return String(value ?? 'Anki Card').replace(/[<>]/g, '') || 'Anki Card'
}


function decodeHtmlEntitiesIfEncodedHtml(value = '') {
  const raw = String(value ?? '')
  if (!/[&]lt;|[&]gt;/i.test(raw)) return raw
  if (!/[&]lt;\/?(?:div|p|span|table|style|script|br|section|article|ul|ol|li|img|h[1-6]|body|html)\b/i.test(raw)) return raw

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

function stripDocumentShell(html = '') {
  return String(html ?? '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[^>]*>([\s\S]*?)<\/head>/gi, '')
    .replace(/<\/?(?:html|body)\b[^>]*>/gi, '')
}

function stripStrayStyleClosers(value = '') {
  let text = String(value ?? '')
  // 部分 Anki/国内版 Anki 模板会把 model.css 做成「style + script」混合片段，
  // 结尾还可能多出一个孤立 </style>。孤立闭合标签会让 iframe DOM 解析错位。
  text = text.replace(/^\s*<\/style>\s*/i, '')
  text = text.replace(/<\/style>\s*$/i, '')
  return text
}

function escapeScriptClose(value = '') {
  return String(value ?? '').replace(/<\/script/gi, '<\\/script')
}

function looksLikeBodyHtml(value = '') {
  return /<(?:div|p|span|table|img|section|article|main|h[1-6]|ul|ol|li|br|hr|button|input|label|svg|math|canvas|audio|video)\b/i.test(String(value ?? ''))
}

function looksLikeCssText(value = '') {
  const text = String(value ?? '').trim()
  if (!text) return false
  if (looksLikeBodyHtml(text)) return false
  const withoutTags = text.replace(/<\/?(?:style|script)\b[^>]*>/gi, '').trim()
  return /\/\*[\s\S]*?\*\//.test(withoutTags)
    || /(?:^|\n)\s*(?:\.|#|body\b|html\b|\.card\b|@media\b|@font-face\b|[a-z-]+\s*[,>{.#:])/i.test(withoutTags)
    || /[.#]?[a-z0-9_-]+(?:\s+[.#]?[a-z0-9_-]+|[:.#][a-z0-9_-]+)?\s*\{[\s\S]*?:[\s\S]*?\}/i.test(withoutTags)
}

function isBlankHtml(value = '') {
  const text = String(value ?? '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length === 0
}

function htmlToPlainPreviewText(value = '') {
  const raw = String(value ?? '')
  if (!raw) return ''
  if (typeof document !== 'undefined') {
    const element = document.createElement('div')
    element.innerHTML = raw
    return String(element.textContent || element.innerText || '').replace(/\s+/g, ' ').trim()
  }
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function looksLikeStyleOrScriptFallback(value = '') {
  const raw = String(value ?? '').trim()
  if (!raw) return false
  if (/^<\/?(?:style|script)\b/i.test(raw)) return true
  const stripped = stripStrayStyleClosers(
    raw
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''),
  ).trim()
  if (!stripped) return true
  const text = htmlToPlainPreviewText(stripped || raw)
  const probe = (text || stripped || raw).trim()
  if (!probe) return true
  if (/^(?:\/\*|@(?:media|font-face|keyframes)|\.|#|body\b|html\b|\.card\b)/i.test(probe)) return true
  if (/<(?:div|p|span|table|img|section|article|main|h[1-6]|ul|ol|li|br|hr|button|input|label|svg|math|canvas|audio|video)\b/i.test(stripped)) return false
  return /(?:\/\*[\s\S]*?\*\/|[.#]?[a-z0-9_-]+(?:\s+[.#]?[a-z0-9_-]+|[:.#][a-z0-9_-]+)?\s*\{[\s\S]*?:[\s\S]*?\})/i.test(probe)
}

function splitHtmlPayload(input = '') {
  const cssBlocks = []
  const scriptBlocks = []
  const headFragments = []
  let body = stripStrayStyleClosers(stripDocumentShell(decodeHtmlEntitiesIfEncodedHtml(input)))

  body = body.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    if (String(css ?? '').trim()) cssBlocks.push(String(css ?? ''))
    return ''
  })

  body = body.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_, attrs = '', code = '') => {
    const attrText = String(attrs ?? '').trim()
    const codeText = String(code ?? '').trim()
    if (attrText || codeText) scriptBlocks.push({ attrs: attrText, code: codeText })
    return ''
  })

  // 抽离正文前泄漏出来的裸 CSS。常见于把 model.css 直接拼到 frontHtml 前面。
  const firstBodyTagIndex = body.search(/<(?:div|p|span|table|img|section|article|main|h[1-6]|ul|ol|li|br|hr|button|input|label|svg|math|canvas|audio|video)\b/i)
  if (firstBodyTagIndex > 0) {
    const prefix = stripStrayStyleClosers(body.slice(0, firstBodyTagIndex).trim())
    if (looksLikeCssText(prefix)) {
      cssBlocks.push(prefix)
      body = body.slice(firstBodyTagIndex)
    }
  } else if (firstBodyTagIndex < 0 && looksLikeCssText(body)) {
    cssBlocks.push(stripStrayStyleClosers(body))
    body = ''
  }

  return {
    html: stripStrayStyleClosers(body).trim(),
    css: cssBlocks.filter(Boolean).join('\n').trim(),
    scripts: scriptBlocks,
    headHtml: headFragments.filter(Boolean).join('\n').trim(),
  }
}

function splitModelPayload(input = '') {
  const cssBlocks = []
  const scriptBlocks = []
  const headFragments = []
  let source = stripStrayStyleClosers(decodeHtmlEntitiesIfEncodedHtml(String(input ?? '').trim()))
  if (!source) return { css: '', scripts: [], headHtml: '' }

  // model.css 可能是纯 CSS，也可能是 <style>...</style><script>...</script> 的混合 HTML 片段。
  source = source.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    if (String(css ?? '').trim()) cssBlocks.push(String(css ?? ''))
    return ''
  })

  source = source.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_, attrs = '', code = '') => {
    const attrText = String(attrs ?? '').trim()
    const codeText = String(code ?? '').trim()
    if (attrText || codeText) scriptBlocks.push({ attrs: attrText, code: codeText })
    return ''
  })

  source = stripStrayStyleClosers(source).trim()
  if (source) {
    if (looksLikeCssText(source) || !/<[a-z][\s\S]*>/i.test(source)) cssBlocks.push(source)
    else headFragments.push(source)
  }

  return {
    css: cssBlocks.filter(Boolean).join('\n').trim(),
    scripts: scriptBlocks,
    headHtml: headFragments.filter(Boolean).join('\n').trim(),
  }
}

function renderScriptTag(script) {
  if (!script) return ''
  if (typeof script === 'string') return `<script>\ntry {\n${escapeScriptClose(script)}\n} catch (error) { console.warn('Anki card script failed', error); }\n<\/script>`
  const attrs = script.attrs ? ` ${script.attrs}` : ''
  const code = script.code ? escapeScriptClose(script.code) : ''
  // 如果是 src 脚本，保留属性；如果是内联脚本，直接放入 iframe 内执行。
  return `<script${attrs}>${code}<\/script>`
}

function buildSrcDoc({ html = '', css = '', js = '', title = 'Anki Card', fallbackHtml = '' }) {
  const safeTitle = escapeTitle(title)
  const main = splitHtmlPayload(html)
  const fallbackPayload = splitHtmlPayload(fallbackHtml)
  const model = splitModelPayload(css)

  const body = main.html
  const fallbackBody = looksLikeCssText(fallbackPayload.html) || looksLikeStyleOrScriptFallback(fallbackPayload.html) ? '' : fallbackPayload.html
  const style = [model.css, main.css, fallbackPayload.css].filter(Boolean).join('\n')
  const scripts = [
    ...model.scripts,
    ...main.scripts,
    ...fallbackPayload.scripts,
    js ? String(js ?? '') : '',
  ].filter(Boolean)

  const shouldUseFallback = !body || isBlankHtml(body)
  const shellBody = shouldUseFallback && fallbackBody ? fallbackBody : body

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
html, body { margin: 0; padding: 0; background: transparent; }
body.card { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #111827; line-height: 1.72; overflow-wrap: anywhere; }
* { box-sizing: border-box; }
img, video, audio, canvas, svg { max-width: 100%; height: auto; }
button, input, label, select { font: inherit; }
.__miki_iframe_shell { padding: 12px; min-height: 48px; }
${style}
</style>
${model.headHtml || ''}
</head>
<body class="card">
<div class="__miki_iframe_shell">${shellBody || ''}</div>
${fallbackBody && !shouldUseFallback ? `<div class="__miki_iframe_fallback" style="display:none">${fallbackBody}</div>` : ''}
<script>
(function(){
  function ensureFallback(){
    try {
      var shell = document.querySelector('.__miki_iframe_shell');
      var fallback = document.querySelector('.__miki_iframe_fallback');
      if (!shell || !fallback || !fallback.innerHTML.trim()) return;
      var text = (shell.textContent || '').replace(/\s+/g, ' ').trim();
      var hasVisibleMedia = !!shell.querySelector('img, video, audio, canvas, svg, table, input, button, label');
      var shellBox = shell.getBoundingClientRect ? shell.getBoundingClientRect() : { height: 0 };
      if ((!text && !hasVisibleMedia) || shellBox.height < 12) shell.innerHTML = fallback.innerHTML;
    } catch (e) {}
  }
  function sendHeight(){
    try {
      ensureFallback();
      var height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 80);
      parent.postMessage({ type: 'miki-anki-frame-height', height: height }, '*');
    } catch (e) {}
  }
  window.addEventListener('load', sendHeight);
  window.addEventListener('resize', sendHeight);
  setTimeout(sendHeight, 0);
  setTimeout(sendHeight, 80);
  setTimeout(sendHeight, 240);
  setTimeout(sendHeight, 800);
})();
<\/script>
${scripts.map(renderScriptTag).join('\n')}
</body>
</html>`
}

const AnkiSandboxFrame = memo(function AnkiSandboxFrame({ html = '', css = '', js = '', title = 'Anki Card', fallbackHtml = '', className = '' }) {
  const iframeRef = useRef(null)
  const [height, setHeight] = useState(260)
  const srcDoc = useMemo(() => buildSrcDoc({ html, css, js, title, fallbackHtml }), [html, css, js, title, fallbackHtml])

  useEffect(() => {
    function onMessage(event) {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (event.data?.type !== 'miki-anki-frame-height') return
      const nextHeight = Math.max(80, Math.min(2400, Number(event.data.height) || 260))
      setHeight(nextHeight)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <iframe
      ref={iframeRef}
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-forms allow-popups allow-modals"
      className={`miki-anki-sandbox-frame w-full rounded-xl border-0 bg-transparent ${className}`}
      style={{ height, minHeight: 80, display: 'block' }}
    />
  )
})

export default AnkiSandboxFrame
