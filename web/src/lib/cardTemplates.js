const SYSTEM_CARD_TEMPLATES = [
  { id: 'qa', name: '问答题', description: '问题、答案。', mode: 'plain', builtIn: true },
  { id: 'cloze', name: '填空题', description: '可用 {{c1::内容}} 做填空。', mode: 'plain', builtIn: true },
  { id: 'note', name: '摘录题', description: '摘录、说明、补充。', mode: 'plain', builtIn: true },
  {
    id: 'html',
    name: 'HTML',
    description: '正面和背面直接作为 HTML 渲染。',
    mode: 'html',
    builtIn: true,
    frontCode: '{{Front}}',
    backCode: '{{Back}}',
    css: '',
    js: '',
  },
  {
    id: 'word-basic',
    name: '单词',
    description: '适合词条、释义、例句。',
    mode: 'html',
    builtIn: true,
    frontCode: '<section class="word-card-front">{{Front}}</section>',
    backCode: '<section class="word-card-back">{{Back}}</section>',
    css: '.word-card-front{font-size:32px;font-weight:800;line-height:1.35}.word-card-back{font-size:16px;line-height:1.75}.word-card-back b,.word-card-back strong{color:#059669}',
    js: '',
  },
]

function getStoredCardTemplates(data) {
  return Array.isArray(data?.profile?.cardTemplates) ? data.profile.cardTemplates : []
}

function normalizeCardTemplate(template = {}) {
  const id = String(template.id || `template-${Date.now()}`)
  return {
    id,
    name: String(template.name || '新模板').trim() || '新模板',
    description: String(template.description || '').trim(),
    mode: template.mode === 'plain' ? 'plain' : 'html',
    frontCode: String(template.frontCode ?? '{{Front}}'),
    backCode: String(template.backCode ?? '{{Back}}'),
    css: String(template.css ?? ''),
    js: String(template.js ?? ''),
    builtIn: Boolean(template.builtIn),
    createdAt: template.createdAt ?? Date.now(),
    updatedAt: template.updatedAt ?? Date.now(),
  }
}

function getCardTemplates(data) {
  const userTemplates = getStoredCardTemplates(data)
    .map(normalizeCardTemplate)
    .filter((template) => !SYSTEM_CARD_TEMPLATES.some((item) => item.id === template.id))
  return [...SYSTEM_CARD_TEMPLATES, ...userTemplates]
}

export { SYSTEM_CARD_TEMPLATES, getStoredCardTemplates, normalizeCardTemplate, getCardTemplates }
