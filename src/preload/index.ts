import { contextBridge, ipcRenderer } from 'electron'
import type {
  AddInlineCommentInput,
  AppApi,
  CreateLearningCardInput,
  CreateLearningCollectionInput,
  GenerateAiCorrectionInput,
  CreateExamInput,
  GetReviewBatchInput,
  ListExamsInput,
  ListLearningCardsInput,
  RecordReviewInput,
  SaveRevisionInput,
  SaveAiSettingsInput,
  SyncAuthInput,
  SyncRunInput,
  TestAiConnectionInput,
  TrashFolderInput,
  UpdateCorrectionInput,
  UpdateFolderInput,
  UpdateExamInput
} from '@shared/ipc'
import type { AttachmentRole, LearningTask } from '@shared/schemas'
import {
  RELEASE_SMOKE_READY_CHANNEL,
  RELEASE_SMOKE_READY_EVENT
} from '@shared/releaseSmoke'

const api: AppApi = {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getFeatureFlags: () => ipcRenderer.invoke('voice:featureFlags'),
  createVoiceReviewSession: (input) => ipcRenderer.invoke('voice:createSession', input),
  completeVoiceReviewSession: (input) => ipcRenderer.invoke('voice:completeSession', input),
  getCurrentUser: () => ipcRenderer.invoke('users:current'),
  listUsers: () => ipcRenderer.invoke('users:list'),
  createUser: (displayName: string) => ipcRenderer.invoke('users:create', displayName),
  updateUser: (input: { id: string; displayName: string }) => ipcRenderer.invoke('users:update', input),
  switchUser: (userId: string) => ipcRenderer.invoke('users:switch', userId),
  completeOnboarding: (userId: string) => ipcRenderer.invoke('users:completeOnboarding', userId),
  completeTour: (userId: string) => ipcRenderer.invoke('users:completeTour', userId),
  resetTour: (userId: string) => ipcRenderer.invoke('users:resetTour', userId),
  listFolders: () => ipcRenderer.invoke('folders:list'),
  createFolder: (name: string, parentId?: string | null) =>
    ipcRenderer.invoke('folders:create', name, parentId ?? null),
  updateFolder: (input: UpdateFolderInput) => ipcRenderer.invoke('folders:update', input),
  trashFolder: (input: TrashFolderInput) => ipcRenderer.invoke('folders:trash', input),
  restoreFolder: (folderId: string) => ipcRenderer.invoke('folders:restore', folderId),
  listExams: () => ipcRenderer.invoke('exams:list'),
  listExamsPage: (input?: ListExamsInput) => ipcRenderer.invoke('exams:listPage', input),
  createExam: (input: CreateExamInput) => ipcRenderer.invoke('exams:create', input),
  getExam: (id: string) => ipcRenderer.invoke('exams:get', id),
  updateExam: (input: UpdateExamInput) => ipcRenderer.invoke('exams:update', input),
  trashExam: (id: string) => ipcRenderer.invoke('exams:trash', id),
  restoreExam: (id: string) => ipcRenderer.invoke('exams:restore', id),
  saveRevision: (input: SaveRevisionInput) => ipcRenderer.invoke('exams:saveRevision', input),
  submitExam: (examId: string) => ipcRenderer.invoke('exams:submit', examId),
  getSubmission: (id: string) => ipcRenderer.invoke('submissions:get', id),
  listAnalyticsEntries: () => ipcRenderer.invoke('analytics:list'),
  getAiSettingsStatus: () => ipcRenderer.invoke('ai:settingsStatus'),
  saveAiSettings: (input: SaveAiSettingsInput) => ipcRenderer.invoke('ai:saveSettings', input),
  removeAiSettings: () => ipcRenderer.invoke('ai:removeSettings'),
  testAiConnection: (input?: TestAiConnectionInput) => ipcRenderer.invoke('ai:testConnection', input),
  generateAiCorrectionDraft: (input: GenerateAiCorrectionInput) =>
    ipcRenderer.invoke('ai:generateCorrectionDraft', input),
  listAiCorrectionDrafts: (submissionId: string) =>
    ipcRenderer.invoke('ai:listCorrectionDrafts', submissionId),
  acceptAiCorrectionDraft: (draftId: string) =>
    ipcRenderer.invoke('ai:acceptCorrectionDraft', draftId),
  rejectAiCorrectionDraft: (draftId: string) =>
    ipcRenderer.invoke('ai:rejectCorrectionDraft', draftId),
  listLearningTasks: () => ipcRenderer.invoke('learningTasks:list'),
  updateLearningTaskStatus: (taskId: string, status: LearningTask['status']) =>
    ipcRenderer.invoke('learningTasks:updateStatus', taskId, status),
  getLearningDashboard: () => ipcRenderer.invoke('learning:dashboard'),
  exportLearningDecksJson: () => ipcRenderer.invoke('learning:exportDecksJson'),
  importLearningDecksJson: (json: string) => ipcRenderer.invoke('learning:importDecksJson', json),
  listLearningCollections: () => ipcRenderer.invoke('learning:collections'),
  createLearningCollection: (input: CreateLearningCollectionInput) =>
    ipcRenderer.invoke('learning:createCollection', input),
  listLearningCards: (collectionId?: string | null) => ipcRenderer.invoke('learning:cards', collectionId ?? null),
  listLearningCardsPage: (input?: ListLearningCardsInput) => ipcRenderer.invoke('learning:cardsPage', input),
  createLearningCard: (input: CreateLearningCardInput) => ipcRenderer.invoke('learning:createCard', input),
  updateLearningCard: (input: CreateLearningCardInput & { id: string }) =>
    ipcRenderer.invoke('learning:updateCard', input),
  deleteLearningCard: (input) => ipcRenderer.invoke('learning:deleteCard', input),
  getReviewBatch: (input?: GetReviewBatchInput) => ipcRenderer.invoke('learning:reviewBatch', input),
  recordReview: (input: RecordReviewInput) => ipcRenderer.invoke('learning:recordReview', input),
  addAttachment: (examId: string, role?: AttachmentRole) =>
    ipcRenderer.invoke('attachments:add', examId, role),
  openAttachment: (id: string) => ipcRenderer.invoke('attachments:open', id),
  exportExamPackage: (examId: string) => ipcRenderer.invoke('package:export', examId),
  importExamPackage: () => ipcRenderer.invoke('package:import'),
  exportExamPdf: (examId: string) => ipcRenderer.invoke('pdf:export', examId),
  createCorrection: (submissionId: string) => ipcRenderer.invoke('corrections:create', submissionId),
  updateCorrection: (input: UpdateCorrectionInput) => ipcRenderer.invoke('corrections:update', input),
  addInlineComment: (input: AddInlineCommentInput) => ipcRenderer.invoke('comments:add', input),
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),
  connectSyncAccount: (input: SyncAuthInput) => ipcRenderer.invoke('sync:connect', input),
  disconnectSyncAccount: () => ipcRenderer.invoke('sync:disconnect'),
  runSync: (input: SyncRunInput) => ipcRenderer.invoke('sync:run', input)
}

contextBridge.exposeInMainWorld('juraApi', api)

window.addEventListener(
  RELEASE_SMOKE_READY_EVENT,
  () => ipcRenderer.send(RELEASE_SMOKE_READY_CHANNEL),
  { once: true }
)
