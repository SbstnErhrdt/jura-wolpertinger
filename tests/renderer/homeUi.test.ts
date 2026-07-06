import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

describe('home UI affordances', () => {
  it('sizes adjacent hero action links with one shared rule', async () => {
    const view = await readFile(resolve(rendererRoot, 'views/HomeView.vue'), 'utf8')
    const styles = await readFile(resolve(rendererRoot, 'styles/main.css'), 'utf8')

    expect(view).toContain('<div class="home-actions">')
    expect(view).toContain('class="primary-action"')
    expect(view).toContain('class="secondary"')
    expect(styles).toMatch(/\.home-actions a\s*\{[^}]*min-height:\s*42px;[^}]*padding:\s*0 14px;/s)
    expect(styles).not.toMatch(/\.primary-action\s*\{[^}]*min-height:/s)
    expect(styles).not.toMatch(/\.primary-action\s*\{[^}]*padding:/s)
  })
})
