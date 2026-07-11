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
})
