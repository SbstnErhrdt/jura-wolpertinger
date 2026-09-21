/// <reference lib="dom" />

import { _electron as electron, expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { AppApi } from '../../src/shared/ipc'

test('aggregates calendar months and shows their scores on hover, keyboard focus and touch', async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'jura-analytics-tooltip-e2e-'))
  const { ELECTRON_RENDERER_URL: _rendererUrl, ...env } = process.env
  const app = await electron.launch({
    executablePath: join(process.cwd(), 'node_modules', '.bin', 'electron'),
    args: [`--user-data-dir=${userDataDir}`, 'out/main/index.js'],
    env: { ...env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true', JURA_E2E: '1' }
  })
  try {
    let page: Page | undefined
    await expect.poll(async () => {
      page = app.windows().find(window => window.url().startsWith('file:'))
      return Boolean(page)
    }).toBe(true)
    if (!page) throw new Error('Main window did not open')
    await page.setViewportSize({ width: 1440, height: 1050 })
    await expect(page.locator('.home-view')).toBeVisible()
    await page.getByRole('button', { name: 'Später entscheiden' }).click()
    const correctionDates = await page.evaluate(async () => {
      const api = (window as unknown as { juraApi: AppApi }).juraApi
      const rows: Array<{ id: string; date: string }> = []
      for (const [title, score, date] of [
        ['Zivilrecht A', 8, '2025-01-03T12:00:00.000Z'],
        ['Zivilrecht B', 8.5, '2025-01-20T12:00:00.000Z'],
        ['Strafrecht', 9.5, '2025-02-10T12:00:00.000Z'],
        ['Öffentliches Recht', 0, '2025-03-10T12:00:00.000Z'],
        ['Folgejahr', 18, '2026-01-10T12:00:00.000Z']
      ] as const) {
        const exam = await api.createExam({ title })
        const submission = await api.submitExam(exam.id)
        const correction = await api.createCorrection(submission.id)
        await api.updateCorrection({ correctionId: correction.id, scorePoints: score, gradingComment: '', tags: [] })
        rows.push({ id: correction.id, date })
      }
      localStorage.setItem('jura-wolpertinger-analytics-filters-v1', JSON.stringify({ startDate: '2025-01-01', endDate: '2026-01-31', tags: [], preset: null }))
      return rows
    })
    // Only the disposable test profile is given historical correction timestamps.
    for (const row of correctionDates) {
      execFileSync('sqlite3', [join(userDataDir, 'database.sqlite'),
        `UPDATE corrections SET updated_at = '${row.date}' WHERE id = '${row.id}';`])
    }
    await page.click('.nav a:has-text("Auswertung")')
    const chart = page.locator('.analytics-chart')
    const tooltip = page.getByRole('tooltip')
    await expect(chart.locator('.analytics-point')).toHaveCount(4)
    await expect(chart.locator('.analytics-month-label')).toHaveCount(13)
    await expect(chart.locator('.analytics-month-label')).toHaveText([
      'Jan. 2025', 'Feb. 2025', 'März 2025', 'Apr. 2025', 'Mai 2025', 'Juni 2025', 'Juli 2025',
      'Aug. 2025', 'Sept. 2025', 'Okt. 2025', 'Nov. 2025', 'Dez. 2025', 'Jan. 2026'
    ])
    const path = await chart.locator('.analytics-line').getAttribute('d')
    expect(path?.match(/M /g)).toHaveLength(2)
    expect(path?.match(/L /g)).toHaveLength(2)

    // A real pointer hover must show a visible tooltip, not just an SVG <title>.
    await chart.locator('.analytics-point').first().hover()
    await expect(tooltip).toContainText('8,25 Punkte')
    await expect(tooltip).toContainText('Januar 2025')
    await expect(tooltip).toContainText('2 Bewertungen')
    await chart.locator('.analytics-point').nth(2).hover({ timeout: 3000 })
    await expect(tooltip).toContainText('0 Punkte')
    await page.keyboard.press('Escape')
    await expect(tooltip).toHaveCount(0)

    const targets = chart.getByRole('button')
    await expect(targets).toHaveCount(4)
    // Start this hit-area check outside the chart after the Escape dismissal.
    await page.mouse.move(0, 0)
    await targets.first().hover({ position: { x: 2, y: 14 } })
    await expect(tooltip).toContainText('8,25 Punkte')
    await expectTooltipInsideChart(page)
    await page.mouse.move(0, 0)
    await expect(tooltip).toHaveCount(0)

    await targets.first().focus()
    await expect(tooltip).toContainText('8,25 Punkte')
    await page.keyboard.press('Tab')
    await expect(targets.nth(1)).toBeFocused()
    await expect(tooltip).toContainText('9,5 Punkte')
    await page.keyboard.press('Escape')
    await expect(tooltip).toHaveCount(0)
    await page.keyboard.press('Enter')
    await expect(tooltip).toContainText('9,5 Punkte')
    await page.keyboard.press('Tab')
    await expect(targets.nth(2)).toBeFocused()
    await expect(tooltip).toContainText('0 Punkte')
    await page.keyboard.press('Tab')
    await expect(targets.last()).toBeFocused()
    await expect(tooltip).toContainText('18 Punkte')
    await expect(tooltip).toContainText('Januar 2026')
    await expect(tooltip).toContainText('1 Bewertung')
    await expectTooltipInsideChart(page)
    await chart.screenshot({ path: '/tmp/jura-analytics-tooltip-light.png' })

    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await expect(chart.locator('.analytics-line')).toHaveCSS('fill', 'none')
    await chart.screenshot({ path: '/tmp/jura-analytics-tooltip-dark.png' })
    const accessibility = await new AxeBuilder({ page }).setLegacyMode(true).include('.analytics-chart').analyze()
    expect(accessibility.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([])

    await page.setViewportSize({ width: 390, height: 844 })
    await chart.scrollIntoViewIfNeeded()
    await expectTooltipInsideChart(page)
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    await page.keyboard.press('Escape')
    await chart.locator('.analytics-chart-scroll').evaluate(element => { element.scrollLeft = 0 })
    const firstPoint = await targets.first().boundingBox()
    expect(firstPoint).not.toBeNull()
    const touch = { x: firstPoint!.x + firstPoint!.width / 2, y: firstPoint!.y + firstPoint!.height / 2 }
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(tooltip).toContainText('8,25 Punkte')
    await expectTooltipInsideChart(page)
    await chart.screenshot({ path: '/tmp/jura-analytics-tooltip-mobile.png' })
    await session.detach()

    // Month boundaries still filter individual corrections before aggregation.
    await page.locator('.analytics-filter-grid input[type="date"]').first().fill('2025-01-15')
    await targets.first().focus()
    await expect(tooltip).toContainText('8,5 Punkte')
    await expect(tooltip).toContainText('1 Bewertung')
    await page.locator('.analytics-filter-grid input[type="date"]').first().fill('2025-04-01')
    await page.locator('.analytics-filter-grid input[type="date"]').last().fill('2025-06-30')
    await expect(chart.locator('.analytics-point')).toHaveCount(0)
    await expect(chart.locator('.analytics-month-label')).toHaveText(['Apr. 2025', 'Mai 2025', 'Juni 2025'])
    await expect(tooltip).toHaveCount(0)
  } finally {
    await app.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})

async function expectTooltipInsideChart(page: Page): Promise<void> {
  await expect.poll(async () => {
    const chart = await page.locator('.analytics-chart').boundingBox()
    const tooltip = await page.getByRole('tooltip').boundingBox()
    return Boolean(chart && tooltip && tooltip.x >= chart.x && tooltip.y >= chart.y &&
      tooltip.x + tooltip.width <= chart.x + chart.width + 1 &&
      tooltip.y + tooltip.height <= chart.y + chart.height + 1)
  }).toBe(true)
}
