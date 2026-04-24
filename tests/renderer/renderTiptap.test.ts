import { describe, expect, it } from 'vitest'
import { renderTiptapHtml } from '@shared/renderTiptap'

describe('renderTiptapHtml', () => {
  it('escapes text and CSS attributes before rendering readonly correction HTML', () => {
    const html = renderTiptapHtml({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: {
            textAlign: 'left;color:red',
            indent: 1
          },
          content: [
            {
              type: 'text',
              text: '<img src=x onerror=alert(1)>',
              marks: [{ type: 'textStyle', attrs: { fontSize: '12pt;background:url(x)' } }]
            }
          ]
        }
      ]
    })

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('url(')
  })
})
