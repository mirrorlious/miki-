function tokenizeForRelated(value) {
  const asciiTokens = String(value ?? '').toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
  const chineseTokens = String(value ?? '').match(/[\u4e00-\u9fa5]{2,}/g) ?? []
  const slicedChinese = chineseTokens.flatMap((token) => {
    const parts = []
    for (let index = 0; index < token.length - 1; index += 1) parts.push(token.slice(index, index + 2))
    return parts
  })
  const stopTokens = new Set(['decryptfront', 'decryptback', 'decrypt', 'front', 'back'])
  return new Set([...asciiTokens, ...slicedChinese].filter((token) => !stopTokens.has(token)))
}

export { tokenizeForRelated }