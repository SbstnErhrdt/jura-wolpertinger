import type {
  Attachment,
  CommentAnchor,
  Correction,
  ExamListItem as SchemaExamListItem,
  ExamRevision,
  ExamStatus,
  Folder as SchemaFolder,
  InlineComment,
  Submission
} from './schemas'
import type { User } from './schemas'

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
}

export type UpdateExamInput = {
  id: string
  title?: string
  folderId?: string | null
  status?: ExamStatus
  tags?: string[]
  notes?: string
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

export type AppApi = {
  getCurrentUser(): Promise<AppUser>
  listUsers(): Promise<AppUser[]>
  createUser(displayName: string): Promise<AppUser>
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
  createExam(input: CreateExamInput): Promise<ExamDetails>
  getExam(id: string): Promise<ExamDetails>
  updateExam(input: UpdateExamInput): Promise<ExamDetails>
  trashExam(id: string): Promise<ExamDetails>
  restoreExam(id: string): Promise<ExamDetails>
  saveRevision(input: SaveRevisionInput): Promise<ExamRevision>
  submitExam(examId: string): Promise<Submission>
  getSubmission(id: string): Promise<SubmissionDetails>
  listAnalyticsEntries(): Promise<AnalyticsEntry[]>
  addAttachment(examId: string): Promise<Attachment | null>
  openAttachment(id: string): Promise<void>
  exportExamPackage(examId: string): Promise<string | null>
  importExamPackage(): Promise<ExamDetails | null>
  exportExamPdf(examId: string): Promise<string | null>
  createCorrection(submissionId: string): Promise<Correction>
  updateCorrection(input: UpdateCorrectionInput): Promise<Correction>
  addInlineComment(input: AddInlineCommentInput): Promise<InlineComment>
}
