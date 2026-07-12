import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('release smoke integration', () => {
  it('waits for an explicit renderer-ready IPC signal', async () => {
    const [mainSource, preloadSource, rendererSource] = await Promise.all([
      readSource('../../src/main/index.ts'),
      readSource('../../src/preload/index.ts'),
      readSource('../../src/renderer/src/App.vue')
    ])

    expect(mainSource).not.toContain("webContents.once('did-finish-load'")
    expect(mainSource).toContain('RELEASE_SMOKE_READY_CHANNEL')
    expect(preloadSource).toContain('RELEASE_SMOKE_READY_EVENT')
    expect(preloadSource).toContain('ipcRenderer.send(RELEASE_SMOKE_READY_CHANNEL)')
    expect(rendererSource).toMatch(
      /await nextTick\(\)[\s\S]*dispatchEvent\(new Event\(RELEASE_SMOKE_READY_EVENT\)\)/
    )
  })

  it('redirects Electron userData before app readiness in smoke mode', async () => {
    const mainSource = await readSource('../../src/main/index.ts')
    const setPathIndex = mainSource.indexOf("app.setPath('userData'")
    const configureCallIndex = mainSource.indexOf('configureReleaseSmokeUserDataPath()')
    const whenReadyIndex = mainSource.indexOf('app.whenReady()')

    expect(setPathIndex).toBeGreaterThan(-1)
    expect(configureCallIndex).toBeGreaterThan(-1)
    expect(configureCallIndex).toBeLessThan(whenReadyIndex)
  })
})

function readSource(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
}
