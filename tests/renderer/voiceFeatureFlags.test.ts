import { describe, expect, it } from 'vitest'
import { hasFeatureFlag } from '../../src/renderer/src/voice/featureFlags'

describe('voice feature flags', () => {
  it('treats missing flags as disabled', () => {
    expect(hasFeatureFlag({}, 'flashcards_voice_agent')).toBe(false)
  })

  it('reads enabled voice flag', () => {
    expect(hasFeatureFlag({ flashcards_voice_agent: true }, 'flashcards_voice_agent')).toBe(true)
  })
})
