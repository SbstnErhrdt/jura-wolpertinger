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
  it('uses one shared breadcrumb component on learning and exam pages', async () => {
    const component = await readFile(resolve(rendererRoot, 'components/ui/AppBreadcrumb.vue'), 'utf8').catch(() => '')

    expect(component).toContain('app-breadcrumb')

    for (const page of breadcrumbPages) {
      const source = await readFile(resolve(rendererRoot, page), 'utf8')
      expect(source, page).toContain('AppBreadcrumb')
    }
  })
})
