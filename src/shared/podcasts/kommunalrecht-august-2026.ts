import type { PodcastCatalog } from '../schemas'

export const KOMMUNALRECHT_SERIES_ID = '9f143318-0db6-4993-8678-dee3beac0b57'
export const KOMMUNALRECHT_SLUG = 'kommunalrecht-august-2026'
export const KOMMUNALRECHT_EPISODE_IDS = {
  gemeinderatsrecht: '5239ec1a-b5a7-4f91-9d70-ab4f01ec257a',
  fallstricke: '8b342aa0-b3bd-4daf-8304-08267f2fb8a0'
} as const

const AUDIO_BASE_URL =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
  KOMMUNALRECHT_SLUG

export const KOMMUNALRECHT_PODCAST_CATALOG: PodcastCatalog = {
  legalAreas: [
    {
      slug: 'oeffentliches-recht',
      name: 'Öffentliches Recht',
      series: [
        {
          id: KOMMUNALRECHT_SERIES_ID,
          slug: KOMMUNALRECHT_SLUG,
          title: 'Kommunalrecht',
          description:
            'Eine Lernreihe zu typischen Strukturen und Klausurproblemen des bayerischen Kommunalrechts.',
          edition: 'August 2026',
          artworkUrl: `${AUDIO_BASE_URL}/cover.png`,
          episodes: [
            {
              id: KOMMUNALRECHT_EPISODE_IDS.gemeinderatsrecht,
              seriesId: KOMMUNALRECHT_SERIES_ID,
              slug: 'bayerisches-gemeinderatsrecht-im-zweiten-staatsexamen',
              number: 1,
              title: 'Bayerisches Gemeinderatsrecht im zweiten Staatsexamen',
              description:
                'Das bayerische Gemeinderatsrecht mit Blick auf Aufbau, typische Probleme und Anforderungen im zweiten Staatsexamen.',
              durationSeconds: 1732.78,
              audioUrl:
                `${AUDIO_BASE_URL}/` +
                '01-bayerisches-gemeinderatsrecht-im-zweiten-staatsexamen.mp3',
              publishedAt: '2026-08-25T00:00:00.000Z',
              progress: null
            },
            {
              id: KOMMUNALRECHT_EPISODE_IDS.fallstricke,
              seriesId: KOMMUNALRECHT_SERIES_ID,
              slug: 'fallstricke-im-bayerischen-kommunalrecht',
              number: 2,
              title: 'Fallstricke im bayerischen Kommunalrecht',
              description:
                'Typische Fehlerquellen und klausurrelevante Fallstricke im bayerischen Kommunalrecht.',
              durationSeconds: 1622.335,
              audioUrl: `${AUDIO_BASE_URL}/02-fallstricke-im-bayerischen-kommunalrecht.mp3`,
              publishedAt: '2026-08-25T00:00:00.000Z',
              progress: null
            }
          ]
        }
      ]
    }
  ]
}
