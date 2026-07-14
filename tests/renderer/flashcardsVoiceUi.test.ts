import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/renderer/src/views/FlashcardsReviewView.vue', 'utf8')

describe('flashcards voice UI contract', () => {
  it('gates the voice action behind flashcards_voice_agent', () => {
    expect(source).toContain('flashcards_voice_agent')
    expect(source).toContain('Mit Wolpi sprechen')
  })

  it('renders voice status and assessment result copy', () => {
    expect(source).toContain('Hört zu')
    expect(source).toContain('Bewertet')
    expect(source).toContain('Antwort konnte nicht sicher bewertet werden')
  })
})
