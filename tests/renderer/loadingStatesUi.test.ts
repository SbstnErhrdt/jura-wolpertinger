import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(import.meta.dirname, '../../src/renderer/src')

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
})
