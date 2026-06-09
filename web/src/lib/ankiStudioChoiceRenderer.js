const OPTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const EXACT_FIELDS = {
  uid: ['AS_UID'],
  number: ['AS_本题题号'],
  frequency: ['AS_本题题频'],
  material: ['AS_分析材料', '分析材料', '材料'],
  question: ['AS_本题题目', 'AS_题目主体', 'AS_题目材料', '题目主体', '题目材料', '题干', '题目'],
  options: ['AS_本题选项', 'AS_选项', '选项'],
  encryptedAnswer: ['AS_正确答案', '正确答案', '答案'],
  analysis: ['AS_原书解析', 'AS_答案解析', '原书解析', '答案解析', '解析'],
  originalReview: ['AS_原文回顾', '原文回顾'],
  pointNote: ['AS_考点笔记', '考点笔记'],
  userNote: ['AS_你的笔记', '你的笔记'],
  page: ['AS_复盘页码', '复盘页码'],
  subject: ['AS_学科分类', '学科分类'],
  volume: ['AS_题目卷属', '题目卷属'],
  belong: ['AS_题目归属', '题目归属'],
  book: ['AS_所属书籍', '所属书籍'],
}

const UI_NOISE_RE = /(通知中心|Control Center|检查更新|正在加载通知|上次更新|题目类型|随机选项|选项还原|选项代入|套卷模式|核心凸显|重叠统计|牌组层级|纯色模式|动画|全部\s*\(\d+\)|紧急\s*\(\d+\)|重要\s*\(\d+\)|普通\s*\(\d+\))/i

const ANSWER_CIPHER_MAP = {
  '≯#bkTRupsIgsNZWPjlgjBhbg==#≮': 'A',
  '≯#hW/1p5DngB3N/RoqRcrvpQ==#≮': 'B',
  '≯#/Tm9AoiowOXd5hXyLWs7xg==#≮': 'C',
  '≯#AsndiNp6zGVzW5T0vZHKSg==#≮': 'D',
  '≯#LCHSNv4mNU21SFntWlyzVg==#≮': 'AB',
  '≯#0TT5BBLKxa4MXqfMZzm27w==#≮': 'AC',
  '≯#FP4KsVdL6237qy0OXh7PmA==#≮': 'AD',
  '≯#G+t9862K1FF1MOeJ13H0NA==#≮': 'BC',
  '≯#TbMVOyitvmcwl2S6CalGxQ==#≮': 'BD',
  '≯#MdGeog5/fLYcvuh9wU01Ag==#≮': 'CD',
  '≯#JWFSxwqO7vVWuJ0E/+2aSQ==#≮': 'ABC',
  '≯#A1mbbMvLqfHWZHFGH/HRlA==#≮': 'ABD',
  '≯#Oa4P1h+K+NL2LckYx38QPA==#≮': 'ACD',
  '≯#PGwOkZxCt+Z5dJJJ8MO/XQ==#≮': 'BCD',
  '≯#4IkYXB1PxwnA62Bjm3OXIA==#≮': 'ABCD',
}

function normalizeFieldName(value = '') {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[：:]/g, '')
    .trim()
}

function getField(fields = {}, names = []) {
  const normalized = new Map(Object.entries(fields || {}).map(([key, value]) => [normalizeFieldName(key), value]))
  for (const name of names) {
    const hit = normalized.get(normalizeFieldName(name))
    if (hit != null && String(hit).trim() !== '') return String(hit)
  }
  return ''
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
    .filter((line) => !UI_NOISE_RE.test(line))
    .filter((line) => !/^(题目材料|题目主体|通知中心|Control Center|Front|Back)$/i.test(line))
    .join('\n'))
}

function cleanQuestion(value = '') {
  return cleanNoiseText(value)
    .replace(/^(题目材料|题目主体|题干|题目)\s*[:：]?\s*/i, '')
    .trim()
}

function parseOptions(value = '') {
  const raw = String(value ?? '').trim()
  if (!raw) return []

  const pipeParts = raw
    .split(/\s*\|\|\s*/g)
    .map((part) => cleanNoiseText(part))
    .filter(Boolean)

  if (pipeParts.length >= 2) {
    return pipeParts.slice(0, 8).map((text, index) => ({
      letter: OPTION_LABELS[index] || String(index + 1),
      text: text.replace(/^[A-H]\s*[\.．、]\s*/i, '').trim(),
    })).filter((item) => item.text)
  }

  const lineSource = raw
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|li|tr)>/gi, '\n')
  const text = cleanNoiseText(lineSource)
  const lines = text
    .replace(/([A-H])\s*[\.．、]\s*/g, '\n$1. ')
    .split(/\n+/)
    .map((item) => compactText(item))
    .filter(Boolean)

  const labeled = []
  for (const line of lines) {
    const match = line.match(/^([A-H])\s*[\.．、]\s*(.+)$/i)
    if (match?.[2]) {
      labeled.push({ letter: match[1].toUpperCase(), text: match[2].trim() })
    }
  }
  if (labeled.length >= 2) return dedupeOptions(labeled)

  if (lines.length >= 2 && lines.length <= 8) {
    return lines.map((text, index) => ({
      letter: OPTION_LABELS[index] || String(index + 1),
      text: text.replace(/^[A-H]\s*[\.．、]\s*/i, '').trim(),
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
  }).slice(0, 8)
}

function lettersFromText(value = '') {
  const text = compactText(stripHtml(value))
    .replace(/[，、；;]/g, ',')
    .replace(/正确答案|原书答案|答案|Answer|Key|选项/gi, '')
  const out = []
  const parts = text.split(/[,/\s]+/).filter(Boolean)
  for (const part of parts) {
    if (/^[A-H]{1,8}$/i.test(part)) {
      part.toUpperCase().split('').forEach((letter) => out.push(letter))
    } else if (/^\d+$/.test(part)) {
      const index = Number(part) - 1
      if (index >= 0 && index < OPTION_LABELS.length) out.push(OPTION_LABELS[index])
    }
  }
  return Array.from(new Set(out.filter((letter) => OPTION_LABELS.includes(letter))))
}

function extractAnswerLetters({ answerRaw = '', analysisRaw = '' } = {}) {
  const beforeAnalysis = String(analysisRaw ?? '').split(/【原书解析】|【答案解析】|原书解析|答案解析/i)[0] || ''
  const fromAnswerBlock = Array.from(beforeAnalysis.matchAll(/OP_([A-H])/gi)).map((match) => match[1].toUpperCase())
  if (fromAnswerBlock.length) return Array.from(new Set(fromAnswerBlock))

  const fromPlain = lettersFromText(answerRaw)
  if (fromPlain.length) return fromPlain

  const mapped = ANSWER_CIPHER_MAP[String(answerRaw ?? '').trim()]
  if (mapped) return mapped.split('')

  const fromAnalysisAll = Array.from(String(analysisRaw ?? '').matchAll(/正确答案是\s*(?:<[^>]+>)*选项?\s*([A-H]+)/gi))
    .flatMap((match) => match[1].toUpperCase().split(''))
  if (fromAnalysisAll.length) return Array.from(new Set(fromAnalysisAll))

  return []
}

function cleanAnalysisHtml(value = '') {
  let html = sanitizeRichHtml(value)
  html = html
    .replace(/^\s*\d+[\.、．]\s*/i, '')
    .replace(/<div[^>]*class=(["'])Tag-A\1[^>]*>\s*【原书答案】\s*<\/div>/gi, '<div class="miki-as-section-title">【原书答案】</div>')
    .replace(/<div[^>]*class=(["'])Tag-A\1[^>]*>\s*【原书解析】\s*<\/div>/gi, '<div class="miki-as-section-title">【原书解析】</div>')
    .replace(/class=(["'])OP_([A-H])\1/gi, 'class="miki-as-op miki-as-op-$2"')
    .replace(/class=(["'])suojin\1/gi, 'class="miki-as-indent"')
  return html.trim()
}

function sectionHtml(title, content, { rich = false } = {}) {
  if (!content || !String(content).trim()) return ''
  const body = rich ? sanitizeRichHtml(content) : escapeHtml(cleanNoiseText(content)).replace(/\n/g, '<br />')
  if (!body.trim()) return ''
  return `<section class="miki-as-section">
  <h3>${escapeHtml(title)}</h3>
  <div class="miki-as-section-body">${body}</div>
</section>`
}

function sourcePillsFrom({ fields = {}, deckPath = [], tags = [] }) {
  const pills = []
  const push = (value) => {
    const clean = compactText(stripHtml(value)).replace(/[【】\[\]]/g, '')
    if (clean && clean.length <= 48 && !UI_NOISE_RE.test(clean) && !pills.includes(clean)) pills.push(clean)
  }

  push(getField(fields, EXACT_FIELDS.subject))
  push(getField(fields, EXACT_FIELDS.volume))
  push(getField(fields, EXACT_FIELDS.book))
  push(getField(fields, EXACT_FIELDS.belong))
  deckPath.slice(-2).forEach(push)
  tags.slice(0, 3).forEach(push)
  return pills.slice(0, 5)
}

function inferType({ deckPath = [], questionText = '', answers = [] } = {}) {
  const deckText = deckPath.join(' / ')
  if (/多选题|多项选择|多选/.test(deckText)) return '多选'
  if (/单选题|单项选择|单选/.test(deckText)) return '单选'
  if (answers.length > 1) return '多选'
  const explicit = String(questionText).match(/[【\[]\s*([^】\]]{1,12})\s*[】\]]/)
  return explicit?.[1] || '单选'
}

function buildOptionsHtml(options = [], answers = [], mode = 'front') {
  const inputType = answers.length > 1 ? 'checkbox' : 'radio'
  const groupName = `miki-as-choice-${Math.random().toString(36).slice(2, 9)}`
  return options.map((option) => {
    const isAnswer = answers.includes(option.letter)
    const answerClass = mode === 'back' && isAnswer ? ' is-answer' : ''
    const optionClass = ` OP_${escapeHtml(option.letter)}`
    return `<label class="miki-as-option${answerClass}${optionClass}">
  ${mode === 'front' ? `<input type="${inputType}" name="${groupName}" value="${escapeHtml(option.letter)}" />` : ''}
  <span class="miki-as-option-ui">
    <span class="miki-as-option-letter">${escapeHtml(option.letter)}.</span>
    <span class="miki-as-option-text">${escapeHtml(option.text)}</span>
  </span>
</label>`
  }).join('\n')
}

function buildPillsHtml(pills = []) {
  if (!pills.length) return ''
  return `<div class="miki-as-tags">${pills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join('')}</div>`
}

function buildStatsIslandHtml({ answers = [], mode = 'front' } = {}) {
  return `<div class="miki-as-islands">
  <span class="miki-as-island miki-as-island-hot">练气题</span>
  <span class="miki-as-island">0.00%</span>
  <span class="miki-as-island">0/0</span>
  ${mode === 'back' && answers.length ? `<span class="miki-as-island miki-as-island-answer">答案 ${escapeHtml(answers.join('、'))}</span>` : ''}
</div>`
}

function buildMainTabsHtml(active = 'question') {
  const tabs = ['题目材料', '题目主体', '智能题卡', '学习曲线', '错误反馈', '在线讨论']
  return `<div class="miki-as-tabs">${tabs.map((tab) => `<span class="${tab === active ? 'active' : ''}">${tab}</span>`).join('')}</div>`
}

function buildStudyStatsHtml(answers = []) {
  return `<div class="miki-as-stats-table">
  <div><b>${answers.length ? escapeHtml(answers.join('、')) : '-'}</b><span>正确答案</span></div>
  <div><b>未选择</b><span>你的选择</span></div>
  <div><b>易错易漏</b><span>易错易漏</span></div>
  <div><b>0.00%（0/0）</b><span>综合统计</span></div>
  <div><b>0</b><span>答题总分</span></div>
  <div><b>0分0秒</b><span>答题用时</span></div>
</div>`
}

function buildNotesTabsHtml() {
  return `<div class="miki-as-note-tabs"><span class="active">原书解析</span><span>原文回顾</span><span>考点笔记</span></div>`
}

export function buildAnkiStudioChoiceRender({
  fields = {},
  renderedQuestionHtml = '',
  renderedBackHtml = '',
  deckPath = [],
  tags = [],
  modelName = '',
} = {}) {
  const modelLooksRight = /Anki\s*Studio|AnkiStudio|选择题|习题集/i.test(String(modelName))
  const questionRaw = getField(fields, EXACT_FIELDS.question) || renderedQuestionHtml
  const optionsRaw = getField(fields, EXACT_FIELDS.options)
  const analysisRaw = getField(fields, EXACT_FIELDS.analysis) || renderedBackHtml
  const answerRaw = getField(fields, EXACT_FIELDS.encryptedAnswer)
  const materialRaw = getField(fields, EXACT_FIELDS.material)

  const question = cleanQuestion(questionRaw)
  const options = parseOptions(optionsRaw)
  if (!question || options.length < 2) return null

  const answers = extractAnswerLetters({ answerRaw, analysisRaw }).filter((letter) => options.some((option) => option.letter === letter))
  const type = inferType({ deckPath, questionText: question, answers })
  const pills = sourcePillsFrom({ fields, deckPath, tags })
  const material = cleanNoiseText(materialRaw)
  const analysisHtml = cleanAnalysisHtml(analysisRaw)
  const originalReview = getField(fields, EXACT_FIELDS.originalReview)
  const pointNote = getField(fields, EXACT_FIELDS.pointNote)
  const userNote = getField(fields, EXACT_FIELDS.userNote)
  const page = cleanNoiseText(getField(fields, EXACT_FIELDS.page))
  const number = cleanNoiseText(getField(fields, EXACT_FIELDS.number))
  const questionLabel = `${type ? `【${type}】` : ''}${number ? ` 第 ${number} 题` : ''}`.trim()

  const frontText = compactText(`${questionLabel} ${question} ${options.map((option) => `${option.letter}. ${option.text}`).join(' ')}`)
  const backText = compactText(`${frontText} ${answers.length ? `答案 ${answers.join('、')}` : ''} ${stripHtml(analysisHtml)} ${stripHtml(pointNote)} ${stripHtml(originalReview)}`)

  const frontHtml = `
<div class="miki-as-card miki-as-front">
  ${buildStatsIslandHtml({ answers, mode: 'front' })}
  ${buildMainTabsHtml('题目主体')}
  <main class="miki-as-body">
    ${material ? `<section class="miki-as-material"><div class="miki-as-panel-title">题目材料</div>${escapeHtml(material).replace(/\n/g, '<br />')}</section>` : ''}
    <div class="miki-as-question-head">
      ${questionLabel ? `<span class="miki-as-type">${escapeHtml(questionLabel)}</span>` : ''}
    </div>
    <div class="miki-as-question">${escapeHtml(question)}</div>
    <div class="miki-as-options">${buildOptionsHtml(options, answers, 'front')}</div>
    ${buildPillsHtml(pills)}
  </main>
</div>`

  const backHtml = `
<div class="miki-as-card miki-as-back">
  ${buildStatsIslandHtml({ answers, mode: 'back' })}
  ${buildMainTabsHtml('题目主体')}
  <main class="miki-as-body">
    ${material ? `<section class="miki-as-material"><div class="miki-as-panel-title">题目材料</div>${escapeHtml(material).replace(/\n/g, '<br />')}</section>` : ''}
    <div class="miki-as-question-head">
      ${questionLabel ? `<span class="miki-as-type">${escapeHtml(questionLabel)}</span>` : ''}
    </div>
    <div class="miki-as-question">${escapeHtml(question)}</div>
    <div class="miki-as-options">${buildOptionsHtml(options, answers, 'back')}</div>
    ${buildPillsHtml(pills)}
    ${buildStudyStatsHtml(answers)}
    ${buildNotesTabsHtml()}
    ${analysisHtml ? sectionHtml('原书解析', analysisHtml, { rich: true }) : ''}
    ${originalReview ? sectionHtml('原文回顾', originalReview, { rich: true }) : ''}
    ${pointNote ? sectionHtml('考点笔记', pointNote, { rich: true }) : ''}
    ${userNote ? sectionHtml('你的笔记', userNote, { rich: true }) : ''}
    ${page ? sectionHtml('复盘页码', page) : ''}
  </main>
</div>`

  const css = `
.miki-as-card {
  box-sizing: border-box;
  max-width: 980px;
  margin: 0 auto;
  padding: 18px 20px 26px;
  color: #111827;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 15px;
  line-height: 1.85;
  background: #fff;
}
.miki-as-card * { box-sizing: border-box; }
.miki-as-islands {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin: 2px 0 16px;
}
.miki-as-island {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 6px 13px;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, #ff5f6d, #ff3b30);
  box-shadow: 0 8px 20px rgba(255, 59, 48, .14);
  font-size: 12px;
  font-weight: 800;
}
.miki-as-island-hot { background: linear-gradient(135deg, #ff7b72, #ef4444); }
.miki-as-island-answer { background: linear-gradient(135deg, #34c759, #22c55e); }
.miki-as-tabs,
.miki-as-note-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 10px auto 18px;
  padding: 8px;
  border-radius: 14px;
  background: #f5f7fb;
}
.miki-as-tabs span,
.miki-as-note-tabs span {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 6px 12px;
  border-radius: 10px;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}
.miki-as-tabs span.active,
.miki-as-note-tabs span.active {
  color: #1677ff;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, .06);
}
.miki-as-body {
  border-radius: 16px;
  background: #fff;
}
.miki-as-question-head {
  margin: 8px 0 10px;
}
.miki-as-type {
  color: #1677ff;
  font-weight: 900;
}
.miki-as-question {
  margin: 10px 0 20px;
  color: #111827;
  font-size: 16px;
  font-weight: 800;
  line-height: 2;
  white-space: pre-wrap;
}
.miki-as-material {
  margin: 8px 0 16px;
  padding: 14px 16px;
  border: 1px solid #bfdbfe;
  border-left: 5px solid #facc15;
  border-radius: 10px;
  background: #fffdf4;
  color: #374151;
}
.miki-as-panel-title {
  margin-bottom: 6px;
  color: #2563eb;
  font-weight: 900;
}
.miki-as-options {
  display: grid;
  gap: 12px;
  margin: 18px 0 24px;
  counter-reset: optionCount;
}
.miki-as-option {
  display: block;
  margin: 0;
  cursor: pointer;
  user-select: none;
}
.miki-as-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.miki-as-option-ui {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  min-height: 46px;
  padding: 10px 14px;
  border: 1.5px solid #1f2937;
  border-radius: 7px;
  background: #fff;
  color: #111827;
  font-weight: 800;
  line-height: 1.75;
  transition: all .16s ease;
}
.miki-as-option:hover .miki-as-option-ui {
  border-color: #1677ff;
  background: #f8fbff;
}
.miki-as-option input:checked + .miki-as-option-ui {
  border-color: #1677ff;
  background: #eaf4ff;
  color: #1677ff;
  box-shadow: 0 0 0 3px rgba(22,119,255,.08);
}
.miki-as-option.is-answer .miki-as-option-ui {
  border-color: #34c759;
  background: #34c759;
  color: #fff;
}
.miki-as-option-letter {
  flex: 0 0 auto;
  min-width: 26px;
  font-weight: 950;
}
.miki-as-option-text {
  flex: 1 1 auto;
}
.miki-as-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0 12px;
}
.miki-as-tags span {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border: 1.5px solid #1677ff;
  border-radius: 6px;
  color: #1677ff;
  background: rgba(0,122,255,.08);
  font-weight: 850;
}
.miki-as-stats-table {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 18px 0 18px;
  padding: 12px 0;
  border-top: 1px solid #eef2f7;
  border-bottom: 1px solid #eef2f7;
  text-align: center;
}
.miki-as-stats-table div {
  min-width: 0;
}
.miki-as-stats-table b {
  display: block;
  color: #ef4444;
  font-size: 13px;
  word-break: break-word;
}
.miki-as-stats-table span {
  display: block;
  margin-top: 4px;
  color: #475569;
  font-size: 12px;
  font-weight: 750;
}
.miki-as-section {
  margin: 16px 0;
  padding: 14px 16px;
  border: 1.5px solid #2dd4bf;
  border-radius: 10px;
  background: #fff;
}
.miki-as-section h3 {
  display: inline-block;
  margin: -26px 0 10px;
  padding: 0 8px;
  color: #ef4444;
  background: #fff;
  font-size: 15px;
  font-weight: 950;
}
.miki-as-section-body {
  color: #111827;
  font-weight: 650;
}
.miki-as-section-body .miki-as-op,
.miki-as-section-body .OP_A,
.miki-as-section-body .OP_B,
.miki-as-section-body .OP_C,
.miki-as-section-body .OP_D {
  display: inline-block;
  margin: 2px 3px;
  padding: 2px 6px;
  border-radius: 5px;
  color: #1677ff;
  background: rgba(0,122,255,.08);
  font-weight: 900;
}
.miki-as-section-body .miki-as-indent {
  margin: 4px 0 4px 1em;
}
.miki-as-section-title {
  margin: 10px 0 6px;
  color: #0f766e;
  font-weight: 900;
}
@media (max-width: 520px) {
  .miki-as-card { padding: 14px 12px 22px; font-size: 14px; }
  .miki-as-islands { justify-content: center; }
  .miki-as-stats-table { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`

  return {
    frontHtml,
    backHtml,
    frontText,
    backText,
    css,
    answers,
    options,
    questionText: question,
    renderer: modelLooksRight ? 'ankistudio-exact-choice' : 'field-exact-choice',
  }
}
