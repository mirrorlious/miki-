import { buildCardValueFromTemplate } from './cardHtml.js'
import { getCardTemplates } from './cardTemplates.js'

const PRESERVED_CARD_KEYS = [
  'id', 'deckId', 'createdAt', 'review', 'tags', 'favorite', 'flagged', 'flagColor', 'comment',
  'annotations', 'links', 'suspended', 'source', 'sourceKey', 'anki', 'userAnkiPack', 'position', 'order',
]

function pickPreservedCardState(card = {}) {
  const preserved = {}
  for (const key of PRESERVED_CARD_KEYS) {
    if (card[key] !== undefined) preserved[key] = card[key]
  }
  return preserved
}

function makeTemplateInputFromCard(card = {}) {
  const fields = card?.anki?.fields && typeof card.anki.fields === 'object' ? card.anki.fields : {}
  return {
    ...fields,
    ...card,
    front: card.rawFront ?? card.front ?? fields.Front ?? fields.正面 ?? fields.内容 ?? '',
    back: card.rawBack ?? card.back ?? fields.Back ?? fields.反面 ?? fields.答案 ?? '',
    rawFront: card.rawFront ?? card.front ?? '',
    rawBack: card.rawBack ?? card.back ?? '',
    内容: fields.内容 ?? card.rawFront ?? card.front ?? '',
  }
}

function findTemplateForCard(card = {}, templates = [], fallbackTemplateId = '') {
  const templateId = fallbackTemplateId || card.templateId || card.template
  return templates.find((template) => template.id === templateId)
    ?? templates.find((template) => template.id === card.template)
    ?? templates.find((template) => template.id === card.templateId)
    ?? null
}

function rebuildCardWithTemplate(card, template) {
  if (!card || !template) return card
  const value = buildCardValueFromTemplate(makeTemplateInputFromCard(card), template)
  return {
    ...card,
    ...pickPreservedCardState(card),
    ...value,
    template: template.id,
    templateId: template.id,
    updatedAt: Date.now(),
  }
}

function reapplyTemplatesToCards(data, { cardIds = [], deckId = '', templateId = '', onlyTemplates = [] } = {}) {
  const cardIdSet = new Set(cardIds.filter(Boolean))
  const onlyTemplateSet = new Set(onlyTemplates.filter(Boolean))
  const templates = getCardTemplates(data)
  let changedCount = 0
  const cards = (data.cards || []).map((card) => {
    const inScope = cardIdSet.size > 0 ? cardIdSet.has(card.id) : deckId ? card.deckId === deckId : true
    if (!inScope) return card
    if (onlyTemplateSet.size > 0 && !onlyTemplateSet.has(card.template) && !onlyTemplateSet.has(card.templateId)) return card
    const template = findTemplateForCard(card, templates, templateId)
    if (!template) return card
    changedCount += 1
    return rebuildCardWithTemplate(card, template)
  })
  return { data: { ...data, cards }, changedCount }
}

export { rebuildCardWithTemplate, reapplyTemplatesToCards, findTemplateForCard }
