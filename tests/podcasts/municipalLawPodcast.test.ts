import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PODCAST_CATALOG } from '@shared/podcasts/catalog'
import {
  KOMMUNALRECHT_EPISODE_IDS,
  KOMMUNALRECHT_SERIES_ID
} from '@shared/podcasts/kommunalrecht-august-2026'

describe('municipal law podcast', () => {
  it('includes two municipal-law episodes below public law', () => {
    const area = PODCAST_CATALOG.legalAreas.find((entry) => entry.slug === 'oeffentliches-recht')
    const series = area?.series.find((entry) => entry.id === KOMMUNALRECHT_SERIES_ID)

    expect(area?.name).toBe('Öffentliches Recht')
    expect(series).toMatchObject({ title: 'Kommunalrecht', edition: 'August 2026' })
    expect(series?.episodes).toEqual([
      expect.objectContaining({
        id: KOMMUNALRECHT_EPISODE_IDS.gemeinderatsrecht,
        number: 1,
        title: 'Bayerisches Gemeinderatsrecht im zweiten Staatsexamen',
        durationSeconds: 1732.78,
        audioUrl:
          'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
          'kommunalrecht-august-2026/' +
          '01-bayerisches-gemeinderatsrecht-im-zweiten-staatsexamen.mp3'
      }),
      expect.objectContaining({
        id: KOMMUNALRECHT_EPISODE_IDS.fallstricke,
        number: 2,
        title: 'Fallstricke im bayerischen Kommunalrecht',
        durationSeconds: 1622.335,
        audioUrl:
          'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
          'kommunalrecht-august-2026/' +
          '02-fallstricke-im-bayerischen-kommunalrecht.mp3'
      })
    ])
  })

  it('ships stable manifests for both idempotent uploads', () => {
    const manifests = [
      'scripts/podcasts/manifests/kommunalrecht-01-gemeinderatsrecht-august-2026.json',
      'scripts/podcasts/manifests/kommunalrecht-02-fallstricke-august-2026.json'
    ].map((path) => JSON.parse(readFileSync(path, 'utf8')))

    expect(manifests.map((manifest) => manifest.legalArea)).toEqual([
      expect.objectContaining({
        id: 'ba7b2026-0400-4000-8000-000000000000',
        slug: 'oeffentliches-recht',
        name: 'Öffentliches Recht'
      }),
      expect.objectContaining({
        id: 'ba7b2026-0400-4000-8000-000000000000',
        slug: 'oeffentliches-recht',
        name: 'Öffentliches Recht'
      })
    ])
    expect(manifests.map((manifest) => manifest.series)).toEqual([
      expect.objectContaining({
        id: KOMMUNALRECHT_SERIES_ID,
        slug: 'kommunalrecht-august-2026',
        title: 'Kommunalrecht'
      }),
      expect.objectContaining({
        id: KOMMUNALRECHT_SERIES_ID,
        slug: 'kommunalrecht-august-2026',
        title: 'Kommunalrecht'
      })
    ])
    expect(manifests.map((manifest) => manifest.episode)).toEqual([
      expect.objectContaining({
        id: KOMMUNALRECHT_EPISODE_IDS.gemeinderatsrecht,
        number: 1,
        durationSeconds: 1732.78
      }),
      expect.objectContaining({
        id: KOMMUNALRECHT_EPISODE_IDS.fallstricke,
        number: 2,
        durationSeconds: 1622.335
      })
    ])
  })
})
