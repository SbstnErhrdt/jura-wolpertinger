// Explicit deployment smoke. Uses only a newly created disposable account, then removes it.
// Credentials stay in memory; real accounts and learning data are never written.
const { execFileSync } = require('node:child_process')
const { randomUUID, randomBytes } = require('node:crypto')
const { readFileSync, existsSync, statSync } = require('node:fs')
const { resolve, relative, join } = require('node:path')
const assert = require('node:assert/strict')
const { chromium, expect } = require('@playwright/test')
const { createClient } = require('@supabase/supabase-js')
const AxeBuilder = require('@axe-core/playwright').default
const origin = 'https://app.jura-wolpi.de'
const env = execFileSync('ssh', ['-o', 'BatchMode=yes', 'server.02', 'cat /home/docker-compose/jura-supabase-wolpi/.env'], { encoding: 'utf8' })
const key = name => {
  const value = env.match(new RegExp('^' + name + '=(.*)$', 'm'))?.[1].trim().replace(/^['"]|['"]$/g, '')
  assert(value, `Missing configured ${name}`)
  return value
}
const anonKey = key('ANON_KEY'), serviceKey = key('SERVICE_ROLE_KEY')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(origin + '/api', serviceKey, options)
const client = createClient(origin + '/api', anonKey, options)
const email = `catalog-smoke-${randomUUID()}@example.invalid`
const password = randomBytes(30).toString('base64url')
const build = process.env.STUDY_CATALOG_BUILD_DIR && resolve(process.env.STUDY_CATALOG_BUILD_DIR)
const publishedBuild = process.env.STUDY_CATALOG_PUBLISHED_DIR && resolve(process.env.STUDY_CATALOG_PUBLISHED_DIR)
let userId, browser, stage = 'temporary account', token = ''
const checked = result => { if (result.error) throw result.error; return result.data }
const safe = error => [anonKey, serviceKey, password, email, token].filter(Boolean).reduce((message, secret) => message.split(secret).join('[redacted]'), String(error.message || error))
async function catalog(search = '', page = 1) {
  return checked(await client.rpc('get_study_collection_catalog', { p_search: search, p_page: page })).catalog
}
async function settle(page) {
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))) })
}
;(async () => {
  try {
    userId = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: 'Katalog', last_name: 'Test' } })).user.id
    token = checked(await client.auth.signInWithPassword({ email, password })).session.access_token
    assert.equal((await catalog()).collectionCount, 0)
    const dueId = randomUUID(), activeId = randomUUID(), newId = randomUUID()
    const collections = [
      ...Array.from({ length: 26 }, (_, i) => ({ id: randomUUID(), name: `Leere Testsammlung ${i}`, subject: 'Test' })),
      { id: dueId, name: 'Wiederholen – Katalogprüfung', subject: 'Öffentliches Recht' },
      { id: activeId, name: 'Fortsetzen – Katalogprüfung', subject: 'Zivilrecht' },
      { id: newId, name: 'Kleiner Einstieg – Katalogprüfung', subject: 'Strafrecht' }
    ].map(c => ({ ...c, owner_user_id: userId, author_user_id: userId, visibility: 'private' }))
    checked(await admin.from('learning_collections').insert(collections))
    const cards = [
      ...Array.from({ length: 4 }, () => ({ id: randomUUID(), collection: dueId })),
      ...Array.from({ length: 3 }, () => ({ id: randomUUID(), collection: activeId })),
      { id: randomUUID(), collection: newId }
    ]
    checked(await admin.from('learning_items').insert(cards.map((c, i) => ({ id: c.id, primary_collection_id: c.collection, owner_user_id: userId, author_user_id: userId, title: `Testkarte ${i}` }))))
    checked(await admin.from('learning_prompts').insert(cards.map((c, i) => ({ id: c.id, item_id: c.id, prompt_type: 'qa', front_markdown: `Testfrage ${i}`, back_markdown: 'Testantwort' }))))
    checked(await admin.from('learning_prompt_schedules').insert(cards.map((c, i) => ({ user_id: userId, prompt_id: c.id, reps: i < 2 ? 1 : 0, lapses: 0, last_rating: i < 2 ? 3 : null, due_at: i === 0 ? '2020-01-01T00:00:00Z' : '2099-01-01T00:00:00Z' }))))
    const active = checked(await client.rpc('study_flashcards', { p_command: { action: 'start', collectionId: activeId, mode: 'first_pass' } }))
    stage = 'authenticated catalog contract'
    const overview = await catalog()
    assert.equal(overview.collectionCount, 29)
    assert.equal(overview.items.length, 24)
    assert.equal((await catalog('', 2)).items.length, 5)
    assert.equal(overview.recommendation.kind, 'review')
    assert.equal(overview.recommendation.collection.id, dueId)
    const searched = await catalog('  ÖFFENTLICHES  ')
    assert.equal(searched.total, 1)
    assert.equal(searched.items[0].overview.reviewedCards, 2)
    assert.equal(searched.items[0].overview.eligibleCards, 4)
    assert.equal(searched.items[0].defaultRun, null)
    assert.equal((await catalog('nonexistent')).recommendation.collection.id, dueId)
    const beforeRuns = checked(await admin.from('flashcard_study_runs').select('*').eq('user_id', userId).order('id'))
    await catalog(); await catalog('Zivilrecht')
    assert.deepEqual(checked(await admin.from('flashcard_study_runs').select('*').eq('user_id', userId).order('id')), beforeRuns)
    console.log('PASS: authenticated catalog, 24/5 pagination, global ranking, literal search, counts and read-only runs')
    if (publishedBuild) {
      const index = readFileSync(join(publishedBuild, 'index.html'))
      assert.deepEqual(Buffer.from(await (await fetch(origin + '/')).arrayBuffer()), index)
      for (const m of index.toString().matchAll(/(?:src|href)="(?:\.\/)?(assets\/[^" ]+\.(?:js|css))"/g)) {
        const response = await fetch(origin + '/' + m[1]); assert.equal(response.status, 200)
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), readFileSync(join(publishedBuild, m[1])))
      }
      console.log('PASS: public HTML, JS and CSS are byte-identical to the tested candidate')
    }
    stage = 'browser login'
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    if (build) await page.route(origin + '/**', async route => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname.startsWith('/api/') || pathname.startsWith('/voice/')) return route.continue()
      const file = resolve(build, '.' + (pathname === '/' ? '/index.html' : pathname))
      if (!relative(build, file).startsWith('..') && existsSync(file) && statSync(file).isFile()) return route.fulfill({ path: file })
      return route.abort()
    })
    await page.goto(origin + '/')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: 'Jetzt einloggen', exact: true }).click()
    await expect(page.locator('.home-view')).toBeVisible({ timeout: 25000 })
    if (await page.getByRole('button', { name: 'Später entscheiden' }).isVisible()) await page.getByRole('button', { name: 'Später entscheiden' }).click()
    stage = 'collection UX'
    await page.goto(origin + '/#/flashcards/collections')
    await expect(page.locator('.collection-card')).toHaveCount(24)
    await expect(page.locator('.study-recommendation')).toContainText('Eine Karte ist zur Wiederholung fällig.')
    await page.getByRole('button', { name: 'Nächste Seite', exact: true }).click()
    await expect(page.locator('.collection-card')).toHaveCount(5)
    const search = page.getByRole('searchbox', { name: 'Sammlungen suchen' })
    await search.fill('öffentliches')
    await expect(page.locator('.collection-card')).toHaveCount(1)
    await expect(page.locator('.collection-card')).toContainText('2 von 4 Karten einmal bearbeitet')
    await expect(page.getByRole('img', {
      name: 'Lernstand Wiederholen – Katalogprüfung: 0 Nicht gewusst, 0 Teilweise gewusst, 2 Gewusst, 2 Noch nicht bearbeitet'
    })).toBeVisible()
    await search.fill('nonexistent')
    await expect(page.getByText('Keine passenden Sammlungen gefunden.')).toBeVisible()
    await expect(page.locator('.study-recommendation')).toContainText('Wiederholen – Katalogprüfung')
    await page.getByRole('button', { name: 'Suche zurücksetzen', exact: true }).click()
    await expect(page.locator('.collection-card')).toHaveCount(24)
    await search.fill('öffentliches')
    await expect(page.locator('.collection-card')).toHaveCount(1)
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.style.colorScheme = theme }, theme)
      await page.setViewportSize({ width: theme === 'dark' ? 390 : 1440, height: 1000 })
      await settle(page)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      const scan = await new AxeBuilder({ page }).analyze()
      assert.deepEqual(scan.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [])
      await page.screenshot({ path: `/tmp/jura-study-catalog-${build ? 'candidate' : 'live'}-${theme}.png`, fullPage: true, animations: 'disabled' })
    }
    await page.locator('.study-recommendation').getByRole('link', { name: 'Jetzt wiederholen' }).click()
    await expect(page).toHaveURL(/mode=review/)
    await expect(page.locator('.study-card-toolbar')).toContainText('0 von 1')
    // All further writes remain within the disposable account.
    checked(await admin.from('learning_prompt_schedules').update({ due_at: '2099-01-01T00:00:00Z' }).eq('user_id', userId))
    // The review just opened is now the most recent run. Complete it explicitly as test data.
    const reviewRuns = checked(await admin.from('flashcard_study_runs').select('id').eq('user_id', userId).eq('collection_id', dueId))
    if (reviewRuns.length) checked(await admin.from('flashcard_study_members').update({ completed: true }).in('run_id', reviewRuns.map(r => r.id)))
    await page.goto(origin + '/#/flashcards/collections')
    await expect(page.locator('.study-recommendation')).toContainText('Fortsetzen – Katalogprüfung')
    await page.locator('.study-recommendation').getByRole('link', { name: 'Durchgang fortsetzen' }).click()
    await expect(page).toHaveURL(new RegExp('run=' + active.run.id))
    await expect(page.locator('.study-question')).toBeVisible()
    for (const card of active.cards) checked(await client.rpc('study_flashcards', { p_command: { action: 'rate', runId: active.run.id, cardId: card.id, rating: 3, eventId: randomUUID() } }))
    await page.goto(origin + '/#/flashcards/collections')
    await expect(page.locator('.study-recommendation')).toContainText('Kleiner Einstieg – Katalogprüfung')
    assert.equal((await catalog()).recommendation.kind, 'new')
    await page.goto(origin + '/#/exams/library')
    await expect(page.locator('.dashboard')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Neue Klausur', exact: true })).toBeVisible()
    assert.deepEqual(errors, [])
    console.log('PASS: browser login, search/reset, pagination, progress, recommendation review/resume/new, exams, mobile/light/dark Axe; no page errors')
  } catch (error) {
    console.error(`FAIL at ${stage}: ${safe(error).slice(0, 2500)}`)
    process.exitCode = 1
  } finally {
    if (browser) await browser.close()
    if (userId) {
      try {
        assert(email.startsWith('catalog-smoke-') && email.endsWith('@example.invalid'))
        checked(await admin.from('learning_collections').delete().eq('owner_user_id', userId))
        checked(await admin.auth.admin.deleteUser(userId))
        console.log('PASS: disposable production account and its test collections removed')
      } catch (error) { console.error('Cleanup failed: ' + safe(error)); process.exitCode = 1 }
    }
  }
})()
