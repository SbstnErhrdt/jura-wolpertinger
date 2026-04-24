export function renderTiptapHtml(content: Record<string, unknown>): string {
  const nodes = Array.isArray(content.content) ? content.content : []
  return nodes.map(renderNode).join('')
}

function renderNode(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const value = node as Record<string, unknown>

  if (value.type === 'text') return applyMarks(escapeHtml(String(value.text ?? '')), value.marks)
  if (value.type === 'hardBreak') return '<br />'

  const children = Array.isArray(value.content) ? value.content.map(renderNode).join('') : ''
  if (value.type === 'paragraph') {
    const attrs = (value.attrs ?? {}) as Record<string, unknown>
    const styles: string[] = []
    if (typeof attrs.textAlign === 'string') styles.push(`text-align:${escapeCss(attrs.textAlign)}`)
    if (typeof attrs.indent === 'number') styles.push(`margin-left:${attrs.indent * 2}em`)
    const style = styles.length ? ` style="${styles.join(';')}"` : ''
    return `<p${style}>${children || '<br />'}</p>`
  }
  return children
}

function applyMarks(text: string, marks: unknown): string {
  if (!Array.isArray(marks)) return text
  return marks.reduce((current, mark) => {
    const value = mark as Record<string, unknown>
    if (value.type === 'bold') return `<strong>${current}</strong>`
    if (value.type === 'italic') return `<em>${current}</em>`
    if (value.type === 'underline') return `<u>${current}</u>`
    if (value.type === 'highlight') return `<mark>${current}</mark>`
    if (value.type === 'textStyle') {
      const attrs = (value.attrs ?? {}) as Record<string, unknown>
      const fontSize = typeof attrs.fontSize === 'string' ? escapeCss(attrs.fontSize) : ''
      return fontSize ? `<span style="font-size:${fontSize}">${current}</span>` : current
    }
    return current
  }, text)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeCss(value: string): string {
  return value.replace(/[^a-zA-Z0-9% ._-]/g, '')
}
