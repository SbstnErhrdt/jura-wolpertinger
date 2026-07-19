import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readDesktopSyncBuildConfig,
  requireDesktopSyncBuildConfig
} from '../../scripts/desktop-sync-build-config'

let tempDir: string | null = null

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true })
  tempDir = null
})

describe('desktop sync build configuration', () => {
  it('loads the public key from the adjacent local Supabase environment', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jura-desktop-build-config-'))
    const appDir = join(tempDir, 'app')
    const supabaseDir = join(tempDir, 'jura-supabase')
    await mkdir(appDir)
    await mkdir(supabaseDir)
    await writeFile(join(supabaseDir, '.env'), 'ANON_KEY=adjacent-anon-key\n')

    expect(readDesktopSyncBuildConfig(appDir, {})).toEqual({
      url: 'https://app.jura-wolpi.de/api',
      anonKey: 'adjacent-anon-key'
    })
  })

  it('prefers an explicit release environment over local files', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jura-desktop-build-config-'))
    await writeFile(join(tempDir, '.env'), 'JURA_SYNC_SUPABASE_ANON_KEY=local-key\n')

    expect(
      readDesktopSyncBuildConfig(tempDir, {
        JURA_SYNC_SUPABASE_URL: 'https://sync.example.test/api',
        JURA_SYNC_SUPABASE_ANON_KEY: 'release-key'
      })
    ).toEqual({
      url: 'https://sync.example.test/api',
      anonKey: 'release-key'
    })
  })

  it('rejects a release build without a public sync key', () => {
    expect(() =>
      requireDesktopSyncBuildConfig({
        url: 'https://app.jura-wolpi.de/api',
        anonKey: ''
      })
    ).toThrow('JURA_SYNC_SUPABASE_ANON_KEY')
  })
})
