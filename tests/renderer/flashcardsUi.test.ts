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

  it('supports keyboard-driven review with visible key hints and skip navigation', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/FlashcardsReviewView.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(source).toContain('window.addEventListener')
    expect(source).toContain('window.removeEventListener')
    expect(source).toContain('handleReviewKeydown')
    expect(source).toContain('isTypingTarget')
    expect(source).toContain('skipCard')
    expect(source).toContain('previousCard')
    expect(source).toContain('ratingBusy')
    expect(source).toContain('Enter')
    expect(source).toContain('1')
    expect(source).toContain('2')
    expect(source).toContain('3')
    expect(source).toContain('4')
    expect(source).toContain('Überspringen')
    expect(styles).toContain('.key-hint')
    expect(styles).toContain('.review-navigation')
  })
})
