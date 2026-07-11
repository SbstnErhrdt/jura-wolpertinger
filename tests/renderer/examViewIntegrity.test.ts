import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(import.meta.dirname, '../../src/renderer/src')

describe('protected exam view', () => {
  it('does not use Nuxt UI components', async () => {
    const [examView, examEditor] = await Promise.all([
      readFile(resolve(rendererRoot, 'views/ExamView.vue'), 'utf8'),
      readFile(resolve(rendererRoot, 'components/ExamEditor.vue'), 'utf8')
    ])

    expect(examView).not.toMatch(/<U[A-Z]/)
    expect(examEditor).not.toMatch(/<U[A-Z]/)
  })

  it('retains the reference view and editor structure', async () => {
    const [examView, examEditor] = await Promise.all([
      readFile(resolve(rendererRoot, 'views/ExamView.vue'), 'utf8'),
      readFile(resolve(rendererRoot, 'components/ExamEditor.vue'), 'utf8')
    ])

    expect(examView).toContain("class=\"exam-view\"")
    expect(examView).toContain("'focus-view': focusMode")
    expect(examView).toContain('class="exam-session-header"')
    expect(examView).toContain('class="dialog-card"')
    expect(examEditor).toContain('class="editor-frame"')
    expect(examEditor).toContain('class="editor-toolbar"')
    expect(examEditor).toContain("class: 'exam-editor-surface'")

    const toolbarTitles = [...examEditor.matchAll(/title="([^"]+)"/g)].map((match) => match[1])
    expect(toolbarTitles.slice(0, 14)).toEqual([
      'Rückgängig',
      'Wiederholen',
      'Ausschneiden',
      'Kopieren',
      'Einfügen',
      'Fett',
      'Kursiv',
      'Unterstreichen',
      'Hervorheben',
      'Schriftgröße',
      'Ausrichtung',
      'Einzug vergrößern',
      'Einzug verkleinern',
      'Drucken'
    ])
  })
})
