import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces'

type PdfMakeApi = {
  addVirtualFileSystem(vfs: unknown): void
  createPdf(definition: TDocumentDefinitions): {
    download(filename?: string): Promise<void>
  }
}

let pdfMakePromise: Promise<PdfMakeApi> | null = null

export async function downloadExamPdf(title: string, content: Record<string, unknown>): Promise<void> {
  const pdfMake = await loadPdfMake()
  await pdfMake.createPdf(createExamPdfDefinition(title, content)).download(`${slug(title)}.pdf`)
}

export function createExamPdfDefinition(
  title: string,
  content: Record<string, unknown>
): TDocumentDefinitions {
  const body = tiptapToPdfContent(content)
  return {
    pageSize: 'A4',
    pageMargins: [62, 62, 80, 62],
    info: {
      title
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 12,
      lineHeight: 1.35
    },
    styles: {
      paragraph: {
        margin: [0, 0, 0, 10]
      }
    },
    content: [
      {
        canvas: [
          {
            type: 'line',
            x1: 469,
            y1: 0,
            x2: 469,
            y2: 720,
            lineWidth: 0.6,
            lineColor: '#b8b8b8'
          }
        ],
        absolutePosition: { x: 515, y: 62 }
      },
      ...body
    ]
  }
}

function tiptapToPdfContent(content: Record<string, unknown>): Content[] {
  const nodes = Array.isArray(content.content) ? content.content : []
  const paragraphs = nodes.flatMap(nodeToPdfContent)
  return paragraphs.length ? paragraphs : [{ text: ' ', style: 'paragraph' }]
}

function nodeToPdfContent(node: unknown): Content[] {
  if (!node || typeof node !== 'object') return []
  const value = node as Record<string, unknown>
  if (value.type !== 'paragraph') {
    const children = Array.isArray(value.content) ? value.content.flatMap(nodeToPdfContent) : []
    return children
  }

  const attrs = (value.attrs ?? {}) as Record<string, unknown>
  const text = Array.isArray(value.content)
    ? value.content.flatMap(inlineNodeToPdfText)
    : [{ text: ' ' }]
  const paragraph: ContentText = {
    text: text.length ? text : [{ text: ' ' }],
    style: 'paragraph'
  }
  if (typeof attrs.textAlign === 'string') {
    paragraph.alignment = normalizeAlignment(attrs.textAlign)
  }
  if (typeof attrs.indent === 'number' && attrs.indent > 0) {
    paragraph.margin = [Math.min(attrs.indent, 6) * 18, 0, 0, 10]
  }
  return [paragraph]
}

function inlineNodeToPdfText(node: unknown): Content[] {
  if (!node || typeof node !== 'object') return []
  const value = node as Record<string, unknown>
  if (value.type === 'hardBreak') return [{ text: '\n' }]
  if (value.type !== 'text') return []

  const textRun: ContentText = { text: String(value.text ?? '') }
  if (Array.isArray(value.marks)) {
    for (const mark of value.marks) applyMark(textRun, mark)
  }
  return [textRun]
}

function applyMark(textRun: ContentText, mark: unknown): void {
  if (!mark || typeof mark !== 'object') return
  const value = mark as Record<string, unknown>
  if (value.type === 'bold') textRun.bold = true
  if (value.type === 'italic') textRun.italics = true
  if (value.type === 'underline') textRun.decoration = 'underline'
  if (value.type === 'highlight') textRun.background = '#d6d6d6'
  if (value.type === 'textStyle') {
    const attrs = (value.attrs ?? {}) as Record<string, unknown>
    const fontSize = parseFontSize(attrs.fontSize)
    if (fontSize) textRun.fontSize = fontSize
  }
}

function parseFontSize(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const parsed = Number(value.replace('px', '').trim())
  if (!Number.isFinite(parsed) || parsed < 8 || parsed > 32) return null
  return parsed
}

function normalizeAlignment(value: string): 'left' | 'center' | 'right' | 'justify' {
  if (value === 'center' || value === 'right' || value === 'justify') return value
  return 'left'
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'klausur'
  )
}

async function loadPdfMake(): Promise<PdfMakeApi> {
  pdfMakePromise ??= Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts')
  ]).then(([pdfMakeModule, fontsModule]) => {
    const pdfMake = moduleDefault(pdfMakeModule) as PdfMakeApi
    pdfMake.addVirtualFileSystem(moduleDefault(fontsModule))
    return pdfMake
  })
  return pdfMakePromise
}

function moduleDefault(module: unknown): unknown {
  if (module && typeof module === 'object' && 'default' in module) {
    return (module as { default: unknown }).default
  }
  return module
}
