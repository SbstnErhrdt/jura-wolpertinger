import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('settings profile UI', () => {
  it('lets users view and edit their profile from settings through a modal', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/SettingsView.vue'), 'utf8')

    expect(source).toContain('<h2>Profil</h2>')
    expect(source).toContain('profileDisplayName')
    expect(source).toContain('Profil bearbeiten')
    expect(source).toContain('<UModal :open="showProfileModal"')
    expect(source).toContain('Vorname')
    expect(source).toContain('Nachname')
    expect(source).toContain('api.getUserProfile()')
    expect(source).toContain('api.updateUserProfile')
    expect(source).not.toMatch(/Supabase|JSON|RLS/)
  })
})
