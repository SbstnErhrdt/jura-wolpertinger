/// <reference lib="dom" />

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test.describe('Jura Wolpertinger Electron app', () => {
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

      await expect(page.locator('.dashboard')).toBeVisible()
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
      await page.click('.onboarding-card button:has-text("Später")')
      await expect(page.locator('.sidebar-user select')).toContainText('Lokaler Nutzer')
      await page.click('.nav a:has-text("Hilfe")')
      await expect(page).toHaveURL(/#\/help/)
      await expect(page.locator('.help-item', { hasText: 'Gehen meine Klausuren verloren' })).toBeVisible()
      await expect(page.locator('.help-item', { hasText: 'Was passiert bei einer KI-Korrektur?' })).toContainText(
        'Korrekturentwurf'
      )
      await page.click('.nav a:has-text("Einstellungen")')
      await expect(page).toHaveURL(/#\/settings/)
      await expect(page.locator('.settings-view')).toBeVisible()
      const userSettingsPanel = page.locator('.settings-panel').filter({ has: page.locator('h2:text-is("Nutzer")') })
      const newUserSettingsPanel = page.locator('.settings-panel').filter({ has: page.locator('h2:text-is("Neuer Nutzer")') })
      await expect(userSettingsPanel).toContainText('Lokaler Nutzer')
      await expect(newUserSettingsPanel).toContainText('Anlegen')
      const aiSettingsPanel = page.locator('.settings-panel', { hasText: 'KI-Korrektur' })
      await expect(aiSettingsPanel).toContainText(/OpenAI-Key (fehlt|gespeichert)|Entwicklungs-Key aktiv/)
      await expect(aiSettingsPanel.locator('input[type="password"]')).toHaveCount(0)
      await aiSettingsPanel
        .getByRole('button', {
          name: /OpenAI-Key einrichten|Eigenen App-Key speichern|Key oder Modell ändern/
        })
        .click()
      await expect(aiSettingsPanel).toContainText('OpenAI API-Key')
      await expect(aiSettingsPanel.locator('input[type="password"]')).toBeVisible()
      await expect(aiSettingsPanel.locator('input[placeholder="gpt-5.5"]')).toBeVisible()
      await aiSettingsPanel.getByRole('button', { name: 'Abbrechen' }).click()
      await expect(aiSettingsPanel.locator('input[type="password"]')).toHaveCount(0)
      await expect(page.locator('.settings-panel', { hasText: 'Oberfläche' })).toContainText('Dunkelmodus')
      await userSettingsPanel.locator('input[placeholder="Name"]').fill('Sebastian')
      await userSettingsPanel.locator('button:has-text("Speichern")').click()
      await expect(page.locator('.action-notice')).toContainText('Nutzername gespeichert')
      await expect(page.locator('.sidebar-user select')).toContainText('Sebastian')
      await page.click('.nav a:has-text("Hilfe")')
      await page.click('button:has-text("Tour starten")')
      await expect(page).toHaveURL(/#\/$/)
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
      await page.selectOption('.dialog-card select', { label: 'Zivilrecht II' })
      await page.fill('.dialog-card .tag-input-field', 'probe')
      await page.keyboard.press('Enter')
      await page.fill('.dialog-card .tag-input-field', 'bayern')
      await page.keyboard.press('Enter')
      await page.click('.dialog-actions button:has-text("Erstellen")')
      await expect(page).toHaveURL(/#\/exam\//)
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

      await page.click('.brand')
      await expect(page.locator('.dashboard')).toBeVisible()
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
      await page.selectOption('.dialog-field select', { label: 'Strafrecht' })
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
      await expect(page).toHaveURL(/#\/exam\/.+\/focus/)
      await expect(page.locator('.exam-session-header')).toContainText('E1234')
      await expect(page.locator('.exam-session-header')).not.toContainText('Prüfungsnummer')
      await expect(page.locator('.session-back')).toBeVisible()
      await expect(page.locator('.focus-save-state')).toContainText('Entwurf lokal gespeichert')
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
      await expect(page).toHaveURL(/#\/corrections\/.+/)
      await expect(page.locator('.correction-list-panel')).toContainText('E1234')
      await expect(page.locator('.readonly-document')).toContainText('Anspruch entstanden.')

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
      await expect(page).toHaveURL(/#\/analytics/)
      await expect(page.locator('.analytics-view')).toBeVisible()
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
        await page.waitForSelector('.dashboard', { timeout: 500 }).catch(() => undefined)
        if (await page.locator('.dashboard').isVisible().catch(() => false)) return page
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

function isIgnorableConsoleError(error: string): boolean {
  return error.includes('Autofill.') || error.includes('Unknown VE context')
}
