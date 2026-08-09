import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('podcast UI', () => {
  it('provides legal-area and series routes with loading and resume states', async () => {
    const library = await readFile(resolve(rendererRoot, 'views/PodcastsView.vue'), 'utf8')
    const series = await readFile(resolve(rendererRoot, 'views/PodcastSeriesView.vue'), 'utf8')
    const router = await readFile(resolve(rendererRoot, 'router.ts'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(router).toContain("path: '/podcasts'")
    expect(router).toContain("name: 'podcasts'")
    expect(router).toContain("path: '/podcasts/:seriesSlug'")
    expect(router).toContain("name: 'podcast-series'")
    expect(library).toContain('api.getPodcastCatalog')
    expect(library).toContain('<USkeleton')
    expect(library).toContain('legalArea')
    expect(library).toContain(':aria-label="series.title"')
    expect(styles).toContain('.podcast-series-card > a')
    expect(styles).toContain('align-self: start')
    expect(series).toContain('Fortsetzen')
    expect(series).toContain('episode.progress')
    expect(series).toContain('playEpisode')
    expect(series).toContain("{ label: 'Podcasts', to: { name: 'podcasts' } }")
  })

  it('centers transport and play icons independently from Nuxt UI defaults', async () => {
    const player = await readFile(resolve(rendererRoot, 'components/PodcastPlayer.vue'), 'utf8')
    const series = await readFile(resolve(rendererRoot, 'views/PodcastSeriesView.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(player.match(/podcast-icon-control/g)).toHaveLength(6)
    expect(series).toContain('podcast-icon-control podcast-episode-play')
    expect(styles).toMatch(/\.podcast-icon-control\s*\{[^}]*align-items:\s*center/)
    expect(styles).toMatch(/\.podcast-icon-control\s*>\s*svg\s*\{[^}]*display:\s*block/)
    expect(styles).toMatch(/\.podcast-wide-control span\s*\{[^}]*inset:\s*0/)
    expect(styles).toMatch(
      /\.podcast-icon-control\s*>\s*\.lucide-play-icon\s*\{[^}]*translateX\(1px\)/
    )
  })
})
