import type {
  AiCorrectionDraft,
  Attachment,
  AttachmentRole,
  CommentAnchor,
  Correction,
  ExamType,
  ExamListItem as SchemaExamListItem,
  ExamRevision,
  ExamStatus,
  Folder as SchemaFolder,
  InlineComment,
  LearningCard,
  LearningCollection,
  LearningDashboard,
  LearningImportResult,
  LearningReviewEvent,
  LearningTask,
  LegalArea,
  ReviewCard,
  ReviewRating,
  SyncAuthInput,
  SyncRunInput,
  SyncRunResult,
  SyncStatus,
  Submission
} from './schemas'
import type { User } from './schemas'

export type {
  SyncAuthInput,
  SyncRunInput,
  SyncRunResult,
  SyncStatus
} from './schemas'

export type FolderDto = SchemaFolder
export type ExamListItem = SchemaExamListItem
export type AppUser = User

export type UpdateFolderInput = {
  id: string
  name: string
}

export type TrashFolderInput = {
  id: string
  moveExamsToFolderId: string | null
}

export type ExamDetails = ExamListItem & {
  currentRevision: ExamRevision | null
  submissions: Submission[]
  attachments: Attachment[]
}

export type SubmissionDetails = Submission & {
  examTitle: string
  content: Record<string, unknown>
  contentHash: string
  corrections: Correction[]
}

export type AnalyticsEntry = {
  correctionId: string
  submissionId: string
  examId: string
  examTitle: string
  scorePoints: number
  submittedAt: string
  correctedAt: string
  examTags: string[]
  correctionTags: string[]
}

export type CreateExamInput = {
  title: string
  folderId?: string | null
  tags?: string[]
  legalArea?: LegalArea | null
  examType?: ExamType | null
  sourceName?: string | null
  sourceUrl?: string | null
}

export type UpdateExamInput = Omit<CreateExamInput, 'title'> & {
  id: string
  title?: string
  status?: ExamStatus
  notes?: string
}

export type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type ListExamsInput = {
  page?: number
  pageSize?: number
  folderId?: string | null
  status?: 'active' | 'archived' | 'all'
  search?: string
  sort?: 'updated' | 'title' | 'score'
}

export type SaveRevisionInput = {
  examId: string
  content: Record<string, unknown>
  kind?: 'autosave' | 'manual'
}

export type UpdateCorrectionInput = {
  correctionId: string
  scorePoints: number | null
  gradingComment: string
  tags: string[]
}

export type AddInlineCommentInput = {
  correctionId: string
  submissionId: string
  body: string
  anchor: CommentAnchor
  tags: string[]
}

export type SaveAiSettingsInput = {
  provider: 'openai'
  apiKey: string
  model: string
}

export type AiSettingsStatus = {
  provider: 'openai'
  configured: boolean
  model: string | null
  source: 'stored' | 'environment' | null
  keyPreview: string | null
  environmentAvailable: boolean
  updatedAt: string | null
}

export type TestAiConnectionInput = {
  source?: 'active' | 'environment'
}

export type AiConnectionTestResult = {
  ok: boolean
  model: string | null
  source: 'stored' | 'environment' | null
  message: string
}

export type GenerateAiCorrectionInput = {
  submissionId: string
}

export type CreateLearningCollectionInput = {
  name: string
  description?: string
  subject?: string | null
  source?: string | null
}

export type CreateLearningCardInput = {
  collectionId: string
  title: string
  frontMarkdown: string
  backMarkdown: string
  tags: string[]
}

export type UpdateLearningCardInput = CreateLearningCardInput & {
  id: string
}

export type DeleteLearningCardInput = {
  id: string
}

export type ListLearningCardsInput = {
  collectionId?: string | null
  page?: number
  pageSize?: number
  search?: string
  sort?: 'updated' | 'title' | 'due' | 'rating'
}

export type GetReviewBatchInput = {
  collectionId?: string | null
  tag?: string | null
  limit?: number
  excludeCardIds?: string[]
}

export type RecordReviewInput = {
  cardId: string
  rating: ReviewRating
  elapsedMs?: number | null
}

export type RecordReviewResult = {
  event: LearningReviewEvent
  nextDueAt: string
  intervalLabel: string
}

export type FeatureFlags = Record<string, boolean>

export type VoiceSessionStartInput = {
  promptId: string
}

export type VoiceSessionStart = {
  sessionId: string
  clientSecret: string
  model: string
  voice: string
}

export type VoiceSessionCompleteInput = {
  sessionId: string
  transcript: string
  assessment: unknown
}

export type VoiceSessionCompleteResult = {
  assessment: {
    rating: ReviewRating
    confidence: 'low' | 'medium' | 'high'
    reason: string
    matchedPoints: string[]
    missedPoints: string[]
    nextStep: string
  }
  recorded: boolean
  reviewEventId: string | null
}

export type UpdateUserProfileInput = {
  firstName: string | null
  lastName: string | null
}

export type SaveAiCorrectionDraftInput = {
  submissionId: string
  provider: 'openai'
  model: string
  scorePoints: number | null
  scoreReasoning: string
  gradingComment: string
  strengths: string[]
  weaknesses: string[]
  tags: string[]
  confidence: 'low' | 'medium' | 'high'
  improvementSuggestions: Array<{
    category: string
    priority: string
    title: string
    detail: string
  }>
  inlineComments: Array<{
    selectedText: string
    prefix: string
    suffix: string
    body: string
    tags: string[]
  }>
}

export type AppApi = {
  getAppVersion(): Promise<string>
  getFeatureFlags(): Promise<FeatureFlags>
  createVoiceReviewSession(input: VoiceSessionStartInput): Promise<VoiceSessionStart>
  completeVoiceReviewSession(input: VoiceSessionCompleteInput): Promise<VoiceSessionCompleteResult>
  getUserProfile(): Promise<import('./schemas').UserProfile>
  updateUserProfile(input: UpdateUserProfileInput): Promise<import('./schemas').UserProfile>
  getCurrentUser(): Promise<AppUser>
  listUsers(): Promise<AppUser[]>
  createUser(displayName: string): Promise<AppUser>
  updateUser(input: { id: string; displayName: string }): Promise<AppUser>
  switchUser(userId: string): Promise<AppUser>
  completeOnboarding(userId: string): Promise<AppUser>
  completeTour(userId: string): Promise<AppUser>
  resetTour(userId: string): Promise<AppUser>
  listFolders(): Promise<FolderDto[]>
  createFolder(name: string, parentId?: string | null): Promise<FolderDto>
  updateFolder(input: UpdateFolderInput): Promise<FolderDto>
  trashFolder(input: TrashFolderInput): Promise<FolderDto>
  restoreFolder(folderId: string): Promise<FolderDto>
  listExams(): Promise<ExamListItem[]>
  listExamsPage(input?: ListExamsInput): Promise<PaginatedResult<ExamListItem>>
  createExam(input: CreateExamInput): Promise<ExamDetails>
  getExam(id: string): Promise<ExamDetails>
  updateExam(input: UpdateExamInput): Promise<ExamDetails>
  trashExam(id: string): Promise<ExamDetails>
  restoreExam(id: string): Promise<ExamDetails>
  saveRevision(input: SaveRevisionInput): Promise<ExamRevision>
  submitExam(examId: string): Promise<Submission>
  getSubmission(id: string): Promise<SubmissionDetails>
  listAnalyticsEntries(): Promise<AnalyticsEntry[]>
  getAiSettingsStatus(): Promise<AiSettingsStatus>
  saveAiSettings(input: SaveAiSettingsInput): Promise<AiSettingsStatus>
  removeAiSettings(): Promise<AiSettingsStatus>
  testAiConnection(input?: TestAiConnectionInput): Promise<AiConnectionTestResult>
  generateAiCorrectionDraft(input: GenerateAiCorrectionInput): Promise<AiCorrectionDraft>
  listAiCorrectionDrafts(submissionId: string): Promise<AiCorrectionDraft[]>
  acceptAiCorrectionDraft(draftId: string): Promise<AiCorrectionDraft>
  rejectAiCorrectionDraft(draftId: string): Promise<AiCorrectionDraft>
  listLearningTasks(): Promise<LearningTask[]>
  updateLearningTaskStatus(taskId: string, status: 'open' | 'in_progress' | 'done'): Promise<LearningTask>
  getLearningDashboard(): Promise<LearningDashboard>
  exportLearningDecksJson(): Promise<string>
  importLearningDecksJson(json: string): Promise<LearningImportResult>
  listLearningCollections(): Promise<LearningCollection[]>
  createLearningCollection(input: CreateLearningCollectionInput): Promise<LearningCollection>
  listLearningCards(collectionId?: string | null): Promise<LearningCard[]>
  listLearningCardsPage(input?: ListLearningCardsInput): Promise<PaginatedResult<LearningCard>>
  createLearningCard(input: CreateLearningCardInput): Promise<LearningCard>
  updateLearningCard(input: UpdateLearningCardInput): Promise<LearningCard>
  deleteLearningCard(input: DeleteLearningCardInput): Promise<void>
  getReviewBatch(input?: GetReviewBatchInput): Promise<ReviewCard[]>
  recordReview(input: RecordReviewInput): Promise<RecordReviewResult>
  addAttachment(examId: string, role?: AttachmentRole): Promise<Attachment | null>
  openAttachment(id: string): Promise<void>
  exportExamPackage(examId: string): Promise<string | null>
  importExamPackage(): Promise<ExamDetails | null>
  exportExamPdf(examId: string): Promise<string | null>
  createCorrection(submissionId: string): Promise<Correction>
  updateCorrection(input: UpdateCorrectionInput): Promise<Correction>
  addInlineComment(input: AddInlineCommentInput): Promise<InlineComment>
  getSyncStatus(): Promise<SyncStatus>
  connectSyncAccount(input: SyncAuthInput): Promise<SyncStatus>
  disconnectSyncAccount(): Promise<SyncStatus>
  runSync(input: SyncRunInput): Promise<SyncRunResult>
}
