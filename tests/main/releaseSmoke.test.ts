import { describe, expect, it, vi } from 'vitest'
import { handleReleaseSmokeRendererReady } from '../../src/main/releaseSmoke'
import { RELEASE_SMOKE_MARKER } from '../../src/shared/releaseSmoke'

describe('handleReleaseSmokeRendererReady', () => {
  it('emits the fixed marker and quits only when release smoke mode is enabled', () => {
    const writeMarker = vi.fn()
    const quit = vi.fn()

    expect(
      handleReleaseSmokeRendererReady({
        env: { JURA_RELEASE_SMOKE: '1' },
        writeMarker,
        quit
      })
    ).toBe(true)
    expect(writeMarker).toHaveBeenCalledWith(RELEASE_SMOKE_MARKER)
    expect(quit).toHaveBeenCalledOnce()
  })

  it('preserves normal startup when release smoke mode is disabled', () => {
    const writeMarker = vi.fn()
    const quit = vi.fn()

    expect(handleReleaseSmokeRendererReady({ env: {}, writeMarker, quit })).toBe(false)
    expect(writeMarker).not.toHaveBeenCalled()
    expect(quit).not.toHaveBeenCalled()
  })
})
