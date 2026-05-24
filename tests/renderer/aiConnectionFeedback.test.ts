import { describe, expect, it } from 'vitest'
import { aiConnectionFallbackMessage } from '@shared/aiConnectionFeedback'

describe('AI connection feedback', () => {
  it('does not blame key or model when the active IPC test crashes before returning a result', () => {
    expect(aiConnectionFallbackMessage('active')).toBe(
      'Verbindungstest konnte nicht gestartet werden. Bitte App komplett neu starten, damit Main und Preload aktualisiert sind.'
    )
  })

  it('names the environment source when the explicit .env test crashes before returning a result', () => {
    expect(aiConnectionFallbackMessage('environment')).toBe(
      '.env-Verbindungstest konnte nicht gestartet werden. Bitte App komplett neu starten, damit Main und Preload aktualisiert sind.'
    )
  })
})
