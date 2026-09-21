/// <reference lib="dom" />
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppApi } from '../../src/shared/ipc'

test('collection search, progress and recommended learning work on desktop and mobile', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jura-study-catalog-e2e-'))
  const { ELECTRON_RENDERER_URL: _rendererUrl, ...env } = process.env
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({ executablePath: join(process.cwd(), 'node_modules', '.bin', 'electron'), args: [`--user-data-dir=${directory}`, 'out/main/index.js'], env: { ...env, JURA_E2E: '1' } })
    await expect.poll(() => app?.windows().find(p => p.url().startsWith('file:'))).toBeTruthy()
    const page = app.windows().find(p => p.url().startsWith('file:'))!
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(page.locator('.home-view')).toBeVisible()
    await page.getByRole('button', { name: 'Später entscheiden' }).click()
    const deckId = await page.evaluate(async () => {
      const api = (window as unknown as { juraApi: AppApi }).juraApi
      for (let i = 0; i < 26; i++) await api.createLearningCollection({ name: `Sammlung ${i}` })
      const deck = await api.createLearningCollection({ name: 'Bauplanungsrecht – Prüfungsschemata und typische Klausurfragen', subject: 'Öffentliches Recht' })
      for (let i = 0; i < 3; i++) await api.createLearningCard({ collectionId: deck.id, title: `Bau ${i}`, frontMarkdown: `Frage ${i}`, backMarkdown: 'Antwort', tags: [] })
      const run = await api.studyFlashcards({ action: 'start', collectionId: deck.id, mode: 'first_pass' })
      await api.studyFlashcards({ action: 'rate', runId: run.run!.id, cardId: run.cards[0].id, rating: 3, eventId: crypto.randomUUID() })
      window.location.hash = '/flashcards/collections'
      return deck.id
    })
    await expect(page.getByRole('heading', { name: 'Als Nächstes lernen' })).toBeVisible()
    await expect(page.locator('.collection-card')).toHaveCount(24)
    await expect(page.locator('.study-recommendation')).toContainText('2 Karten offen')
    const search = page.getByRole('searchbox', { name: 'Sammlungen suchen' })
    await search.fill('öffentliches')
    await expect(page.locator('.collection-card')).toHaveCount(1)
    const progress = page.getByRole('img', { name: /Lernstand Bauplanungsrecht/ })
    await expect(progress).toHaveAttribute('aria-label', /0 Nicht gewusst, 0 Teilweise gewusst, 1 Gewusst, 2 Noch nicht bearbeitet/)
    await expect(progress.locator('.learning-status-segment-known')).toHaveAttribute('style', /33\.333/)
    await expect(page.locator('.collection-card')).toContainText('1 von 3 Karten einmal bearbeitet')
    await search.fill('nicht vorhanden')
    await expect(page.getByText('Keine passenden Sammlungen gefunden.')).toBeVisible()
    await expect(page.locator('.study-recommendation')).toContainText('Bauplanungsrecht')
    await page.getByRole('button', { name: 'Suche zurücksetzen', exact: true }).click()
    await expect(page.locator('.collection-card')).toHaveCount(24)
    await page.getByRole('button', { name: 'Nächste Seite', exact: true }).click()
    await expect(page.locator('.collection-card')).toHaveCount(3)
    await page.getByRole('button', { name: 'Vorherige Seite', exact: true }).click()
    await expect(page.locator('.collection-card')).toHaveCount(24)
    await search.fill('öffentliches')
    await expect(page.locator('.collection-card')).toHaveCount(1)
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; document.documentElement.classList.toggle('dark', theme === 'dark') }, theme)
      await page.setViewportSize({ width: theme === 'dark' ? 390 : 1440, height: 1000 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined))) })
      const scan = await new AxeBuilder({ page }).setLegacyMode(true).analyze()
      expect(scan.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
      await page.screenshot({ path: `/tmp/jura-study-catalog-${theme}.png`, fullPage: true })
    }
    await page.evaluate(() => { window.location.hash = '/flashcards/statistics' })
    await expect(page.getByRole('heading', { name: 'Sammlungsfortschritt' })).toBeVisible()
    const collectionLink = page.getByRole('link', { name: 'Bauplanungsrecht – Prüfungsschemata und typische Klausurfragen' })
    await expect(collectionLink).toBeVisible()
    await collectionLink.click()
    await expect(page).toHaveURL(new RegExp(`#/flashcards/collections/${deckId}$`))
    await page.evaluate(() => { window.location.hash = '/flashcards/collections' })
    await search.fill('öffentliches')
    await page.locator('.study-recommendation').getByRole('link', { name: 'Durchgang fortsetzen' }).click()
    await expect(page).toHaveURL(new RegExp(`collection=${deckId}`))
    await expect(page.locator('.study-question')).toBeVisible()
    // Only the disposable E2E database is changed: make the previously rated card due.
    await app.evaluate(({ app }, collectionId) => {
      const loadModule = process.getBuiltinModule('module').createRequire(`${process.cwd()}/package.json`)
      const Database = loadModule('better-sqlite3')
      const db = new Database(loadModule('node:path').join(app.getPath('userData'), 'database.sqlite'))
      try {
        db.prepare("UPDATE learning_card_schedules SET due_at = '2020-01-01T00:00:00.000Z' WHERE card_id IN (SELECT id FROM learning_cards WHERE collection_id = ?) AND reps > 0").run(collectionId)
      } finally { db.close() }
    }, deckId)
    await page.evaluate(() => { window.location.hash = '/flashcards/collections' })
    await expect(page.locator('.study-recommendation')).toContainText('Eine Karte ist zur Wiederholung fällig.')
    await page.locator('.study-recommendation').getByRole('link', { name: 'Jetzt wiederholen' }).click()
    await expect(page).toHaveURL(/mode=review/)
    await expect(page.locator('.study-card-toolbar')).toContainText('0 von 1')
  } finally {
    await app?.close()
    await rm(directory, { recursive: true, force: true })
  }
})
