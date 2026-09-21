import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BAYBO_PODCAST_CATALOG } from '@shared/podcasts/baybo-april-2026'
import { buildBayboSeedPlan } from '../../scripts/podcasts/seed-baybo-podcast'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('BayBO podcast seed', () => {
  it('maps all generated episodes to stable catalog rows and existing MP3 files', async () => {
    const sourceRoot = await createSourceFixture()
    const plan = buildBayboSeedPlan(
      sourceRoot,
      'https://app.jura-wolpi.de/api'
    )
    const catalogEpisodes = BAYBO_PODCAST_CATALOG.legalAreas[0].series[0].episodes

    expect(plan.episodes).toHaveLength(18)
    expect(plan.uploads).toHaveLength(18)
    expect(plan.series.id).toBe('ba7b2026-0400-4000-8000-000000000001')
    expect(plan.episodes.map((episode) => episode.id)).toEqual(
      catalogEpisodes.map((episode) => episode.id)
    )
    expect(plan.episodes.map((episode) => Number(episode.duration_seconds))).toEqual(
      catalogEpisodes.map((episode) => episode.durationSeconds)
    )
    expect(plan.uploads.every((upload) => upload.size > 0)).toBe(true)
    expect(plan.uploads.map((upload) => upload.storagePath)).toEqual(
      plan.episodes.map((episode) => episode.storage_path)
    )
    expect(plan.episodes[0].audio_url).toBe(
      'https://app.jura-wolpi.de/api/storage/v1/object/public/podcast-audio/' +
        'baybo-april-2026/01-regelungsgegenstand-und-grundbegriffe.mp3'
    )
  })
})

async function createSourceFixture(): Promise<string> {
  const sourceRoot = await mkdtemp(join(tmpdir(), 'baybo-podcast-seed-'))
  temporaryDirectories.push(sourceRoot)
  const catalogSeries = BAYBO_PODCAST_CATALOG.legalAreas[0].series[0]
  const sourceEpisodes = catalogSeries.episodes.map((episode) => ({
    number: episode.number,
    slug: episode.slug,
    title: episode.title
  }))
  const mp3Paths: string[] = []

  for (const episode of sourceEpisodes) {
    const directory = `${String(episode.number).padStart(2, '0')}-${episode.slug}`
    const episodeDirectory = join(sourceRoot, 'episodes', directory)
    const mp3Path = join(episodeDirectory, `${directory}.mp3`)
    await mkdir(episodeDirectory, { recursive: true })
    await writeFile(mp3Path, `fixture-${episode.number}`)
    mp3Paths.push(mp3Path)
  }

  await Promise.all([
    writeFile(
      join(sourceRoot, 'series-plan.json'),
      JSON.stringify({ title: catalogSeries.title, episodes: sourceEpisodes })
    ),
    writeFile(
      join(sourceRoot, 'summary.json'),
      JSON.stringify({ episode_count: sourceEpisodes.length, mp3_paths: mp3Paths })
    )
  ])

  return sourceRoot
}
