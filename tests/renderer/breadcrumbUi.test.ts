import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

const breadcrumbPages = [
  'views/FlashcardsCollectionsView.vue',
  'views/FlashcardsCollectionDetailView.vue',
  'views/FlashcardsReviewView.vue',
  'views/DashboardView.vue',
  'views/ExamView.vue',
  'views/CorrectionView.vue',
  'views/AnalyticsView.vue',
  'views/FlashcardsStatisticsView.vue',
  'views/ExamsHubView.vue',
  'views/MoreHubView.vue',
  'views/PodcastsView.vue',
  'views/PodcastSeriesView.vue',
  'views/SettingsView.vue',
  'views/AboutView.vue',
  'views/HelpView.vue'
]

describe('breadcrumb navigation', () => {
  it('uses one app breadcrumb component for every page', async () => {
    const component = await readFile(resolve(rendererRoot, 'components/ui/AppBreadcrumb.vue'), 'utf8').catch(() => '')

    expect(component).toContain('app-breadcrumb')
    expect(component).toContain('<UBreadcrumb')
    expect(component).toContain(':items="withHomeIcon(items)"')

    const pages = (await readdir(resolve(rendererRoot, 'views'))).filter(file => file.endsWith('.vue')).map(file => 'views/' + file)
    for (const page of pages) {
      const source = await readFile(resolve(rendererRoot, page), 'utf8')
      expect(source, page).not.toContain('<UBreadcrumb')
      expect(source, page).not.toContain('withHomeIcon')
      if (breadcrumbPages.includes(page)) expect(source, page).toContain('<AppBreadcrumb')
    }
  })

  it('owns breadcrumb presentation without legacy global overrides', async () => {
    const [component, styles] = await Promise.all([
      readFile(resolve(rendererRoot, 'components/ui/AppBreadcrumb.vue'), 'utf8'),
      readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')
    ])

    expect(component).toContain('<style scoped>')
    expect(component).toContain('aria-label="Pfad"')
    expect(component).toContain("[data-slot='linkLabel']")
    expect(component).toContain(':focus-visible')
    expect(component).toContain("[aria-current='page']")
    expect(component).toContain("[data-theme='dark']")
    expect(styles).not.toMatch(/\.app-breadcrumb-(link|current|separator|item)\b/)
    expect(styles).not.toContain(".app-breadcrumb [data-slot=")
  })
})
