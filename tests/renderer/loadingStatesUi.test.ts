import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(import.meta.dirname, '../../src/renderer/src')
const repoRoot = resolve(import.meta.dirname, '../..')

async function rendererFile(path: string): Promise<string> {
  return readFile(resolve(rendererRoot, path), 'utf8')
}

describe('app loading states', () => {
  it('provides one accessible loading wrapper for view-shaped skeletons', async () => {
    const source = await rendererFile('components/ui/AppLoadingState.vue')

    expect(source).toContain('label: string')
    expect(source).toContain('role="status"')
    expect(source).toContain('aria-live="polite"')
    expect(source).toContain('aria-busy="true"')
    expect(source).toContain('aria-hidden="true"')
    expect(source).toContain('<slot />')
  })

  it('separates app bootstrap from the signed-out authentication gate', async () => {
    const source = await rendererFile('App.vue')

    expect(source).toContain("bootstrapStatus === 'loading'")
    expect(source).toContain('App wird geladen')
    expect(source).toContain("bootstrapStatus === 'error'")
    expect(source).toContain('bootstrapApp')
    expect(source).toContain('Erneut versuchen')
  })

  it('does not render placeholder zeroes while the home dashboard loads', async () => {
    const source = await rendererFile('views/HomeView.vue')

    expect(source).toContain('<AppLoadingState')
    expect(source).toContain('label="Startseite wird geladen"')
    expect(source).toContain('v-else-if="dashboard"')
    expect(source).toContain('loadError')
    expect(source).toContain('Erneut versuchen')
    expect(source).not.toContain('dashboard?.streakDays ?? 0')
    expect(source).not.toContain('dashboard?.dueCount ?? 0')
    expect(source).not.toContain('dashboard?.collectionCount ?? 0')
  })

  it('covers exam, correction, analytics and settings first loads and retries', async () => {
    const files = ['ExamView.vue', 'CorrectionView.vue', 'AnalyticsView.vue', 'SettingsView.vue']
    for (const file of files) {
      const source = await rendererFile(`views/${file}`)
      expect(source, file).toContain('<AppLoadingState')
      expect(source, file).toContain('loadError')
      expect(source, file).toContain('Erneut versuchen')
    }
  })

  it('shows busy feedback for correction, analytics and settings mutations', async () => {
    const correction = await rendererFile('views/CorrectionView.vue')
    const analytics = await rendererFile('views/AnalyticsView.vue')
    const settings = await rendererFile('views/SettingsView.vue')

    expect(correction).toContain(':loading="saveBusy"')
    expect(correction).toContain(':loading="commentBusy"')
    expect(analytics).toContain(':loading="taskBusyId === task.id"')
    expect(settings).toContain('userActionBusy')
  })

  it('uses the shared loading semantics across learning and podcast views', async () => {
    const files = [
      'DashboardView.vue',
      'FlashcardsCollectionsView.vue',
      'FlashcardsCollectionDetailView.vue',
      'FlashcardsReviewView.vue',
      'FlashcardsStatisticsView.vue',
      'PodcastsView.vue',
      'PodcastSeriesView.vue'
    ]
    for (const file of files) {
      expect(await rendererFile(`views/${file}`), file).toContain('<AppLoadingState')
    }
  })

  it('shows busy feedback while collection files and records change', async () => {
    const source = await rendererFile('views/FlashcardsCollectionsView.vue')

    expect(source).toContain(':loading="createBusy"')
    expect(source).toContain(':loading="importBusy"')
    expect(source).toContain(':loading="exportBusy"')
  })

  it('documents reliable load semantics and respects reduced motion', async () => {
    const userStories = await readFile(resolve(repoRoot, 'docs/user-stories.md'), 'utf8')
    const styles = await rendererFile('styles/main.css')

    expect(userStories).toContain('Verlässliche Ladezustände')
    expect(userStories).toContain('noch geladen')
    expect(userStories).toContain('echten Leerzustand')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(styles).toContain('.app-skeleton-block')
  })
})
