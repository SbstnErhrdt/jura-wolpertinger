/// <reference lib="dom" />

import AxeBuilder from '@axe-core/playwright'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppApi } from '../../src/shared/ipc'

test('keeps breadcrumb typography, current state and ancestor navigation consistent throughout the app', async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'jura-breadcrumb-e2e-'))
  const { ELECTRON_RENDERER_URL: _rendererUrl, ...env } = process.env
  const app = await electron.launch({
    executablePath: join(process.cwd(), 'node_modules', '.bin', 'electron'),
    args: [`--user-data-dir=${userDataDir}`, 'out/main/index.js'],
    env: { ...env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true', JURA_E2E: '1' }
  })

  try {
    const page = await findMainWindow(app)
    await page.setViewportSize({ width: 1440, height: 1050 })
    await page.getByRole('button', { name: 'Später entscheiden' }).click()
    const ids = await page.evaluate(async () => {
      const api = (window as unknown as { juraApi: AppApi }).juraApi
      const folder = await api.createFolder('Kurs A')
      const exam = await api.createExam({ title: 'Prüfung in A', folderId: folder.id })
      const submission = await api.submitExam(exam.id)
      const collection = await api.createLearningCollection({ name: 'Zivilrecht AT', subject: 'Zivilrecht' })
      await api.createLearningCard({ collectionId: collection.id, title: 'Vertrag', tags: [], frontMarkdown: 'Wie entsteht ein Vertrag?', backMarkdown: 'Durch Angebot und Annahme.' })
      return { folder: folder.id, exam: exam.id, submission: submission.id, collection: collection.id }
    })
    const routes = [
      `/exams/${ids.exam}`,
      '/exams',
      '/exams/library',
      `/exams/library?folder=${ids.folder}`,
      '/exams/corrections',
      `/exams/corrections/${ids.submission}`,
      '/exams/analytics',
      '/flashcards',
      '/flashcards/collections',
      `/flashcards/collections/${ids.collection}`,
      `/flashcards/review?collection=${ids.collection}`,
      '/flashcards/statistics',
      '/podcasts',
      '/podcasts/breadcrumb-test-series',
      '/more',
      '/more/settings',
      '/more/about',
      '/more/help'
    ]
    const appUrl = page.url().split('#')[0]
    let breadcrumbFontFamily: string | undefined

    for (const theme of ['light', 'dark'] as const) {
      await page.goto(`${appUrl}#/more/settings`)
      await page.getByRole('group', { name: 'Farbschema' }).getByRole('button', { name: theme === 'dark' ? 'Dunkelmodus' : 'Hellmodus', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

      for (const route of routes) {
        await test.step(`${theme}: ${route}`, async () => {
          await page.goto(`${appUrl}#${route}`)
          await page.mouse.move(0, 0)
          const breadcrumb = page.locator('.app-breadcrumb')
          await expect(breadcrumb).toBeVisible()
          await expect(breadcrumb).toHaveAttribute('aria-label', 'Pfad')
          await expect(breadcrumb).toHaveCSS('background-color', theme === 'dark' ? 'rgba(17, 27, 32, 0.78)' : 'rgba(255, 255, 255, 0.72)')
          const links = breadcrumb.locator('[data-slot="link"]')
          const current = breadcrumb.locator('[aria-current="page"]')
          await expect(current).toHaveCount(1)
          await expect(links.last()).toHaveAttribute('aria-current', 'page')
          await expect(links.first().locator('[data-slot="linkLeadingIcon"]')).toBeVisible()
          const typography = await breadcrumb.locator('[data-slot="link"], [data-slot="linkLabel"]').evaluateAll(elements =>
            elements.map(element => {
              const style = getComputedStyle(element)
              return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight }
            })
          )
          expect(typography.length).toBeGreaterThan(2)
          breadcrumbFontFamily ??= typography[0].family
          for (const font of typography) {
            expect(font).toEqual({ family: breadcrumbFontFamily, size: '12px', weight: '800', lineHeight: '12px' })
            expect(font.family).toContain('Inter')
          }
          await expect(current).toHaveCSS('background-color', 'rgb(0, 90, 132)')
          await expect(current.locator('[data-slot="linkLabel"]')).toHaveCSS('color', 'rgb(255, 255, 255)')
          const ancestors = breadcrumb.locator('a[data-slot="link"]')
          expect(await ancestors.count()).toBe(await links.count() - 1)
          for (const ancestor of await ancestors.all()) {
            await expect(ancestor).not.toHaveAttribute('aria-current', 'page')
            await expect(ancestor).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
          }
        })
      }

      await page.goto(`${appUrl}#/exams/${ids.exam}`)
      const breadcrumb = page.getByRole('navigation', { name: 'Pfad', exact: true })
      await expect(breadcrumb).toContainText('Prüfung in A')
      await page.screenshot({ path: test.info().outputPath(`exam-breadcrumb-${theme}.png`) })
      await breadcrumb.getByRole('link', { name: 'Kurs A', exact: true }).hover()
      await expect(breadcrumb.getByRole('link', { name: 'Kurs A', exact: true })).toHaveCSS('background-color', theme === 'dark' ? 'rgb(23, 55, 70)' : 'rgb(226, 235, 243)')
      await breadcrumb.getByRole('link', { name: 'Kurs A', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`folder=${ids.folder}$`))
      await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('Kurs A')
      await breadcrumb.getByRole('link', { name: 'Bibliothek', exact: true }).click()
      await expect(page).toHaveURL(/#\/exams\/library$/)
      await breadcrumb.getByRole('link', { name: 'Home', exact: true }).focus()
      await page.keyboard.press('Tab')
      await expect(breadcrumb.getByRole('link', { name: 'Prüfungen', exact: true })).toBeFocused()
      await expect(breadcrumb.getByRole('link', { name: 'Prüfungen', exact: true })).toHaveCSS('outline-style', 'solid')
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/#\/exams$/)
      await breadcrumb.getByRole('link', { name: 'Home', exact: true }).click()
      await expect(page.locator('.home-view')).toBeVisible()

      await page.goto(`${appUrl}#/flashcards/review?collection=${ids.collection}`)
      await expect(breadcrumb).toContainText('Zivilrecht AT')
      await breadcrumb.getByRole('link', { name: 'Zivilrecht AT', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`#/flashcards/collections/${ids.collection}$`))
      await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('Zivilrecht AT')
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(breadcrumb).toBeVisible()
      const overflow = await page.evaluate(() => Array.from(document.body.querySelectorAll('*'))
        .filter(element => element.getBoundingClientRect().right > window.innerWidth)
        .slice(0, 12)
        .map(element => ({ tag: element.tagName, class: element.className, width: element.getBoundingClientRect().width })))
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), JSON.stringify(overflow)).toBe(true)
      expect(await breadcrumb.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
      const result = await new AxeBuilder({ page }).setLegacyMode(true).include('.app-breadcrumb').analyze()
      expect(result.violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([])
      await page.screenshot({ path: test.info().outputPath(`mobile-breadcrumb-${theme}.png`) })
      await page.setViewportSize({ width: 1440, height: 1050 })
    }
  } finally {
    await app.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})

async function findMainWindow(app: ElectronApplication): Promise<Page> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    for (const page of app.windows()) {
      if (!page.url().startsWith('data:')) {
        await page.waitForSelector('.home-view', { timeout: 500 }).catch(() => undefined)
        if (await page.locator('.home-view').isVisible().catch(() => false)) return page
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Main Electron window did not become ready')
}
