/// <reference lib="dom" />

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppApi } from '../../src/shared/ipc'

const tagTest = test.extend<{ tagApp: { page: Page; examId: string } }>({
  tagApp: async ({}, use) => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'jura-tag-input-e2e-'))
    const { ELECTRON_RENDERER_URL: _rendererUrl, ...env } = process.env
    let app: ElectronApplication | undefined
    try {
      app = await electron.launch({
        executablePath: join(process.cwd(), 'node_modules', '.bin', 'electron'),
        args: [`--user-data-dir=${userDataDir}`, 'out/main/index.js'],
        env: { ...env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true', JURA_E2E: '1' }
      })
      await expect.poll(() => app?.windows().find(page => page.url().startsWith('file:'))).toBeTruthy()
      const page = app.windows().find(page => page.url().startsWith('file:'))!
      await page.setViewportSize({ width: 1440, height: 1050 })
      await expect(page.locator('.home-view')).toBeVisible()
      await page.getByRole('button', { name: 'Später entscheiden' }).click()
      const examId = await page.evaluate(async () => {
        const api = (window as unknown as { juraApi: AppApi }).juraApi
        const source = await api.createExam({ title: 'Tag-Vorschläge', tags: ['Arbeitsrecht', 'Zivilrecht'] })
        const submission = await api.submitExam(source.id)
        const correction = await api.createCorrection(submission.id)
        await api.updateCorrection({ correctionId: correction.id, scorePoints: 10, gradingComment: '', tags: [] })
        const exam = await api.createExam({ title: 'Tag-Auswahl', tags: ['Vorhanden'] })
        window.location.hash = `/exams/${exam.id}`
        return exam.id
      })
      await expect(page.locator('.exam-view')).toBeVisible()
      await use({ page, examId })
    } finally {
      await app?.close()
      await rm(userDataDir, { recursive: true, force: true })
    }
  }
})
tagTest('clicking an exam tag suggestion saves the complete tag without the unfinished search', async ({ tagApp }) => {
  const { page, examId } = tagApp
  const input = page.locator('.tag-input-field')
  await input.fill('ziv')
  await page.getByRole('button', { name: 'Zivilrecht', exact: true }).click()
  await expect(page.locator('.tag-input-chip > span')).toHaveText(['Vorhanden', 'Zivilrecht'])
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await expect.poll(() => page.evaluate(async id => {
    const api = (window as unknown as { juraApi: AppApi }).juraApi
    return (await api.getExam(id)).tags
  }, examId)).toEqual(['Vorhanden', 'Zivilrecht'])
  await page.reload()
  await expect(page.locator('.tag-input-chip > span')).toHaveText(['Vorhanden', 'Zivilrecht'])
})

tagTest('clicking an analytics tag suggestion filters by the complete tag only', async ({ tagApp }) => {
  const { page } = tagApp
  await page.evaluate(() => { window.location.hash = '/exams/analytics' })
  await expect(page.locator('.analytics-view')).toBeVisible()
  await page.locator('.tag-input-field').fill('ziv')
  await page.getByRole('button', { name: 'Zivilrecht', exact: true }).click()
  await expect(page.locator('.tag-input-chip > span')).toHaveText(['Zivilrecht'])
  await expect(page.locator('.analytics-table-row')).toContainText('Tag-Vorschläge')
  await page.reload()
  await expect(page.locator('.tag-input-chip > span')).toHaveText(['Zivilrecht'])
})

tagTest('keeps free text submission with Enter and Tab and keyboard activation of suggestions', async ({ tagApp }) => {
  const { page } = tagApp
  const input = page.locator('.tag-input-field')
  const chips = page.locator('.tag-input-chip > span')
  await input.fill('Eigener Tag')
  await input.press('Enter')
  await expect(chips).toHaveText(['Eigener Tag', 'Vorhanden'])
  await input.fill('Weiterer Tag')
  await input.press('Tab')
  await expect(chips).toHaveText(['Eigener Tag', 'Vorhanden', 'Weiterer Tag'])
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await input.press('Tab')
  const suggestion = page.getByRole('button', { name: 'Arbeitsrecht', exact: true })
  await expect(suggestion).toBeFocused()
  await suggestion.press('Space')
  await expect(chips).toHaveText(['Arbeitsrecht', 'Eigener Tag', 'Vorhanden', 'Weiterer Tag'])
  await expect(input).toBeFocused()
})
