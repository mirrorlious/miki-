import { getDeckOptionLabel, groupDecksBySection } from '../lib/deckUtils.js'

function DeckSelectOptions({ decks }) {
  return groupDecksBySection(decks).map((group) => (
    <optgroup key={group.section} label={group.section}>
      {group.decks.map((deck) => (
        <option key={deck.id} value={deck.id}>{getDeckOptionLabel(deck)}</option>
      ))}
    </optgroup>
  ))
}

export default DeckSelectOptions
