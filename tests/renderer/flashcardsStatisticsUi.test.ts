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
})
