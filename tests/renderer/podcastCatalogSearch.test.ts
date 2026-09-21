import { describe, expect, it } from 'vitest'
import type { PodcastCatalog } from '../../src/shared/schemas'

const searchModulePath = '../../src/renderer/src/ui/podcastCatalogSearch'
const { filterPodcastCatalog } = await import(/* @vite-ignore */ searchModulePath)

const catalog: PodcastCatalog = {
  legalAreas: [
    {
      slug: 'oeffentliches-recht',
      name: 'Öffentliches Recht',
      series: [{
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'kommunalrecht',
        title: 'Kommunalrecht',
        description: 'Gemeinden und ihre Organe',
        edition: 'August 2026',
        artworkUrl: null,
        episodes: [{
          id: '22222222-2222-4222-8222-222222222222',
          seriesId: '11111111-1111-4111-8111-111111111111',
          slug: 'gemeinderat',
          number: 1,
          title: 'Bayerisches Gemeinderatsrecht',
          description: 'Sitzungen und Beschlüsse',
          durationSeconds: 600,
          audioUrl: 'https://example.test/gemeinderat.m4a',
          publishedAt: null,
          progress: null
        }]
      }]
    },
    {
      slug: 'steuerrecht',
      name: 'Steuerrecht',
      series: [{
        id: '33333333-3333-4333-8333-333333333333',
        slug: 'ao',
        title: 'Steuerrecht – AO',
        description: 'Das Verfahren des Finanzamts',
        edition: 'September 2026',
        artworkUrl: null,
        episodes: []
      }]
    }
  ]
}

describe('podcast catalog search', () => {
  it('keeps the original grouped catalog for a blank query', () => {
    expect(filterPodcastCatalog(catalog, '   ')).toEqual(catalog)
  })

  it('matches case- and diacritic-insensitively across legal area and series metadata', () => {
    expect(filterPodcastCatalog(catalog, 'OFFENTLICHES').legalAreas).toHaveLength(1)
    expect(filterPodcastCatalog(catalog, 'august 2026').legalAreas[0].series[0].title).toBe('Kommunalrecht')
  })

  it('keeps a series when only an episode title or description matches', () => {
    expect(filterPodcastCatalog(catalog, 'Gemeinderatsrecht').legalAreas[0].series[0].slug).toBe('kommunalrecht')
    expect(filterPodcastCatalog(catalog, 'Beschlüsse').legalAreas[0].series[0].slug).toBe('kommunalrecht')
  })

  it('removes empty legal-area groups without reordering the remaining catalog', () => {
    expect(filterPodcastCatalog(catalog, 'Finanzamt')).toEqual({ legalAreas: [catalog.legalAreas[1]] })
    expect(filterPodcastCatalog(catalog, 'kein Treffer')).toEqual({ legalAreas: [] })
  })
})
