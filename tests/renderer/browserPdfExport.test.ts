import { describe, expect, it } from 'vitest'
import { createExamPdfDefinition } from '../../src/renderer/src/utils/browserPdfExport'

describe('browser PDF export', () => {
  it('creates a text-based A4 PDF document definition from the editor content', () => {
    const definition = createExamPdfDefinition('Arbeitsrechtliche Klausur', {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'justify' },
          content: [
            { type: 'text', text: 'Die Klage ist ' },
            { type: 'text', text: 'zulässig', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' und begründet.' }
          ]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Wichtiger Hinweis', marks: [{ type: 'highlight' }] }
          ]
        }
      ]
    })

    expect(definition.pageSize).toBe('A4')
    expect(definition.info).toMatchObject({ title: 'Arbeitsrechtliche Klausur' })
    expect(JSON.stringify(definition.content)).toContain('Die Klage ist')
    expect(JSON.stringify(definition.content)).toContain('zulässig')
    expect(JSON.stringify(definition.content)).toContain('"bold":true')
    expect(JSON.stringify(definition.content)).toContain('"background":"#d6d6d6"')
    expect(JSON.stringify(definition.content)).toContain('"alignment":"justify"')
  })
})
