import { buildAnkiStudioChoiceRender } from './ankiStudioChoiceRenderer.js'

const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const CONTROL_NOISE_RE = /(通知中心|Control Center|检查更新|正在加载通知|上次更新|题目类型|随机选项|选项还原|选项代入|套卷模式|核心凸显|重叠统计|牌组层级|纯色模式|动画|智能题卡|学习曲线|错误反馈|在线讨论)/i
const SCRIPT_SIGNAL_RE = /\b(decryptFront|decryptBack|Persistence|switchTab|switchMainTab|front-options|back-options|ASNotice|anki_discuss|ANKI_DISCUSS_CONFIG)\b/i
const EMPTY_SCRIPT_CALL_RE = /^(?:decrypt|render|show|load|init)[a-zA-Z0-9_$]*\(\)\s*;?$/i

const ROLE_SPECS = {
  question: {
    exact: ['AS_本题题目', 'AS_题目主体', 'AS_题目材料', 'Question', 'Front', '正面', '题目', '题干', '问题'],
    nameRe: /(本题题目|题目主体|题目材料|题干|题目|问题|question|prompt|stem|front|正面)/i,
    badNameRe: /(选项|答案|解析|统计|通知|设置|页码|分类|归属|书籍|笔记|材料)/i,
  },
  options: {
    exact: ['AS_本题选项', 'AS_选项', 'Options', 'Choices', '选项'],
    nameRe: /(本题选项|选项|options?|choices?|choice)/i,
    badNameRe: /(答案|解析|题干|材料|统计|通知|分类|归属|书籍|笔记)/i,
  },
  answer: {
    exact: ['AS_正确答案', '正确答案', '答案', 'Answer', 'Key', 'Back'],
    nameRe: /(正确答案|原书答案|答案|answer|key|back|背面)/i,
    badNameRe: /(解析|题干|题目|选项|材料|统计|通知|分类|归属|书籍|笔记)/i,
  },
  analysis: {
    exact: ['AS_原书解析', 'AS_答案解析', '原书解析', '答案解析', '解析', 'Analysis', 'Explain', 'Explanation', 'Solution'],
    nameRe: /(原书解析|答案解析|解析|详解|解释|analysis|explain|explanation|solution)/i,
    badNameRe: /(题干|题目|选项|通知|统计|分类|归属|书籍)/i,
  },
  material: {
    exact: ['AS_分析材料', '分析材料', '材料', 'Material', 'Passage'],
    nameRe: /(分析材料|材料|阅读材料|素材|material|passage|context)/i,
    badNameRe: /(答案|解析|选项|通知|统计)/i,
  },
  originalReview: {
    exact: ['AS_原文回顾', '原文回顾', '原文', 'Review'],
    nameRe: /(原文回顾|原文|review)/i,
    badNameRe: /(答案|选项|通知|统计)/i,
  },
  pointNote: {
    exact: ['AS_考点笔记', '考点笔记', '考点', 'Note'],
    nameRe: /(考点笔记|考点|知识点|note|notes)/i,
    badNameRe: /(你的笔记|用户笔记|通知|统计)/i,
  },
  userNote: {
    exact: ['AS_你的笔记', '你的笔记', '我的笔记', 'UserNote'],
    nameRe: /(你的笔记|我的笔记|用户笔记|user.*note)/i,
    badNameRe: /(考点|解析|通知|统计)/i,
  },
  subject: {
    exact: ['AS_学科分类', '学科分类', '科目', 'Subject'],
    nameRe: /(学科分类|科目|subject|category)/i,
    badNameRe: /(题干|答案|解析|选项)/i,
  },
  volume: {
    exact: ['AS_题目卷属', '题目卷属', '卷属', 'Volume'],
    nameRe: /(题目卷属|卷属|卷|volume)/i,
    badNameRe: /(题干|答案|解析|选项)/i,
  },
  belong: {
    exact: ['AS_题目归属', '题目归属', '归属', 'Belong'],
    nameRe: /(题目归属|归属|belong|source)/i,
    badNameRe: /(题干|答案|解析|选项)/i,
  },
  book: {
    exact: ['AS_所属书籍', '所属书籍', '书籍', 'Book'],
    nameRe: /(所属书籍|书籍|book)/i,
    badNameRe: /(题干|答案|解析|选项)/i,
  },
}

function normalizeFieldName(value = '') {
  return String(value ?? '').replace(/\s+/g, '').replace(/[：:]/g, '').trim().toLowerCase()
}

function htmlDecode(value = '') {
  const raw = String(value ?? '')
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = raw
    return textarea.value
  }
  return raw
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function stripHtml(value = '') {
  return htmlDecode(String(value ?? '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|section|article|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
}

function normalizeText(value = '') {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function compactText(value = '') {
  return normalizeText(value).replace(/\s+/g, ' ').trim()
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeRichHtml(value = '') {
  return String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>[\s\S]*?<\/embed>/gi, '')
}

function cleanNoiseText(value = '') {
  return normalizeText(stripHtml(value)
    .split(/\n+/)
    .map((line) => compactText(line))
    .filter(Boolean)
    .filter((line) => !CONTROL_NOISE_RE.test(line))
    .filter((line) => !/^(题目材料|题目主体|通知中心|Control Center|Front|Back)$/i.test(line))
    .join('\n'))
}

function fieldEntries(fields = {}) {
  return Object.entries(fields || {}).map(([name, raw]) => ({
    name,
    normalizedName: normalizeFieldName(name),
    raw: String(raw ?? ''),
    text: cleanNoiseText(raw),
    plainText: compactText(stripHtml(raw)),
  }))
}

function scoreField(entry, role) {
  const spec = ROLE_SPECS[role]
  if (!spec) return -999
  const normalizedExact = new Set(spec.exact.map(normalizeFieldName))
  let score = 0
  if (normalizedExact.has(entry.normalizedName)) score += 80
  if (spec.nameRe.test(entry.name)) score += 42
  if (spec.badNameRe?.test(entry.name)) score -= 35
  if (!entry.text) score -= 45
  if (CONTROL_NOISE_RE.test(entry.plainText)) score -= 12
  if (EMPTY_SCRIPT_CALL_RE.test(entry.text)) score -= 80
  if (role === 'options' && detectOptionCount(entry.raw) >= 2) score += 38
  if (role === 'question' && /[？?]/.test(entry.text)) score += 10
  if (role === 'answer' && extractAnswerLetters(entry.raw).length) score += 20
  if (role === 'analysis' && /(解析|原因|因此|所以|错误|正确|OP_[A-H]|原书)/i.test(entry.raw)) score += 18
  score += Math.min(entry.text.length, 240) / 40
  return score
}

function pickRoleField(fields = {}, role) {
  const entries = fieldEntries(fields)
  const scored = entries
    .map((entry) => ({ ...entry, score: scoreField(entry, role) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored[0] || null
}

function getRoleValue(fields = {}, role) {
  const hit = pickRoleField(fields, role)
  return hit?.raw || ''
}

function detectOptionCount(value = '') {
  return parseOptions(value).length
}

function parseOptions(value = '') {
  const raw = String(value ?? '').trim()
  if (!raw) return []

  const pipeParts = raw
    .split(/\s*\|\|\s*/g)
    .map((part) => cleanNoiseText(part))
    .filter(Boolean)

  if (pipeParts.length >= 2) {
    return pipeParts.slice(0, 12).map((text, index) => ({
      letter: OPTION_LABELS[index] || String(index + 1),
      text: text.replace(/^[A-L]\s*[\.．、:：]\s*/i, '').trim(),
    })).filter((item) => item.text)
  }

  const lineSource = raw
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|li|tr)>/gi, '\n')
  const text = cleanNoiseText(lineSource)
  const normalized = text.replace(/(^|\s)([A-L])\s*[\.．、:：]\s*/g, '\n$2. ')
  const lines = normalized.split(/\n+/).map((item) => compactText(item)).filter(Boolean)

  const labeled = []
  for (const line of lines) {
    const match = line.match(/^([A-L])\s*[\.．、:：]\s*(.+)$/i)
    if (match?.[2]) labeled.push({ letter: match[1].toUpperCase(), text: match[2].trim() })
  }
  if (labeled.length >= 2) return dedupeOptions(labeled)

  const inline = Array.from(text.matchAll(/(?:^|\s)([A-L])\s*[\.．、:：]\s*([^A-L]{1,120}?)(?=\s+[A-L]\s*[\.．、:：]|$)/gi))
    .map((match) => ({ letter: match[1].toUpperCase(), text: compactText(match[2]) }))
    .filter((item) => item.text)
  if (inline.length >= 2) return dedupeOptions(inline)

  if (lines.length >= 2 && lines.length <= 12) {
    return lines.map((text, index) => ({
      letter: OPTION_LABELS[index] || String(index + 1),
      text: text.replace(/^[A-L]\s*[\.．、:：]\s*/i, '').trim(),
    })).filter((item) => item.text)
  }

  return []
}

function dedupeOptions(options = []) {
  const seen = new Set()
  return options.filter((item) => {
    const key = `${item.letter}:${compactText(item.text)}`
    if (!item.text || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 12)
}

function extractAnswerLetters(value = '') {
  const raw = String(value ?? '')
  const text = compactText(stripHtml(raw))
    .replace(/[，、；;]/g, ',')
    .replace(/正确答案|原书答案|答案|Answer|Key|选项/gi, '')
  const out = []
  const opLetters = Array.from(raw.matchAll(/OP_([A-L])/gi)).map((match) => match[1].toUpperCase())
  out.push(...opLetters)
  const plainGroups = text.split(/[,/\s]+/).filter(Boolean)
  for (const part of plainGroups) {
    if (/^[A-L]{1,12}$/i.test(part)) {
      part.toUpperCase().split('').forEach((letter) => out.push(letter))
    } else if (/^\d+$/.test(part)) {
      const index = Number(part) - 1
      if (index >= 0 && index < OPTION_LABELS.length) out.push(OPTION_LABELS[index])
    }
  }
  return Array.from(new Set(out.filter((letter) => OPTION_LABELS.includes(letter))))
}

function makeSyntheticChoiceFields({ fields = {}, renderedQuestionHtml = '', renderedBackHtml = '' } = {}) {
  const questionField = pickRoleField(fields, 'question')
  const optionsField = pickRoleField(fields, 'options')
  const answerField = pickRoleField(fields, 'answer')
  const analysisField = pickRoleField(fields, 'analysis')

  let question = questionField?.raw || renderedQuestionHtml
  let optionsRaw = optionsField?.raw || ''
  const optionsFromQuestion = parseOptions(question)
  if (!optionsRaw && optionsFromQuestion.length >= 2) {
    optionsRaw = optionsFromQuestion.map((item) => item.text).join('||')
    question = cleanNoiseText(question).replace(/\s*[A-L]\s*[\.．、:：]\s*[^A-L]+(?=\s+[A-L]\s*[\.．、:：]|$)/gi, '').trim() || question
  }

  const analysis = analysisField?.raw || renderedBackHtml
  const answer = answerField?.raw || ''
  const options = parseOptions(optionsRaw)
  if (!cleanNoiseText(question) || options.length < 2) return null

  return {
    AS_本题题目: question,
    AS_本题选项: options.map((item) => item.text).join('||'),
    AS_正确答案: answer,
    AS_原书解析: analysis,
    AS_分析材料: getRoleValue(fields, 'material'),
    AS_原文回顾: getRoleValue(fields, 'originalReview'),
    AS_考点笔记: getRoleValue(fields, 'pointNote'),
    AS_你的笔记: getRoleValue(fields, 'userNote'),
    AS_学科分类: getRoleValue(fields, 'subject'),
    AS_题目卷属: getRoleValue(fields, 'volume'),
    AS_题目归属: getRoleValue(fields, 'belong'),
    AS_所属书籍: getRoleValue(fields, 'book'),
  }
}


function parseMonolithicStudyText(value = '') {
  const raw = cleanNoiseText(value)
  if (!raw) return null
  const lines = raw.split(/\n+/).map((line) => compactText(line)).filter(Boolean)
  if (!lines.length) return null

  const noiseLineRe = /^(未填写|暂无|未作答|正确答案|你的选择|易错易漏|综合统计|单选统计|多选统计|答题总分|答题用时|隐藏解析|显示解析|答案[：:]\s*未填写|你的选择[：:]\s*暂无|0(?:\.00)?%\s*\(0\/0\)|0分0秒|0)$/i
  const answerIndex = lines.findIndex((line) => /^(答案|解析|参考答案|正确答案)\s*[：:]/.test(line))
  const stopIndex = lines.findIndex((line) => /^(未填写|正确答案|你的选择|易错易漏|综合统计|单选统计|多选统计|答题总分|答题用时|隐藏解析|显示解析)$/i.test(line))
  const questionLines = lines
    .slice(0, answerIndex >= 0 ? answerIndex : (stopIndex >= 0 ? stopIndex : Math.min(lines.length, 4)))
    .filter((line) => !noiseLineRe.test(line))
    .filter((line) => !/[{]{2}[^}]+[}]{2}/.test(line))

  let question = questionLines.join('\n').trim()
  if (!question && lines[0] && !noiseLineRe.test(lines[0])) question = lines[0]

  let answer = ''
  if (answerIndex >= 0) {
    answer = lines.slice(answerIndex).join('\n')
      .replace(/^答案\s*[：:]\s*/i, '')
      .replace(/^解析\s*[：:]\s*/i, '解析：')
      .trim()
  }

  if (!answer) {
    const answerMatch = raw.match(/(?:答案|解析|参考答案)\s*[：:]\s*([\s\S]+)$/i)
    if (answerMatch?.[1]) answer = answerMatch[1].trim()
  }

  if (!question || !answer) return null
  return { question, answer }
}

function buildMonolithicTextRender(args = {}) {
  const { fields = {}, renderedQuestionHtml = '', renderedBackHtml = '', deckPath = [], tags = [], modelName = '' } = args
  const candidates = []
  for (const [name, raw] of Object.entries(fields || {})) {
    const text = cleanNoiseText(raw)
    if (/内容|正文|题目|front|back/i.test(name) || /正确答案|你的选择|答题用时|隐藏解析|答案[：:]/.test(text)) {
      candidates.push(text)
    }
  }
  candidates.push(cleanNoiseText(renderedQuestionHtml), cleanNoiseText(renderedBackHtml))

  const parsed = candidates.map(parseMonolithicStudyText).find(Boolean)
  if (!parsed) return null

  const pills = [
    getRoleValue(fields, 'subject'),
    getRoleValue(fields, 'volume'),
    getRoleValue(fields, 'book'),
    getRoleValue(fields, 'belong'),
    ...deckPath.slice(-2),
    ...tags.slice(0, 2),
  ].map((item) => compactText(stripHtml(item))).filter(Boolean).slice(0, 5)
  const pillHtml = pills.length ? `<div class="miki-generic-tags">${pills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join('')}</div>` : ''
  const questionHtml = escapeHtml(parsed.question).replace(/\n/g, '<br />')
  const answerHtml = escapeHtml(parsed.answer).replace(/\n/g, '<br />')
  const frontHtml = `<article class="miki-generic-card miki-generic-front">
  <div class="miki-generic-kind">文本 / 问答卡</div>
  <section class="miki-generic-question">${questionHtml}</section>
  ${pillHtml}
</article>`
  const backHtml = `<article class="miki-generic-card miki-generic-back">
  <div class="miki-generic-kind">文本 / 问答卡</div>
  <section class="miki-generic-question">${questionHtml}</section>
  <section class="miki-generic-answer"><h3>答案 / 解析</h3><div>${answerHtml}</div></section>
  ${pillHtml}
</article>`
  return {
    frontHtml,
    backHtml,
    frontText: compactText(parsed.question),
    backText: compactText(`${parsed.question} ${parsed.answer}`),
    css: GENERIC_CARD_CSS,
    renderer: 'monolithic-text-qa',
    fieldAnalysis: analyzeApkgFields({ ...args, modelName }),
  }
}

function buildGenericChoiceRender(args = {}) {
  const syntheticFields = makeSyntheticChoiceFields(args)
  if (!syntheticFields) return null
  const render = buildAnkiStudioChoiceRender({
    ...args,
    fields: syntheticFields,
    modelName: `${args.modelName || ''} GenericChoice`,
  })
  if (!render) return null
  return {
    ...render,
    renderer: 'generic-choice',
    fieldAnalysis: analyzeApkgFields(args),
  }
}

function buildQaRender(args = {}) {
  const { fields = {}, renderedQuestionHtml = '', renderedBackHtml = '', deckPath = [], tags = [], modelName = '' } = args
  const question = cleanNoiseText(pickRoleField(fields, 'question')?.raw || renderedQuestionHtml)
  const answer = pickRoleField(fields, 'answer')?.raw || pickRoleField(fields, 'analysis')?.raw || renderedBackHtml
  const answerText = cleanNoiseText(answer)
  if (!question || !answerText || CONTROL_NOISE_RE.test(question)) return null

  const pills = [
    getRoleValue(fields, 'subject'),
    getRoleValue(fields, 'volume'),
    getRoleValue(fields, 'book'),
    getRoleValue(fields, 'belong'),
    ...deckPath.slice(-2),
    ...tags.slice(0, 2),
  ].map((item) => compactText(stripHtml(item))).filter(Boolean).slice(0, 5)

  const pillHtml = pills.length ? `<div class="miki-generic-tags">${pills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join('')}</div>` : ''
  const frontHtml = `<article class="miki-generic-card miki-generic-front">
  <div class="miki-generic-kind">问答 / HTML 卡</div>
  <section class="miki-generic-question">${escapeHtml(question).replace(/\n/g, '<br />')}</section>
  ${pillHtml}
</article>`
  const backHtml = `<article class="miki-generic-card miki-generic-back">
  <div class="miki-generic-kind">问答 / HTML 卡</div>
  <section class="miki-generic-question">${escapeHtml(question).replace(/\n/g, '<br />')}</section>
  <section class="miki-generic-answer"><h3>答案 / 解析</h3><div>${sanitizeRichHtml(answer) || escapeHtml(answerText).replace(/\n/g, '<br />')}</div></section>
  ${pillHtml}
</article>`
  return {
    frontHtml,
    backHtml,
    frontText: compactText(question),
    backText: compactText(`${question} ${answerText}`),
    css: GENERIC_CARD_CSS,
    renderer: 'generic-qa',
    fieldAnalysis: analyzeApkgFields({ ...args, modelName }),
  }
}

function buildDiagnosticRender(args = {}) {
  const { fields = {}, modelName = '', templateName = '', deckPath = [] } = args
  const analysis = analyzeApkgFields(args)
  const suspicious = analysis.templateSignals.hasScript || analysis.templateSignals.hasControlPanel || analysis.fieldNames.length > 0
  if (!suspicious) return null
  const rows = analysis.fieldReport.slice(0, 18).map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.role || '未识别')}</td><td>${escapeHtml(item.sample)}</td></tr>`).join('')
  const hint = analysis.fieldNames.length
    ? '这个 APKG 模板已保存，但暂时没有匹配到稳定 renderer。不会再直接显示 Control Center / 通知中心；请根据字段报告补 adapter。'
    : '这个 APKG 暂时没有可显示字段。'
  const frontHtml = `<article class="miki-apkg-diagnostic">
  <h2>APKG 字段诊断</h2>
  <p>${escapeHtml(hint)}</p>
  <div class="miki-apkg-diag-meta">${escapeHtml([modelName, templateName, ...deckPath.slice(-2)].filter(Boolean).join(' / '))}</div>
  <table><thead><tr><th>字段</th><th>推断角色</th><th>样例</th></tr></thead><tbody>${rows}</tbody></table>
</article>`
  return {
    frontHtml,
    backHtml: frontHtml,
    frontText: `APKG 字段诊断 ${analysis.fieldNames.join(' ')}`,
    backText: `APKG 字段诊断 ${analysis.fieldNames.join(' ')}`,
    css: DIAGNOSTIC_CSS,
    renderer: 'diagnostic-unmatched',
    fieldAnalysis: analysis,
  }
}

export function analyzeApkgFields({ fields = {}, modelName = '', templateName = '', renderedQuestionHtml = '', renderedBackHtml = '' } = {}) {
  const entries = fieldEntries(fields)
  const roles = {}
  for (const role of Object.keys(ROLE_SPECS)) {
    const hit = pickRoleField(fields, role)
    if (hit) roles[role] = { name: hit.name, score: Math.round(hit.score) }
  }
  const fieldReport = entries.map((entry) => {
    const role = Object.entries(roles).find(([, hit]) => hit.name === entry.name)?.[0] || ''
    return {
      name: entry.name,
      role,
      sample: compactText(entry.text || entry.plainText).slice(0, 120),
      hasHtml: /<[^>]+>/.test(entry.raw),
      optionCount: parseOptions(entry.raw).length,
    }
  })

  const templateBlob = `${modelName}\n${templateName}\n${renderedQuestionHtml}\n${renderedBackHtml}`
  return {
    fieldNames: entries.map((entry) => entry.name),
    roles,
    fieldReport,
    templateSignals: {
      hasScript: SCRIPT_SIGNAL_RE.test(templateBlob),
      hasControlPanel: CONTROL_NOISE_RE.test(templateBlob),
      hasOptionsContainer: /front-options|back-options|class=["']options|id=["']options/i.test(templateBlob),
    },
  }
}

export function buildApkgStructuredRender(args = {}) {
  const adapters = [
    () => buildAnkiStudioChoiceRender(args),
    () => buildGenericChoiceRender(args),
    () => buildMonolithicTextRender(args),
    () => buildQaRender(args),
    () => buildDiagnosticRender(args),
  ]

  for (const adapter of adapters) {
    try {
      const result = adapter()
      if (result?.frontHtml || result?.backHtml) {
        return {
          ...result,
          fieldAnalysis: result.fieldAnalysis || analyzeApkgFields(args),
        }
      }
    } catch (error) {
      console.warn('[apkgRenderRegistry] adapter failed:', error)
    }
  }
  return null
}

const GENERIC_CARD_CSS = `
.miki-generic-card { box-sizing: border-box; max-width: 920px; margin: 0 auto; padding: 18px 20px 26px; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.85; background: #fff; }
.miki-generic-kind { display: inline-flex; margin-bottom: 14px; padding: 5px 10px; border-radius: 999px; color: #1677ff; background: rgba(0,122,255,.08); font-weight: 900; }
.miki-generic-question { padding: 14px 16px; border-radius: 12px; background: #f8fafc; color: #111827; font-weight: 850; }
.miki-generic-answer { margin-top: 16px; padding: 14px 16px; border: 1.5px solid #2dd4bf; border-radius: 12px; }
.miki-generic-answer h3 { margin: 0 0 10px; color: #ef4444; }
.miki-generic-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.miki-generic-tags span { padding: 4px 9px; border: 1px solid #1677ff; border-radius: 6px; color: #1677ff; background: rgba(0,122,255,.08); font-weight: 800; }
`

const DIAGNOSTIC_CSS = `
.miki-apkg-diagnostic { box-sizing: border-box; max-width: 980px; margin: 0 auto; padding: 18px 20px 26px; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 14px; line-height: 1.7; background: #fff; }
.miki-apkg-diagnostic h2 { margin: 0 0 10px; color: #ef4444; }
.miki-apkg-diag-meta { margin: 10px 0 14px; color: #64748b; font-weight: 700; }
.miki-apkg-diagnostic table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; }
.miki-apkg-diagnostic th, .miki-apkg-diagnostic td { padding: 8px 10px; border: 1px solid #e5e7eb; vertical-align: top; }
.miki-apkg-diagnostic th { background: #f8fafc; color: #334155; text-align: left; }
`
