import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')

describe('Nuxt UI renderer foundation', () => {
  it('registers Nuxt UI in Vite and Vue', async () => {
    const [viteConfig, main] = await Promise.all([
      readFile(resolve(projectRoot, 'electron.vite.config.ts'), 'utf8'),
      readFile(resolve(projectRoot, 'src/renderer/src/main.ts'), 'utf8')
    ])

    expect(viteConfig).toContain("from '@nuxt/ui/vite'")
    expect(viteConfig).toMatch(/plugins:\s*\[\s*vue\(\),\s*ui\(/)
    expect(main).toContain("from '@nuxt/ui/vue-plugin'")
    expect(main).toContain('.use(ui)')
  })

  it('wraps the renderer and isolates its root styles', async () => {
    const [app, index, styles] = await Promise.all([
      readFile(resolve(projectRoot, 'src/renderer/src/App.vue'), 'utf8'),
      readFile(resolve(projectRoot, 'src/renderer/index.html'), 'utf8'),
      readFile(resolve(projectRoot, 'src/renderer/src/styles/main.css'), 'utf8')
    ])

    expect(app).toContain('<UApp>')
    expect(index).toContain('<div id="app" class="isolate"></div>')
    expect(styles).toContain('@import "tailwindcss";')
    expect(styles).toContain('@import "@nuxt/ui";')
    expect(styles).toContain('--color-wolpi-500:')
  })
})
