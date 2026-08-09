import type { PodcastCatalog } from '../schemas'

export const STEUERRECHT_AO_SERIES_ID = '7be6edfa-9c51-48b0-9dde-53f5de29420f'
export const STEUERRECHT_AO_EPISODE_ID = '4e2ed99e-fad8-4f88-947f-becdc6ced300'
export const STEUERRECHT_AO_SLUG = 'steuerrecht-ao-august-2026'

const EPISODE_SLUG = 'die-abgabenordnung-als-betriebssystem-des-finanzamts'
const AUDIO_URL =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
  `${STEUERRECHT_AO_SLUG}/01-${EPISODE_SLUG}.mp3`

export const STEUERRECHT_AO_PODCAST_CATALOG: PodcastCatalog = {
  legalAreas: [
    {
      slug: 'steuerrecht',
      name: 'Steuerrecht',
      series: [
        {
          id: STEUERRECHT_AO_SERIES_ID,
          slug: STEUERRECHT_AO_SLUG,
          title: 'Steuerrecht-AO',
          description:
            'Eine Lernfolge zur Abgabenordnung als Grundlage des steuerlichen Verwaltungsverfahrens.',
          edition: 'August 2026',
          artworkUrl: null,
          episodes: [
            {
              id: STEUERRECHT_AO_EPISODE_ID,
              seriesId: STEUERRECHT_AO_SERIES_ID,
              slug: EPISODE_SLUG,
              number: 1,
              title: 'Die Abgabenordnung als Betriebssystem des Finanzamts',
              description:
                'Die Abgabenordnung als systematische Grundlage für Organisation, Verfahren und Entscheidungen des Finanzamts.',
              durationSeconds: 1413.407,
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
