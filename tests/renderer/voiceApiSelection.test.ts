import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppApi } from '../../src/shared/ipc'

describe('Voice API selection', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('keeps Voice calls on Electron IPC even when a renderer online client is configured', async () => {
    const desktopApi = createDesktopApi()
    const rpc = vi.fn().mockResolvedValue({ data: { flashcards_voice_agent: true }, error: null })
    vi.stubGlobal('window', { juraApi: desktopApi })
    vi.doMock('../../src/renderer/src/cloudAuth', () => ({
      requiresCloudAuth: () => false,
      getSupabaseAuthClient: () => ({ rpc })
    }))

    const apiModulePath = '../../src/renderer/src/api'
    const { getApi } = await import(/* @vite-ignore */ apiModulePath)
    const api = getApi()

    await expect(api.getFeatureFlags()).resolves.toEqual({})
    await expect(api.createVoiceReviewSession({ promptId: 'prompt-1' })).rejects.toThrow(
      'Bitte verbinde dein Online-Konto, um Voice zu nutzen.'
    )

    expect(rpc).not.toHaveBeenCalled()
    expect(desktopApi.getFeatureFlags).toHaveBeenCalledOnce()
    expect(desktopApi.createVoiceReviewSession).toHaveBeenCalledWith({ promptId: 'prompt-1' })
  })

  it('keeps the Electron Voice IPC methods when no online client is available', async () => {
    const desktopApi = createDesktopApi()
    vi.stubGlobal('window', { juraApi: desktopApi })
    vi.doMock('../../src/renderer/src/cloudAuth', () => ({
      requiresCloudAuth: () => false,
      getSupabaseAuthClient: () => null,
      getVoiceSupabaseAuthClient: () => null
    }))

    const apiModulePath = '../../src/renderer/src/api'
    const { getApi } = await import(/* @vite-ignore */ apiModulePath)
    const api = getApi()

    await expect(api.getFeatureFlags()).resolves.toEqual({})
    await expect(api.createVoiceReviewSession({ promptId: 'prompt-1' })).rejects.toThrow(
      'Bitte verbinde dein Online-Konto, um Voice zu nutzen.'
    )
    expect(desktopApi.getFeatureFlags).toHaveBeenCalledOnce()
    expect(desktopApi.createVoiceReviewSession).toHaveBeenCalledWith({ promptId: 'prompt-1' })
  })
})

function createDesktopApi(): AppApi {
  return {
    getFeatureFlags: vi.fn().mockResolvedValue({}),
    createVoiceReviewSession: vi.fn().mockRejectedValue(
      new Error('Bitte verbinde dein Online-Konto, um Voice zu nutzen.')
    )
  } as unknown as AppApi
}
