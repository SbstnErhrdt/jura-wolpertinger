/// <reference lib="dom" />

import AxeBuilder from '@axe-core/playwright'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('searches podcasts by episode and opens the matching series', async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'jura-podcast-search-e2e-'))
  const { ELECTRON_RENDERER_URL: _rendererUrl, ...env } = process.env
  const app = await electron.launch({
    executablePath: join(process.cwd(), 'node_modules', '.bin', 'electron'),
    args: [`--user-data-dir=${userDataDir}`, 'out/main/index.js'],
    env: { ...env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true', JURA_E2E: '1' }
  })

  try {
    const page = await findMainWindow(app)
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.getByRole('button', { name: 'Später entscheiden' }).click()
    await page.evaluate(() => { window.location.hash = '/podcasts' })
    const search = page.getByRole('searchbox', { name: 'Podcasts durchsuchen' })
    await expect(search).toBeVisible()
    await search.fill('Fallstricke')
    await expect(page.getByRole('status')).toContainText('1 Reihe gefunden')
    await expect(page.locator('.podcast-series-card')).toHaveCount(1)
    const result = page.getByRole('link', { name: 'Kommunalrecht' })
    await expect(result).toBeVisible()
    await page.getByRole('button', { name: 'Suche zurücksetzen' }).click()
    await expect(page.locator('.podcast-series-card')).toHaveCount(8)
    await search.fill('Fallstricke')
    await result.click()
    await expect(page).toHaveURL(/#\/podcasts\/kommunalrecht-august-2026$/)
    await expect(page.locator('.podcast-series-view')).toContainText('Fallstricke im bayerischen Kommunalrecht')
    const scan = await new AxeBuilder({ page }).setLegacyMode(true).analyze()
    expect(scan.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([])
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  } finally {
    await app.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})

async function findMainWindow(app: ElectronApplication): Promise<Page> {
  await expect.poll(() => app.windows().find((page) => page.url().startsWith('file:'))).toBeTruthy()
  return app.windows().find((page) => page.url().startsWith('file:'))!
}
