import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PODCAST_CATALOG } from '@shared/podcasts/catalog'
import {
  VORLAEUFIGER_RECHTSSCHUTZ_EPISODE_ID,
  VORLAEUFIGER_RECHTSSCHUTZ_SERIES_ID
} from '@shared/podcasts/vorlaeufiger-rechtsschutz-august-2026'

describe('interim legal protection podcast', () => {
  it('includes the series below public law', () => {
    const area = PODCAST_CATALOG.legalAreas.find((entry) => entry.slug === 'oeffentliches-recht')
    const series = area?.series.find(
      (entry) => entry.id === VORLAEUFIGER_RECHTSSCHUTZ_SERIES_ID
    )

    expect(area?.name).toBe('Öffentliches Recht')
    expect(series).toMatchObject({
      title: 'Vorläufiger Rechtsschutz',
      edition: 'August 2026'
    })
    expect(series?.episodes).toEqual([
      expect.objectContaining({
        id: VORLAEUFIGER_RECHTSSCHUTZ_EPISODE_ID,
        number: 1,
        title: 'Schild und Schwert im bayerischen Eilrechtsschutz',
        durationSeconds: 2064.118,
        audioUrl:
          'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
          'vorlaeufiger-rechtsschutz-august-2026/' +
          '01-schild-und-schwert-im-bayerischen-eilrechtsschutz.mp3'
      })
    ])
  })

  it('ships stable manifest IDs for an idempotent upload', () => {
    const manifest = JSON.parse(
      readFileSync(
        'scripts/podcasts/manifests/vorlaeufiger-rechtsschutz-august-2026.json',
        'utf8'
      )
    )

    expect(manifest).toMatchObject({
      legalArea: {
        id: 'ba7b2026-0400-4000-8000-000000000000',
        slug: 'oeffentliches-recht',
        name: 'Öffentliches Recht'
      },
      series: {
        id: VORLAEUFIGER_RECHTSSCHUTZ_SERIES_ID,
        slug: 'vorlaeufiger-rechtsschutz-august-2026',
        title: 'Vorläufiger Rechtsschutz'
      },
      episode: {
        id: VORLAEUFIGER_RECHTSSCHUTZ_EPISODE_ID,
        slug: 'schild-und-schwert-im-bayerischen-eilrechtsschutz',
        number: 1,
        durationSeconds: 2064.118
      }
    })
  })
})
