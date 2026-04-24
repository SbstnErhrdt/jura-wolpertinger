import { contextBridge, ipcRenderer } from 'electron'
import type {
  AddInlineCommentInput,
  AppApi,
  CreateExamInput,
  SaveRevisionInput,
  TrashFolderInput,
  UpdateCorrectionInput,
  UpdateFolderInput,
  UpdateExamInput
} from '@shared/ipc'

const api: AppApi = {
  getCurrentUser: () => ipcRenderer.invoke('users:current'),
  listUsers: () => ipcRenderer.invoke('users:list'),
  createUser: (displayName: string) => ipcRenderer.invoke('users:create', displayName),
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
  createExam: (input: CreateExamInput) => ipcRenderer.invoke('exams:create', input),
  getExam: (id: string) => ipcRenderer.invoke('exams:get', id),
  updateExam: (input: UpdateExamInput) => ipcRenderer.invoke('exams:update', input),
  trashExam: (id: string) => ipcRenderer.invoke('exams:trash', id),
  restoreExam: (id: string) => ipcRenderer.invoke('exams:restore', id),
  saveRevision: (input: SaveRevisionInput) => ipcRenderer.invoke('exams:saveRevision', input),
  submitExam: (examId: string) => ipcRenderer.invoke('exams:submit', examId),
  getSubmission: (id: string) => ipcRenderer.invoke('submissions:get', id),
  listAnalyticsEntries: () => ipcRenderer.invoke('analytics:list'),
  addAttachment: (examId: string) => ipcRenderer.invoke('attachments:add', examId),
  openAttachment: (id: string) => ipcRenderer.invoke('attachments:open', id),
  exportExamPackage: (examId: string) => ipcRenderer.invoke('package:export', examId),
  importExamPackage: () => ipcRenderer.invoke('package:import'),
  exportExamPdf: (examId: string) => ipcRenderer.invoke('pdf:export', examId),
  createCorrection: (submissionId: string) => ipcRenderer.invoke('corrections:create', submissionId),
  updateCorrection: (input: UpdateCorrectionInput) => ipcRenderer.invoke('corrections:update', input),
  addInlineComment: (input: AddInlineCommentInput) => ipcRenderer.invoke('comments:add', input)
}

contextBridge.exposeInMainWorld('juraApi', api)
