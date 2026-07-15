import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('home UI affordances', () => {
  it('sizes adjacent hero actions consistently through Nuxt UI', async () => {
    const view = await readFile(resolve(rendererRoot, 'views/HomeView.vue'), 'utf8')

    expect(view).toContain('<div class="home-actions">')
    expect(view).toContain('class="primary-action"')
    expect([...view.matchAll(/<UButton[^>]*size="lg"/g)]).toHaveLength(2)
    expect(view).toContain("name: 'flashcards-review'")
    expect(view).toContain("name: 'dashboard'")
  })

  it('prompts signed-in cloud users to complete their profile in a modal', async () => {
    const view = await readFile(resolve(rendererRoot, 'views/HomeView.vue'), 'utf8')

    expect(view).toContain('profilePromptVisible')
    expect(view).toContain('Wie dürfen wir dich ansprechen?')
    expect(view).toContain('Profil vervollständigen')
    expect(view).toContain('<UModal')
    expect(view).toContain('Vorname')
    expect(view).toContain('Nachname')
    expect(view).toContain('api.getUserProfile()')
    expect(view).toContain('api.updateUserProfile')
  })
})
