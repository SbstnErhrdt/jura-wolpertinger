import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const viewsRoot = resolve(import.meta.dirname, '../../src/renderer/src/views')
const files = ['FlashcardsCollectionsView.vue', 'FlashcardsCollectionDetailView.vue', 'FlashcardsReviewView.vue']

describe('Nuxt UI flashcard workflows', () => {
  it.each(files)('%s uses no native standard controls or legacy wrappers', async (file) => {
    const source = await readFile(resolve(viewsRoot, file), 'utf8')
    expect(source).not.toMatch(/<(button|input|select|textarea)\b/)
    expect(source).not.toMatch(/components\/ui\/(ActionMenu|AppBadge|AppBreadcrumb|AppPagination|ListSkeleton)/)
  })

  it('keeps keyboard navigation and card motion while using Nuxt UI', async () => {
    const review = await readFile(resolve(viewsRoot, 'FlashcardsReviewView.vue'), 'utf8')
    expect(review).toContain('<UButton')
    expect(review).toContain('<UDropdownMenu')
    expect(review).toContain('<UBadge')
    expect(review).toContain('study-card-motion-flip')
    expect(review).toContain("event.key === 'ArrowLeft'")
    expect(review).toContain("event.key === 'ArrowRight'")
    expect(review).toContain("['1', '2', '3', '4']")
    expect(review).toContain('<kbd class="key-hint">Enter</kbd>')
  })

  it('uses Nuxt UI pagination, loading, feedback, and modal controls', async () => {
    const detail = await readFile(resolve(viewsRoot, 'FlashcardsCollectionDetailView.vue'), 'utf8')
    const collections = await readFile(resolve(viewsRoot, 'FlashcardsCollectionsView.vue'), 'utf8')
    const combined = `${detail}\n${collections}`
    expect(combined).toContain('<UPagination')
    expect(combined).toContain('<USkeleton')
    expect(combined).toContain('<UAlert')
    expect(combined).toContain('<UModal')
    expect(combined).toContain('<UFormField')
  })
})
