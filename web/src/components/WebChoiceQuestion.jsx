import React, { useEffect, useMemo, useState } from 'react'
import {
  getStoredWebChoiceAttempt,
  sanitizeTrustedCardHtml,
  saveStoredWebChoiceAttempt,
} from '../lib/webChoiceBank'
import { WEB_CHOICE_BANK_MEDIA_BASE_URL } from '../config/webChoiceBankConfig'
import './WebChoiceBank.css'
import './WebChoiceBank.drill.css'
import './WebChoiceWorldModel.css'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function isCorrectSelection(selected = [], answers = []) {
  const answerSet = new Set(answers || [])
  return selected.length === answerSet.size && selected.every((letter) => answerSet.has(letter))
}

function getOptionLabel(index) {
  const labels = ['OPTION', 'MEMORY', 'KNOWLEDGE', 'STORY']
  return labels[index] || `CHOICE ${index + 1}`
}

function stripHtmlToText(value = '') {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function makeTakeaway(card, revealed, answers, currentCorrect, skipped) {
  if (!revealed) return '先选，再看解析。把题目当作一个小场景来理解。'
  const analysisText = stripHtmlToText(card?.analysis || '')
  if (analysisText) return analysisText.slice(0, 78) + (analysisText.length > 78 ? '…' : '')
  if (skipped) return `本题正确答案：${answers.join('、') || '暂无'}。`
  return currentCorrect ? '这题已经打通，继续保持节奏。' : `关键变化：正确答案是 ${answers.join('、') || '暂无'}，回看选项差异。`
}

export default function WebChoiceQuestion({
  card,
  mediaBaseUrl = WEB_CHOICE_BANK_MEDIA_BASE_URL,
  storedAttempt = null,
  onAttempt,
  onReset,
  onPrev,
  onNext,
  onToggleWrongBook,
  wrongBook = false,
  showNext = false,
  compact = false,
  currentIndex = 0,
  total = 0,
}) {
  const previousAttempt = useMemo(() => storedAttempt || getStoredWebChoiceAttempt(card?.id), [card?.id, storedAttempt])
  const [selected, setSelected] = useState(previousAttempt?.selected || [])
  const [revealed, setRevealed] = useState(Boolean(previousAttempt?.revealed))
  const [skipped, setSkipped] = useState(Boolean(previousAttempt?.skipped))

  useEffect(() => {
    const attempt = storedAttempt || getStoredWebChoiceAttempt(card?.id)
    setSelected(attempt?.selected || [])
    setRevealed(Boolean(attempt?.revealed))
    setSkipped(Boolean(attempt?.skipped))
  }, [card?.id, storedAttempt])

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
  const analysisHtml = sanitizeTrustedCardHtml(card.analysis || '', mediaBaseUrl)
  const hasTotal = total > 0
  const canGoPrev = hasTotal ? currentIndex > 0 : Boolean(onPrev)
  const canGoNext = hasTotal ? currentIndex < total - 1 : Boolean(onNext)
  const progressNow = hasTotal ? currentIndex + 1 : Number(card.number || 0) || 1
  const progressTotal = hasTotal ? total : 5
  const takeaway = makeTakeaway(card, revealed, answers, currentCorrect, skipped)

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

  return (
    <article className={`web-choice-question web-choice-world ${compact ? 'compact' : ''}`}>
      {hasTotal ? (
        <div className="web-choice-practice-bar">
          <button type="button" className="web-choice-nav-btn" onClick={onPrev} disabled={!canGoPrev}>上一题</button>
          <div className="web-choice-practice-progress">
            <strong>{currentIndex + 1}</strong>
            <span>/ {total}</span>
          </div>
          <button type="button" className="web-choice-nav-btn" onClick={onNext} disabled={!canGoNext}>下一题</button>
        </div>
      ) : null}

      <div className="wm-card">
        <header className="wm-topline">
          <div className="wm-kicker">ZH2000 / {card.subject || 'QUESTION BANK'}</div>
          <div className="wm-count">{String(progressNow).padStart(2, '0')} / {String(progressTotal).padStart(2, '0')}</div>
        </header>

        <section className="wm-title-block">
          <div className="wm-blue-label">NOT JUST OPTIONS</div>
          <h2>{card.question}</h2>
        </section>

        <div className="wm-meta-row">
          <span>{card.type}</span>
          {card.volume ? <span>{card.volume}</span> : null}
          {card.book ? <span>{card.book}</span> : null}
          {card.number ? <span>#{card.number}</span> : null}
        </div>

        <div className="wm-option-grid">
          {(card.options || []).map((option, index) => {
            const letter = LETTERS[index]
            const picked = selectedSet.has(letter)
            const correct = answerSet.has(letter)
            const className = [
              'wm-option-card',
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
                <span className="wm-option-kicker">{letter} / {getOptionLabel(index)}</span>
                <strong>{option}</strong>
              </button>
            )
          })}
        </div>

        <div className="wm-actions">
          {!revealed ? (
            <>
              <button
                type="button"
                className="wm-primary"
                onClick={() => finishAttempt({ direct: false })}
                disabled={!hasSelection}
                title={hasSelection ? '提交并判定正误' : '先选择一个选项'}
              >
                提交答案
              </button>
              <button type="button" className="wm-secondary" onClick={() => finishAttempt({ direct: true })}>
                直接看答案
              </button>
              {showNext ? (
                <button type="button" className="wm-secondary" onClick={onNext} disabled={!canGoNext}>
                  跳过
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button type="button" className="wm-primary" onClick={onNext} disabled={!canGoNext}>
                下一题
              </button>
              <button type="button" className="wm-secondary" onClick={reset}>
                重做本题
              </button>
            </>
          )}
          <button type="button" className={`wm-secondary wm-wrong ${wrongBook ? 'active' : ''}`} onClick={() => onToggleWrongBook?.(card)}>
            {wrongBook ? '移出错题本' : '加入错题本'}
          </button>
        </div>

        <footer className="wm-takeaway">
          <div>
            <span>TAKEAWAY</span>
            <p>{takeaway}</p>
          </div>
          <b>{selected.length ? selected.join('') : '?'}</b>
        </footer>
      </div>

      {revealed ? (
        <section className={`web-choice-answer-panel wm-answer-panel ${currentCorrect ? 'is-correct' : 'is-wrong'}`}>
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
