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

  it('styles review shortcuts as keycaps and animates card flips', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/FlashcardsReviewView.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(source).toContain('study-card-face-back')
    expect(source).toContain('study-card-face-front')
    expect(source).toContain('study-card-motion-next')
    expect(source).toContain('study-card-motion-previous')
    expect(source).toContain('cardMotion')
    expect(source).toContain('<kbd class="key-hint" aria-hidden="true">←</kbd>')
    expect(source).toContain('<kbd class="key-hint" aria-hidden="true">→</kbd>')
    expect(styles).toContain('--keycap-bg')
    expect(styles).toContain('--keycap-shadow')
    expect(styles).toContain('.key-hint::after')
    expect(styles).toContain('.key-hint:active')
    expect(styles).toContain('@keyframes study-card-flip')
    expect(styles).toContain('@keyframes study-card-slide-next')
    expect(styles).toContain('@keyframes study-card-slide-previous')
    expect(styles).toContain('animation: study-card-flip 360ms')
    expect(styles).toContain('animation: study-card-slide-next 320ms')
    expect(styles).toContain('animation: study-card-slide-previous 320ms')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(styles).toContain(":root[data-theme='dark'] .key-hint")
  })
})
