import { _electron as electron } from '@playwright/test'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const projectRoot = process.cwd()
const outputDir = resolve(projectRoot, 'website/static/screenshots')
const userDataDir = await mkdtemp(join(tmpdir(), 'jura-website-screenshots-'))
const executablePath = resolve(projectRoot, 'node_modules/.bin/electron')
let app

try {
  await mkdir(outputDir, { recursive: true })
  const { ELECTRON_RENDERER_URL: _rendererUrl, ...env } = process.env
  app = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${userDataDir}`, 'out/main/index.js'],
    env: { ...env, JURA_E2E: '1', JURA_DEMO_DATA: '0' }
  })
  app.process().stdout?.on('data', (chunk) => process.stdout.write(`[electron stdout] ${chunk}`))
  app.process().stderr?.on('data', (chunk) => process.stderr.write(`[electron stderr] ${chunk}`))
  const page = await findMainWindow(app)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.evaluate(() => {
    localStorage.setItem('jura-wolpertinger-theme', 'light')
    document.documentElement.dataset.theme = 'light'
    document.documentElement.style.colorScheme = 'light'
    document.documentElement.classList.remove('dark')
  })
  const seeded = await page.evaluate(async () => {
    const api = window.juraApi
    const currentUser = await api.getCurrentUser()
    await api.completeOnboarding(currentUser.id)

    const collectionSpecs = [
      { name: 'Verwaltungsrecht – Klausurklassiker', subject: 'Öffentliches Recht', ratings: [1, 2, 3] },
      { name: 'Strafrecht AT – Prüfungsschemata', subject: 'Strafrecht', ratings: [2, 3, 4] },
      { name: 'Steuerrecht – Grundlagen', subject: 'Steuerrecht', ratings: [] }
    ]
    const collections = []
    for (const specification of collectionSpecs) {
      const collection = await api.createLearningCollection({ name: specification.name, subject: specification.subject })
      for (let index = 0; index < 5; index += 1) {
        await api.createLearningCard({
          collectionId: collection.id,
          title: `${specification.subject} ${index + 1}`,
          frontMarkdown: `Welche Struktur ist bei ${specification.subject} ${index + 1} zu prüfen?`,
          backMarkdown: 'Anspruchsgrundlage, Tatbestand, Rechtsfolge und klausurnahe Subsumtion.',
          tags: [specification.subject.toLocaleLowerCase('de-DE')]
        })
      }
      if (specification.ratings.length) {
        const run = await api.studyFlashcards({ action: 'start', collectionId: collection.id, mode: 'all' })
        for (let index = 0; index < specification.ratings.length; index += 1) {
          await api.studyFlashcards({
            action: 'rate',
            runId: run.run.id,
            cardId: run.cards[index].id,
            rating: specification.ratings[index],
            eventId: crypto.randomUUID()
          })
        }
      }
      collections.push(collection)
    }

    const folders = {}
    for (const name of ['Zivilrecht', 'Strafrecht', 'Öffentliches Recht']) {
      folders[name] = (await api.createFolder(name)).id
    }
    const exams = [
      ['Kaufrecht und Rücktritt', 'Zivilrecht'],
      ['Mietrechtliche Räumungsklage', 'Zivilrecht'],
      ['Revision im Strafrecht', 'Strafrecht'],
      ['Baurechtliche Nutzungsuntersagung', 'Öffentliches Recht'],
      ['Eilrechtsschutz nach § 80 Abs. 5 VwGO', 'Öffentliches Recht']
    ]
    for (const [title, folder] of exams) await api.createExam({ title, folderId: folders[folder] })
    return { reviewCollectionId: collections[2].id }
  })

  await page.reload({ waitUntil: 'domcontentloaded' })

  await capture(page, '#/', '.home-view', '1_home.png')
  await capture(page, '#/flashcards/collections', '.collection-grid', '2_karteikarten.png')
  await capture(page, '#/podcasts', '.podcast-legal-areas', '3_podcasts.png', true)
  await capture(page, `#/flashcards/review?collection=${seeded.reviewCollectionId}&mode=first_pass`, '.study-question', '4_wiederholen.png')
  await capture(page, '#/exams/library', '.dashboard', '5_pruefungen.png')
  await capture(page, '#/flashcards/statistics', '.learning-statistics-view', '6_statistik.png')
} finally {
  await app?.close()
  await rm(userDataDir, { recursive: true, force: true })
}

async function findMainWindow(electronApp) {
  let observedUrls = []
  for (let attempt = 0; attempt < 80; attempt += 1) {
    observedUrls = electronApp.windows().map((candidate) => candidate.url())
    const page = electronApp.windows().find((candidate) => candidate.url().startsWith('file:'))
    if (page) {
      await page.waitForLoadState('domcontentloaded')
      return page
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Main window did not appear. Observed URLs: ${observedUrls.join(', ') || '(none)'}`)
}

async function capture(page, hash, readySelector, fileName, waitForImages = false) {
  await page.evaluate((nextHash) => { window.location.hash = nextHash }, hash)
  await page.locator(readySelector).first().waitFor({ state: 'visible' })
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(document.getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => undefined)))
  })
  if (waitForImages) {
    await page.waitForFunction(() => [...document.images].every((image) => image.complete))
  }
  await page.screenshot({
    path: resolve(outputDir, fileName),
    animations: 'disabled',
    fullPage: false
  })
}
