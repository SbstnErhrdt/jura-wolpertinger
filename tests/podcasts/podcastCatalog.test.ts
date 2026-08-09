import { describe, expect, it } from 'vitest'
import { PODCAST_CATALOG } from '@shared/podcasts/catalog'
import {
  POLIZEI_SICHERHEITSRECHT_EPISODE_ID,
  POLIZEI_SICHERHEITSRECHT_SERIES_ID
} from '@shared/podcasts/polizei-und-sicherheitsrecht-august-2026'

describe('podcast catalog', () => {
  it('includes police and security law below public law', () => {
    const area = PODCAST_CATALOG.legalAreas.find((entry) => entry.slug === 'oeffentliches-recht')
    const series = area?.series.find(
      (entry) => entry.id === POLIZEI_SICHERHEITSRECHT_SERIES_ID
    )

    expect(series).toMatchObject({
      title: 'Polizei- und Sicherheitsrecht',
      edition: 'August 2026'
    })
    expect(series?.episodes).toEqual([
      expect.objectContaining({
        id: POLIZEI_SICHERHEITSRECHT_EPISODE_ID,
        number: 1,
        title: 'Klausurfallen im bayerischen Polizei- und Versammlungsrecht',
        durationSeconds: 1555.043
      })
    ])
  })
})
