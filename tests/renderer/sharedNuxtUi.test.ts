import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')

describe('shared Nuxt UI contracts', () => {
  it('uses Nuxt UI controls without changing the TagInput public hooks', async () => {
    const source = await readFile(resolve(projectRoot, 'src/renderer/src/components/TagInput.vue'), 'utf8')

    expect(source).toContain('<UInput')
    expect(source).toContain('<UButton')
    expect(source).not.toMatch(/<(button|input)\b/)
    expect(source).toContain('tag-input-field')
    expect(source).toContain('tag-input-chip')
    expect(source).toContain('tag-input-suggestion')
    expect(source).toContain("'update:modelValue': [string[]]")
  })

  it('provides plain item types for breadcrumbs and action menus', async () => {
    const [breadcrumbs, actionMenu] = await Promise.all([
      readFile(resolve(projectRoot, 'src/renderer/src/ui/breadcrumbs.ts'), 'utf8'),
      readFile(resolve(projectRoot, 'src/renderer/src/ui/actionMenu.ts'), 'utf8')
    ])

    expect(breadcrumbs).toContain('export type AppBreadcrumbItem')
    expect(breadcrumbs).toContain('RouteLocationRaw')
    expect(actionMenu).toContain('export type AppActionMenuItem')
    expect(actionMenu).toContain('onSelect: () => void')
  })
})
