import { motion } from 'framer-motion'
import CardContent from './CardContent.jsx'

function getStudySideLabel({ section, revealed, isDrill }) {
  if (section === 'note') return 'Note'
  if (section === 'back' || revealed || String(section || '').startsWith('section:')) return 'Back'
  return isDrill ? 'Drill · Front' : 'Front'
}

export default function StudyCardView({
  card,
  hasHtml,
  section,
  revealed,
  tabs,
  htmlSection,
  lastGrade,
  isDrill,
  deckLabel,
  stateLabel,
  notePanel,
  onSelectSection,
  onReveal,
}) {
  const sideLabel = getStudySideLabel({ section, revealed, isDrill })

  return (
    <motion.div key={card.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl bg-white/90 border border-white shadow-sm mb-4 min-h-[460px] flex flex-col overflow-hidden ${hasHtml ? 'text-left' : 'text-center'}`}>
      <div className="h-10 border-b border-gray-200 px-4 flex items-center justify-between gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-2">
          {sideLabel}
          {hasHtml && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600">HTML</span>}
        </span>
        <span className="truncate text-right">{deckLabel} · {stateLabel}</span>
      </div>

      <div className={`flex-1 flex flex-col ${hasHtml ? 'justify-start p-4 sm:p-6' : 'justify-center p-10'}`}>
        <div className={`mb-5 flex flex-wrap items-center gap-2 text-xs font-black ${hasHtml ? 'justify-start' : 'justify-center'}`}>
          {card.favorite && <span className="rounded-lg bg-yellow-50 px-2 py-1 text-yellow-700">收藏</span>}
          {card.flagged && <span className="rounded-lg bg-red-50 px-2 py-1 text-red-600">重点</span>}
          {lastGrade && <span className={`rounded-lg px-2 py-1 ${lastGrade.badgeClass}`}>上次 {lastGrade.title}</span>}
          {card.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-lg bg-gray-100 px-2 py-1 text-gray-500">{tag}</span>
          ))}
        </div>
        {hasHtml && (
          <div className="mb-6 flex max-w-full flex-wrap justify-start gap-1 self-stretch rounded-xl bg-gray-100 p-1 text-xs font-black">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSelectSection(tab.key)}
                className={`h-8 rounded-lg px-3 ${section === tab.key ? 'bg-white text-[#007aff] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {hasHtml && section === 'note' ? (
          notePanel
        ) : hasHtml && htmlSection && revealed ? (
          <div className="mx-auto w-full max-w-full">
            <p className="text-xs font-bold text-gray-400 mb-4">{htmlSection.label}</p>
            <CardContent
              card={card}
              side="back"
              htmlOverride={htmlSection.html}
              textOverride={htmlSection.text}
              className="mx-auto w-full max-w-full text-left text-base font-normal text-gray-800 leading-relaxed break-words"
              fallbackClassName="mx-auto w-full max-w-full text-left text-base font-normal text-gray-800 leading-relaxed break-words whitespace-pre-wrap"
            />
          </div>
        ) : (
          <>
            {(!hasHtml || section === 'front' || !revealed) && (
              <CardContent
                card={card}
                side="front"
                className={hasHtml ? 'mx-auto w-full max-w-full text-left text-base font-normal text-gray-900 leading-relaxed break-words' : 'mx-auto max-w-full text-3xl font-black text-gray-950 leading-relaxed break-words'}
                fallbackClassName={hasHtml ? 'mx-auto w-full max-w-full text-left text-base font-normal text-gray-900 leading-relaxed break-words whitespace-pre-wrap' : 'mx-auto max-w-full text-3xl font-black text-gray-950 leading-relaxed break-words whitespace-pre-wrap'}
              />
            )}

            {!revealed ? (
              <button type="button" onClick={onReveal} title="显示答案" className="mt-12 mx-auto h-11 w-[170px] rounded-xl bg-[#ff9f0a] text-white text-sm font-bold hover:bg-[#f59600]">显示答案</button>
            ) : (
              (!hasHtml || section === 'back') && (
                <div className={hasHtml ? '' : 'mt-10 pt-8 border-t border-gray-200'}>
                  {!hasHtml && <p className="text-xs font-bold text-gray-400 mb-4">Back</p>}
                  <CardContent
                    card={card}
                    side="back"
                    className={hasHtml ? 'mx-auto w-full max-w-full text-left text-base font-normal text-gray-800 leading-relaxed break-words' : 'mx-auto max-w-full text-xl text-gray-800 leading-relaxed break-words'}
                    fallbackClassName={hasHtml ? 'mx-auto w-full max-w-full text-left text-base font-normal text-gray-800 leading-relaxed break-words whitespace-pre-wrap' : 'mx-auto max-w-full text-xl text-gray-800 leading-relaxed break-words whitespace-pre-wrap'}
                  />
                  {!hasHtml && card.comment && <p className="mt-5 rounded-xl bg-gray-50 px-4 py-3 text-left text-sm leading-relaxed text-gray-500">{card.comment}</p>}
                </div>
              )
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
