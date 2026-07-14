import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppApi } from '../../src/shared/ipc'

describe('Voice API selection', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('uses the online Voice client in Electron when an online client is configured', async () => {
    const desktopApi = createDesktopApi()
    const rpc = vi.fn().mockResolvedValue({ data: { flashcards_voice_agent: true }, error: null })
    const createVoiceReviewSession = vi.fn()
    const completeVoiceReviewSession = vi.fn()
    vi.stubGlobal('window', { juraApi: desktopApi })
    vi.doMock('../../src/renderer/src/cloudAuth', () => ({
      requiresCloudAuth: () => false,
      getSupabaseAuthClient: () => null,
      getVoiceSupabaseAuthClient: () => ({ rpc })
    }))
    vi.doMock('../../src/renderer/src/voice/voiceApi', () => ({
      createVoiceReviewSession,
      completeVoiceReviewSession
    }))

    const apiModulePath = '../../src/renderer/src/api'
    const { getApi } = await import(/* @vite-ignore */ apiModulePath)
    const api = getApi()

    await expect(api.getFeatureFlags()).resolves.toEqual({ flashcards_voice_agent: true })
    await api.createVoiceReviewSession({ promptId: 'prompt-1' })

    expect(rpc).toHaveBeenCalledWith('get_effective_feature_flags')
    expect(desktopApi.getFeatureFlags).not.toHaveBeenCalled()
    expect(createVoiceReviewSession).toHaveBeenCalledWith({ promptId: 'prompt-1' })
    expect(desktopApi.createVoiceReviewSession).not.toHaveBeenCalled()
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
