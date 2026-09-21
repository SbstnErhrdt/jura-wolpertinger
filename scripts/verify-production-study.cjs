// Explicit production verification: creates only private disposable test data, then removes it.
// Requires server.02 SSH access and an installed Playwright Chromium browser. Never logs credentials.
const { createRequire } = require('node:module')
const { execFileSync } = require('node:child_process')
const { randomUUID, randomBytes } = require('node:crypto')
const assert = require('node:assert/strict')
const repoRequire = createRequire(require('node:path').resolve(process.cwd(), 'package.json'))
const { chromium, expect } = repoRequire('@playwright/test')
const { createClient } = repoRequire('@supabase/supabase-js')
const serverEnv = execFileSync('ssh', ['-o', 'BatchMode=yes', 'server.02', 'cat /home/docker-compose/jura-supabase-wolpi/.env'], { encoding: 'utf8' })
const getKey = (name) => serverEnv.match(new RegExp('^' + name + '=(.*)$', 'm'))[1].trim().replace(/^['"]|['"]$/g, '')
const anonKey = getKey('ANON_KEY')
const serviceKey = getKey('SERVICE_ROLE_KEY')
const url = 'https://app.jura-wolpi.de/api'
const appUrl = process.env.JURA_STUDY_APP_URL || 'https://app.jura-wolpi.de'
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, options)
const client = createClient(url, anonKey, options)
const email = `study-smoke-${randomUUID()}@example.invalid`
const password = randomBytes(30).toString('base64url')
let userId, browser, page, stage = 'create temporary account'
let releaseHeldRequests = () => {}
const checked = (result) => { if (result.error) throw result.error; return result.data }
const waitForSignal = async promise => {
  let timer
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Expected intercepted request did not arrive')), 15000) })]) }
  finally { clearTimeout(timer) }
}
const safeMessage = (error) => [password, email, anonKey, serviceKey].reduce((message, secret) => message.split(secret).join('[redacted]'), String(error.message || error))
;(async () => {
  try {
    const created = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: 'Lernfluss', last_name: 'Test' } }))
    userId = created.user.id
    checked(await client.auth.signInWithPassword({ email, password }))
    stage = 'authenticated RPC compatibility'
    const emptyProgress = { p_schedules: [], p_review_events: [], p_runs: [], p_expected_schedules: [] }
    checked(await client.rpc('sync_flashcard_learning_progress', emptyProgress))
    checked(await client.rpc('sync_flashcard_learning_progress', { ...emptyProgress, p_schedule_deletions: [] }))
    console.log('PASS: authenticated four- and five-argument progress RPC compatibility')
    stage = 'browser login'
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.setDefaultTimeout(15000)
    if (process.env.JURA_STUDY_BUILD_DIR) {
      const { resolve, relative } = require('node:path')
      const { stat } = require('node:fs/promises')
      const root = resolve(process.env.JURA_STUDY_BUILD_DIR)
      // Test candidate bytes at the real origin, preserving the production CSP and API paths.
      await page.route(`${appUrl}/**`, async route => {
        const pathname = new URL(route.request().url()).pathname
        if (pathname.startsWith('/api/') || pathname.startsWith('/voice/')) { await route.continue(); return }
        const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
        if (!relative(root, file).startsWith('..') && (await stat(file).catch(() => null))?.isFile()) await route.fulfill({ path: file })
        else await route.abort()
      })
    }
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    if (process.env.JURA_STUDY_DIAGNOSTICS === '1') {
      page.on('requestfailed', request => console.log('Request failed:', new URL(request.url()).pathname, request.failure()?.errorText))
      page.on('response', response => { if (response.status() >= 400) console.log('HTTP:', response.status(), new URL(response.url()).pathname) })
      page.on('console', message => { if (message.type() === 'error') console.log('Browser error:', safeMessage(message.text())) })
      page.on('request', request => {
        if (request.url().includes('/auth/v1/token')) {
          const body = request.postDataJSON()
          console.log('Auth request:', new URL(request.url()).origin, { emailMatches: body?.email === email, passwordMatches: body?.password === password })
        }
      })
    }
    await page.goto(`${appUrl}/`, { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: 'Jetzt einloggen', exact: true }).click()
    await expect(page.locator('.home-view')).toBeVisible({ timeout: 25000 })
    if (await page.getByRole('button', { name: 'Später entscheiden' }).isVisible()) await page.getByRole('button', { name: 'Später entscheiden' }).click()
    console.log('PASS: production browser login')
    stage = 'create collection and first card in browser'
    await page.locator('.nav a', { hasText: 'Sammlungen' }).click()
    await page.getByRole('button', { name: 'Neue Sammlung', exact: true }).click()
    await page.locator('.dialog-card input[placeholder="z. B. Strafrecht AT"]').fill('Lernfluss – Produktionsprüfung')
    await page.locator('.dialog-card input[placeholder="z. B. Strafrecht"]').fill('Zivilrecht')
    await page.locator('.dialog-actions').getByRole('button', { name: 'Sammlung speichern' }).click()
    await expect(page).toHaveURL(/#\/flashcards\/collections\/[a-f0-9-]+/)
    const collectionUrl = page.url()
    const collectionId = collectionUrl.split('/').pop()
    await page.locator('header').getByRole('button', { name: 'Neue Karteikarte', exact: true }).click()
    await page.locator('input[placeholder="Kurzer Titel, z. B. Abmahnung"]').fill('Prüfkarte 1')
    await page.locator('textarea[placeholder="Was soll auf der Vorderseite stehen?"]').fill('Prüffrage 1')
    await page.locator('textarea[placeholder="Was soll auf der Rückseite stehen?"]').fill('1. **Anspruch entstanden**\n2. Anspruch nicht erloschen')
    await page.locator('.dialog-actions').getByRole('button', { name: 'Karteikarte speichern' }).click()
    await expect(page.locator('.action-notice')).toContainText('Karteikarte gespeichert')
    console.log('PASS: production collection and card creation')
    stage = 'seed remaining temporary cards'
    const items = Array.from({ length: 46 }, (_, i) => ({ id: randomUUID(), primary_collection_id: collectionId, owner_user_id: userId, author_user_id: userId, title: `Prüfkarte ${i + 2}`, source_kind: 'manual', is_archived: false }))
    checked(await client.from('learning_items').insert(items))
    const prompts = items.map((item, i) => ({ id: randomUUID(), item_id: item.id, prompt_type: 'qa', front_markdown: `Prüffrage ${i + 2}`, back_markdown: '1. **Anspruch entstanden**\n2. Anspruch nicht erloschen', sort_index: 0, is_archived: false }))
    checked(await client.from('learning_prompts').insert(prompts))
    checked(await client.from('learning_prompt_schedules').insert(prompts.map(prompt => ({ user_id: userId, prompt_id: prompt.id, due_at: new Date().toISOString(), reps: 0, lapses: 0, last_rating: null, last_reviewed_at: null }))))
    stage = 'delayed collection loading and navigation regression'
    let collectionRequestArrived
    const collectionArrival = new Promise(resolve => { collectionRequestArrived = resolve })
    const collectionGate = new Promise(resolve => { releaseHeldRequests = resolve })
    const holdCollection = async route => { collectionRequestArrived(); await collectionGate; await route.continue() }
    await page.route('**/api/rest/v1/rpc/get_learning_collection_summaries', holdCollection)
    const overviewResponse = page.waitForResponse(response => response.url().endsWith('/rpc/study_flashcards') && response.request().postDataJSON()?.p_command?.action === 'overview')
    await page.reload()
    await waitForSignal(collectionArrival)
    await overviewResponse
    await expect(page.locator('header').getByRole('link', { name: 'Sammlung durcharbeiten' })).toBeDisabled()
    await page.locator('.nav a', { hasText: 'Bibliothek' }).click()
    const releasedResponse = page.waitForResponse(response => response.url().endsWith('/rpc/get_learning_collection_summaries'))
    releaseHeldRequests()
    await releasedResponse
    await page.unroute('**/api/rest/v1/rpc/get_learning_collection_summaries', holdCollection)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/#\/exams\/library$/)
    console.log('PASS: delayed collection response cannot enable premature start or hijack subsequent navigation')
    await page.goto(collectionUrl)
    await expect(page.locator('.page-header')).toContainText('47 Karten')
    await page.locator('header').getByRole('link', { name: 'Sammlung durcharbeiten' }).click()
    await expect(page.locator('.study-card-toolbar')).toContainText('0 von 47')
    stage = 'navigation between runs of the same collection'
    const firstPassUrl = page.url()
    const alternate = checked(await client.rpc('study_flashcards', { p_command: { action: 'start', collectionId, mode: 'all' } }))
    let alternateRequestArrived
    const alternateArrival = new Promise(resolve => { alternateRequestArrived = resolve })
    const alternateGate = new Promise(resolve => { releaseHeldRequests = resolve })
    const holdAlternateRun = async route => {
      const command = route.request().postDataJSON()?.p_command
      if (command?.action === 'batch' && command.runId === alternate.run.id) { alternateRequestArrived(); await alternateGate }
      await route.continue()
    }
    await page.route('**/api/rest/v1/rpc/study_flashcards', holdAlternateRun)
    await page.goto(`${appUrl}/#/flashcards/review?collection=${collectionId}&run=${alternate.run.id}&mode=all`)
    await waitForSignal(alternateArrival)
    await page.goto(firstPassUrl)
    await expect(page.locator('.study-card-toolbar')).toContainText('Erster Durchgang')
    const alternateResponse = page.waitForResponse(response => response.url().endsWith('/rpc/study_flashcards') && response.request().postDataJSON()?.p_command?.runId === alternate.run.id)
    releaseHeldRequests()
    await alternateResponse
    await page.unroute('**/api/rest/v1/rpc/study_flashcards', holdAlternateRun)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(firstPassUrl)
    await expect(page.locator('.study-card-toolbar')).toContainText('0 von 47')
    console.log('PASS: delayed response from another run cannot replace the chosen run')
    stage = 'large production study run'
    const deferred = await page.locator('.study-question .markdown-block').innerText()
    await page.getByRole('button', { name: 'Für später zurückstellen' }).click()
    await expect(page.locator('.study-question .markdown-block')).not.toHaveText(deferred)
    const seen = new Set()
    let firstMilestoneImage
    for (let i = 0; i < 46; i++) {
      const question = page.locator('.study-question .markdown-block')
      await expect(question).toBeVisible()
      await expect(page.locator('.study-card-toolbar')).toContainText(`${i} von 47`)
      const text = await question.innerText()
      assert.notEqual(text, deferred)
      assert(!seen.has(text), 'unseen card must not be displaced by a repeated card')
      seen.add(text)
      await page.getByRole('button', { name: 'Antwort zeigen' }).click()
      await expect(page.locator('.study-answer ol > li')).toHaveCount(2)
      const attemptedEvents = []
      const loseSavedResponse = async route => {
        const command = route.request().postDataJSON()?.p_command
        if (command?.action === 'rate') {
          attemptedEvents.push(command.eventId)
          if (attemptedEvents.length === 1) { await route.fetch(); await route.abort(); return }
        }
        await route.continue()
      }
      if (i === 9) await page.route('**/api/rest/v1/rpc/study_flashcards', loseSavedResponse)
      await page.getByRole('button', { name: /^Nicht gewusst/ }).click()
      if (i === 9) {
        await expect(page.getByRole('alert')).toContainText('Der Durchgang konnte nicht aktualisiert werden')
        await expect(page.getByRole('complementary', { name: 'Lernerfolg', exact: true })).toHaveCount(0)
        await page.getByRole('button', { name: 'Erneut versuchen' }).click()
        const celebration = page.getByRole('complementary', { name: 'Lernerfolg', exact: true })
        await expect(celebration).toContainText('10 Karten bearbeitet')
        assert.equal(attemptedEvents.length, 2)
        assert.equal(attemptedEvents[0], attemptedEvents[1])
        await page.unroute('**/api/rest/v1/rpc/study_flashcards', loseSavedResponse)
        await expect.poll(() => celebration.locator('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
        firstMilestoneImage = await celebration.locator('img').getAttribute('src')
        await page.screenshot({ path: '/tmp/wolpi-production-milestone.png', fullPage: true, animations: 'disabled' })
        await page.getByRole('button', { name: 'Motivation ausblenden' }).click()
        await expect(celebration).toHaveCount(0)
        console.log('PASS: uncertain saved tenth rating retries once with the same event ID; milestone loads and is dismissible')
      }
      if (i === 19) {
        const celebration = page.getByRole('complementary', { name: 'Lernerfolg', exact: true })
        await expect(celebration).toContainText('20 Karten bearbeitet')
        assert.notEqual(await celebration.locator('img').getAttribute('src'), firstMilestoneImage)
        await page.setViewportSize({ width: 390, height: 844 })
        await page.screenshot({ path: '/tmp/wolpi-production-mobile.png', fullPage: true, animations: 'disabled' })
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        await page.setViewportSize({ width: 1440, height: 1000 })
      }
      if (i === 1) {
        await page.getByRole('button', { name: 'Bewertung rückgängig machen' }).click()
        await expect(question).toHaveText(text)
        await expect(page.locator('.study-card-toolbar')).toContainText('1 von 47')
        await page.getByRole('button', { name: /^Teilweise gewusst/ }).click()
      }
      if (i === 20) {
        await page.getByRole('button', { name: 'Pause machen' }).click()
        await expect(page.locator('.study-summary')).toContainText('21 Karten in dieser Lerneinheit')
        await page.getByRole('button', { name: 'Weiterlernen', exact: true }).click()
        await page.reload()
        await expect(page.locator('.study-card-toolbar')).toContainText('21 von 47')
        await expect(page.locator('.study-answer')).toHaveCount(0)
      }
    }
    await expect(page.locator('.empty-state')).toContainText('1 Karte noch offen')
    await page.getByRole('button', { name: 'Offene Karten bearbeiten' }).click()
    await expect(page.locator('.study-question .markdown-block')).toHaveText(deferred)
    await page.getByRole('button', { name: 'Antwort zeigen' }).click()
    await page.getByRole('button', { name: /^Gewusst/ }).click()
    await expect(page.locator('.study-summary')).toContainText('47 von 47')
    await expect(page.locator('.study-summary')).toContainText('Sammlung einmal vollständig bearbeitet')
    await expect(page.getByRole('complementary', { name: 'Durchgang geschafft' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Lernerfolg', exact: true })).toHaveCount(0)
    await page.screenshot({ path: '/tmp/study-production-completed.png', fullPage: true })
    const events = checked(await client.from('review_events').select('id,voided_at').eq('user_id', userId))
    assert.equal(events.filter(event => !event.voided_at).length, 47)
    assert.equal(events.filter(event => event.voided_at).length, 1)
    console.log('PASS: 47 distinct production cards, wrong ratings, undo, pause, reload, batch boundary, deferred card, completion and exact event counts')
    stage = 'production exams browser smoke'
    await page.goto(`${appUrl}/#/exams/`)
    await expect(page.locator('.mobile-hub-grid')).toContainText('Bibliothek')
    await page.locator('.nav a', { hasText: 'Bibliothek' }).click()
    await expect(page.getByRole('button', { name: 'Neue Klausur', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Neue Klausur', exact: true }).click()
    await expect(page.locator('.dialog-card input[placeholder="Titel"]')).toBeVisible()
    await page.locator('.dialog-card input[placeholder="Titel"]').fill('Produktionsprüfung – Testentwurf')
    await page.locator('.dialog-actions').getByRole('button', { name: 'Erstellen', exact: true }).click()
    await expect(page.locator('.title-input')).toHaveValue('Produktionsprüfung – Testentwurf')
    await page.locator('.exam-editor-surface').click()
    await page.keyboard.type('Anspruch entstanden. Weitere Prüfung.')
    await expect(page.locator('.exam-editor-surface')).toContainText('Anspruch entstanden.')
    assert.equal(pageErrors.length, 0, pageErrors.join('\n'))
    console.log('PASS: production exams navigation, draft creation and writing; no page errors')
  } catch (error) {
    console.error(`FAIL at ${stage}: ${safeMessage(error)}`)
    if (page) console.error(safeMessage(await page.locator('body').innerText().catch(() => 'Page unavailable')).slice(0, 4500))
    process.exitCode = 1
  } finally {
    releaseHeldRequests()
    if (browser) await browser.close()
    if (userId) {
      const collections = await admin.from('learning_collections').delete().eq('owner_user_id', userId)
      if (collections.error) { console.error('FAIL: temporary collection cleanup: ' + safeMessage(collections.error)); process.exitCode = 1 }
      const deleted = await admin.auth.admin.deleteUser(userId)
      if (deleted.error) { console.error('FAIL: temporary account cleanup: ' + safeMessage(deleted.error)); process.exitCode = 1 }
      else console.log('PASS: temporary production account removed')
    }
  }
})()
