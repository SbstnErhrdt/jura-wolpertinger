import { z } from 'zod'
import {
  APP_VERSION,
  DOCUMENT_SCHEMA_VERSION,
  EDITOR_SCHEMA_VERSION,
  JURA_FORMAT,
  JURA_FORMAT_VERSION
} from './constants'

export const isoDateSchema = z.string().datetime()
export const uuidSchema = z.string().uuid()

export const examStatusSchema = z.enum([
  'draft',
  'in_progress',
  'submitted',
  'corrected',
  'archived'
])

export const userSchema = z.object({
  id: uuidSchema,
  displayName: z.string().min(1),
  kind: z.enum(['local', 'demo', 'remote']),
  remoteUserId: z.string().nullable(),
  onboardingCompletedAt: isoDateSchema.nullable(),
  tourCompletedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
})

export const folderSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  name: z.string().min(1),
  parentId: uuidSchema.nullable(),
  trashedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
})

export const examListItemSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  title: z.string().min(1),
  folderId: uuidSchema.nullable(),
  folderName: z.string().nullable(),
  status: examStatusSchema,
  tags: z.array(z.string()),
  notes: z.string(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  lastSavedAt: isoDateSchema,
  currentRevisionId: uuidSchema.nullable(),
  latestScore: z.number().nullable()
})

export const tiptapContentSchema = z
  .object({
    type: z.string().optional(),
    content: z.array(z.unknown()).optional()
  })
  .passthrough()

export const juraManifestSchema = z.object({
  format: z.literal(JURA_FORMAT),
  formatVersion: z.literal(JURA_FORMAT_VERSION),
  minimumAppVersion: z.string().default(APP_VERSION),
  createdWithAppVersion: z.string().default(APP_VERSION),
  documentSchemaVersion: z.literal(DOCUMENT_SCHEMA_VERSION),
  createdAt: isoDateSchema,
  documentId: uuidSchema
})

export const documentSchema = z.object({
  schemaVersion: z.literal(DOCUMENT_SCHEMA_VERSION),
  documentType: z.literal('jura-klausur'),
  id: uuidSchema,
  title: z.string().min(1),
  status: examStatusSchema,
  folderPath: z.array(z.string()),
  tags: z.array(z.string()),
  notes: z.string(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  currentRevisionId: uuidSchema.nullable(),
  submissions: z.array(uuidSchema),
  corrections: z.array(uuidSchema),
  attachments: z.array(uuidSchema)
})

export const revisionSchema = z.object({
  schemaVersion: z.literal(1),
  editorSchemaVersion: z.literal(EDITOR_SCHEMA_VERSION),
  id: uuidSchema,
  userId: uuidSchema,
  examId: uuidSchema,
  createdAt: isoDateSchema,
  kind: z.enum(['initial', 'autosave', 'manual', 'submission']),
  contentFormat: z.literal('tiptap-v1'),
  contentHash: z.string().min(1),
  content: tiptapContentSchema
})

export const submissionSchema = z.object({
  schemaVersion: z.literal(1),
  id: uuidSchema,
  userId: uuidSchema,
  examId: uuidSchema,
  submittedAt: isoDateSchema,
  revisionId: uuidSchema,
  contentHash: z.string().min(1),
  canContinueEditing: z.literal(true),
  pdfPath: z.string().nullable()
})

export const scoreSchema = z.object({
  system: z.literal('bayern-0-18'),
  points: z
    .number()
    .min(0)
    .max(18)
    .refine((value) => Number.isInteger(value * 2), 'Score must be in 0.5 increments')
    .nullable()
})

export const commentAnchorSchema = z.object({
  type: z.literal('prosemirror-selection'),
  editorSchemaVersion: z.literal(EDITOR_SCHEMA_VERSION),
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  selectedText: z.string(),
  prefix: z.string(),
  suffix: z.string(),
  contentHash: z.string()
})

export const inlineCommentSchema = z.object({
  schemaVersion: z.literal(1),
  id: uuidSchema,
  userId: uuidSchema,
  targetSubmissionId: uuidSchema,
  correctionId: uuidSchema,
  createdAt: isoDateSchema,
  status: z.enum(['open', 'resolved', 'archived']),
  body: z.string(),
  anchor: commentAnchorSchema,
  tags: z.array(z.string())
})

export const correctionSchema = z.object({
  schemaVersion: z.literal(1),
  id: uuidSchema,
  userId: uuidSchema,
  targetSubmissionId: uuidSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  score: scoreSchema,
  gradingComment: z.string(),
  tags: z.array(z.string()),
  inlineComments: z.array(inlineCommentSchema)
})

export const attachmentSchema = z.object({
  schemaVersion: z.literal(1),
  id: uuidSchema,
  userId: uuidSchema,
  examId: uuidSchema,
  originalName: z.string(),
  storedName: z.string(),
  mimeType: z.string().nullable(),
  size: z.number().int().nonnegative(),
  relativePath: z.string(),
  createdAt: isoDateSchema
})

export type ExamStatus = z.infer<typeof examStatusSchema>
export type User = z.infer<typeof userSchema>
export type Folder = z.infer<typeof folderSchema>
export type ExamListItem = z.infer<typeof examListItemSchema>
export type JuraManifest = z.infer<typeof juraManifestSchema>
export type JuraDocument = z.infer<typeof documentSchema>
export type ExamRevision = z.infer<typeof revisionSchema>
export type Submission = z.infer<typeof submissionSchema>
export type Score = z.infer<typeof scoreSchema>
export type CommentAnchor = z.infer<typeof commentAnchorSchema>
export type InlineComment = z.infer<typeof inlineCommentSchema>
export type Correction = z.infer<typeof correctionSchema>
export type Attachment = z.infer<typeof attachmentSchema>
