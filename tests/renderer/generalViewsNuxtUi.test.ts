import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const viewsRoot = resolve(import.meta.dirname, '../../src/renderer/src/views')
const files = [
  'HomeView.vue',
  'FlashcardsHubView.vue',
  'ExamsHubView.vue',
  'MoreHubView.vue',
  'SettingsView.vue',
  'AboutView.vue',
  'HelpView.vue'
]

describe('general Nuxt UI views', () => {
  it.each(files)('%s has no native standard controls or legacy breadcrumb', async (file) => {
    const source = await readFile(resolve(viewsRoot, file), 'utf8')

    expect(source).not.toMatch(/<(button|input|select|textarea)\b/)
    expect(source).not.toContain("components/ui/AppBreadcrumb.vue")
  })

  it('uses Nuxt UI for navigation cards, feedback, forms, and dialogs', async () => {
    const sources = await Promise.all(files.map((file) => readFile(resolve(viewsRoot, file), 'utf8')))
    const combined = sources.join('\n')

    expect(combined).toContain('<UBreadcrumb')
    expect(combined).toContain('<UButton')
    expect(combined).toContain('<UPageCard')
    expect(combined).toContain('<UCard')
    expect(combined).toContain('<UAlert')
    expect(combined).toContain('<UFormField')
    expect(combined).toContain('<UInput')
    expect(combined).toContain('<USelect')
    expect(combined).toContain('<UModal')
  })

  it('keeps About and Hilfe aligned with current flashcard workflows', async () => {
    const about = await readFile(resolve(viewsRoot, 'AboutView.vue'), 'utf8')
    const help = await readFile(resolve(viewsRoot, 'HelpView.vue'), 'utf8')
    const agents = await readFile(resolve(import.meta.dirname, '../../AGENTS.md'), 'utf8')

    expect(about).toContain('Karteikarten')
    expect(about).toContain('Lokal und online')
    expect(about).toContain('KI-Korrektur')
    expect(help).toContain('Wie erstelle ich Karteikarten?')
    expect(help).toContain('Wie wiederhole ich Karteikarten?')
    expect(help).toContain('Wie lösche ich Karteikarten?')
    expect(help).toContain('Schlagwörter')
    expect(agents).toContain('AboutView.vue')
    expect(agents).toContain('HelpView.vue')
  })
})
