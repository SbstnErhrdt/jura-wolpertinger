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

export const legalAreaSchema = z.enum(['civil', 'criminal', 'public', 'mixed', 'other'])
export const examTypeSchema = z.enum([
  'judgment',
  'order',
  'relation',
  'indictment',
  'expert_opinion',
  'pleading',
  'other'
])
export const attachmentRoleSchema = z.enum(['assignment', 'candidate_note', 'model_solution', 'other'])
export const aiDraftStatusSchema = z.enum(['draft', 'accepted', 'rejected', 'superseded'])
export const aiConfidenceSchema = z.enum(['low', 'medium', 'high'])
export const improvementCategorySchema = z.enum([
  'issue_spotting',
  'law',
  'procedure',
  'structure',
  'argumentation',
  'style',
  'time_management',
  'other'
])
export const learningTaskStatusSchema = z.enum(['open', 'in_progress', 'done'])
export const learningTaskPrioritySchema = z.enum(['low', 'medium', 'high'])

const nullableDefaultSchema = <Schema extends z.ZodTypeAny>(schema: Schema) =>
  z.preprocess((value) => value ?? null, schema.nullable().optional())

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
  latestScore: z.number().nullable(),
  legalArea: nullableDefaultSchema(legalAreaSchema),
  examType: nullableDefaultSchema(examTypeSchema),
  sourceName: nullableDefaultSchema(z.string()),
  sourceUrl: nullableDefaultSchema(z.string())
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
  attachments: z.array(uuidSchema),
  legalArea: nullableDefaultSchema(legalAreaSchema),
  examType: nullableDefaultSchema(examTypeSchema),
  sourceName: nullableDefaultSchema(z.string()),
  sourceUrl: nullableDefaultSchema(z.string())
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

export const improvementSuggestionSchema = z.object({
  category: improvementCategorySchema,
  priority: learningTaskPrioritySchema,
  title: z.string().min(1),
  detail: z.string().min(1)
})

export const aiInlineCommentSuggestionSchema = z.object({
  selectedText: z.string().min(1),
  prefix: z.string().default(''),
  suffix: z.string().default(''),
  body: z.string().min(1),
  tags: z.array(z.string()).default([])
})

export const aiCorrectionDraftSchema = z.object({
  schemaVersion: z.literal(1),
  id: uuidSchema,
  userId: uuidSchema,
  submissionId: uuidSchema,
  correctionId: uuidSchema.nullable(),
  status: aiDraftStatusSchema,
  provider: z.literal('openai'),
  model: z.string().min(1),
  promptVersion: z.literal('ai-correction-v1'),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  score: scoreSchema,
  scoreReasoning: z.string().min(1),
  gradingComment: z.string().min(1),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  tags: z.array(z.string()),
  confidence: aiConfidenceSchema,
  improvementSuggestions: z.array(improvementSuggestionSchema),
  inlineComments: z.array(aiInlineCommentSuggestionSchema)
})

export const learningTaskSchema = z.object({
  schemaVersion: z.literal(1),
  id: uuidSchema,
  userId: uuidSchema,
  submissionId: uuidSchema,
  correctionId: uuidSchema.nullable(),
  aiDraftId: uuidSchema.nullable(),
  category: improvementCategorySchema,
  priority: learningTaskPrioritySchema,
  status: learningTaskStatusSchema,
  title: z.string().min(1),
  detail: z.string().min(1),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema
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
  role: attachmentRoleSchema.default('other'),
  createdAt: isoDateSchema
})

export type ExamStatus = z.infer<typeof examStatusSchema>
export type LegalArea = z.infer<typeof legalAreaSchema>
export type ExamType = z.infer<typeof examTypeSchema>
export type AttachmentRole = z.infer<typeof attachmentRoleSchema>
export type AiDraftStatus = z.infer<typeof aiDraftStatusSchema>
export type AiConfidence = z.infer<typeof aiConfidenceSchema>
export type ImprovementCategory = z.infer<typeof improvementCategorySchema>
export type LearningTaskStatus = z.infer<typeof learningTaskStatusSchema>
export type LearningTaskPriority = z.infer<typeof learningTaskPrioritySchema>
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
export type AiCorrectionDraft = z.infer<typeof aiCorrectionDraftSchema>
export type LearningTask = z.infer<typeof learningTaskSchema>
export type ImprovementSuggestion = z.infer<typeof improvementSuggestionSchema>
export type AiInlineCommentSuggestion = z.infer<typeof aiInlineCommentSuggestionSchema>
export type Attachment = z.infer<typeof attachmentSchema>
