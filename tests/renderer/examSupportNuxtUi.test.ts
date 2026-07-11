import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const viewsRoot = resolve(import.meta.dirname, '../../src/renderer/src/views')
const files = ['DashboardView.vue', 'CorrectionView.vue', 'AnalyticsView.vue']

describe('Nuxt UI exam support views', () => {
  it.each(files)('%s has no native standard controls or legacy wrappers', async (file) => {
    const source = await readFile(resolve(viewsRoot, file), 'utf8')
    expect(source).not.toMatch(/<(button|input|select|textarea)\b/)
    expect(source).not.toMatch(/components\/ui\/(AppBreadcrumb|AppPagination|ListSkeleton)/)
  })

  it('uses Nuxt UI without changing support workflow handlers', async () => {
    const [dashboard, correction, analytics] = await Promise.all(
      files.map((file) => readFile(resolve(viewsRoot, file), 'utf8'))
    )
    const combined = `${dashboard}\n${correction}\n${analytics}`
    expect(combined).toContain('<UBreadcrumb')
    expect(combined).toContain('<UButton')
    expect(combined).toContain('<UInput')
    expect(combined).toContain('<UTextarea')
    expect(combined).toContain('<USelect')
    expect(combined).toContain('<UModal')
    expect(combined).toContain('<UPagination')
    expect(dashboard).toContain('@dragstart="startExamDrag($event, exam.id)"')
    expect(correction).toContain('@mouseup="captureSelection"')
    expect(analytics).toContain('markTaskDone(task.id)')
  })
})
