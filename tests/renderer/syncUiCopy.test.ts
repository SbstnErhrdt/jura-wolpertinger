import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('sync UI copy', () => {
  it('uses non-technical user-facing wording for online sync', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/SettingsView.vue'), 'utf8')
    const onlinePanel = source.slice(source.indexOf('<h2>Online-Version</h2>'), source.indexOf('<h2>Oberfläche</h2>'))

    expect(onlinePanel).toContain('Mit Online-Version verbinden')
    expect(onlinePanel).toContain('Lokale Daten online sichern')
    expect(onlinePanel).toContain('Online-Daten auf dieses Gerät holen')
    expect(onlinePanel).not.toMatch(/Supabase|JSON|Bucket|Storage|RLS/i)
    expect(onlinePanel).not.toContain(' API')
  })
})
