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
})
