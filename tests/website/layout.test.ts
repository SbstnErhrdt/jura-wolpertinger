import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const staticRoot = resolve(projectRoot, 'website/static')
let browser: Browser
let server: Server
let baseUrl = ''
const contexts = new Set<BrowserContext>()

beforeAll(async () => {
  const [template, stylesheet] = await Promise.all([
    readFile(resolve(projectRoot, 'website/layouts/index.html'), 'utf8'),
    readFile(resolve(projectRoot, 'website/assets/css/main.css'), 'utf8')
  ])
  const main = template.match(/<main[\s\S]*<\/main>/)?.[0]
  if (!main) throw new Error('Homepage template does not contain a main element')

  server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    if (pathname === '/') {
      response.setHeader('content-type', 'text/html; charset=utf-8')
      response.end(
        `<!doctype html><html lang="de"><head><title>Jura Wolpertinger</title><style>${stylesheet}</style></head><body>${main}</body></html>`
      )
      return
    }

    const assetPath = resolve(staticRoot, `.${decodeURIComponent(pathname)}`)
    if (!assetPath.startsWith(`${staticRoot}/`)) {
      response.statusCode = 403
      response.end()
      return
    }

    try {
      const asset = await readFile(assetPath)
      if (assetPath.endsWith('.png')) response.setHeader('content-type', 'image/png')
      response.end(asset)
    } catch {
      response.statusCode = 404
      response.end()
    }
  })
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Website test server did not expose a port')
  baseUrl = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch()
})

afterAll(async () => {
  await Promise.all([...contexts].map((context) => context.close()))
  await browser?.close()
  await new Promise<void>((resolveClose, reject) => {
    if (!server) return resolveClose()
    server.close((error) => (error ? reject(error) : resolveClose()))
  })
})

describe('public website responsive layout', () => {
  it.each([
    { name: 'wide desktop', width: 2400, height: 1200 },
    { name: 'mobile', width: 390, height: 844 }
  ])('preserves image proportions on $name', async ({ width, height }) => {
    const page = await openHomepage(width, height)

    for (const selector of [
      '.product-window > img',
      '.hero-wolpi',
      '.split-art > img',
      '.offline-band > img'
    ]) {
      const metrics = await imageMetrics(page, selector)
      const relativeDifference = Math.abs(metrics.renderedRatio - metrics.naturalRatio) / metrics.naturalRatio
      expect(relativeDifference, `${selector} is distorted`).toBeLessThanOrEqual(0.01)
    }

    await page.close()
  })

  it('keeps the desktop hero contained and mobile pages free of horizontal overflow', async () => {
    const desktop = await openHomepage(2400, 1200)
    const hero = desktop.locator('.hero-inner')
    expect(await hero.count()).toBe(1)
    const heroWidth = await hero.evaluate((element) => element.getBoundingClientRect().width)
    expect(heroWidth).toBeLessThanOrEqual(1520)
    await desktop.close()

    const mobile = await openHomepage(390, 844)
    const widths = await mobile.evaluate(() => ({
      viewport: window.innerWidth,
      page: document.documentElement.scrollWidth
    }))
    expect(widths.page).toBeLessThanOrEqual(widths.viewport)
    await mobile.close()
  })

  it('keeps the main heading compact at a standard desktop width', async () => {
    const page = await openHomepage(1440, 1000)
    const typography = await page.locator('.hero h1').evaluate((element) => {
      const styles = getComputedStyle(element)
      return {
        renderedHeight: element.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(styles.lineHeight)
      }
    })

    expect(Math.round(typography.renderedHeight / typography.lineHeight)).toBeLessThanOrEqual(4)
    await page.close()
  })

  it('has no serious or critical accessibility violations', async () => {
    const page = await openHomepage(1440, 1000)
    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical'
    )

    expect(blocking.map((violation) => violation.id)).toEqual([])
    await page.close()
  })
})

async function openHomepage(width: number, height: number): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height } })
  contexts.add(context)
  const page = await context.newPage()
  page.once('close', () => {
    contexts.delete(context)
    void context.close().catch(() => undefined)
  })
  await page.goto(baseUrl)
  await page.waitForFunction(() => {
    const heroImages = Array.from(document.querySelectorAll<HTMLImageElement>('.hero-product img'))
    return heroImages.length === 2 && heroImages.every((image) => image.complete && image.naturalWidth > 0)
  })
  return page
}

async function imageMetrics(page: Page, selector: string) {
  const image = page.locator(selector)
  await image.scrollIntoViewIfNeeded()
  await page.waitForFunction(
    (targetSelector) => {
      const target = document.querySelector<HTMLImageElement>(targetSelector)
      return Boolean(target?.complete && target.naturalWidth > 0)
    },
    selector
  )
  return image.evaluate((element) => {
    const image = element as HTMLImageElement
    const bounds = image.getBoundingClientRect()
    return {
      naturalRatio: image.naturalWidth / image.naturalHeight,
      renderedRatio: bounds.width / bounds.height
    }
  })
}
