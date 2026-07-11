import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('mobile hub navigation', () => {
  it('routes mobile top-level navigation through hub pages', async () => {
    const app = await readFile(resolve(rendererRoot, 'App.vue'), 'utf8')
    const router = await readFile(resolve(rendererRoot, 'router.ts'), 'utf8')

    expect(router).toContain("name: 'flashcards'")
    expect(router).toContain("name: 'exams'")
    expect(router).toContain("name: 'more'")
    expect(router).toContain("path: '/flashcards'")
    expect(router).toContain("path: '/exams'")
    expect(router).toContain("path: '/more'")
    expect(router).toContain('FlashcardsHubView')
    expect(router).toContain('ExamsHubView')
    expect(router).toContain('MoreHubView')

    expect(app).toContain("name: 'flashcards'")
    expect(app).toContain("name: 'exams'")
    expect(app).toContain("name: 'more'")
    expect(app).toContain("label: 'Karteikarten'")
    expect(app).toContain("label: 'Prüfungen'")
    expect(app).toContain("label: 'Mehr'")
    expect(app).not.toContain('<span>Karten</span>')
  })

  it('lays out Nuxt UI navigation list items in four stable mobile columns', async () => {
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(styles).toMatch(/\.mobile-nav\s+\[data-slot='list'\]\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s)
    expect(styles).toMatch(/\.mobile-nav\s*>\s*div:first-child\s*\{[^}]*width:\s*100%/s)
    expect(styles).toMatch(/\.mobile-nav\s+\[data-slot='item'\]\s*\{[^}]*min-width:\s*0/s)
  })

  it('defines consistent mobile hover, active, focus and dark interaction states', async () => {
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(styles).toMatch(/\.mobile-nav a:hover\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.mobile-nav a\[data-active\]\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.mobile-nav a\.router-link-active\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.mobile-nav a:focus-visible\s*\{[^}]*outline:\s*2px solid/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.mobile-nav\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.mobile-nav a:hover\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.mobile-nav a\[data-active\]\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.mobile-nav a\.router-link-active\s*\{[^}]*background:/s)
  })

  it('provides hub pages with the missing desktop subnavigation actions', async () => {
    const flashcardsHub = await readFile(resolve(rendererRoot, 'views/FlashcardsHubView.vue'), 'utf8')
    const examsHub = await readFile(resolve(rendererRoot, 'views/ExamsHubView.vue'), 'utf8')
    const moreHub = await readFile(resolve(rendererRoot, 'views/MoreHubView.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(flashcardsHub).toContain('Karteikarten')
    expect(flashcardsHub).toContain("name: 'flashcards-review'")
    expect(flashcardsHub).toContain("name: 'flashcards-collections'")

    expect(examsHub).toContain('Prüfungen')
    expect(examsHub).toContain("name: 'dashboard'")
    expect(examsHub).toContain("name: 'correction'")
    expect(examsHub).toContain("name: 'analytics'")

    expect(moreHub).toContain('Mehr')
    expect(moreHub).toContain("name: 'settings'")
    expect(moreHub).toContain("name: 'help'")
    expect(moreHub).toContain("name: 'about'")

    expect(styles).toContain('.mobile-hub-grid')
    expect(styles).toContain('.mobile-hub-link')
  })

  it('uses hub-aware breadcrumbs on nested pages', async () => {
    const dashboard = await readFile(resolve(rendererRoot, 'views/DashboardView.vue'), 'utf8')
    const correction = await readFile(resolve(rendererRoot, 'views/CorrectionView.vue'), 'utf8')
    const analytics = await readFile(resolve(rendererRoot, 'views/AnalyticsView.vue'), 'utf8')
    const flashcardsCollections = await readFile(resolve(rendererRoot, 'views/FlashcardsCollectionsView.vue'), 'utf8')
    const flashcardsReview = await readFile(resolve(rendererRoot, 'views/FlashcardsReviewView.vue'), 'utf8')
    const exam = await readFile(resolve(rendererRoot, 'views/ExamView.vue'), 'utf8')
    const settings = await readFile(resolve(rendererRoot, 'views/SettingsView.vue'), 'utf8')
    const help = await readFile(resolve(rendererRoot, 'views/HelpView.vue'), 'utf8')
    const about = await readFile(resolve(rendererRoot, 'views/AboutView.vue'), 'utf8')

    expect(dashboard).toContain("{ label: 'Prüfungen', to: { name: 'exams' } }")
    expect(correction).toContain("{ label: 'Prüfungen', to: { name: 'exams' } }")
    expect(analytics).toContain("{ label: 'Prüfungen', to: { name: 'exams' } }")
    expect(exam).toContain("{ label: 'Prüfungen', to: { name: 'exams' } }")

    expect(flashcardsCollections).toContain("{ label: 'Karteikarten', to: { name: 'flashcards' } }")
    expect(flashcardsReview).toContain("{ label: 'Karteikarten', to: { name: 'flashcards' } }")

    expect(settings).toContain("{ label: 'Mehr', to: { name: 'more' } }")
    expect(help).toContain("{ label: 'Mehr', to: { name: 'more' } }")
    expect(about).toContain("{ label: 'Mehr', to: { name: 'more' } }")
  })

  it('keeps correction breadcrumbs out of the narrow submission sidebar', async () => {
    const correction = await readFile(resolve(rendererRoot, 'views/CorrectionView.vue'), 'utf8')
    const listHeaderStart = correction.indexOf('<div class="correction-list-header">')
    const listHeaderEnd = correction.indexOf('<div v-if="submittedItems.length"', listHeaderStart)
    const listHeader = correction.slice(listHeaderStart, listHeaderEnd)

    expect(listHeader).not.toContain('UBreadcrumb')
    expect(correction).toContain(':items="withHomeIcon(detailBreadcrumbItems)"')
    expect(correction).toContain(':items="withHomeIcon(listBreadcrumbItems)"')
  })
})
