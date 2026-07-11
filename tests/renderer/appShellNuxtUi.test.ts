import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(import.meta.dirname, '../../src/renderer/src')

describe('Nuxt UI app shell', () => {
  it('uses Nuxt UI for navigation and standard controls', async () => {
    const app = await readFile(resolve(rendererRoot, 'App.vue'), 'utf8')

    expect(app).toContain('<UNavigationMenu')
    expect(app).toContain('<UButton')
    expect(app).toContain('<UInput')
    expect(app).toContain('<USelect')
    expect(app).toContain('<UModal')
    expect(app).not.toMatch(/<(button|input|select|textarea)\b/)
  })

  it('keeps every desktop and mobile destination', async () => {
    const app = await readFile(resolve(rendererRoot, 'App.vue'), 'utf8')

    for (const routeName of [
      'home',
      'flashcards',
      'flashcards-review',
      'flashcards-collections',
      'exams',
      'dashboard',
      'correction',
      'analytics',
      'more',
      'settings',
      'about',
      'help'
    ]) {
      expect(app).toContain(`name: '${routeName}'`)
    }

    for (const label of ['Home', 'Karteikarten', 'Prüfungen', 'Mehr']) {
      expect(app).toContain(`label: '${label}'`)
    }
  })

  it('maps the existing theme state to the dark class used by Nuxt UI', async () => {
    const theme = await readFile(resolve(rendererRoot, 'theme.ts'), 'utf8')

    expect(theme).toContain("document.documentElement.classList.toggle('dark', theme.value === 'dark')")
    expect(theme).toContain("document.documentElement.classList.toggle('light', theme.value === 'light')")
  })
})
