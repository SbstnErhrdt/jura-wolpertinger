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
})
