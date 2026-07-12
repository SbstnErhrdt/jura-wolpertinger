import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')
const publicRoot = resolve(process.cwd(), 'src/renderer/public')

describe('flashcards UI affordances', () => {
  it('presents collections as structured cards with icons, status chips and spaced actions', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/FlashcardsCollectionsView.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(source).toContain('collection-card-header')
    expect(source).toContain('collection-card-icon')
    expect(source).toContain('<FolderKanban')
    expect(source).toContain('<Layers')
    expect(source).toContain('<Clock3')
    expect(source).toContain('<Play')
    expect(source).toContain('<FolderOpen')
    expect(source.indexOf('Wiederholen')).toBeLessThan(source.indexOf('Öffnen'))
    expect(styles).toContain('.collection-card-actions')
    expect(styles).toContain('--wolpi-nav-blue: #005a84')
    expect(styles).toMatch(/\.collection-card > div,\n\.collection-card \[data-slot='body'\]\s*\{[^}]*gap:\s*14px/s)
    expect(styles).toMatch(/\.collection-card-actions\s*\{[^}]*gap:\s*14px/s)
    expect(styles).toMatch(/\.collection-card-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s)
    expect(styles).toMatch(/\.collection-card-title h2\s*\{[^}]*font-size:\s*16px/s)
    expect(styles).toMatch(/\.collection-card-title h2\s*\{[^}]*-webkit-line-clamp:\s*2/s)
    expect(styles).toMatch(/\.collection-card-icon\s*\{[^}]*background:\s*var\(--wolpi-nav-blue\)/s)
    expect(styles).toMatch(/\.collection-stats span\s*\{[^}]*background:\s*#fff/s)
    expect(styles).toMatch(/\.collection-stats span\s*\{[^}]*border:\s*1px solid var\(--color-border-strong\)/s)
    expect(styles).toContain('.collection-stats span.due')
    expect(styles).toContain(":root[data-theme='dark'] .collection-stats span.due")
  })

  it('offers accessible edit and delete actions for cards inside a collection', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/FlashcardsCollectionDetailView.vue'), 'utf8')

    expect(source).toContain('Karteikarte bearbeiten')
    expect(source).toContain('openEditCardDialog')
    expect(source).toContain('api.updateLearningCard')
    expect(source).toContain('Karteikarte löschen')
    expect(source).toContain('openDeleteCardDialog')
    expect(source).toContain('api.deleteLearningCard')
    expect(source).toContain("color: 'error'")
    expect(source).toContain(':open="Boolean(deleteCardTarget)"')
  })

  it('keeps entity dialogs wide enough for readable forms', async () => {
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(styles).toMatch(/\.dialog-card\s*\{[^}]*max-width:\s*720px/s)
    expect(styles).toMatch(/\.dialog-card\s*\{[^}]*max-height:\s*calc\(100dvh - 32px\)/s)
    expect(styles).toMatch(/\.dialog-card-wide\s*\{[^}]*max-width:\s*920px/s)
    expect(styles).toMatch(/\.dialog-form,\n\.dialog-field\s*\{[^}]*width:\s*100%/s)
    expect(styles).toContain('.dialog-field :is(input, textarea, select, .tag-input-control, .tag-input)')
    expect(styles).not.toContain("[data-slot='base'], .tag-input")
  })

  it('keeps tag suggestions compact and color-codes the last review status', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/FlashcardsCollectionDetailView.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(source).toContain('ratingStatusClass')
    expect(source).toContain('performance-cell-rating')
    expect(styles).toMatch(/\.tag-input-suggestions\s*\{[^}]*display:\s*flex/s)
    expect(styles).toMatch(/\.tag-input-suggestion\s*\{[^}]*width:\s*auto/s)
    expect(styles).toContain('.card-performance .performance-cell-rating.status-rating-again')
    expect(styles).toContain('.card-performance .performance-cell-rating.status-rating-hard')
    expect(styles).toContain('.card-performance .performance-cell-rating.status-rating-good')
    expect(styles).toContain('.card-performance .performance-cell-rating.status-rating-easy')
  })

  it('uses the Nuxt UI dropdown menu instead of native details for review actions', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/FlashcardsReviewView.vue'), 'utf8')

    expect(source).not.toContain('<details>')
    expect(source).toContain('UDropdownMenu')
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

  it('celebrates every tenth reviewed card with rotating optimized Wolpi artwork', async () => {
    const source = await readFile(resolve(rendererRoot, 'views/FlashcardsReviewView.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')
    const wolpiAssets = await readdir(resolve(publicRoot, 'assets/wolpi'))
    const firstAsset = await stat(resolve(publicRoot, 'assets/wolpi/wolpi-01.webp'))

    expect(source).toContain('reviewedCardsInSession.value % 10')
    expect(source).toContain('showWolpiMilestone')
    expect(source).toContain('assets/wolpi/wolpi-')
    expect(source).toContain('WOLPI_MILESTONE_IMAGE_COUNT = 39')
    expect(source).toContain('<Transition name="wolpi-milestone">')
    expect(source).toContain('aria-live="polite"')
    expect(source).toContain('Motivation ausblenden')
    expect(styles).toContain('.wolpi-milestone')
    expect(styles).toContain('@keyframes wolpi-milestone-pop')
    expect(styles).toContain('.wolpi-milestone-enter-active')
    expect(styles).toContain(":root[data-theme='dark'] .wolpi-milestone")
    expect(wolpiAssets.filter((file) => file.endsWith('.webp'))).toHaveLength(39)
    expect(firstAsset.size).toBeLessThan(80_000)
  })
})
