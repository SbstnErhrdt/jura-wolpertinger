import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { renderTiptapHtml } from '@shared/renderTiptap'
import type { AppServices } from './services'

export async function exportExamPdf(services: AppServices, examId: string): Promise<string> {
  const details = services.getExam(examId)
  if (!details.currentRevision) {
    throw new Error('Cannot export PDF without a current revision')
  }

  const html = createPrintHtml(details.title, details.currentRevision.content)
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  })

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      preferCSSPageSize: true
    })

    const outputDir = join(services.filesDir, 'exams', examId, 'exports')
    await mkdir(outputDir, { recursive: true })
    const outputPath = join(outputDir, `${Date.now()}-${slug(details.title)}.pdf`)
    await writeFile(outputPath, pdf)
    return outputPath
  } finally {
    win.close()
  }
}

function createPrintHtml(title: string, content: Record<string, unknown>): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtmlAttribute(title)}</title>
  <style>
    @page { size: A4; margin: 22mm 28mm 22mm 22mm; }
    * { box-sizing: border-box; }
    body {
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12pt;
      line-height: 1.45;
      margin: 0;
    }
    .page {
      border-right: 1px solid #b8b8b8;
      min-height: 250mm;
      padding-right: 28mm;
    }
    p { margin: 0 0 10pt; }
    mark, .highlight { background: #d6d6d6; color: inherit; }
  </style>
</head>
<body>
  <main class="page">${renderTiptapHtml(content)}</main>
</body>
</html>`
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'klausur'
  )
}
