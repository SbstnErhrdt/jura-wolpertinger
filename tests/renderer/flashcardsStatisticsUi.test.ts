import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('flashcard statistics UI', () => {
  it('shows loading scaffolding, activity, ratings and collection progress', async () => {
    const source = await readFile(
      resolve(rendererRoot, 'views/FlashcardsStatisticsView.vue'),
      'utf8'
    )
    const router = await readFile(resolve(rendererRoot, 'router.ts'), 'utf8')

    expect(router).toContain("path: '/flashcards/statistics'")
    expect(router).toContain("name: 'flashcards-statistics'")
    expect(source).toContain('api.getLearningStatistics')
    expect(source).toContain('<USkeleton')
    expect(source).toContain('14 Tage Aktivität')
    expect(source).toContain('Letzte Bewertung je Karte')
    expect(source).toContain('Sammlungsfortschritt')
    expect(source).toContain('averageRating')
    expect(source).toContain("{ label: 'Karteikarten', to: { name: 'flashcards' } }")
  })

  it('uses one accessible status palette and links every collection', async () => {
    const statistics = await readFile(resolve(rendererRoot, 'views/FlashcardsStatisticsView.vue'), 'utf8')
    const collections = await readFile(resolve(rendererRoot, 'views/FlashcardsCollectionsView.vue'), 'utf8')
    const component = await readFile(resolve(rendererRoot, 'components/LearningStatusBar.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(component).toContain('learningStatusSegments')
    expect(component).toContain('learning-status-segment-not-known')
    expect(component).toContain('learning-status-segment-partially-known')
    expect(component).toContain('learning-status-segment-known')
    expect(component).toContain('learning-status-segment-unreviewed')
    expect(component).toContain('role="img"')
    expect(component).toContain(':aria-label="accessibleLabel"')
    expect(collections).toContain('<LearningStatusBar')
    expect(collections).toContain('Nicht gewusst')
    expect(collections).toContain('Noch nicht bearbeitet')
    expect(statistics).toContain('<LearningStatusBar')
    expect(statistics).toContain("name: 'flashcards-collection'")
    expect(statistics).toContain('rating-status-not-known')
    expect(statistics).toContain('rating-status-partially-known')
    expect(statistics).toContain('rating-status-known')
    expect(styles).toContain('--learning-status-not-known')
    expect(styles).toContain('--learning-status-partially-known')
    expect(styles).toContain('--learning-status-known')
    expect(styles).toContain(":root[data-theme='dark']")
  })
})
