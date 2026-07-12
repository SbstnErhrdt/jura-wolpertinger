import { readFile } from 'node:fs/promises'
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
  'views/AnalyticsView.vue'
]

describe('breadcrumb navigation', () => {
  it('uses Nuxt UI breadcrumbs outside the protected exam view', async () => {
    const component = await readFile(resolve(rendererRoot, 'components/ui/AppBreadcrumb.vue'), 'utf8').catch(() => '')

    expect(component).toContain('app-breadcrumb')

    for (const page of breadcrumbPages) {
      const source = await readFile(resolve(rendererRoot, page), 'utf8')
      if (page.endsWith('ExamView.vue')) expect(source, page).toContain('AppBreadcrumb')
      else expect(source, page).toContain('UBreadcrumb')
    }
  })

  it('defines consistent breadcrumb hover, current, focus and dark interaction states', async () => {
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(styles).toMatch(/\.app-breadcrumb-link:hover\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.app-breadcrumb a\[data-slot='link'\]:hover\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.app-breadcrumb-current\[aria-current='page'\]\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.app-breadcrumb-current\[aria-current='page'\]\s*\{[^}]*background:\s*var\(--color-primary-strong\)/s)
    expect(styles).toMatch(/\.app-breadcrumb span\[data-slot='link'\]\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.app-breadcrumb span\[data-slot='link'\]\s*\{[^}]*background:\s*var\(--color-primary-strong\)/s)
    expect(styles).toMatch(/\.app-breadcrumb-link:focus-visible\s*\{[^}]*outline:\s*2px solid/s)
    expect(styles).toContain('--color-primary-strong: var(--wolpi-nav-blue)')
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.app-breadcrumb\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.app-breadcrumb-link:hover\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.app-breadcrumb a\[data-slot='link'\]:hover\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.app-breadcrumb-current\[aria-current='page'\]\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.app-breadcrumb-current\[aria-current='page'\]\s*\{[^}]*background:\s*var\(--wolpi-nav-blue\)/s)
  })
})
