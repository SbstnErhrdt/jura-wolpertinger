import { describe, expect, it } from 'vitest'
import { resolveRuntimeDockIconPath } from '@main/appIdentity'

describe('resolveRuntimeDockIconPath', () => {
  it('does not override the macOS dock icon in packaged builds', () => {
    const iconPath = resolveRuntimeDockIconPath({
      platform: 'darwin',
      isPackaged: true,
      resolveAssetPath: (...segments) => segments.join('/')
    })

    expect(iconPath).toBeNull()
  })

  it('uses the generated icns in macOS development builds', () => {
    const iconPath = resolveRuntimeDockIconPath({
      platform: 'darwin',
      isPackaged: false,
      resolveAssetPath: (...segments) => segments.join('/')
    })

    expect(iconPath).toBe('build/icon.icns')
  })

  it('does not use png files as runtime dock icons', () => {
    const iconPath = resolveRuntimeDockIconPath({
      platform: 'darwin',
      isPackaged: false,
      resolveAssetPath: (...segments) => (segments.join('/') === 'build/icon.icns' ? '' : segments.join('/'))
    })

    expect(iconPath).toBeNull()
  })
})
