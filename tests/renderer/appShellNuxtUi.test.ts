import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(import.meta.dirname, '../../src/renderer/src')

describe('Nuxt UI app shell', () => {
  it('uses Nuxt UI for navigation and standard controls', async () => {
    const app = await readFile(resolve(rendererRoot, 'App.vue'), 'utf8')

    expect(app).toContain('<UNavigationMenu')
    expect(app).toContain('<UButton')
    expect(app).toContain('<UInput')
    expect(app).toContain('<UDropdownMenu')
    expect(app).toContain('<UModal')
    expect(app).not.toMatch(/<(button|input|select|textarea)\b/)
  })

  it('keeps every desktop and mobile destination', async () => {
    const app = await readFile(resolve(rendererRoot, 'App.vue'), 'utf8')

    for (const routeName of [
      'home',
      'flashcards',
      'flashcards-review',
      'flashcards-collections',
      'flashcards-statistics',
      'podcasts',
      'exams',
      'dashboard',
      'correction',
      'analytics',
      'more',
      'settings',
      'about',
      'help'
    ]) {
      expect(app).toContain(`name: '${routeName}'`)
    }

    for (const label of ['Home', 'Karteikarten', 'Podcasts', 'Prüfungen', 'Mehr']) {
      expect(app).toContain(`label: '${label}'`)
    }
  })

  it('keeps section navigation active on every nested route', async () => {
    const app = await readFile(resolve(rendererRoot, 'App.vue'), 'utf8')

    expect(app).toContain('const homeNavigationItems = computed')
    expect(app).toContain('const flashcardNavigationItems = computed')
    expect(app).toContain('const examNavigationItems = computed')
    expect(app).toContain('const mobileNavigationItems = computed')
    expect(app).toContain("route.path.startsWith('/flashcards')")
    expect(app).toContain("route.path.startsWith('/exams')")
    expect(app).toContain("route.path.startsWith('/more')")
    expect(app).toContain("['flashcards-collections', 'flashcards-collection'].includes(String(route.name))")
    expect(app).toContain("['dashboard', 'exam', 'exam-focus'].includes(String(route.name))")
  })

  it('maps the existing theme state to the dark class used by Nuxt UI', async () => {
    const theme = await readFile(resolve(rendererRoot, 'theme.ts'), 'utf8')

    expect(theme).toContain("document.documentElement.classList.toggle('dark', theme.value === 'dark')")
    expect(theme).toContain("document.documentElement.classList.toggle('light', theme.value === 'light')")
  })

  it('defines consistent sidebar hover, active, focus and dark interaction states', async () => {
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(styles).toMatch(/\.nav a:hover\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.nav a\[data-active\]\s*\{[^}]*background:/s)
    expect(styles).toContain('--wolpi-blue-tint: #e2ebf3')
    expect(styles).toContain('--wolpi-nav-blue: #005a84')
    expect(styles).toContain('--wolpi-blue-tint-text: var(--wolpi-nav-blue)')
    expect(styles).toMatch(/\.nav a\[data-active\]\s*\{[^}]*background:\s*var\(--wolpi-blue-tint\)/s)
    expect(styles).toMatch(/\.nav a\[data-active\]\s*\{[^}]*color:\s*var\(--wolpi-blue-tint-text\)/s)
    expect(styles).toMatch(/\.nav a\.router-link-active\s*\{[^}]*background:/s)
    expect(styles).toMatch(/\.nav a\.router-link-active\s*\{[^}]*background:\s*var\(--wolpi-blue-tint\)/s)
    expect(styles).toMatch(/\.nav a\.router-link-active\s*\{[^}]*color:\s*var\(--wolpi-blue-tint-text\)/s)
    expect(styles).toContain(".nav a.router-link-active [data-slot='label']")
    expect(styles).toContain(".nav a[data-active] [data-slot='label']")
    expect(styles).toMatch(/\.nav a:focus-visible\s*\{[^}]*outline:\s*2px solid/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.nav a:hover\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.nav a\[data-active\]\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.nav a\[data-active\]\s*\{[^}]*color:\s*var\(--wolpi-blue-tint-text\)/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.nav a\.router-link-active\s*\{[^}]*background:/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.nav a\.router-link-active\s*\{[^}]*color:\s*var\(--wolpi-blue-tint-text\)/s)
  })

  it('keeps the app blue palette anchored to the Wolpi navigation blue', async () => {
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(styles).toContain('--wolpi-nav-blue: #005a84')
    expect(styles).toContain('--color-primary: var(--wolpi-nav-blue)')
    expect(styles).toContain('--color-primary-strong: var(--wolpi-nav-blue)')
    expect(styles).not.toMatch(/#(?:004f80|008bd2|006ea8|075d88|0f6c9d|0f506f|168fd1|7fcaf0|43bce8|82d5f2|159fd8|b9e7f8|dff3fc|0091ea|007fbe|0086d7|008fe3)\b/i)
  })

  it('uses one compact account menu for cloud and local user actions', async () => {
    const app = await readFile(resolve(rendererRoot, 'App.vue'), 'utf8')

    expect(app).toContain('const isCloudShell = computed')
    expect(app).toContain('<UDropdownMenu')
    expect(app).toContain(':items="accountMenuItems"')
    expect(app).toContain('class="sidebar-account-trigger"')
    expect(app).toContain('const accountMenuItems = computed')
    expect(app).toContain('Einstellungen')
    expect(app).toContain('Neuer Nutzer')
    expect(app).toContain('Abmelden')
    expect(app).toContain('async function signOut')
    expect(app).toContain('showCreateUser.value = true')
  })

  it('flushes and clears podcast state before the active account changes', async () => {
    const app = await readFile(resolve(rendererRoot, 'App.vue'), 'utf8')
    const player = await readFile(resolve(rendererRoot, 'podcasts/usePodcastPlayer.ts'), 'utf8')

    for (const [functionName, accountAction] of [
      ['switchUser', 'api.switchUser'],
      ['createUser', 'api.createUser'],
      ['signOut', 'client.auth.signOut']
    ]) {
      const block = app.match(new RegExp(`async function ${functionName}[^]*?\\n}`))?.[0] ?? ''
      expect(block.indexOf('await podcastPlayer.prepareForAccountChange()')).toBeGreaterThan(-1)
      expect(block.indexOf('await podcastPlayer.prepareForAccountChange()')).toBeLessThan(
        block.indexOf(accountAction)
      )
    }

    expect(player).toContain('async function prepareForAccountChange')
    expect(player).toContain('currentEpisode.value = null')
    expect(player).toContain('catalog.value = null')
  })

  it('renders the beta badge as a clean top-right corner ribbon', async () => {
    const app = await readFile(resolve(rendererRoot, 'App.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(app).toContain('class="beta-banner-corner"')
    expect(styles).toMatch(/\.beta-banner-corner\s*\{[^}]*height:\s*72px/s)
    expect(styles).toMatch(/\.beta-banner-corner\s*\{[^}]*overflow:\s*hidden/s)
    expect(styles).toMatch(/\.beta-banner-corner\s*\{[^}]*position:\s*absolute/s)
    expect(styles).toMatch(/\.beta-banner-corner\s*\{[^}]*right:\s*0/s)
    expect(styles).toMatch(/\.beta-banner-corner\s*\{[^}]*top:\s*0/s)
    expect(styles).toMatch(/\.beta-banner-corner\s*\{[^}]*width:\s*72px/s)
    expect(styles).toMatch(/\.beta-banner\s*\{[^}]*transform:\s*rotate\(45deg\)/s)
    expect(styles).not.toMatch(/\.beta-banner\s*\{[^}]*translate\(/s)
  })

  it('keeps the cloud auth form readable, recoverable and theme-aware', async () => {
    const app = await readFile(resolve(rendererRoot, 'App.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(app).toContain("authMode = ref<'sign_in' | 'sign_up' | 'reset_password' | 'update_password'>")
    expect(app).toContain('Passwort vergessen?')
    expect(app).toContain('resetPasswordForEmail')
    expect(app).toContain('verifyOtp')
    expect(app).toContain('token_hash')
    expect(app).toContain("params.get('type') !== 'recovery'")
    expect(app).toContain('history.replaceState')
    expect(app).toContain('PASSWORD_RECOVERY')
    expect(app).toContain('Neues Passwort setzen')
    expect(app).toContain('updateUser({ password')
    expect(app).toContain('class="auth-theme-toggle"')
    expect(app).toContain('Link zum Zurücksetzen senden')
    expect(styles).toMatch(/\.auth-field\s+\[data-slot='label'\]\s*\{[^}]*color:\s*#243746 !important/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.auth-panel\s*\{[^}]*background:\s*#0e202b/s)
    expect(styles).toMatch(/:root\[data-theme='dark'\] \.auth-field\s+\[data-slot='label'\]\s*\{[^}]*color:\s*#eef5f7 !important/s)
    expect(styles).toMatch(/\.auth-theme-toggle\s*\{[^}]*justify-self:\s*center/s)
  })
})
