import type { PodcastCatalog } from '../schemas'

export const GRUNDSKRIPT_STEUERRECHT_SERIES_ID =
  '7d61a370-ece1-4c4a-a613-3b2c00707fce'
export const GRUNDSKRIPT_STEUERRECHT_EPISODE_ID =
  '2abfbda4-e81d-4e31-b518-d319bf56c391'
export const GRUNDSKRIPT_STEUERRECHT_SLUG =
  'grundskript-steuerrecht-april-2026'

const EPISODE_SLUG =
  'systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen'
const MEDIA_BASE =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio'

export const GRUNDSKRIPT_STEUERRECHT_PODCAST_CATALOG: PodcastCatalog = {
  legalAreas: [
    {
      slug: 'steuerrecht',
      name: 'Steuerrecht',
      series: [
        {
          id: GRUNDSKRIPT_STEUERRECHT_SERIES_ID,
          slug: GRUNDSKRIPT_STEUERRECHT_SLUG,
          title: 'Grundskript Steuerrecht',
          description:
            'Eine klausurorientierte Lernreihe zu den Grundlagen und zur Systematik des Steuerrechts im zweiten Staatsexamen.',
          edition: 'April 2026',
          artworkUrl: `${MEDIA_BASE}/${GRUNDSKRIPT_STEUERRECHT_SLUG}/cover.png`,
          episodes: [
            {
              id: GRUNDSKRIPT_STEUERRECHT_EPISODE_ID,
              seriesId: GRUNDSKRIPT_STEUERRECHT_SERIES_ID,
              slug: EPISODE_SLUG,
              number: 1,
              title: 'Systematik des Einkommensteuerrechts im zweiten Staatsexamen',
              description:
                'Die Systematik des Einkommensteuerrechts als Einstieg in das Grundskript Steuerrecht.',
              durationSeconds: 1740.487,
              audioUrl:
                `${MEDIA_BASE}/${GRUNDSKRIPT_STEUERRECHT_SLUG}/01-${EPISODE_SLUG}.mp3`,
              publishedAt: '2026-09-21T00:00:00.000Z',
              progress: null
            }
          ]
        }
      ]
    }
  ]
}
