export const APP_VERSION = '0.1.0'
export const DATABASE_SCHEMA_VERSION = 2
export const JURA_FORMAT = 'jura-klausur'
export const JURA_FORMAT_VERSION = 1
export const DOCUMENT_SCHEMA_VERSION = 1
export const EDITOR_SCHEMA_VERSION = 1

export const EMPTY_TIPTAP_DOCUMENT = {
  type: 'doc',
  content: [{ type: 'paragraph' }]
} as const

export const ALLOWED_FONT_SIZES = ['11pt', '12pt', '14pt'] as const
export const DEFAULT_FONT_SIZE = '12pt'
