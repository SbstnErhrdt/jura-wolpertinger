import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { hasFeatureFlag } from '../../src/renderer/src/voice/featureFlags'

const source = readFileSync('src/renderer/src/views/FlashcardsReviewView.vue', 'utf8')

describe('flashcards voice UI contract', () => {
  it('gates the voice action behind flashcards_voice_agent', () => {
    expect(hasFeatureFlag({}, 'flashcards_voice_agent')).toBe(false)
    expect(hasFeatureFlag({ flashcards_voice_agent: true }, 'flashcards_voice_agent')).toBe(true)
    expect(source).toContain('featureFlags.value = await api.getFeatureFlags().catch(() => ({}))')
    expect(source).toContain("const voiceEnabled = computed(() => hasFeatureFlag(featureFlags.value, 'flashcards_voice_agent'))")
    expect(source).toMatch(/<UButton\s+v-if="voiceEnabled"[\s\S]*?>\s*Mit Wolpi sprechen\s*<\/UButton>/)
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

  it('keeps answer completion available after assessment and clears voice state on card changes', () => {
    expect(source).toContain('v-if="voiceClient && voiceInProgress"')
    expect(source).not.toContain(':disabled="voiceStatus === \'assessing\'"')
    expect(source).toContain('@click="finishVoiceReview"')
    expect(source).toContain('function clearVoiceReview(): void')
    expect(source).toContain("voiceStatus.value = 'idle'")
    expect(source).toContain('clearVoiceReview()')
  })

  it('handles voice navigation commands without recording a review', () => {
    expect(source).toContain('onCommand: (command) =>')
    expect(source).toContain('void handleVoiceCommand(command)')
    expect(source).toContain('async function handleVoiceCommand')
    expect(source).toContain("command === 'next_card'")
    expect(source).toContain("command === 'previous_card'")
    expect(source).toContain('await nextTick()')
    expect(source).toContain('void startVoiceReview()')
  })
})
