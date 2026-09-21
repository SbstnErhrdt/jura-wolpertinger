/// <reference lib="dom" />

import AxeBuilder from '@axe-core/playwright'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppApi } from '../../src/shared/ipc'

test.describe('Jura Wolpertinger Electron app', () => {
  test('shows every exam when changing library pages and page size', async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'jura-pagination-e2e-'))
    const app = await launchApp(userDataDir)
    try {
      const page = await findMainWindow(app)
      await page.setViewportSize({ width: 1440, height: 1050 })
      await expect(page.locator('.home-view')).toBeVisible()
      await page.getByRole('button', { name: 'Später entscheiden' }).click()
      await page.evaluate(async () => {
        const api = (window as unknown as { juraApi: AppApi }).juraApi
        const folder = await api.createFolder('Kleine Auswahl')
        for (let n = 1; n <= 40; n++) {
          await api.createExam({ title: `Klausur ${String(n).padStart(2, '0')}`, folderId: n <= 3 ? folder.id : null })
        }
      })
      await page.click('.nav a:has-text("Bibliothek")')
      await expect(page.locator('.exam-row')).toHaveCount(25)
      await expect(page.locator('.app-pagination')).toContainText('1-25 von 40')
      const firstPage = await page.locator('.exam-row').evaluateAll(rows => rows.map(row => row.getAttribute('href')))
      const pager = page.locator('.app-pagination')
      await pager.getByRole('button', { name: 'Page 2', exact: true }).click()
      await expect(page.locator('.exam-row')).toHaveCount(15)
      await expect(pager).toContainText('26-40 von 40')
      const secondPage = await page.locator('.exam-row').evaluateAll(rows => rows.map(row => row.getAttribute('href')))
      expect(new Set([...firstPage, ...secondPage]).size).toBe(40)
      await pager.getByRole('button', { name: 'Previous Page', exact: true }).click()
      await expect(page.locator('.exam-row')).toHaveCount(25)
      await expect(pager.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page')
      await page.getByRole('combobox', { name: 'Einträge pro Seite' }).click()
      await page.getByRole('option', { name: '50', exact: true }).click()
      await expect(page.locator('.exam-row')).toHaveCount(40)
      await expect(pager).toContainText('1-40 von 40')
      await page.getByRole('combobox', { name: 'Einträge pro Seite' }).click()
      await page.getByRole('option', { name: '25', exact: true }).click()
      await expect(page.locator('.exam-row')).toHaveCount(25)
      await pager.getByRole('button', { name: 'Last Page', exact: true }).click()
      await expect(page.locator('.exam-row')).toHaveCount(15)
      await page.getByRole('button', { name: 'Kleine Auswahl', exact: true }).click()
      await expect(page.locator('.exam-row')).toHaveCount(3)
      await expect(pager).toContainText('1-3 von 3')
      await expect(pager.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(pager.getByRole('button', { name: 'Next Page', exact: true })).toBeDisabled()
    } finally {
      await app.close()
      await rm(userDataDir, { recursive: true, force: true })
    }
  })

  test('keeps library folders in the URL and breadcrumb navigation across reloads and history', async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'jura-folder-e2e-'))
    const app = await launchApp(userDataDir)
    try {
      const page = await findMainWindow(app)
      await page.setViewportSize({ width: 1440, height: 1050 })
      await expect(page.locator('.home-view')).toBeVisible()
      await page.getByRole('button', { name: 'Später entscheiden' }).click()
      const ids = await page.evaluate(async () => {
        const api = (window as unknown as { juraApi: AppApi }).juraApi
        const a = await api.createFolder('Kurs A')
        const b = await api.createFolder('Kurs B')
        const exam = await api.createExam({ title: 'Prüfung in A', folderId: a.id })
        await api.createExam({ title: 'Prüfung in B', folderId: b.id })
        await api.createExam({ title: 'Prüfung ohne Ordner' })
        return { a: a.id, b: b.id, exam: exam.id }
      })
      await page.click('.nav a:has-text("Bibliothek")')
      await page.getByRole('button', { name: 'Kurs A', exact: true }).click()
      await expect(page).toHaveURL(new RegExp('folder=' + ids.a))
      await expect(page.locator('h1')).toHaveText('Kurs A')
      await expect(page.locator('.exam-row')).toHaveCount(1)
      await expect(page.locator('.exam-row')).toContainText('Prüfung in A')
      const crumbs = page.locator('.dashboard .app-breadcrumb')
      await expect(crumbs.locator('[aria-current="page"]')).toHaveCount(1)
      await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Kurs A')
      await expect(crumbs.getByRole('link', { name: 'Bibliothek', exact: true })).toBeVisible()
      const folderUrl = page.url()
      await page.reload()
      await expect(page.locator('h1')).toHaveText('Kurs A')
      await expect(page.locator('.exam-row')).toHaveCount(1)
      await page.getByRole('button', { name: 'Kurs B', exact: true }).click()
      await expect(page.locator('.exam-row')).toContainText('Prüfung in B')
      await page.goBack()
      await expect(page).toHaveURL(folderUrl)
      await expect(page.locator('.exam-row')).toContainText('Prüfung in A')
      await page.goForward()
      await expect(page.locator('h1')).toHaveText('Kurs B')
      await page.goto(folderUrl)
      await page.locator('.exam-row').click()
      await expect(page.locator('.exam-view')).toBeVisible()
      await page.locator('.app-breadcrumb').getByRole('link', { name: 'Kurs A', exact: true }).click()
      await expect(page).toHaveURL(folderUrl)
      await expect(page.locator('.exam-row')).toHaveCount(1)
      await crumbs.getByRole('link', { name: 'Bibliothek', exact: true }).click()
      await expect(page).not.toHaveURL(/folder=/)
      await expect(page.locator('.exam-row')).toHaveCount(3)
      await page.evaluate(() => { window.location.hash = '/exams/library?folder=missing-folder&view=keep' })
      await expect(page).toHaveURL(/#\/exams\/library\?view=keep$/)
      await expect(page.locator('.folder-notice')).toContainText('nicht verfügbar')
      await page.getByRole('button', { name: 'Ohne Ordner', exact: true }).click()
      await expect(page).toHaveURL(/folder=unassigned/)
      await page.reload()
      await expect(page.locator('.exam-row')).toHaveCount(1)
      await expect(page.locator('.exam-row')).toContainText('Prüfung ohne Ordner')
      await page.goto(folderUrl)
      await page.evaluate(async id => {
        await (window as unknown as { juraApi: AppApi }).juraApi.updateFolder({ id, name: 'Kurs umbenannt' })
      }, ids.a)
      await page.reload()
      await expect(page.locator('h1')).toHaveText('Kurs umbenannt')
      await expect(page).toHaveURL(folderUrl)
      await page.screenshot({ path: '/tmp/jura-folder-navigation-light.png' })
      await scanAccessibility(page, 'library')
      await page.evaluate(() => {
        localStorage.setItem('jura-wolpertinger-theme', 'dark')
        document.documentElement.dataset.theme = 'dark'
      })
      await scanAccessibility(page, 'library')
      await page.screenshot({ path: '/tmp/jura-folder-navigation-dark.png' })
      await page.evaluate(async id => {
        await (window as unknown as { juraApi: AppApi }).juraApi.trashFolder({ id, moveExamsToFolderId: null })
      }, ids.a)
      await page.reload()
      await expect(page).not.toHaveURL(/folder=/)
      await expect(page.locator('.folder-notice')).toContainText('nicht verfügbar')
      await expect(page.locator('.exam-row')).toHaveCount(3)
    } finally {
      await app.close()
      await rm(userDataDir, { recursive: true, force: true })
    }
  })

  test('covers writing, focus mode, dark mode, PDF export, submission and correction', async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'jura-e2e-'))
    const app = await launchApp(userDataDir)
    const errors: string[] = []

    try {
      const page = await findMainWindow(app)
      await page.setViewportSize({ width: 1920, height: 1366 })
      await page.evaluate(() => {
        localStorage.setItem('jura-wolpertinger-theme', 'light')
        document.documentElement.dataset.theme = 'light'
        document.documentElement.style.colorScheme = 'light'
      })
      page.on('pageerror', (error) => errors.push(String(error)))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })

      await expect(page.locator('.home-view')).toBeVisible()
      await expect
        .poll(() => page.locator('.brand img').evaluate((image) => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0)
      await expect(page.locator('.onboarding-card')).toBeVisible()
      await expect
        .poll(() =>
          page
            .locator('.onboarding-image')
            .evaluate((image) => (image as HTMLImageElement).naturalWidth)
        )
        .toBeGreaterThan(0)
      await page.getByRole('button', { name: 'Später entscheiden' }).click()
      await expect(page.locator('.onboarding-card')).toHaveCount(0)
      await scanAccessibility(page, 'home')
      await expect(page.locator('.sidebar-account-trigger')).toContainText('Lokaler Nutzer')
      await page.click('.nav a:has-text("Bewertung")')
      await expect(page).toHaveURL(/#\/exams\/corrections/)
      await expect(page.locator('.correction-page .app-breadcrumb')).toHaveCount(1)
      await expect(page.locator('.correction-page .app-breadcrumb')).toContainText('Bewertung')
      await expect
        .poll(() => page.locator('.correction-page .app-breadcrumb').evaluate((element) => element.getBoundingClientRect().width))
        .toBeLessThan(400)
      const correctionEmptyState = page.locator('.correction-list-panel > .empty-state')
      await expect(correctionEmptyState).toContainText('Keine abgegebenen Prüfungen.')
      await expect
        .poll(() => correctionEmptyState.evaluate((element) => getComputedStyle(element).borderTopWidth))
        .toBe('0px')
      await page.click('.nav a:has-text("Sammlungen")')
      await expect(page).toHaveURL(/#\/flashcards\/collections/)
      await expect(page.locator('.flashcards-page')).toBeVisible()
      await scanAccessibility(page, 'collections')
      await page.click('button:has-text("Neue Sammlung")')
      await page.fill('.dialog-card input[placeholder="z. B. Strafrecht AT"]', 'Arbeitsrecht')
      await page.fill('.dialog-card input[placeholder="z. B. Strafrecht"]', 'Arbeitsrecht')
      await page.click('.dialog-actions button:has-text("Sammlung speichern")')
      await expect(page).toHaveURL(/#\/flashcards\/collections\/.+/)
      await expect(page.locator('.page-header')).toContainText('Arbeitsrecht')
      await page.click('button:has-text("Neue Karteikarte")')
      await page.fill('input[placeholder="Kurzer Titel, z. B. Abmahnung"]', 'Abmahnung')
      await page.fill('textarea[placeholder="Was soll auf der Vorderseite stehen?"]', 'Was ist eine Abmahnung?')
      await page.fill(
        'textarea[placeholder="Was soll auf der Rückseite stehen?"]',
        'Eine Abmahnung rügt ein konkretes Fehlverhalten und warnt arbeitsrechtliche Konsequenzen an.'
      )
      await page.fill('.dialog-card .tag-input-field', 'arbeitsrecht')
      await page.keyboard.press('Enter')
      await page.click('.dialog-actions button:has-text("Karteikarte speichern")')
      await expect(page.locator('.action-notice')).toContainText('Karteikarte gespeichert')
      await expect(page.locator('.flashcard-list-card', { hasText: 'Abmahnung' })).toContainText('Noch nicht bewertet')
      await expect(page.locator('.page-header')).toContainText('1 Karten')
      const flashcardRow = page.locator('.flashcard-list-card', { hasText: 'Abmahnung' })
      await flashcardRow.getByRole('button', { name: 'Karteikartenaktionen' }).click()
      await page.getByRole('menuitem', { name: 'Karteikarte bearbeiten' }).click()
      await expect(page.locator('.dialog-card')).toContainText('Karteikarte bearbeiten')
      await page.fill('input[placeholder="Kurzer Titel, z. B. Abmahnung"]', 'Abmahnung im Arbeitsrecht')
      await page.fill('textarea[placeholder="Was soll auf der Vorderseite stehen?"]', 'Wozu dient eine Abmahnung?')
      await page.fill(
        'textarea[placeholder="Was soll auf der Rückseite stehen?"]',
        'Sie dokumentiert den Pflichtverstoß, fordert Vertragstreue und warnt vor Kündigung.'
      )
      await page.click('.dialog-actions button:has-text("Änderungen speichern")')
      await expect(page.locator('.action-notice')).toContainText('Karteikarte aktualisiert')
      await expect(page.locator('.flashcard-list-card', { hasText: 'Abmahnung im Arbeitsrecht' })).toContainText(
        'Wozu dient eine Abmahnung?'
      )
      const collectionUrl = page.url()
      await page.locator('header').getByRole('link', { name: 'Sammlung durcharbeiten' }).click()
      await expect(page).toHaveURL(/#\/flashcards\/review\?collection=/)
      await expect(page.locator('.study-card')).toContainText('Abmahnung')
      await page.getByRole('button', { name: 'Antwort zeigen' }).click()
      await page.getByRole('button', { name: /^Gewusst/ }).click()
      await expect(page.locator('.study-summary')).toContainText('Sammlung einmal vollständig bearbeitet')
      await page.getByRole('button', { name: 'Sammlung erneut durcharbeiten' }).click()
      await expect(page.locator('.study-card')).toContainText('Abmahnung')
      await page.goto(collectionUrl)
      await page.locator('header').getByRole('link', { name: 'Durchgang fortsetzen' }).click()
      await expect(page.locator('.study-card')).toContainText('Abmahnung')
      await page.locator('.sidebar-account-trigger').click()
      await page.getByRole('menuitem', { name: 'Hilfe' }).click()
      await expect(page).toHaveURL(/#\/more\/help/)
      await expect(page.locator('.help-item', { hasText: 'Gehen meine Klausuren verloren' })).toBeVisible()
      await expect.poll(() => page.locator('.help-view').evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(1550)
      await expect(page.locator('.help-item', { hasText: 'Was passiert, wenn ich die Online-Sicherung einrichte?' })).toContainText(
        'Nach der Anmeldung'
      )
      await page.locator('.sidebar-account-trigger').click()
      await page.getByRole('menuitem', { name: 'Einstellungen' }).click()
      await expect(page).toHaveURL(/#\/more\/settings/)
      await expect(page.locator('.settings-view')).toBeVisible()
      await expect.poll(() => page.locator('.settings-view').evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(1550)
      const userSettingsPanel = page.locator('.settings-panel').filter({ has: page.locator('h2:text-is("Nutzer")') })
      const newUserSettingsPanel = page.locator('.settings-panel').filter({ has: page.locator('h2:text-is("Neuer Nutzer")') })
      await expect(userSettingsPanel).toContainText('Lokaler Nutzer')
      await expect(newUserSettingsPanel).toContainText('Anlegen')
      await expect(page.locator('.settings-panel', { hasText: 'Oberfläche' })).toContainText('Dunkelmodus')
      await userSettingsPanel.locator('input[placeholder="Name"]').fill('Sebastian')
      await userSettingsPanel.locator('button:has-text("Speichern")').click()
      await expect(page.locator('.action-notice')).toContainText('Nutzername gespeichert')
      await expect(page.locator('.sidebar-account-trigger')).toContainText('Sebastian')
      await page.locator('.sidebar-account-trigger').click()
      await page.getByRole('menuitem', { name: 'Hilfe' }).click()
      await page.click('button:has-text("Tour starten")')
      await expect(page).toHaveURL(/#\/exams/)
      await expect(page.locator('.driver-popover')).toBeVisible()
      await page.click('.driver-popover-close-btn')
      await expect(page.locator('.driver-popover')).toHaveCount(0)

      await page.click('button:has-text("Neuer Ordner")')
      await page.fill('.dialog-card input[placeholder="Ordnername"]', 'Zivilrecht')
      await page.click('.dialog-actions button:has-text("Erstellen")')
      await expect(page.locator('.folder-row', { hasText: 'Zivilrecht' })).toBeVisible()
      await page.click('button:has-text("Neuer Ordner")')
      await page.fill('.dialog-card input[placeholder="Ordnername"]', 'Strafrecht')
      await page.click('.dialog-actions button:has-text("Erstellen")')
      await expect(page.locator('.folder-row', { hasText: 'Strafrecht' })).toBeVisible()

      await page.click('.folder-row:has-text("Zivilrecht")', { button: 'right' })
      await expect(page.locator('.context-menu')).toBeVisible()
      await page.click('.context-menu button:has-text("Umbenennen")')
      await page.fill('input[placeholder="Ordnername"]', 'Zivilrecht II')
      await page.click('.dialog-actions button:has-text("Speichern")')
      await expect(page.locator('.folder-row', { hasText: 'Zivilrecht II' })).toBeVisible()

      await page.click('button:has-text("Neue Klausur")')
      await page.fill('.dialog-card input[placeholder="Titel"]', 'E1234')
      await page.locator('.dialog-card [role="combobox"]').click()
      await page.getByRole('option', { name: 'Zivilrecht II' }).click()
      await page.fill('.dialog-card .tag-input-field', 'probe')
      await page.keyboard.press('Enter')
      await page.fill('.dialog-card .tag-input-field', 'bayern')
      await page.keyboard.press('Enter')
      await page.click('.dialog-actions button:has-text("Erstellen")')
      await expect(page).toHaveURL(/#\/exams\/[^/]+$/)
      const examUrl = page.url()

      await expect(page.locator('.title-input')).toHaveValue('E1234')
      expect(
        await page.locator('.side-panel .tag-input-chip > span').evaluateAll((nodes) =>
          nodes.map((node) => node.textContent?.trim()).sort()
        )
      ).toEqual(['bayern', 'probe'])
      await page.locator('.exam-editor-surface').click()
      await page.keyboard.type('Anspruch entstanden. Weitere Prüfung.')
      await expect(page.locator('.exam-editor-surface')).toContainText('Anspruch entstanden.')

      await page.click('.nav a:has-text("Bibliothek")')
      await expect(page.locator('.dashboard')).toBeVisible()
      await scanAccessibility(page, 'library')
      await page.click('button:has-text("Neue Klausur")')
      await page.fill('.dialog-card input[placeholder="Titel"]', 'Tag-Test')
      await page.click('.dialog-card .tag-input-suggestion:has-text("bayern")')
      await page.click('.dialog-card .tag-input-suggestion:has-text("probe")')
      expect(
        await page.locator('.dialog-card .tag-input-chip > span').evaluateAll((nodes) =>
          nodes.map((node) => node.textContent?.trim()).sort()
        )
      ).toEqual(['bayern', 'probe'])
      await page.click('.dialog-actions button:has-text("Abbrechen")')

      await page.click('.folder-row:has-text("Zivilrecht II")', { button: 'right' })
      await page.click('.context-menu button:has-text("In Papierkorb")')
      await page.locator('.dialog-card [role="combobox"]').click()
      await page.getByRole('option', { name: 'Strafrecht' }).click()
      await page.click('.dialog-actions button:has-text("In Papierkorb")')
      await expect(page.locator('.trash-section')).toContainText('Zivilrecht II')
      await expect(page.locator('.exam-row', { hasText: 'E1234' })).toContainText('Strafrecht')
      await page.click('.trash-row button:has-text("Wiederherstellen")')
      await expect(page.locator('.folder-row', { hasText: 'Zivilrecht II' })).toBeVisible()
      await page.click('.exam-row:has-text("E1234")')
      await expect(page).toHaveURL(examUrl)

      await page.click('button:has-text("PDF")')
      await expect(page.locator('.action-error')).toHaveCount(0)
      const pdfPath = await waitForPdf(userDataDir)
      await expect.poll(async () => (await stat(pdfPath)).size).toBeGreaterThan(5_000)

      await page.click('text=Prüfungsmodus')
      await expect(page).toHaveURL(/#\/exams\/.+\/focus/)
      await expect(page.locator('.exam-session-header')).toContainText('E1234')
      await expect(page.locator('.exam-session-header')).not.toContainText('Prüfungsnummer')
      await expect(page.locator('.session-back')).toBeVisible()
      await expect(page.locator('.focus-save-state')).toContainText('Entwurf gespeichert')
      await expectToolbarOrder(page)

      const frame = await page.locator('.editor-frame').boundingBox()
      const toolbar = await page.locator('.editor-toolbar').boundingBox()
      expect(Math.round(frame?.width ?? 0)).toBe(1144)
      expect(Math.round(toolbar?.height ?? 0)).toBe(68)

      await page.click('.theme-toggle')
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
      await expect
        .poll(() =>
          page.evaluate(() => getComputedStyle(document.querySelector('.exam-editor-surface')!).backgroundColor)
        )
        .toBe('rgb(26, 27, 28)')

      await page.click('.session-back')
      await expect(page).toHaveURL(examUrl)
      await expect(page.locator('.side-panel')).toBeVisible()

      await page.click('button:has-text("Abgeben")')
      await expect(page.locator('.dialog-card')).toContainText('Klausur abgeben')
      await page.click('.dialog-actions button:has-text("Abgeben")')
      await expect(page.locator('.submission-celebration')).toBeVisible()
      await expect(page.locator('.submission-celebration-card')).toContainText('Klausur abgegeben')
      await expect
        .poll(() =>
          page
            .locator('.submission-celebration-image')
            .evaluate((image) => (image as HTMLImageElement).naturalWidth)
        )
        .toBeGreaterThan(0)
      await expect(page.locator('.side-panel')).toContainText('Korrigieren')
      await page.click('.submission-celebration button:has-text("Weiter")')
      await expect(page.locator('.submission-celebration')).toHaveCount(0)
      await page.click('text=Korrigieren')
      await expect(page).toHaveURL(/#\/exams\/corrections\/.+/)
      await expect(page.locator('.correction-list-panel')).toContainText('E1234')
      await expect(page.locator('.readonly-document')).toContainText('Anspruch entstanden.')
      await scanAccessibility(page, 'correction')

      await page.fill('input[placeholder="0 bis 18, z. B. 12,5"]', '12,5')
      await page.locator('textarea').first().fill('Solide Schwerpunktsetzung.')
      await page.click('button:has-text("Speichern")')

      await selectReadonlyText(page, 'Anspruch')
      await page.locator('textarea[placeholder="Hinweis oder Korrektur zur markierten Passage"]').evaluate((textarea) => {
        textarea.dispatchEvent(new FocusEvent('focus'))
      })
      await page.fill(
        'textarea[placeholder="Hinweis oder Korrektur zur markierten Passage"]',
        'Anspruchsgrundlage genauer benennen.'
      )
      await page.click('button:has-text("Kommentar setzen")')
      await expect(page.locator('.comment-card')).toContainText('Anspruchsgrundlage genauer benennen.')

      await page.click('.nav a:has-text("Auswertung")')
      await expect(page).toHaveURL(/#\/exams\/analytics/)
      await expect(page.locator('.analytics-view')).toBeVisible()
      await scanAccessibility(page, 'analytics')
      await expect(
        page.locator('.analytics-metrics .metric').filter({ hasText: 'Durchschnitt' }).locator('strong')
      ).toHaveText('12,5')
      await expect(page.locator('.analytics-table-row')).toContainText('E1234')

      await page.fill('.analytics-tag-field .tag-input-field', 'bayern')
      await page.keyboard.press('Enter')
      await page.click('.analytics-preset:has-text("Letzte 3 Monate")')
      await page.reload()
      expect(
        await page.locator('.analytics-tag-field .tag-input-chip > span').evaluateAll((nodes) =>
          nodes.map((node) => node.textContent?.trim())
        )
      ).toEqual(['bayern'])
      await expect(page.locator('.analytics-preset.active')).toHaveText('Letzte 3 Monate')
      await page.click('button:has-text("Filter zurücksetzen")')
      await expect(page.locator('.analytics-tag-field .tag-input-chip')).toHaveCount(0)

      expect(errors.filter((error) => !isIgnorableConsoleError(error))).toEqual([])
    } finally {
      await app.close().catch(() => undefined)
      await rm(userDataDir, { recursive: true, force: true })
    }
  })
})

test('finishes a large collection across batches, pause, undo, reload and deferred cards', async () => {
  test.setTimeout(180_000)
  const userDataDir = await mkdtemp(join(tmpdir(), 'jura-study-e2e-'))
  const app = await launchApp(userDataDir)
  try {
    const page = await findMainWindow(app)
    await page.getByRole('button', { name: 'Später entscheiden' }).click()
    const seeded = await page.evaluate(async () => {
      const api = (window as unknown as { juraApi: AppApi }).juraApi
      const collection = await api.createLearningCollection({ name: 'Große Sammlung', subject: 'Zivilrecht' })
      const cards = []
      for (let i = 0; i < 47; i++) cards.push(await api.createLearningCard({ collectionId: collection.id,
        title: `Lösungstitel ${i}`, frontMarkdown: `Frage ${i}`, tags: ['verrät-die-lösung'],
        backMarkdown: '1. **Anspruch entstanden**\n2. Anspruch nicht erloschen\n\n<script>window.studyUnsafe=true</script>\n\n[Quelle](javascript:alert(1))' }))
      return { collection: collection.id, questions: cards.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map((card) => card.frontMarkdown) }
    })
    await page.goto(page.url().split('#')[0] + `#/flashcards/review?collection=${seeded.collection}`)
    await expect(page.locator('.study-card-toolbar')).toContainText('0 von 47')
    await expect(page.locator('.study-card')).not.toContainText('Lösungstitel')
    await expect(page.locator('.study-card-tags')).toHaveCount(0)
    await page.getByRole('button', { name: 'Für später zurückstellen' }).click()
    let firstMilestoneImage: string | null = null
    for (let i = 1; i <= 42; i++) {
      await expect(page.locator('.study-question .markdown-block')).toHaveText(seeded.questions[i])
      await page.getByRole('button', { name: 'Antwort zeigen' }).click()
      if (i === 1) {
        await expect(page.locator('.study-question')).toBeVisible()
        await expect(page.locator('.study-answer ol > li')).toHaveCount(2)
        await expect(page.locator('.study-answer strong')).toHaveText('Anspruch entstanden')
        await expect(page.locator('.study-answer script')).toHaveCount(0)
        expect(await page.locator('.study-answer a').getAttribute('href')).toBeNull()
        await page.screenshot({ path: '/tmp/study-desktop.png', fullPage: true })
        await scanAccessibility(page, 'study')
      }
      await page.getByRole('button', { name: /^Nicht gewusst/ }).click()
      if (i === 9) {
        await expect(page.getByRole('complementary', { name: 'Lernerfolg', exact: true })).toHaveCount(0)
        await page.reload()
        await expect(page.locator('.study-card-toolbar')).toContainText('9 von 47')
      }
      if (i === 10) {
        const celebration = page.getByRole('complementary', { name: 'Lernerfolg', exact: true })
        await expect(celebration).toContainText('10 Karten bearbeitet')
        await expect(celebration.locator('img')).toHaveJSProperty('complete', true)
        firstMilestoneImage = await celebration.locator('img').getAttribute('src')
        await page.screenshot({ path: '/tmp/wolpi-milestone-desktop.png', fullPage: true })
        await scanAccessibility(page, 'study')
        await page.getByRole('button', { name: 'Bewertung rückgängig machen' }).click()
        await expect(celebration).toHaveCount(0)
        await expect(page.locator('.study-card-toolbar')).toContainText('9 von 47')
        await page.getByRole('button', { name: /^Teilweise gewusst/ }).click()
        await expect(celebration).toHaveCount(0)
      }
      if (i === 20) {
        await page.setViewportSize({ width: 390, height: 844 })
        await page.emulateMedia({ reducedMotion: 'reduce' })
        const celebration = page.getByRole('complementary', { name: 'Lernerfolg', exact: true })
        await expect(celebration).toContainText('20 Karten bearbeitet')
        expect(await celebration.locator('img').getAttribute('src')).not.toBe(firstMilestoneImage)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await page.screenshot({ path: '/tmp/wolpi-milestone-mobile.png', fullPage: true })
        await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.classList.add('dark') })
        await page.screenshot({ path: '/tmp/wolpi-milestone-mobile-dark.png', fullPage: true })
        await scanAccessibility(page, 'study')
        await expect(celebration).toHaveCount(0, { timeout: 6000 })
        await page.setViewportSize({ width: 1440, height: 1000 })
        await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; document.documentElement.classList.remove('dark') })
      }
    }
    await expect(page.locator('.study-card-toolbar')).toContainText('42 von 47')
    await expect(page.locator('.study-question .markdown-block')).toHaveText(seeded.questions[43])
    await page.getByRole('button', { name: 'Pause machen' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.study-summary')).toContainText('33 Karten in dieser Lerneinheit')
    await page.getByRole('button', { name: 'Weiterlernen', exact: true }).click()
    await page.getByRole('button', { name: 'Bewertung rückgängig machen' }).click()
    await expect(page.locator('.study-question .markdown-block')).toHaveText(seeded.questions[42])
    await expect(page.locator('.study-answer')).toBeVisible()
    await expect(page.locator('.study-card-toolbar')).toContainText('41 von 47')
    await page.getByRole('button', { name: /^Teilweise gewusst/ }).click()
    await page.reload()
    await expect(page.locator('.study-question .markdown-block')).toHaveText(seeded.questions[43])
    await expect(page.locator('.study-answer')).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    for (let i = 43; i < 47; i++) {
      await page.getByRole('button', { name: 'Antwort zeigen' }).click()
      if (i === 43) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await page.screenshot({ path: '/tmp/study-mobile.png', fullPage: true })
        await page.evaluate(() => {
          document.documentElement.dataset.theme = 'dark'
          document.documentElement.style.colorScheme = 'dark'
          document.documentElement.classList.add('dark')
        })
        await expect.poll(() => page.locator('.rating-option.again').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(69, 35, 33)')
        await page.screenshot({ path: '/tmp/study-mobile-dark.png', fullPage: true })
        await scanAccessibility(page, 'study')
      }
      await page.getByRole('button', { name: /^Gewusst/ }).click()
    }
    await expect(page.locator('.empty-state')).toContainText('1 Karte noch offen')
    await page.getByRole('button', { name: 'Offene Karten bearbeiten' }).click()
    await expect(page.locator('.study-question .markdown-block')).toHaveText(seeded.questions[0])
    await page.getByRole('button', { name: 'Antwort zeigen' }).click()
    await page.getByRole('button', { name: /^Gewusst/ }).click()
    await expect(page.locator('.study-summary')).toContainText('47 von 47')
    await expect(page.getByRole('complementary', { name: 'Durchgang geschafft' })).toBeVisible()
    const stats = await page.evaluate(() => (window as unknown as { juraApi: AppApi }).juraApi.getLearningStatistics())
    expect(stats.reviewedCards).toBe(47)
    expect(stats.reviewsToday).toBe(47)
    for (const size of [1, 10, 11]) {
      const collectionId = await page.evaluate(async (count) => {
        const api = (window as unknown as { juraApi: AppApi }).juraApi
        const collection = await api.createLearningCollection({ name: `Abschluss mit ${count} Karten`, subject: 'Zivilrecht' })
        for (let n = 0; n < count; n++) await api.createLearningCard({ collectionId: collection.id, title: `Karte ${n}`, frontMarkdown: `Frage ${n}`, backMarkdown: 'Antwort', tags: [] })
        return collection.id
      }, size)
      await page.goto(page.url().split('#')[0] + `#/flashcards/review?collection=${collectionId}`)
      if (size === 11) await page.getByRole('button', { name: 'Für später zurückstellen' }).click()
      for (let n = 0; n < Math.min(size, 10); n++) {
        await page.getByRole('button', { name: 'Antwort zeigen' }).click()
        await page.getByRole('button', { name: /^Gewusst/ }).click()
      }
      if (size === 11) {
        await expect(page.getByRole('complementary', { name: 'Lernerfolg', exact: true })).toContainText('10 Karten bearbeitet')
        await page.getByRole('button', { name: 'Offene Karten bearbeiten' }).click()
        await page.getByRole('button', { name: 'Antwort zeigen' }).click()
        await page.getByRole('button', { name: /^Gewusst/ }).click()
      }
      const completion = page.getByRole('complementary', { name: 'Durchgang geschafft' })
      await expect(completion).toBeVisible()
      await expect(page.getByRole('complementary', { name: 'Lernerfolg', exact: true })).toHaveCount(0)
      const image = await completion.locator('img').getAttribute('src')
      await page.reload()
      await expect(completion.locator('img')).toHaveAttribute('src', image!)
    }
  } finally {
    await app.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})

async function launchApp(userDataDir: string): Promise<ElectronApplication> {
  const { ELECTRON_RENDERER_URL: _rendererUrl, ...env } = process.env
  return electron.launch({
    executablePath: join(process.cwd(), 'node_modules', '.bin', 'electron'),
    args: [`--user-data-dir=${userDataDir}`, 'out/main/index.js'],
    env: {
      ...env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      JURA_E2E: '1'
    }
  })
}

async function findMainWindow(app: ElectronApplication): Promise<Page> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    for (const page of app.windows()) {
      if (!page.url().startsWith('data:')) {
        await page.waitForSelector('.home-view, .dashboard', { timeout: 500 }).catch(() => undefined)
        if (await page.locator('.home-view, .dashboard').first().isVisible().catch(() => false)) return page
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Main Electron window did not become ready')
}

async function waitForPdf(userDataDir: string): Promise<string> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const files = await listFiles(userDataDir)
    const pdf = files.find((file) => file.endsWith('.pdf'))
    if (pdf) return pdf
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('PDF export did not create a file')
}

async function listFiles(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  const result: string[] = []
  for (const entry of entries) {
    const nextPath = join(path, entry.name)
    if (entry.isDirectory()) result.push(...(await listFiles(nextPath)))
    else result.push(nextPath)
  }
  return result
}

async function expectToolbarOrder(page: Page): Promise<void> {
  const titles = await page.locator('.editor-toolbar button').evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('title'))
  )
  expect(titles).toEqual([
    'Rückgängig',
    'Wiederholen',
    'Ausschneiden',
    'Kopieren',
    'Einfügen',
    'Fett',
    'Kursiv',
    'Unterstreichen',
    'Hervorheben',
    'Ausrichtung',
    'Einzug vergrößern',
    'Einzug verkleinern',
    'Drucken',
    'PDF-Vorschau'
  ])
}

async function selectReadonlyText(page: Page, text: string): Promise<void> {
  await page.locator('.readonly-document').evaluate((element, selectedText) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      const index = node.textContent?.indexOf(selectedText) ?? -1
      if (index >= 0) {
        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + selectedText.length)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        return
      }
      node = walker.nextNode()
    }
    throw new Error(`Text not found: ${selectedText}`)
  }, text)
}

async function scanAccessibility(page: Page, surface: 'home' | 'collections' | 'library' | 'correction' | 'analytics' | 'study'): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  const results = await new AxeBuilder({ page }).setLegacyMode(true).analyze()
  const blockingImpacts = ['serious', 'critical']
  const violations = results.violations.filter(
    (violation) => violation.impact && blockingImpacts.includes(violation.impact)
  )

  expect(
    violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      helpUrl: violation.helpUrl,
      targets: violation.nodes.map((node) => node.target)
    })),
    `${surface} has serious or critical Axe violations`
  ).toEqual([])
}

function isIgnorableConsoleError(error: string): boolean {
  return error.includes('Autofill.') || error.includes('Unknown VE context')
}
