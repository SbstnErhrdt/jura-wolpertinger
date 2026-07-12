import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(import.meta.dirname, '../../src/renderer/src')
const protectedFiles = new Set(['views/ExamView.vue', 'components/ExamEditor.vue'])
const deletedWrappers = ['ActionMenu.vue', 'AppBadge.vue', 'AppPagination.vue', 'ListSkeleton.vue']

async function vueFiles(directory: string, prefix = ''): Promise<Array<{ relative: string; source: string }>> {
  const entries = await readdir(directory, { withFileTypes: true })
  const result: Array<{ relative: string; source: string }> = []
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    const absolute = resolve(directory, entry.name)
    if (entry.isDirectory()) result.push(...(await vueFiles(absolute, relative)))
    else if (entry.name.endsWith('.vue')) result.push({ relative, source: await readFile(absolute, 'utf8') })
  }
  return result
}

describe('Nuxt UI migration completeness', () => {
  it('uses Nuxt UI controls everywhere outside the protected exam view', async () => {
    const files = await vueFiles(rendererRoot)
    for (const file of files) {
      if (protectedFiles.has(file.relative)) continue
      expect(file.source, file.relative).not.toMatch(/<(button|input|select|textarea)\b/)
      expect(file.source, file.relative).not.toMatch(/components\/ui\/(ActionMenu|AppBadge|AppBreadcrumb|AppPagination|ListSkeleton)/)
    }
  })

  it('removes superseded custom standard-control wrappers', async () => {
    const uiFiles = await readdir(resolve(rendererRoot, 'components/ui')).catch(() => [])
    for (const wrapper of deletedWrappers) expect(uiFiles).not.toContain(wrapper)
  })

  it('keeps both protected files free of Nuxt UI tags', async () => {
    const files = await vueFiles(rendererRoot)
    for (const relative of protectedFiles) {
      const file = files.find((candidate) => candidate.relative === relative)
      expect(file?.source, relative).not.toMatch(/<U[A-Z]/)
    }
  })
})
