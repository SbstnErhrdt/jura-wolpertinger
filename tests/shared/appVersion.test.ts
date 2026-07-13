import { describe, expect, it } from 'vitest'
import packageJson from '../../package.json'
import { APP_VERSION } from '../../src/shared/constants'

describe('app version contract', () => {
  it('keeps the shared fallback version aligned with package.json', () => {
    expect(APP_VERSION).toBe(packageJson.version)
  })
})
