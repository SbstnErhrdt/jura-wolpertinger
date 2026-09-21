import { mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildPodcastArtworkPublishPlan,
  formatPodcastArtworkDryRun,
  publishPodcastArtwork
} from '../../scripts/podcasts/publish-podcast-artwork'

const SERIES_ID = '7ca1a2cc-17be-4aec-a833-d4cf4ad1e3bf'
const SERIES_SLUG = 'polizei-und-sicherheitsrecht-august-2026'
const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function temporaryImage(name = 'cover.png'): string {
  const directory = mkdtempSync(join(tmpdir(), 'podcast-artwork-'))
  temporaryDirectories.push(directory)
  const path = join(directory, name)
  writeFileSync(path, Buffer.from('png-test-image'))
  return path
}

describe('podcast artwork publisher plan', () => {
  it('derives the stable public cover URL', () => {
    const plan = buildPodcastArtworkPublishPlan({
      apiUrl: 'https://app.jura-wolpi.de/api/',
      seriesId: SERIES_ID,
      seriesSlug: SERIES_SLUG,
      imageFile: temporaryImage()
    })

    expect(plan).toMatchObject({
      apiUrl: 'https://app.jura-wolpi.de/api',
      seriesId: SERIES_ID,
      seriesSlug: SERIES_SLUG,
      storagePath: `${SERIES_SLUG}/cover.png`,
      artworkUrl:
        `https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/` +
        `${SERIES_SLUG}/cover.png`
    })
    expect(formatPodcastArtworkDryRun(plan)).toContain(`Cover: ${SERIES_SLUG}/cover.png`)
    expect(formatPodcastArtworkDryRun(plan)).toContain('Ziel: https://app.jura-wolpi.de/api')
  })

  it('rejects an invalid series id or slug', () => {
    expect(() =>
      buildPodcastArtworkPublishPlan({
        apiUrl: 'https://app.jura-wolpi.de/api',
        seriesId: 'not-a-uuid',
        seriesSlug: 'Nicht gültig',
        imageFile: temporaryImage()
      })
    ).toThrow()
  })

  it('rejects files that are not PNG artwork', () => {
    expect(() =>
      buildPodcastArtworkPublishPlan({
        apiUrl: 'https://app.jura-wolpi.de/api',
        seriesId: SERIES_ID,
        seriesSlug: SERIES_SLUG,
        imageFile: temporaryImage('cover.webp')
      })
    ).toThrow('Cover muss als PNG vorliegen.')
  })

  it('rejects empty files and files above 10 MiB', () => {
    const empty = temporaryImage()
    truncateSync(empty, 0)
    expect(() =>
      buildPodcastArtworkPublishPlan({
        apiUrl: 'https://app.jura-wolpi.de/api',
        seriesId: SERIES_ID,
        seriesSlug: SERIES_SLUG,
        imageFile: empty
      })
    ).toThrow('Cover ist leer.')

    const oversized = temporaryImage()
    truncateSync(oversized, 10_485_761)
    expect(() =>
      buildPodcastArtworkPublishPlan({
        apiUrl: 'https://app.jura-wolpi.de/api',
        seriesId: SERIES_ID,
        seriesSlug: SERIES_SLUG,
        imageFile: oversized
      })
    ).toThrow('Cover überschreitet das Limit von 10 MiB.')
  })
})

describe('podcast artwork publication', () => {
  it('uploads and verifies the cover before updating and checking the public catalog', async () => {
    const plan = buildPodcastArtworkPublishPlan({
      apiUrl: 'https://app.jura-wolpi.de/api',
      seriesId: SERIES_ID,
      seriesSlug: SERIES_SLUG,
      imageFile: temporaryImage()
    })
    const requests: Array<{ url: string; init: RequestInit }> = []
    const request: typeof fetch = async (input, init = {}) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.endsWith('/rest/v1/rpc/get_podcast_catalog')) {
        return Response.json({
          legalAreas: [
            {
              series: [{ id: SERIES_ID, artworkUrl: plan.artworkUrl }]
            }
          ]
        })
      }
      return new Response(null, {
        status: 200,
        headers: { 'content-type': url.endsWith('cover.png') ? 'image/png' : 'application/json' }
      })
    }

    await publishPodcastArtwork(
      plan,
      { serviceRoleKey: 'service-test', publishableKey: 'anon-test' },
      request
    )

    expect(requests.map(({ url, init }) => `${init.method} ${new URL(url).pathname}`)).toEqual([
      `POST /api/storage/v1/object/podcast-audio/${SERIES_SLUG}/cover.png`,
      `HEAD /api/storage/v1/object/public/podcast-audio/${SERIES_SLUG}/cover.png`,
      'PATCH /api/rest/v1/podcast_series',
      'POST /api/rest/v1/rpc/get_podcast_catalog'
    ])
    expect(new Headers(requests[0].init.headers)).toMatchObject(
      expect.objectContaining({})
    )
    expect(new Headers(requests[0].init.headers).get('content-type')).toBe('image/png')
    expect(new Headers(requests[0].init.headers).get('x-upsert')).toBe('true')
    expect(new URL(requests[2].url).searchParams.get('id')).toBe(`eq.${SERIES_ID}`)
    expect(JSON.parse(String(requests[2].init.body))).toEqual({ artwork_url: plan.artworkUrl })
    expect(new Headers(requests[3].init.headers).get('apikey')).toBe('anon-test')
  })
})
