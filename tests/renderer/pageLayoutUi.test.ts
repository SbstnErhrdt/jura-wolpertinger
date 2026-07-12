import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('page layout consistency', () => {
  it('uses shared page layout tokens and one wrapper rule for main pages', async () => {
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(styles).toContain('--page-max-width: 1120px')
    expect(styles).toContain('--page-padding: 28px')
    expect(styles).toContain('--page-gap: 22px')
    expect(styles).toContain('--page-title-size: 32px')
    expect(styles).toMatch(/\.home-view,\n\.dashboard,\n\.analytics-view,\n\.settings-view,\n\.about-view,\n\.help-view,\n\.flashcards-page,\n\.flashcard-review,\n\.mobile-hub-view\s*\{[^}]*max-width:\s*var\(--page-max-width\);[^}]*padding:\s*0;/s)
    expect(styles).toMatch(/\.main-pane\s*\{[^}]*padding:\s*var\(--page-padding\);/s)
  })

  it('keeps page titles on one shared scale outside intentional hero areas', async () => {
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(styles).toMatch(/\.page-header h1,\n\.review-header h1\s*\{[^}]*font-size:\s*var\(--page-title-size\);/s)
    expect(styles).not.toMatch(/\.page-header h1,\n\.review-header h1\s*\{[^}]*font-size:\s*42px;/s)
    expect(styles).not.toMatch(/\.page-header h1\s*\{[^}]*font-size:\s*28px;/s)
  })

  it('does not add a second mobile page padding inside wrappers', async () => {
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(styles).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.main-pane\s*\{[^}]*padding:\s*16px 16px 104px;/s)
    expect(styles).not.toMatch(/\.home-view,\n\s*\.flashcards-page,\n\s*\.flashcard-review,\n\s*\.mobile-hub-view\s*\{[^}]*padding:\s*16px;/s)
  })
})
