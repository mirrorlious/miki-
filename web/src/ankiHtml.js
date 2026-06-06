const ANSWER_SECTION_PATTERNS = [
  /(?:[【［[]\s*)?(?:参考答案|参考解析|答案解析|解析答案|参考解答)(?:\s*[】］\]])?\s*[:：]?/i,
  /(?:^|[\n\r])\s*(?:答案|解析)\s*[:：]/i,
  /[【［[]\s*(?:答案|解析)\s*[】］\]]\s*[:：]?/i,
]

function findAnswerSectionIndex(value = '') {
  const text = String(value ?? '')
  for (const pattern of ANSWER_SECTION_PATTERNS) {
    const match = text.match(pattern)
    if (match?.index != null) return match.index
  }
  return -1
}

function removeFollowingNodes(node, root) {
  let current = node
  while (current && current !== root) {
    let sibling = current.nextSibling
    while (sibling) {
      const next = sibling.nextSibling
      sibling.remove()
      sibling = next
    }
    current = current.parentNode
  }
}

function removeEmptyTrailingNodes(root) {
  let changed = true
  while (changed) {
    changed = false
    const nodes = Array.from(root.querySelectorAll('*')).reverse()
    for (const node of nodes) {
      if (node.children.length === 0 && !String(node.textContent ?? '').trim()) {
        node.remove()
        changed = true
      }
    }
  }
}

export function stripAnswerSectionFromText(value = '') {
  const text = String(value ?? '')
  const index = findAnswerSectionIndex(text)
  return index < 0 ? text : text.slice(0, index).trim()
}

export function stripAnswerSectionFromHtml(html = '') {
  const rawHtml = String(html ?? '')
  if (!rawHtml.trim()) return ''

  if (typeof document === 'undefined') {
    const index = findAnswerSectionIndex(rawHtml)
    return index < 0 ? rawHtml : rawHtml.slice(0, index).trim()
  }

  const root = document.createElement('div')
  root.innerHTML = rawHtml
  const walker = document.createTreeWalker(root, 4)
  let textNode = walker.nextNode()
  while (textNode) {
    const index = findAnswerSectionIndex(textNode.nodeValue)
    if (index >= 0) {
      textNode.nodeValue = textNode.nodeValue.slice(0, index).trimEnd()
      removeFollowingNodes(textNode, root)
      removeEmptyTrailingNodes(root)
      return root.innerHTML.trim()
    }
    textNode = walker.nextNode()
  }

  return rawHtml
}

export function stripSelectionBlockingStylesFromCss(css = '') {
  return String(css ?? '')
    .replace(/(?:-webkit-|-moz-|-ms-)?user-select\s*:\s*[^;{}]+;?/gi, '')
    .replace(/-webkit-touch-callout\s*:\s*[^;{}]+;?/gi, '')
}

function makeStyleSelectable(style = '') {
  return stripSelectionBlockingStylesFromCss(style)
    .replace(/;{2,}/g, ';')
    .replace(/^\s*;\s*|\s*;\s*$/g, '')
    .trim()
}

export function makeHtmlTextSelectable(html = '') {
  const rawHtml = String(html ?? '')
  if (!rawHtml.trim()) return ''

  if (typeof document === 'undefined') {
    return rawHtml.replace(/\sstyle=(["'])(.*?)\1/gi, (match, quote, style) => {
      const cleanStyle = makeStyleSelectable(style)
      return cleanStyle ? ` style=${quote}${cleanStyle}${quote}` : ''
    })
  }

  const root = document.createElement('div')
  root.innerHTML = rawHtml
  root.querySelectorAll('[style]').forEach((node) => {
    const cleanStyle = makeStyleSelectable(node.getAttribute('style'))
    if (cleanStyle) {
      node.setAttribute('style', cleanStyle)
    } else {
      node.removeAttribute('style')
    }
  })
  return root.innerHTML
}
