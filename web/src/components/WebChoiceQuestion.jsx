import React, { useEffect, useMemo, useState } from 'react'
import {
  getStoredWebChoiceAttempt,
  sanitizeTrustedCardHtml,
  saveStoredWebChoiceAttempt,
} from '../lib/webChoiceBank'
import { WEB_CHOICE_BANK_MEDIA_BASE_URL } from '../config/webChoiceBankConfig'
import './WebChoiceBank.css'
import './WebChoiceBank.drill.css'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function isCorrectSelection(selected = [], answers = []) {
  const answerSet = new Set(answers || [])
  return selected.length === answerSet.size && selected.every((letter) => answerSet.has(letter))
}

export default function WebChoiceQuestion({
  card,
  mediaBaseUrl = WEB_CHOICE_BANK_MEDIA_BASE_URL,
  onAttempt,
  onReset,
  onPrev,
  onNext,
  showNext = false,
  compact = false,
  currentIndex = 0,
  total = 0,
}) {
  const previousAttempt = useMemo(() => getStoredWebChoiceAttempt(card?.id), [card?.id])
  const [selected, setSelected] = useState(previousAttempt?.selected || [])
  const [revealed, setRevealed] = useState(Boolean(previousAttempt?.revealed))
  const [skipped, setSkipped] = useState(Boolean(previousAttempt?.skipped))

  useEffect(() => {
    const attempt = getStoredWebChoiceAttempt(card?.id)
    setSelected(attempt?.selected || [])
    setRevealed(Boolean(attempt?.revealed))
    setSkipped(Boolean(attempt?.skipped))
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

  const answers = card.answerLetters || []
  const answerSet = new Set(answers)
  const selectedSet = new Set(selected)
  const isMulti = answers.length > 1
  const currentCorrect = isCorrectSelection(selected, answers)
  const hasSelection = selected.length > 0

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

  function finishAttempt({ direct = false } = {}) {
    if (!direct && !selected.length) return
    const attempt = {
      selected,
      revealed: true,
      skipped: Boolean(direct && !selected.length),
      correct: direct && !selected.length ? false : currentCorrect,
      answeredAt: new Date().toISOString(),
    }
    saveStoredWebChoiceAttempt(card.id, attempt)
    setSkipped(Boolean(attempt.skipped))
    setRevealed(true)
    onAttempt?.(card, attempt)
  }

  function reset() {
    const attempt = { selected: [], revealed: false, skipped: false, correct: false }
    setSelected([])
    setRevealed(false)
    setSkipped(false)
    saveStoredWebChoiceAttempt(card.id, attempt)
    onReset?.(card, attempt)
  }

  const analysisHtml = sanitizeTrustedCardHtml(card.analysis || '', mediaBaseUrl)
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < total - 1

  return (
    <article className={`web-choice-question ${compact ? 'compact' : ''}`}>
      {total > 0 ? (
        <div className="web-choice-practice-bar">
          <button type="button" className="web-choice-nav-btn" onClick={onPrev} disabled={!canGoPrev}>上一题</button>
          <div className="web-choice-practice-progress">
            <strong>{currentIndex + 1}</strong>
            <span>/ {total}</span>
          </div>
          <button type="button" className="web-choice-nav-btn" onClick={onNext} disabled={!canGoNext}>下一题</button>
        </div>
      ) : null}

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

      <div className="web-choice-actions practice-actions">
        {!revealed ? (
          <>
            <button
              type="button"
              className="web-choice-primary"
              onClick={() => finishAttempt({ direct: false })}
              disabled={!hasSelection}
              title={hasSelection ? '提交并判定正误' : '先选择一个选项'}
            >
              提交答案
            </button>
            <button type="button" className="web-choice-secondary" onClick={() => finishAttempt({ direct: true })}>
              直接看答案
            </button>
          </>
        ) : (
          <>
            <button type="button" className="web-choice-primary" onClick={onNext} disabled={!canGoNext}>
              下一题
            </button>
            <button type="button" className="web-choice-secondary" onClick={reset}>
              重做本题
            </button>
          </>
        )}
        {showNext && !revealed ? (
          <button type="button" className="web-choice-next" onClick={onNext} disabled={!canGoNext}>
            跳过
          </button>
        ) : null}
      </div>

      {revealed ? (
        <section className={`web-choice-answer-panel ${currentCorrect ? 'is-correct' : 'is-wrong'}`}>
          <div className="web-choice-result-title">
            {skipped ? '已查看答案' : currentCorrect ? '回答正确' : '回答错误'}
          </div>
          <div className="web-choice-answer-line">
            <strong>正确答案：</strong>
            <span>{answers.join('、') || '暂无'}</span>
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
