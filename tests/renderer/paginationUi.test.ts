import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('paginated list UI affordances', () => {
  it('provides a reusable pagination component with range copy and page-size control', async () => {
    const source = await readFile(resolve(rendererRoot, 'components/ui/AppPagination.vue'), 'utf8')

    expect(source).toContain('defineEmits')
    expect(source).toContain('update:page')
    expect(source).toContain('update:pageSize')
    expect(source).toContain('rangeStart')
    expect(source).toContain('rangeEnd')
    expect(source).toContain('page-size')
    expect(source).toContain('ChevronLeft')
    expect(source).toContain('ChevronRight')
  })

  it('provides skeleton list tiles that are hidden from screen readers', async () => {
    const source = await readFile(resolve(rendererRoot, 'components/ui/ListSkeleton.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(source).toContain('aria-hidden="true"')
    expect(source).toContain('skeleton-list')
    expect(source).toContain("variant?: 'exam' | 'flashcard'")
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
    expect(source).toContain('collection?.cardCount')
    expect(source).toContain('aria-busy')
    expect(source).toContain('paginated-list-refreshing')
  })
})
