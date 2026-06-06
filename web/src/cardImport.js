function normalizeText(rawText) {
  return String(rawText ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function hashString(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(36)
}

function stableKey(value) {
  return hashString(value.trim().toLowerCase().replace(/\s+/g, ' '))
}

export function cleanCardText(value) {
  return String(value ?? '')
    .replace(/^\s*(?:[-*#]\s*)+/, '')
    .replace(/^\s*\d+[.)、]\s*/, '')
    .trim()
}

function parseDelimitedLine(line) {
  const delimiters = ['=>', '->', '\t', '|']
  for (const delimiter of delimiters) {
    const index = line.indexOf(delimiter)
    if (index > 0) {
      return {
        front: cleanCardText(line.slice(0, index)),
        back: cleanCardText(line.slice(index + delimiter.length)),
      }
    }
  }

  const commaIndex = line.indexOf(',')
  if (commaIndex > 0 && !line.includes('，')) {
    return {
      front: cleanCardText(line.slice(0, commaIndex)),
      back: cleanCardText(line.slice(commaIndex + 1)),
    }
  }

  return null
}

export function parseBulkCards(rawText) {
  const text = normalizeText(rawText)
  const lines = text.split('\n').map((line) => line.trim())
  const cards = []
  const looseLines = []
  let pendingQuestion = ''

  for (const line of lines) {
    if (!line) continue

    const qaLine = parseDelimitedLine(line)
    if (qaLine?.front && qaLine?.back) {
      cards.push(qaLine)
      pendingQuestion = ''
      continue
    }

    const questionMatch = line.match(/^(?:Q|q|问题|题目|Front|front)[:：]\s*(.+)$/)
    if (questionMatch) {
      pendingQuestion = cleanCardText(questionMatch[1])
      continue
    }

    const answerMatch = line.match(/^(?:A|a|答案|解析|Back|back)[:：]\s*(.+)$/)
    if (answerMatch && pendingQuestion) {
      cards.push({ front: pendingQuestion, back: cleanCardText(answerMatch[1]) })
      pendingQuestion = ''
      continue
    }

    looseLines.push(line)
  }

  const compactLines = looseLines.filter(Boolean).map(cleanCardText)
  for (let index = 0; index < compactLines.length; index += 2) {
    const front = compactLines[index]
    const back = compactLines[index + 1]
    if (front && back) cards.push({ front, back })
  }

  return cards.filter((card) => card.front && card.back)
}

function parseHeadingTitle(rawTitle) {
  const tags = []
  const title = rawTitle
    .replace(/(?:^|\s)#([A-Za-z][\w-]*)/g, (match, tag) => {
      tags.push(tag.toLowerCase())
      return ''
    })
    .replace(/\s+/g, ' ')
    .trim()

  return {
    title: title || rawTitle.trim(),
    tags,
  }
}

function extractSourceId(value) {
  return value.match(/<!--\s*(?:YANG-ID|ID)\s*:\s*([A-Za-z0-9_.:-]+)\s*-->/i)?.[1] ?? null
}

function stripMarkdownComments(value) {
  return value.replace(/<!--[\s\S]*?-->/g, '').trim()
}

function buildHeadingTree(rawText) {
  const root = { level: 0, title: '', tags: [], contentLines: [], children: [] }
  const stack = [root]
  let inFence = false

  for (const line of normalizeText(rawText).split('\n')) {
    if (/^\s*(?:```|~~~)/.test(line)) inFence = !inFence

    const headingMatch = inFence ? null : line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (headingMatch) {
      const { title, tags } = parseHeadingTitle(headingMatch[2])
      const node = {
        level: headingMatch[1].length,
        title,
        tags,
        contentLines: [],
        children: [],
      }

      while (stack.length > 1 && stack[stack.length - 1].level >= node.level) stack.pop()
      stack[stack.length - 1].children.push(node)
      stack.push(node)
      continue
    }

    stack[stack.length - 1].contentLines.push(line)
  }

  return root.children
}

function walkHeadings(nodes, ancestors, visit) {
  for (const node of nodes) {
    const path = [...ancestors, node.title]
    visit(node, path)
    walkHeadings(node.children, path, visit)
  }
}

function measureIndent(value) {
  return value.replace(/\t/g, '    ').length
}

function parseMarkdownList(rawBody) {
  const roots = []
  const stack = []

  for (const line of rawBody.split('\n')) {
    const match = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.+?)\s*$/)
    if (!match) continue

    const text = stripMarkdownComments(match[2]).trim()
    if (!text) continue

    const node = {
      text,
      indent: measureIndent(match[1]),
      children: [],
    }

    while (stack.length > 0 && stack[stack.length - 1].indent >= node.indent) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent) parent.children.push(node)
    else roots.push(node)
    stack.push(node)
  }

  return roots
}

function formatMarkdownList(nodes, depth = 0) {
  return nodes
    .map((node) => {
      const line = `${'  '.repeat(depth)}- ${node.text}`
      if (node.children.length === 0) return line
      return `${line}\n${formatMarkdownList(node.children, depth + 1)}`
    })
    .join('\n')
}

function createListCards({ nodes, headingTitle, baseSourceKey, source, indexPath = [], textPath = [] }) {
  return nodes.flatMap((node, index) => {
    const nextIndexPath = [...indexPath, index + 1]
    const nextTextPath = [...textPath, cleanCardText(node.text)]
    const childCards = createListCards({
      nodes: node.children,
      headingTitle,
      baseSourceKey,
      source,
      indexPath: nextIndexPath,
      textPath: nextTextPath,
    })

    if (node.children.length === 0) return childCards

    return [
      {
        front: `${headingTitle}：${nextTextPath.join(' / ')}`,
        back: formatMarkdownList(node.children),
        template: 'list',
        sourceKey: `${baseSourceKey}:list:${nextIndexPath.join('.')}`,
        source: {
          ...source,
          listPath: nextTextPath,
        },
      },
      ...childCards,
    ]
  })
}

function withUniqueSourceKeys(cards) {
  const seen = new Map()

  return cards.map((card) => {
    if (!card.sourceKey) return card
    const count = (seen.get(card.sourceKey) ?? 0) + 1
    seen.set(card.sourceKey, count)
    if (count === 1) return card
    return {
      ...card,
      sourceKey: `${card.sourceKey}:copy:${count}`,
    }
  })
}

export function parseMarkdownCards(rawText) {
  const headings = buildHeadingTree(rawText)
  const allNodes = []
  walkHeadings(headings, [], (node, path) => allNodes.push({ node, path }))

  const usesDetailedHeadings = allNodes.some(({ node }) => node.level >= 3)
  const cards = []

  for (const { node, path } of allNodes) {
    if (usesDetailedHeadings && node.level < 3) continue

    const rawBody = node.contentLines.join('\n')
    const back = stripMarkdownComments(rawBody)
    if (!node.title || !back) continue

    const sourceId = extractSourceId(rawBody)
    const pathLabel = path.join(' / ')
    const baseSourceKey = sourceId ? `markdown:id:${sourceId}` : `markdown:path:${stableKey(pathLabel)}`
    const source = {
      type: 'markdown',
      sourceId,
      heading: node.title,
      path,
    }
    const shouldSplitList = node.tags.includes('anki-list') || node.tags.includes('list-card') || node.tags.includes('yang-list')

    if (shouldSplitList) {
      const listCards = createListCards({
        nodes: parseMarkdownList(back),
        headingTitle: node.title,
        baseSourceKey,
        source,
      })

      if (listCards.length > 0) {
        cards.push(...listCards)
        continue
      }
    }

    cards.push({
      front: node.title,
      back,
      template: shouldSplitList ? 'list' : 'markdown',
      sourceKey: baseSourceKey,
      source,
    })
  }

  const markdownCards = withUniqueSourceKeys(cards).filter((card) => card.front && card.back)
  return markdownCards.length > 0 ? markdownCards : parseBulkCards(rawText)
}
