import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SupabaseSyncClient } from '@main/services/supabaseSyncClient'

const originalCwd = process.cwd()
const originalEnv = {
  JURA_SYNC_SUPABASE_ANON_KEY: process.env.JURA_SYNC_SUPABASE_ANON_KEY,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  ANON_KEY: process.env.ANON_KEY
}

let tempDir: string | null = null

afterEach(async () => {
  process.chdir(originalCwd)
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

describe('SupabaseSyncClient configuration', () => {
  it('reads the public sync key from a local env file for desktop development', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jura-sync-config-'))
    process.chdir(tempDir)
    delete process.env.JURA_SYNC_SUPABASE_ANON_KEY
    delete process.env.VITE_SUPABASE_ANON_KEY
    delete process.env.ANON_KEY
    await writeFile(join(tempDir, '.env'), 'ANON_KEY=local-anon-key\n')

    expect(() => new SupabaseSyncClient()).not.toThrow()
  })
})
