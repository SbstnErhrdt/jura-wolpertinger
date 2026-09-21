import type { PodcastCatalog } from '../schemas'

export const POLIZEI_SICHERHEITSRECHT_SERIES_ID = '7ca1a2cc-17be-4aec-a833-d4cf4ad1e3bf'
export const POLIZEI_SICHERHEITSRECHT_EPISODE_ID = '2756538a-67e2-4457-8f0e-a94764e99233'
export const POLIZEI_SICHERHEITSRECHT_SLUG = 'polizei-und-sicherheitsrecht-august-2026'

const EPISODE_SLUG = 'klausurfallen-im-bayerischen-polizei-und-versammlungsrecht'
const AUDIO_URL =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
  `${POLIZEI_SICHERHEITSRECHT_SLUG}/01-${EPISODE_SLUG}.mp3`
const ARTWORK_URL =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
  `${POLIZEI_SICHERHEITSRECHT_SLUG}/cover.png`

export const POLIZEI_SICHERHEITSRECHT_PODCAST_CATALOG: PodcastCatalog = {
  legalAreas: [
    {
      slug: 'oeffentliches-recht',
      name: 'Öffentliches Recht',
      series: [
        {
          id: POLIZEI_SICHERHEITSRECHT_SERIES_ID,
          slug: POLIZEI_SICHERHEITSRECHT_SLUG,
          title: 'Polizei- und Sicherheitsrecht',
          description:
            'Eine Lernfolge zu typischen Klausurfallen im bayerischen Polizei- und Versammlungsrecht.',
          edition: 'August 2026',
          artworkUrl: ARTWORK_URL,
          episodes: [
            {
              id: POLIZEI_SICHERHEITSRECHT_EPISODE_ID,
              seriesId: POLIZEI_SICHERHEITSRECHT_SERIES_ID,
              slug: EPISODE_SLUG,
              number: 1,
              title: 'Klausurfallen im bayerischen Polizei- und Versammlungsrecht',
              description:
                'Typische Prüfungsprobleme und Fehlerquellen im bayerischen Polizei- und Versammlungsrecht.',
              durationSeconds: 1555.043,
              audioUrl: AUDIO_URL,
              publishedAt: '2026-08-09T00:00:00.000Z',
              progress: null
            }
          ]
        }
      ]
    }
  ]
}
