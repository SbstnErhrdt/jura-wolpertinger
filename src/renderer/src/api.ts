import { EDITOR_SCHEMA_VERSION, EMPTY_TIPTAP_DOCUMENT } from '@shared/constants'
import type {
  AddInlineCommentInput,
  AiSettingsStatus,
  AnalyticsEntry,
  AppApi,
  CreateExamInput,
  ExamDetails,
  ExamListItem,
  FolderDto,
  SubmissionDetails,
  TrashFolderInput,
  UpdateCorrectionInput,
  UpdateFolderInput,
  UpdateExamInput
} from '@shared/ipc'
import type {
  AiCorrectionDraft,
  Attachment,
  Correction,
  ExamType,
  ExamRevision,
  InlineComment,
  LearningTask,
  LegalArea,
  Submission,
  User
} from '@shared/schemas'
import { examStatusSchema, examTypeSchema, learningTaskStatusSchema, legalAreaSchema } from '@shared/schemas'

const BROWSER_STORE_KEY = 'jura-wolpertinger-browser-dev-v1'
const AI_CORRECTION_NOT_IMPLEMENTED_MESSAGE = 'KI-Korrektur ist noch nicht implementiert.'

type BrowserStore = {
  users: User[]
  currentUserId: string | null
  folders: FolderDto[]
  exams: ExamListItem[]
  revisions: ExamRevision[]
  submissions: Submission[]
  attachments: Attachment[]
  corrections: Correction[]
  aiSettings: {
    provider: 'openai'
    configured: boolean
    model: string
    updatedAt: string | null
  } | null
  aiCorrectionDrafts: AiCorrectionDraft[]
  learningTasks: LearningTask[]
}

let browserDevApi: AppApi | null = null

export const isElectronApiAvailable = Boolean(window.juraApi)
export const api: AppApi = getApi()

export function getApi(): AppApi {
  if (window.juraApi) return window.juraApi
  browserDevApi ??= createBrowserDevApi()
  return browserDevApi
}

function createBrowserDevApi(): AppApi {
  console.warn(
    'Electron API bridge is not available. Using browser-only localStorage fallback for development.'
  )

  return {
    async getCurrentUser() {
      const store = readStore()
      return ensureBrowserUser(store)
    },
    async listUsers() {
      const store = readStore()
      ensureBrowserUser(store)
      writeStore(store)
      return store.users
    },
    async createUser(displayName: string) {
      const store = readStore()
      const user = createBrowserUser(displayName.trim() || 'Lokaler Nutzer', 'local')
      store.users.push(user)
      store.currentUserId = user.id
      writeStore(store)
      return user
    },
    async switchUser(userId: string) {
      const store = readStore()
      const user = store.users.find((candidate) => candidate.id === userId)
      if (!user) throw new Error(`User not found: ${userId}`)
      store.currentUserId = user.id
      writeStore(store)
      return user
    },
    async completeOnboarding(userId: string) {
      return updateBrowserUserTimestamp(userId, 'onboardingCompletedAt')
    },
    async completeTour(userId: string) {
      return updateBrowserUserTimestamp(userId, 'tourCompletedAt')
    },
    async resetTour(userId: string) {
      const store = readStore()
      const user = store.users.find((candidate) => candidate.id === userId)
      if (!user) throw new Error(`User not found: ${userId}`)
      user.tourCompletedAt = null
      user.onboardingCompletedAt = null
      user.updatedAt = nowIso()
      store.currentUserId = user.id
      writeStore(store)
      return user
    },
    async listFolders() {
      const store = readStore()
      const user = ensureBrowserUser(store)
      return store.folders.filter((folder) => folder.userId === user.id)
    },
    async createFolder(name: string, parentId?: string | null) {
      const store = readStore()
      const user = ensureBrowserUser(store)
      const now = nowIso()
      const folder: FolderDto = {
        id: newId(),
        userId: user.id,
        name: name.trim() || 'Neuer Ordner',
        parentId: parentId ?? null,
        trashedAt: null,
        createdAt: now,
        updatedAt: now
      }
      store.folders.unshift(folder)
      writeStore(store)
      return folder
    },
    async updateFolder(input: UpdateFolderInput) {
      const store = readStore()
      const index = store.folders.findIndex((folder) => folder.id === input.id)
      if (index < 0) throw new Error(`Folder not found: ${input.id}`)
      const current = store.folders[index]
      const next: FolderDto = {
        ...current,
        name: input.name.trim() || 'Neuer Ordner',
        updatedAt: nowIso()
      }
      store.folders[index] = next
      writeStore(store)
      return next
    },
    async trashFolder(input: TrashFolderInput) {
      const store = readStore()
      const index = store.folders.findIndex((folder) => folder.id === input.id)
      if (index < 0) throw new Error(`Folder not found: ${input.id}`)
      if (input.moveExamsToFolderId === input.id) {
        throw new Error('Einträge können nicht in denselben Ordner verschoben werden')
      }
      if (input.moveExamsToFolderId) {
        const targetFolder = store.folders.find((folder) => folder.id === input.moveExamsToFolderId)
        if (!targetFolder || targetFolder.trashedAt) {
          throw new Error('Papierkorb-Ordner kann nicht verwendet werden')
        }
      }

      const now = nowIso()
      for (const exam of store.exams) {
        if (exam.folderId === input.id) {
          exam.folderId = input.moveExamsToFolderId ?? null
          exam.folderName = folderName(store, input.moveExamsToFolderId ?? null)
          exam.updatedAt = now
        }
      }

      store.folders[index] = {
        ...store.folders[index],
        trashedAt: now,
        updatedAt: now
      }
      writeStore(store)
      return store.folders[index]
    },
    async restoreFolder(folderId: string) {
      const store = readStore()
      const index = store.folders.findIndex((folder) => folder.id === folderId)
      if (index < 0) throw new Error(`Folder not found: ${folderId}`)
      store.folders[index] = {
        ...store.folders[index],
        trashedAt: null,
        updatedAt: nowIso()
      }
      writeStore(store)
      return store.folders[index]
    },
    async listExams() {
      const store = readStore()
      const user = ensureBrowserUser(store)
      return store.exams.filter((exam) => exam.userId === user.id).map(withLatestScore)
    },
    async createExam(input: CreateExamInput) {
      const store = readStore()
      const user = ensureBrowserUser(store)
      const legalArea = parseLegalArea(input.legalArea)
      const examType = parseExamType(input.examType)
      const now = nowIso()
      const examId = newId()
      const revisionId = newId()
      const content = clone(EMPTY_TIPTAP_DOCUMENT) as Record<string, unknown>
      const revision: ExamRevision = {
        schemaVersion: 1,
        editorSchemaVersion: 1,
        id: revisionId,
        userId: user.id,
        examId,
        createdAt: now,
        kind: 'initial',
        contentFormat: 'tiptap-v1',
        contentHash: hashJson(content),
        content
      }
      const exam: ExamListItem = {
        id: examId,
        userId: user.id,
        title: input.title.trim() || 'Neue Klausur',
        folderId: input.folderId ?? null,
        folderName: folderName(store, input.folderId ?? null),
        status: 'draft',
        tags: normalizeTags(input.tags ?? []),
        notes: '',
        createdAt: now,
        updatedAt: now,
        lastSavedAt: now,
        currentRevisionId: revisionId,
        latestScore: null,
        legalArea,
        examType,
        sourceName: input.sourceName ?? null,
        sourceUrl: input.sourceUrl ?? null
      }
      store.exams.unshift(exam)
      store.revisions.push(revision)
      writeStore(store)
      return examDetails(store, examId)
    },
    async getExam(id: string) {
      return examDetails(readStore(), id)
    },
    async updateExam(input: UpdateExamInput) {
      const store = readStore()
      const index = store.exams.findIndex((exam) => exam.id === input.id)
      if (index < 0) throw new Error(`Exam not found: ${input.id}`)
      const current = store.exams[index]
      const legalArea = input.legalArea === undefined ? current.legalArea : parseLegalArea(input.legalArea)
      const examType = input.examType === undefined ? current.examType : parseExamType(input.examType)
      const status = input.status === undefined ? current.status : examStatusSchema.parse(input.status)
      const next: ExamListItem = {
        ...current,
        title: input.title ?? current.title,
        folderId: input.folderId === undefined ? current.folderId : input.folderId,
        folderName: folderName(
          store,
          input.folderId === undefined ? current.folderId : input.folderId
        ),
        status,
        tags: input.tags ? normalizeTags(input.tags) : current.tags,
        notes: input.notes ?? current.notes,
        legalArea,
        examType,
        sourceName: input.sourceName === undefined ? current.sourceName : input.sourceName,
        sourceUrl: input.sourceUrl === undefined ? current.sourceUrl : input.sourceUrl,
        updatedAt: nowIso()
      }
      store.exams[index] = next
      writeStore(store)
      return examDetails(store, input.id)
    },
    async trashExam(id: string) {
      return setExamStatus(id, 'archived')
    },
    async restoreExam(id: string) {
      const store = readStore()
      const exam = store.exams.find((candidate) => candidate.id === id)
      if (!exam) throw new Error(`Exam not found: ${id}`)
      const restoredStatus = exam.currentRevisionId ? 'in_progress' : 'draft'
      return setExamStatus(id, restoredStatus)
    },
    async saveRevision(input) {
      const store = readStore()
      const exam = store.exams.find((candidate) => candidate.id === input.examId)
      if (!exam) throw new Error(`Exam not found: ${input.examId}`)
      const now = nowIso()
      const content = clone(input.content)
      const revision: ExamRevision = {
        schemaVersion: 1,
        editorSchemaVersion: 1,
        id: newId(),
        userId: exam.userId,
        examId: input.examId,
        createdAt: now,
        kind: input.kind ?? 'autosave',
        contentFormat: 'tiptap-v1',
        contentHash: hashJson(content),
        content
      }
      store.revisions.push(revision)
      exam.currentRevisionId = revision.id
      exam.status = exam.status === 'draft' ? 'in_progress' : exam.status
      exam.updatedAt = now
      exam.lastSavedAt = now
      writeStore(store)
      return revision
    },
    async submitExam(examId: string) {
      const store = readStore()
      const exam = store.exams.find((candidate) => candidate.id === examId)
      if (!exam || !exam.currentRevisionId) throw new Error(`Exam not found: ${examId}`)
      const revision = getRevision(store, exam.currentRevisionId)
      const submission: Submission = {
        schemaVersion: 1,
        id: newId(),
        userId: exam.userId,
        examId,
        submittedAt: nowIso(),
        revisionId: revision.id,
        contentHash: revision.contentHash,
        canContinueEditing: true,
        pdfPath: null
      }
      store.submissions.push(submission)
      exam.status = 'submitted'
      exam.updatedAt = submission.submittedAt
      writeStore(store)
      return submission
    },
    async getSubmission(id: string) {
      return submissionDetails(readStore(), id)
    },
    async listAnalyticsEntries() {
      const store = readStore()
      return store.corrections
        .filter((correction) => correction.score.points !== null)
        .map((correction) => {
          const submission = store.submissions.find(
            (candidate) => candidate.id === correction.targetSubmissionId
          )
          if (!submission) throw new Error(`Submission not found: ${correction.targetSubmissionId}`)
          const exam = store.exams.find((candidate) => candidate.id === submission.examId)
          if (!exam) throw new Error(`Exam not found: ${submission.examId}`)

          return {
            correctionId: correction.id,
            submissionId: submission.id,
            examId: exam.id,
            examTitle: exam.title,
            scorePoints: correction.score.points!,
            submittedAt: submission.submittedAt,
            correctedAt: correction.updatedAt,
            examTags: [...exam.tags],
            correctionTags: [...correction.tags]
          } satisfies AnalyticsEntry
        })
        .sort((left, right) => left.correctedAt.localeCompare(right.correctedAt))
    },
    async getAiSettingsStatus() {
      const settings = readStore().aiSettings
      return aiSettingsStatus(settings)
    },
    async saveAiSettings(input) {
      const store = readStore()
      const updatedAt = nowIso()
      const provider = (input as { provider?: unknown }).provider
      const apiKey = input.apiKey.trim()
      const model = input.model.trim()
      if (provider !== 'openai') throw new Error('AI provider wird noch nicht unterstuetzt.')
      if (!apiKey) throw new Error('OpenAI API key darf nicht leer sein')
      if (!model) throw new Error('OpenAI model darf nicht leer sein')
      store.aiSettings = {
        provider,
        configured: true,
        model,
        updatedAt
      }
      writeStore(store)
      return aiSettingsStatus(store.aiSettings)
    },
    async generateAiCorrectionDraft() {
      throw new Error(AI_CORRECTION_NOT_IMPLEMENTED_MESSAGE)
    },
    async listAiCorrectionDrafts(submissionId: string) {
      return readStore().aiCorrectionDrafts.filter((draft) => draft.submissionId === submissionId)
    },
    async acceptAiCorrectionDraft(draftId: string) {
      const store = readStore()
      const draft = findAiDraft(store, draftId)
      requireDraftStatus(draft, 'accept')
      const correction = ensureCorrectionForDraft(store, draft)
      correction.score = draft.score
      correction.gradingComment = draft.gradingComment
      correction.tags = [...draft.tags]
      correction.updatedAt = nowIso()
      const submission = store.submissions.find((candidate) => candidate.id === draft.submissionId)
      const revision = submission
        ? store.revisions.find((candidate) => candidate.id === submission.revisionId)
        : null
      const submissionText = revision ? plainTextFromTipTapNode(revision.content) : ''
      const contentHash =
        submission?.contentHash ?? correction.inlineComments[0]?.anchor.contentHash ?? ''
      for (const comment of draft.inlineComments) {
        correction.inlineComments.push({
          schemaVersion: 1,
          id: newId(),
          userId: draft.userId,
          targetSubmissionId: draft.submissionId,
          correctionId: correction.id,
          createdAt: correction.updatedAt,
          status: 'open',
          body: comment.body,
          anchor: buildBrowserAiInlineCommentAnchor(comment, contentHash, submissionText),
          tags: normalizeTags(comment.tags)
        })
      }
      draft.status = 'accepted'
      draft.correctionId = correction.id
      draft.updatedAt = correction.updatedAt
      for (const otherDraft of store.aiCorrectionDrafts) {
        if (otherDraft.submissionId === draft.submissionId && otherDraft.id !== draft.id && otherDraft.status === 'draft') {
          otherDraft.status = 'superseded'
          otherDraft.updatedAt = correction.updatedAt
        }
      }
      for (const suggestion of draft.improvementSuggestions) {
        store.learningTasks.push({
          schemaVersion: 1,
          id: newId(),
          userId: draft.userId,
          submissionId: draft.submissionId,
          correctionId: correction.id,
          aiDraftId: draft.id,
          category: suggestion.category,
          priority: suggestion.priority,
          status: 'open',
          title: suggestion.title,
          detail: suggestion.detail,
          createdAt: correction.updatedAt,
          updatedAt: correction.updatedAt
        })
      }
      writeStore(store)
      return draft
    },
    async rejectAiCorrectionDraft(draftId: string) {
      const store = readStore()
      const draft = findAiDraft(store, draftId)
      requireDraftStatus(draft, 'reject')
      draft.status = 'rejected'
      draft.updatedAt = nowIso()
      writeStore(store)
      return draft
    },
    async listLearningTasks() {
      const store = readStore()
      const user = ensureBrowserUser(store)
      return store.learningTasks.filter((task) => task.userId === user.id)
    },
    async updateLearningTaskStatus(taskId, status) {
      const store = readStore()
      const user = ensureBrowserUser(store)
      const nextStatus = learningTaskStatusSchema.parse(status)
      const task = store.learningTasks.find((candidate) => candidate.id === taskId && candidate.userId === user.id)
      if (!task) throw new Error(`Learning task not found: ${taskId}`)
      task.status = nextStatus
      task.updatedAt = nowIso()
      writeStore(store)
      return task
    },
    async addAttachment() {
      console.warn('Attachments are only available in the Electron app window.')
      return null
    },
    async openAttachment() {
      console.warn('Attachments are only available in the Electron app window.')
    },
    async exportExamPackage() {
      console.warn('.jura export is only available in the Electron app window.')
      return null
    },
    async importExamPackage() {
      console.warn('.jura import is only available in the Electron app window.')
      return null
    },
    async exportExamPdf() {
      console.warn('PDF export is only available in the Electron app window.')
      return null
    },
    async createCorrection(submissionId: string) {
      const store = readStore()
      const submission = store.submissions.find((candidate) => candidate.id === submissionId)
      if (!submission) throw new Error(`Submission not found: ${submissionId}`)
      const existing = store.corrections.find(
        (correction) => correction.targetSubmissionId === submissionId
      )
      if (existing) return existing
      const now = nowIso()
      const correction: Correction = {
        schemaVersion: 1,
        id: newId(),
        userId: submission.userId,
        targetSubmissionId: submissionId,
        createdAt: now,
        updatedAt: now,
        score: { system: 'bayern-0-18', points: null },
        gradingComment: '',
        tags: [],
        inlineComments: []
      }
      store.corrections.push(correction)
      writeStore(store)
      return correction
    },
    async updateCorrection(input: UpdateCorrectionInput) {
      const store = readStore()
      const index = store.corrections.findIndex((correction) => correction.id === input.correctionId)
      if (index < 0) throw new Error(`Correction not found: ${input.correctionId}`)
      const current = store.corrections[index]
      const next: Correction = {
        ...current,
        updatedAt: nowIso(),
        score: { system: 'bayern-0-18', points: input.scorePoints },
        gradingComment: input.gradingComment,
        tags: normalizeTags(input.tags),
        inlineComments: current.inlineComments
      }
      store.corrections[index] = next
      writeStore(store)
      return next
    },
    async addInlineComment(input: AddInlineCommentInput) {
      const store = readStore()
      const correction = store.corrections.find((candidate) => candidate.id === input.correctionId)
      if (!correction) throw new Error(`Correction not found: ${input.correctionId}`)
      const comment: InlineComment = {
        schemaVersion: 1,
        id: newId(),
        userId: correction.userId,
        targetSubmissionId: input.submissionId,
        correctionId: input.correctionId,
        createdAt: nowIso(),
        status: 'open',
        body: input.body,
        anchor: input.anchor,
        tags: normalizeTags(input.tags)
      }
      correction.inlineComments.push(comment)
      correction.updatedAt = comment.createdAt
      writeStore(store)
      return comment
    }
  }
}

function readStore(): BrowserStore {
  const raw = localStorage.getItem(BROWSER_STORE_KEY)
  if (!raw) {
    const store = emptyStore()
    ensureBrowserUser(store)
    writeStore(store)
    return store
  }
  try {
    const parsed = { ...emptyStore(), ...JSON.parse(raw) } as BrowserStore
    const user = ensureBrowserUser(parsed)
    const normalizedIds = normalizeBrowserStoreIds(parsed)
    parsed.folders = parsed.folders.map((folder) => ({
      ...folder,
      userId: folder.userId ?? user.id,
      trashedAt: folder.trashedAt ?? null
    }))
    parsed.exams = parsed.exams.map((exam) => ({
      ...exam,
      userId: exam.userId ?? user.id,
      lastSavedAt: exam.lastSavedAt ?? exam.updatedAt ?? exam.createdAt,
      legalArea: exam.legalArea ?? null,
      examType: exam.examType ?? null,
      sourceName: exam.sourceName ?? null,
      sourceUrl: exam.sourceUrl ?? null
    }))
    parsed.revisions = parsed.revisions.map((revision) => ({ ...revision, userId: revision.userId ?? user.id }))
    parsed.submissions = parsed.submissions.map((submission) => ({ ...submission, userId: submission.userId ?? user.id }))
    parsed.attachments = parsed.attachments.map((attachment) => ({
      ...attachment,
      userId: attachment.userId ?? user.id,
      role: attachment.role ?? 'other'
    }))
    parsed.corrections = parsed.corrections.map((correction) => ({
      ...correction,
      userId: correction.userId ?? user.id,
      inlineComments: correction.inlineComments.map((comment) => ({ ...comment, userId: comment.userId ?? user.id }))
    }))
    const normalizedAiSettings = normalizeBrowserAiSettings(parsed.aiSettings)
    const strippedAiSecret = Boolean(
      parsed.aiSettings && 'apiKey' in parsed.aiSettings
    )
    parsed.aiSettings = normalizedAiSettings
    if (strippedAiSecret) writeStore(parsed)
    if (normalizedIds) writeStore(parsed)
    return parsed
  } catch {
    const store = emptyStore()
    ensureBrowserUser(store)
    writeStore(store)
    return store
  }
}

function normalizeBrowserStoreIds(store: BrowserStore): boolean {
  const folderIds = buildBrowserIdMap(store.folders)
  const examIds = buildBrowserIdMap(store.exams)
  const revisionIds = buildBrowserIdMap(store.revisions)
  const submissionIds = buildBrowserIdMap(store.submissions)
  const correctionIds = buildBrowserIdMap(store.corrections)
  const attachmentIds = buildBrowserIdMap(store.attachments)
  const changed = [folderIds, examIds, revisionIds, submissionIds, correctionIds, attachmentIds].some(
    (map) => map.size > 0
  ) || store.corrections.some((correction) =>
    correction.inlineComments.some((comment) => !isUuid(comment.id))
  )

  for (const folder of store.folders) {
    folder.id = folderIds.get(folder.id) ?? folder.id
    folder.parentId = folder.parentId ? (folderIds.get(folder.parentId) ?? folder.parentId) : null
  }
  for (const exam of store.exams) {
    exam.id = examIds.get(exam.id) ?? exam.id
    exam.folderId = exam.folderId ? (folderIds.get(exam.folderId) ?? exam.folderId) : null
    exam.currentRevisionId = exam.currentRevisionId
      ? (revisionIds.get(exam.currentRevisionId) ?? exam.currentRevisionId)
      : null
  }
  for (const revision of store.revisions) {
    revision.id = revisionIds.get(revision.id) ?? revision.id
    revision.examId = examIds.get(revision.examId) ?? revision.examId
  }
  for (const submission of store.submissions) {
    submission.id = submissionIds.get(submission.id) ?? submission.id
    submission.examId = examIds.get(submission.examId) ?? submission.examId
    submission.revisionId = revisionIds.get(submission.revisionId) ?? submission.revisionId
  }
  for (const attachment of store.attachments) {
    attachment.id = attachmentIds.get(attachment.id) ?? attachment.id
    attachment.examId = examIds.get(attachment.examId) ?? attachment.examId
  }
  for (const correction of store.corrections) {
    correction.id = correctionIds.get(correction.id) ?? correction.id
    correction.targetSubmissionId =
      submissionIds.get(correction.targetSubmissionId) ?? correction.targetSubmissionId
    correction.inlineComments = correction.inlineComments.map((comment) => ({
      ...comment,
      id: isUuid(comment.id) ? comment.id : newId(),
      targetSubmissionId: submissionIds.get(comment.targetSubmissionId) ?? comment.targetSubmissionId,
      correctionId: correctionIds.get(comment.correctionId) ?? comment.correctionId
    }))
  }
  return changed
}

function buildBrowserIdMap(items: Array<{ id: string }>): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items) {
    if (!isUuid(item.id)) map.set(item.id, newId())
  }
  return map
}

function writeStore(store: BrowserStore): void {
  localStorage.setItem(BROWSER_STORE_KEY, JSON.stringify({
    ...store,
    aiSettings: normalizeBrowserAiSettings(store.aiSettings)
  }))
}

function emptyStore(): BrowserStore {
  return {
    users: [],
    currentUserId: null,
    folders: [],
    exams: [],
    revisions: [],
    submissions: [],
    attachments: [],
    corrections: [],
    aiSettings: null,
    aiCorrectionDrafts: [],
    learningTasks: []
  }
}

function ensureBrowserUser(store: BrowserStore): User {
  const current = store.currentUserId
    ? store.users.find((candidate) => candidate.id === store.currentUserId)
    : null
  if (current) return current

  const existing = store.users[0]
  if (existing) {
    store.currentUserId = existing.id
    return existing
  }

  const user = createBrowserUser('Lokaler Nutzer', 'local')
  store.users.push(user)
  store.currentUserId = user.id
  return user
}

function createBrowserUser(displayName: string, kind: User['kind']): User {
  const now = nowIso()
  return {
    id: newId(),
    displayName,
    kind,
    remoteUserId: null,
    onboardingCompletedAt: null,
    tourCompletedAt: null,
    createdAt: now,
    updatedAt: now
  }
}

function updateBrowserUserTimestamp(
  userId: string,
  field: 'onboardingCompletedAt' | 'tourCompletedAt'
): User {
  const store = readStore()
  const user = store.users.find((candidate) => candidate.id === userId)
  if (!user) throw new Error(`User not found: ${userId}`)
  const now = nowIso()
  user[field] = now
  user.updatedAt = now
  store.currentUserId = user.id
  writeStore(store)
  return user
}

function examDetails(store: BrowserStore, id: string): ExamDetails {
  const exam = store.exams.find((candidate) => candidate.id === id)
  if (!exam) throw new Error(`Exam not found: ${id}`)
  return {
    ...withLatestScore(exam),
    folderName: folderName(store, exam.folderId),
    currentRevision: exam.currentRevisionId ? getRevision(store, exam.currentRevisionId) : null,
    submissions: store.submissions.filter((submission) => submission.examId === id),
    attachments: store.attachments.filter((attachment) => attachment.examId === id)
  }
}

function setExamStatus(id: string, status: ExamListItem['status']): ExamDetails {
  const store = readStore()
  const exam = store.exams.find((candidate) => candidate.id === id)
  if (!exam) throw new Error(`Exam not found: ${id}`)
  exam.status = status
  exam.updatedAt = nowIso()
  writeStore(store)
  return examDetails(store, id)
}

function submissionDetails(store: BrowserStore, id: string): SubmissionDetails {
  const submission = store.submissions.find((candidate) => candidate.id === id)
  if (!submission) throw new Error(`Submission not found: ${id}`)
  const revision = getRevision(store, submission.revisionId)
  const exam = store.exams.find((candidate) => candidate.id === submission.examId)
  if (!exam) throw new Error(`Exam not found: ${submission.examId}`)
  return {
    ...submission,
    examTitle: exam.title,
    content: clone(revision.content),
    contentHash: revision.contentHash,
    corrections: store.corrections.filter(
      (correction) => correction.targetSubmissionId === submission.id
    )
  }
}

function aiSettingsStatus(settings: BrowserStore['aiSettings']): AiSettingsStatus {
  return {
    provider: 'openai',
    configured: Boolean(settings?.configured),
    model: settings?.model ?? null,
    updatedAt: settings?.updatedAt ?? null
  }
}

function normalizeBrowserAiSettings(settings: unknown): BrowserStore['aiSettings'] {
  if (!settings || typeof settings !== 'object') return null
  const candidate = settings as {
    provider?: unknown
    apiKey?: unknown
    configured?: unknown
    model?: unknown
    updatedAt?: unknown
  }
  if (candidate.provider !== 'openai' || typeof candidate.model !== 'string') return null
  return {
    provider: 'openai',
    configured: Boolean(candidate.configured) || Boolean(candidate.apiKey),
    model: candidate.model,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null
  }
}

function buildBrowserAiInlineCommentAnchor(
  comment: AiCorrectionDraft['inlineComments'][number],
  contentHash: string,
  submissionText: string
): InlineComment['anchor'] {
  const anchoredText = `${comment.prefix}${comment.selectedText}${comment.suffix}`
  const anchoredIndex = comment.prefix || comment.suffix ? submissionText.indexOf(anchoredText) : -1
  const from = anchoredIndex >= 0
    ? anchoredIndex + comment.prefix.length
    : Math.max(0, submissionText.indexOf(comment.selectedText))
  return {
    type: 'prosemirror-selection',
    editorSchemaVersion: EDITOR_SCHEMA_VERSION,
    from,
    to: from + comment.selectedText.length,
    selectedText: comment.selectedText,
    prefix: comment.prefix,
    suffix: comment.suffix,
    contentHash
  }
}

function findAiDraft(store: BrowserStore, draftId: string): AiCorrectionDraft {
  const draft = store.aiCorrectionDrafts.find((candidate) => candidate.id === draftId)
  if (!draft) throw new Error(`AI correction draft not found: ${draftId}`)
  return draft
}

function requireDraftStatus(draft: AiCorrectionDraft, action: 'accept' | 'reject'): void {
  if (draft.status !== 'draft') {
    throw new Error(`AI correction draft must have status draft to ${action}; current status is ${draft.status}`)
  }
}

function ensureCorrectionForDraft(store: BrowserStore, draft: AiCorrectionDraft): Correction {
  const existing = store.corrections.find((correction) => correction.targetSubmissionId === draft.submissionId)
  if (existing) return existing
  const now = nowIso()
  const correction: Correction = {
    schemaVersion: 1,
    id: newId(),
    userId: draft.userId,
    targetSubmissionId: draft.submissionId,
    createdAt: now,
    updatedAt: now,
    score: { system: 'bayern-0-18', points: null },
    gradingComment: '',
    tags: [],
    inlineComments: []
  }
  store.corrections.push(correction)
  return correction
}

function getRevision(store: BrowserStore, id: string): ExamRevision {
  const revision = store.revisions.find((candidate) => candidate.id === id)
  if (!revision) throw new Error(`Revision not found: ${id}`)
  return clone(revision)
}

function withLatestScore(exam: ExamListItem): ExamListItem {
  const store = readStore()
  const submissionIds = new Set(
    store.submissions
      .filter((submission) => submission.examId === exam.id)
      .map((submission) => submission.id)
  )
  const latestCorrection = [...store.corrections]
    .reverse()
    .find((correction) => submissionIds.has(correction.targetSubmissionId))
  return {
    ...exam,
    latestScore: latestCorrection?.score.points ?? null
  }
}

function folderName(store: BrowserStore, folderId: string | null | undefined): string | null {
  if (!folderId) return null
  return store.folders.find((folder) => folder.id === folderId && !folder.trashedAt)?.name ?? null
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
}

function parseLegalArea(value: CreateExamInput['legalArea']): LegalArea | null {
  return value === undefined ? null : legalAreaSchema.nullable().parse(value)
}

function parseExamType(value: CreateExamInput['examType']): ExamType | null {
  return value === undefined ? null : examTypeSchema.nullable().parse(value)
}

function nowIso(): string {
  return new Date().toISOString()
}

function newId(): string {
  return crypto.randomUUID()
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function hashJson(value: Record<string, unknown>): string {
  const text = JSON.stringify(value)
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0
  }
  return `browser-${text.length}-${Math.abs(hash)}`
}

function plainTextFromTipTapNode(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const record = node as { type?: unknown; text?: unknown; content?: unknown }
  if (record.type === 'text') return typeof record.text === 'string' ? record.text : ''
  const children = Array.isArray(record.content) ? record.content.map(plainTextFromTipTapNode) : []
  const joined = children.join('')
  if (['paragraph', 'heading', 'blockquote', 'listItem'].includes(String(record.type))) {
    return `${joined}\n`
  }
  if (['bulletList', 'orderedList'].includes(String(record.type))) {
    return `${joined}\n`
  }
  return joined
}

function clone<T>(value: T): T {
  return structuredClone(value)
}
