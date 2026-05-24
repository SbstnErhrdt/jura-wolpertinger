import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppApi } from '../../src/shared/ipc'

type LocalStorageMock = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

const storage = new Map<string, string>()
const localStorageMock: LocalStorageMock = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
}

describe('browser development API', () => {
  beforeEach(() => {
    storage.clear()
    vi.resetModules()
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', localStorageMock)
  })

  it('does not persist OpenAI API keys in localStorage', async () => {
    const apiModulePath = '../../src/renderer/src/api'
    const { getApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      getApi: () => AppApi
    }
    const api = getApi()

    const status = await api.saveAiSettings({
      provider: 'openai',
      apiKey: 'sk-test-secret',
      model: 'gpt-5'
    })

    expect(status.configured).toBe(true)
    expect(localStorageMock.getItem('jura-wolpertinger-browser-dev-v1')).not.toContain('sk-test-secret')
    expect(localStorageMock.getItem('jura-wolpertinger-browser-dev-v1')).not.toContain('apiKey')
  })
})
