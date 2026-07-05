import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('flashcards UI affordances', () => {
  it('offers an accessible edit action for cards inside a collection', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/FlashcardsCollectionDetailView.vue'), 'utf8')

    expect(source).toContain('Karteikarte bearbeiten')
    expect(source).toContain('openEditCardDialog')
    expect(source).toContain('api.updateLearningCard')
  })

  it('uses the shared action menu instead of native details for review actions', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/FlashcardsReviewView.vue'), 'utf8')

    expect(source).not.toContain('<details>')
    expect(source).toContain('ActionMenu')
    expect(source).toContain('Aus Session entfernen')
  })
})
