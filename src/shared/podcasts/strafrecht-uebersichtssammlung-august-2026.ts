import type { PodcastCatalog } from '../schemas'

export const STRAFRECHT_UEBERSICHTSSAMMLUNG_SERIES_ID =
  'a33d4dc5-48d4-448a-99be-77b7f8868d5c'
export const STRAFRECHT_UEBERSICHTSSAMMLUNG_EPISODE_ID =
  '6d7efa8a-3ad7-43e3-9753-7c44de28272d'
export const STRAFRECHT_UEBERSICHTSSAMMLUNG_SLUG =
  'uebersichtssammlung-strafrecht-august-2026'

const EPISODE_SLUG = 'urteilsaufbau-und-systematik-der-strafzumessung'
const AUDIO_URL =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
  `${STRAFRECHT_UEBERSICHTSSAMMLUNG_SLUG}/01-${EPISODE_SLUG}.mp3`
const ARTWORK_URL =
  'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
  `${STRAFRECHT_UEBERSICHTSSAMMLUNG_SLUG}/cover.png`

export const STRAFRECHT_UEBERSICHTSSAMMLUNG_PODCAST_CATALOG: PodcastCatalog = {
  legalAreas: [
    {
      slug: 'strafrecht',
      name: 'Strafrecht',
      series: [
        {
          id: STRAFRECHT_UEBERSICHTSSAMMLUNG_SERIES_ID,
          slug: STRAFRECHT_UEBERSICHTSSAMMLUNG_SLUG,
          title: 'Übersichtssammlung Strafrecht',
          description:
            'Eine Übersichtssammlung zu zentralen Strukturen und Prüfungsschemata des Strafrechts.',
          edition: 'August 2026',
          artworkUrl: ARTWORK_URL,
          episodes: [
            {
              id: STRAFRECHT_UEBERSICHTSSAMMLUNG_EPISODE_ID,
              seriesId: STRAFRECHT_UEBERSICHTSSAMMLUNG_SERIES_ID,
              slug: EPISODE_SLUG,
              number: 1,
              title: 'Urteilsaufbau und Systematik der Strafzumessung',
              description:
                'Urteilsaufbau und Systematik der Strafzumessung kompakt und klausurorientiert erklärt.',
              durationSeconds: 1658.776,
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
