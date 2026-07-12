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

  it('keeps section navigation active on every nested route', async () => {
    const app = await readFile(resolve(rendererRoot, 'App.vue'), 'utf8')

    expect(app).toContain('const homeNavigationItems = computed')
    expect(app).toContain('const flashcardNavigationItems = computed')
    expect(app).toContain('const examNavigationItems = computed')
    expect(app).toContain('const mobileNavigationItems = computed')
    expect(app).toContain("route.path.startsWith('/flashcards')")
    expect(app).toContain("route.path.startsWith('/exams')")
    expect(app).toContain("route.path.startsWith('/more')")
    expect(app).toContain("['flashcards-collections', 'flashcards-collection'].includes(String(route.name))")
    expect(app).toContain("['dashboard', 'exam', 'exam-focus'].includes(String(route.name))")
  })

  it('maps the existing theme state to the dark class used by Nuxt UI', async () => {
    const theme = await readFile(resolve(rendererRoot, 'theme.ts'), 'utf8')

    expect(theme).toContain("document.documentElement.classList.toggle('dark', theme.value === 'dark')")
    expect(theme).toContain("document.documentElement.classList.toggle('light', theme.value === 'light')")
  })

  it('defines consistent sidebar hover, active, focus and dark interaction states', async () => {
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(styles).toMatch(/\.nav a:hover\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.nav a\[data-active\]\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.nav a\.router-link-active\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.nav a:focus-visible\s*\{[^}]*outline:\s*2px solid/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.nav a:hover\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.nav a\[data-active\]\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.nav a\.router-link-active\s*\{[^}]*background:/s)
  })
})
