import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('paginated list UI affordances', () => {
  it('uses Nuxt UI pagination with range copy and page-size controls', async () => {
    const sources = await Promise.all([
      readFile(resolve(rendererRoot, 'views/DashboardView.vue'), 'utf8'),
      readFile(resolve(rendererRoot, 'views/FlashcardsCollectionDetailView.vue'), 'utf8')
    ])

    for (const source of sources) {
      expect(source).toContain('<UPagination')
      expect(source).toContain('pageSizeOptions')
      expect(source).toContain('von {{')
    }
  })

  it('provides Nuxt UI skeleton tiles that are hidden from screen readers', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/DashboardView.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(source).toContain('aria-hidden="true"')
    expect(source).toContain('<USkeleton')
    expect(styles).toContain('.skeleton-list')
    expect(styles).toContain('@keyframes skeleton-shimmer')
  })

  it('wires dashboard exams through pagination and loading affordances', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/DashboardView.vue'), 'utf8')
    const store = await readFile(resolve(rendererRoot, 'stores/library.ts'), 'utf8')

    expect(source).toContain('<UPagination')
    expect(source).toContain('<USkeleton')
    expect(source).toContain('aria-busy')
    expect(source).toContain('paginated-list-refreshing')
    expect(source).toContain('store.examTotal')
    expect(store).toContain('listExamsPage')
    expect(store).toContain('examPageCount')
  })

  it('wires collection cards through pagination and loading affordances', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/FlashcardsCollectionDetailView.vue'), 'utf8')

    expect(source).toContain('<UPagination')
    expect(source).toContain('<USkeleton')
    expect(source).toContain('listLearningCardsPage')
    expect(source).toContain('{{ cardsTotal }} Karten')
    expect(source).toContain('aria-busy')
    expect(source).toContain('paginated-list-refreshing')
  })
})
