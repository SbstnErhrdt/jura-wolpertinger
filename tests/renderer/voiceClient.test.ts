import { describe, expect, it } from 'vitest'
import { parseRealtimeEvent } from '../../src/renderer/src/voice/voiceClient'

describe('voice realtime event parser', () => {
  it('parses a valid assessment from completed function-call arguments', () => {
    const parsed = parseRealtimeEvent(JSON.stringify({
      type: 'response.function_call_arguments.done',
      name: 'assess_flashcard_answer',
      arguments: JSON.stringify({
        rating: 3,
        confidence: 'medium',
        reason: 'Die Voraussetzungen wurden richtig benannt.',
        matched_points: ['Voraussetzungen'],
        missed_points: [],
        next_step: 'Pruefe als Naechstes die Rechtsfolge.'
      })
    }))

    expect(parsed?.assessment).toEqual({
      rating: 3,
      confidence: 'medium',
      reason: 'Die Voraussetzungen wurden richtig benannt.',
      matched_points: ['Voraussetzungen'],
      missed_points: [],
      next_step: 'Pruefe als Naechstes die Rechtsfolge.'
    })
  })

  it('keeps transcript deltas without treating arbitrary event data as an assessment', () => {
    const parsed = parseRealtimeEvent(JSON.stringify({
      type: 'response.output_audio_transcript.delta',
      delta: 'Die Anspruchsgrundlage ist '
    }))

    expect(parsed).toEqual({ transcript: 'Die Anspruchsgrundlage ist ' })
  })

  it('rejects incomplete function-call arguments', () => {
    const parsed = parseRealtimeEvent(JSON.stringify({
      type: 'response.function_call_arguments.done',
      arguments: JSON.stringify({ rating: 3, confidence: 'medium' })
    }))

    expect(parsed?.assessment).toBeUndefined()
  })
})
