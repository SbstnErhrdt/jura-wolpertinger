import { describe, expect, it } from 'vitest'
import { shouldShowAppWindows } from '@main/appWindowVisibility'

describe('shouldShowAppWindows', () => {
  it('keeps normal app launches visible', () => {
    expect(shouldShowAppWindows({})).toBe(true)
  })

  it('keeps automated E2E windows hidden by default', () => {
    expect(shouldShowAppWindows({ JURA_E2E: '1' })).toBe(false)
  })

  it('allows visible E2E windows for deliberate debugging', () => {
    expect(shouldShowAppWindows({ JURA_E2E: '1', JURA_E2E_SHOW: '1' })).toBe(true)
  })
})
