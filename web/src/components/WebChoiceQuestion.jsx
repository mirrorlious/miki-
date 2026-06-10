import React, { useEffect, useMemo, useState } from 'react'
import {
  getStoredWebChoiceAttempt,
  sanitizeTrustedCardHtml,
  saveStoredWebChoiceAttempt,
} from '../lib/webChoiceBank'
import { WEB_CHOICE_BANK_MEDIA_BASE_URL } from '../config/webChoiceBankConfig'
import './WebChoiceBank.css'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default function WebChoiceQuestion({
  card,
  mediaBaseUrl = WEB_CHOICE_BANK_MEDIA_BASE_URL,
  onAttempt,
  onReset,
  onNext,
  showNext = false,
  compact = false,
}) {
  const previousAttempt = useMemo(() => getStoredWebChoiceAttempt(card?.id), [card?.id])
  const [selected, setSelected] = useState(previousAttempt?.selected || [])
  const [revealed, setRevealed] = useState(Boolean(previousAttempt?.revealed))

  useEffect(() => {
    const attempt = getStoredWebChoiceAttempt(card?.id)
    setSelected(attempt?.selected || [])
    setRevealed(Boolean(attempt?.revealed))
  }, [card?.id])

  if (!card) {
    return (
      <div className="web-choice-empty">
        <div className="web-choice-empty-icon">📘</div>
        <div className="web-choice-empty-title">选择一道题开始</div>
        <div className="web-choice-empty-text">左侧按 deck / subject / book 筛选，右侧会显示题目。</div>
      </div>
    )
  }

  const answerSet = new Set(card.answerLetters || [])
  const selectedSet = new Set(selected)
  const isMulti = (card.answerLetters || []).length > 1
  const currentCorrect = selected.length === answerSet.size && selected.every((letter) => answerSet.has(letter))

  function toggleOption(letter) {
    if (revealed) return
    let next
    if (isMulti) {
      next = selectedSet.has(letter)
        ? selected.filter((x) => x !== letter)
        : [...selected, letter].sort()
    } else {
      next = [letter]
    }
    setSelected(next)
  }

  function revealAnswer() {
    const correct =
      selected.length === answerSet.size && selected.every((letter) => answerSet.has(letter))
    const attempt = {
      selected,
      revealed: true,
      correct,
      answeredAt: new Date().toISOString(),
    }
    saveStoredWebChoiceAttempt(card.id, attempt)
    setRevealed(true)
    onAttempt?.(card, attempt)
  }

  function reset() {
    const attempt = { selected: [], revealed: false }
    setSelected([])
    setRevealed(false)
    saveStoredWebChoiceAttempt(card.id, attempt)
    onReset?.(card, attempt)
  }

  const analysisHtml = sanitizeTrustedCardHtml(card.analysis || '', mediaBaseUrl)

  return (
    <article className={`web-choice-question ${compact ? 'compact' : ''}`}>
      <div className="web-choice-question-header">
        <div>
          <div className="web-choice-meta">
            <span>{card.type}</span>
            <span>{card.subject}</span>
            {card.volume ? <span>{card.volume}</span> : null}
            {card.book ? <span>{card.book}</span> : null}
          </div>
          <h2>{card.question}</h2>
        </div>
        <div className="web-choice-number">#{card.number || '-'}</div>
      </div>

      {card.tags?.length ? (
        <div className="web-choice-tags">
          {card.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      <div className="web-choice-options">
        {(card.options || []).map((option, index) => {
          const letter = LETTERS[index]
          const picked = selectedSet.has(letter)
          const correct = answerSet.has(letter)
          const className = [
            'web-choice-option',
            picked ? 'is-picked' : '',
            revealed && correct ? 'is-correct' : '',
            revealed && picked && !correct ? 'is-wrong' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              type="button"
              key={`${letter}-${option}`}
              className={className}
              onClick={() => toggleOption(letter)}
            >
              <b>{letter}.</b>
              <span>{option}</span>
            </button>
          )
        })}
      </div>

      <div className="web-choice-actions">
        <button type="button" className="web-choice-primary" onClick={revealAnswer}>
          {revealed ? '重新显示解析' : '显示答案'}
        </button>
        <button type="button" className="web-choice-secondary" onClick={reset}>
          重做
        </button>
        {showNext ? (
          <button type="button" className="web-choice-next" onClick={onNext}>
            下一题
          </button>
        ) : null}
      </div>

      {revealed ? (
        <section className={`web-choice-answer-panel ${currentCorrect ? 'is-correct' : 'is-wrong'}`}>
          <div className="web-choice-answer-line">
            <strong>正确答案：</strong>
            <span>{(card.answerLetters || []).join('、')}</span>
          </div>
          <div className="web-choice-answer-line">
            <strong>你的选择：</strong>
            <span>{selected.length ? selected.join('、') : '暂无'}</span>
          </div>
          {analysisHtml ? (
            <div
              className="web-choice-analysis"
              dangerouslySetInnerHTML={{ __html: analysisHtml }}
            />
          ) : null}
        </section>
      ) : null}
    </article>
  )
}
