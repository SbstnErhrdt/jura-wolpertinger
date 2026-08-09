import { afterEach, describe, expect, it, vi } from 'vitest'

describe('renderer API selection', () => {
  afterEach(() => {
    vi.doUnmock('../../src/renderer/src/cloudAuth')
    vi.doUnmock('../../src/renderer/src/cloudLearningApi')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('does not report the browser development fallback in the cloud app', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined
    })
    vi.doMock('../../src/renderer/src/cloudAuth', () => ({
      getSupabaseAuthClient: () => ({ auth: {} }),
      requiresCloudAuth: () => true
    }))
    vi.doMock('../../src/renderer/src/cloudLearningApi', () => ({
      createCloudLearningApi: (localApi: unknown) => localApi
    }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const apiModulePath = '../../src/renderer/src/api'

    await import(/* @vite-ignore */ apiModulePath)

    expect(warn).not.toHaveBeenCalledWith(
      'Electron API bridge is not available. Using browser-only localStorage fallback for development.'
    )
  })
})
