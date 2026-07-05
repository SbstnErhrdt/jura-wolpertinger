import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('auth gate copy', () => {
  it('does not show backend vendor wording in the missing login setup message', async () => {
    const source = await readFile(resolve(rendererRoot, 'cloudAuth.ts'), 'utf8')
    const missingConfigMessage = source.match(/error: '([^']+)'/)?.[1] ?? ''

    expect(missingConfigMessage).toBe(
      'Die Anmeldung ist gerade nicht eingerichtet. Bitte versuche es später erneut.'
    )
    expect(missingConfigMessage).not.toMatch(/supabase|auth|api|backend|konfiguriert/i)
  })
})
