import type { ReviewCard, ReviewRating } from './schemas'
import type { RecordReviewResult } from './ipc'
import { z } from 'zod'
import { reviewCardSchema, learningReviewEventSchema, isoDateSchema, uuidSchema } from './schemas'

export type StudyMode = 'first_pass' | 'review' | 'weak' | 'all'
export type StudyCommand =
  | { action: 'catalog'; search?: string; page?: number }
  | { action: 'overview'; collectionId?: string }
  | { action: 'start'; collectionId: string; mode: StudyMode }
  | { action: 'batch' | 'resume_deferred'; runId: string }
  | { action: 'defer'; runId: string; cardId: string }
  | { action: 'rate'; runId: string; cardId: string; rating: ReviewRating; eventId: string; elapsedMs?: number }
  | { action: 'undo'; runId: string; eventId: string }

export type StudyRun = {
  id: string
  collectionId: string
  mode: StudyMode
  total: number
  completed: number
  remaining: number
  deferred: number
  excluded: number
  added: number
  status: 'active' | 'completed'
  createdAt: string
  updatedAt: string
}

export type StudyOverview = {
  collectionId: string
  totalCards: number
  eligibleCards: number
  reviewedCards: number
  newCards: number
  dueCards: number
  weakCards: number
  pausedCards: number
  activeRun: StudyRun | null
}

export type StudyResponse = {
  overviews: StudyOverview[]
  run: StudyRun | null
  cards: ReviewCard[]
  review: RecordReviewResult | null
  catalog?: StudyCatalog
}

export type StudyCollection = { id: string; name: string; subject: string | null; overview: StudyOverview; defaultRun: StudyRun | null }
export type StudyRecommendation = { kind: 'review' | 'resume' | 'new'; collection: StudyCollection }
export type StudyCatalog = {
  items: StudyCollection[]
  total: number
  collectionCount: number
  eligibleCollectionCount: number
  recommendation: StudyRecommendation | null
}

export const STUDY_CATALOG_PAGE_SIZE = 24
export const studyCatalogQuerySchema = z.object({
  search: z.string().trim().default(''),
  page: z.number().int().min(1).max(2147483647).default(1)
})

export const STUDY_BATCH_SIZE = 40

export const studyRunSchema = z.object({
  id: uuidSchema, collectionId: uuidSchema, mode: z.enum(['first_pass', 'review', 'weak', 'all']),
  total: z.number().int().nonnegative(), completed: z.number().int().nonnegative(), remaining: z.number().int().nonnegative(),
  deferred: z.number().int().nonnegative(), excluded: z.number().int().nonnegative(), added: z.number().int().nonnegative(),
  status: z.enum(['active', 'completed']), createdAt: isoDateSchema, updatedAt: isoDateSchema
})

export const studyOverviewSchema = z.object({
    collectionId: uuidSchema, totalCards: z.number().int().nonnegative(), eligibleCards: z.number().int().nonnegative(),
    reviewedCards: z.number().int().nonnegative(), newCards: z.number().int().nonnegative(), dueCards: z.number().int().nonnegative(),
    weakCards: z.number().int().nonnegative(), pausedCards: z.number().int().nonnegative(), activeRun: studyRunSchema.nullable()
  })
export const studyCollectionSchema = z.object({
  id: uuidSchema, name: z.string(), subject: z.string().nullable(), overview: studyOverviewSchema, defaultRun: studyRunSchema.nullable()
})
export const studyCatalogSchema = z.object({
  items: z.array(studyCollectionSchema).max(STUDY_CATALOG_PAGE_SIZE),
  total: z.number().int().nonnegative(), collectionCount: z.number().int().nonnegative(),
  eligibleCollectionCount: z.number().int().nonnegative(),
  recommendation: z.object({ kind: z.enum(['review', 'resume', 'new']), collection: studyCollectionSchema }).nullable()
})

export const studyResponseSchema = z.object({
  overviews: z.array(studyOverviewSchema),
  catalog: studyCatalogSchema.optional(),
  run: studyRunSchema.nullable(), cards: z.array(reviewCardSchema).max(STUDY_BATCH_SIZE),
  review: z.object({ event: learningReviewEventSchema, nextDueAt: isoDateSchema, intervalLabel: z.string() }).nullable()
})
