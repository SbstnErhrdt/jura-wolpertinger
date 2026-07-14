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

  it('locks review controls and disposes late voice starts while a conversation is active', () => {
    expect(source).toContain(':disabled="!canGoPrevious || ratingBusy || voiceInProgress"')
    expect(source).toContain(':disabled="ratingBusy || voiceInProgress"')
    expect(source).toContain(':disabled="voiceInProgress"')
    expect(source).toContain('if (voiceInProgress.value) return')
    expect(source).toContain('voiceRequestGeneration')
    expect(source).toContain('client.stop()')
    expect(source).toContain('const completionGeneration = voiceRequestGeneration')
    expect(source).toContain('if (!isCurrentVoiceRequest(completionGeneration)) return')
  })
})
