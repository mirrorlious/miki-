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
const COUNTDOWN_STORAGE_KEY = 'miki.zh2000.countdown'
const DEFAULT_COUNTDOWN = {
  title: '距离考研初试',
  date: '2026-12-20',
  note: '把每天的选择题都变成确定感。',
}

function isCorrectSelection(selected = [], answers = []) {
  const answerSet = new Set(answers || [])
  return selected.length === answerSet.size && selected.every((letter) => answerSet.has(letter))
}

function getOptionLabel(index) {
  const labels = ['OPTION', 'MEMORY', 'KNOWLEDGE', 'STORY']
  return labels[index] || `CHOICE ${index + 1}`
}

function readCountdownConfig() {
  try {
    const raw = window.localStorage?.getItem(COUNTDOWN_STORAGE_KEY)
    if (!raw) return DEFAULT_COUNTDOWN
    const parsed = JSON.parse(raw)
    return {
      title: String(parsed?.title || DEFAULT_COUNTDOWN.title),
      date: String(parsed?.date || DEFAULT_COUNTDOWN.date),
      note: String(parsed?.note || DEFAULT_COUNTDOWN.note),
    }
  } catch {
    return DEFAULT_COUNTDOWN
  }
}

function saveCountdownConfig(config) {
  try {
    window.localStorage?.setItem(COUNTDOWN_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Ignore storage failures.
  }
}

function getCountdownDays(dateText) {
  const target = new Date(`${dateText || DEFAULT_COUNTDOWN.date}T00:00:00+08:00`)
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.ceil((targetDay.getTime() - today.getTime()) / 86400000)
}

function normalizeAttempt(attempt = null) {
  return {
    selected: Array.isArray(attempt?.selected) ? attempt.selected : [],
    revealed: Boolean(attempt?.revealed),
    skipped: Boolean(attempt?.skipped),
  }
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
  const [selected, setSelected] = useState(() => normalizeAttempt(previousAttempt).selected)
  const [revealed, setRevealed] = useState(() => normalizeAttempt(previousAttempt).revealed)
  const [skipped, setSkipped] = useState(() => normalizeAttempt(previousAttempt).skipped)
  const [countdown, setCountdown] = useState(readCountdownConfig)

  useEffect(() => {
    const attempt = normalizeAttempt(storedAttempt || getStoredWebChoiceAttempt(card?.id))
    setSelected(attempt.selected)
    setRevealed(attempt.revealed)
    setSkipped(attempt.skipped)
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
  const analysisHtml = sanitizeTrustedCardHtml(card.analysis || '', mediaBaseUrl)
  const hasTotal = total > 0
  const canGoPrev = hasTotal ? currentIndex > 0 : Boolean(onPrev)
  const canGoNext = hasTotal ? currentIndex < total - 1 : Boolean(onNext)
  const progressNow = hasTotal ? currentIndex + 1 : Number(card.number || 0) || 1
  const progressTotal = hasTotal ? total : 5
  const countdownDays = getCountdownDays(countdown.date)

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
      wrongBook,
      answeredAt: new Date().toISOString(),
    }
    saveStoredWebChoiceAttempt(card.id, attempt)
    setSkipped(Boolean(attempt.skipped))
    setRevealed(true)
    onAttempt?.(card, attempt)
  }

  function reset() {
    const attempt = { selected: [], revealed: false, skipped: false, correct: false, wrongBook }
    setSelected([])
    setRevealed(false)
    setSkipped(false)
    saveStoredWebChoiceAttempt(card.id, attempt)
    onReset?.(card, attempt)
  }

  function editCountdown() {
    const title = window.prompt('倒计时标题', countdown.title)
    if (title === null) return
    const date = window.prompt('目标日期，格式 YYYY-MM-DD', countdown.date)
    if (date === null) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      window.alert('日期格式要写成 YYYY-MM-DD，比如 2026-12-20。')
      return
    }
    const note = window.prompt('底部提示文字', countdown.note)
    if (note === null) return
    const next = { title: title.trim() || DEFAULT_COUNTDOWN.title, date: date.trim(), note: note.trim() || DEFAULT_COUNTDOWN.note }
    setCountdown(next)
    saveCountdownConfig(next)
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

        <div className="wm-meta-row wm-meta-row-top">
          <span>{card.type}</span>
          {card.volume ? <span>{card.volume}</span> : null}
          {card.book ? <span>{card.book}</span> : null}
          {card.number ? <span>#{card.number}</span> : null}
        </div>

        <section className="wm-title-block">
          <div className="wm-blue-label">NOT JUST OPTIONS</div>
          <h2>{card.question}</h2>
        </section>

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
                提交
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

        <footer className="wm-countdown">
          <div>
            <span>COUNTDOWN</span>
            <p>{countdown.title}</p>
            <small>{countdown.date} · {countdown.note}</small>
          </div>
          <button type="button" onClick={editCountdown} title="编辑倒计时标题、日期和提示文字">编辑倒计时</button>
          <b>{countdownDays === null ? '--' : Math.max(0, countdownDays)}</b>
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
