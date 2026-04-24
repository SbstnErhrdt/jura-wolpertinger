import { defineStore } from 'pinia'
import type { ExamListItem, FolderDto } from '@shared/ipc'
import { getApi } from '../api'

export const useLibraryStore = defineStore('library', {
  state: () => ({
    exams: [] as ExamListItem[],
    folders: [] as FolderDto[],
    loading: false
  }),
  getters: {
    averageScore(state): number | null {
      const scores = state.exams
        .filter((exam) => exam.status !== 'archived')
        .map((exam) => exam.latestScore)
        .filter((score): score is number => typeof score === 'number')
      if (!scores.length) return null
      return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
    },
    submittedCount(state): number {
      return state.exams.filter((exam) => ['submitted', 'corrected'].includes(exam.status)).length
    },
    correctedCount(state): number {
      return state.exams.filter((exam) => exam.status === 'corrected').length
    }
  },
  actions: {
    async load() {
      this.loading = true
      try {
        const api = getApi()
        const [folders, exams] = await Promise.all([api.listFolders(), api.listExams()])
        this.folders = folders
        this.exams = exams
      } finally {
        this.loading = false
      }
    },
    async createFolder(name: string) {
      const api = getApi()
      await api.createFolder(name)
      await this.load()
    },
    async renameFolder(folderId: string, name: string) {
      const api = getApi()
      const folder = await api.updateFolder({ id: folderId, name })
      await this.load()
      return folder
    },
    async trashFolder(folderId: string, moveExamsToFolderId: string | null) {
      const api = getApi()
      const folder = await api.trashFolder({ id: folderId, moveExamsToFolderId })
      await this.load()
      return folder
    },
    async restoreFolder(folderId: string) {
      const api = getApi()
      const folder = await api.restoreFolder(folderId)
      await this.load()
      return folder
    },
    async createExam(title: string, folderId: string | null, tags: string[]) {
      const api = getApi()
      const exam = await api.createExam({ title, folderId, tags: [...tags] })
      await this.load()
      return exam
    },
    async moveExam(examId: string, folderId: string | null) {
      const api = getApi()
      const exam = await api.updateExam({ id: examId, folderId })
      await this.load()
      return exam
    },
    async renameExam(examId: string, title: string) {
      const api = getApi()
      const exam = await api.updateExam({ id: examId, title })
      await this.load()
      return exam
    },
    async trashExam(examId: string) {
      const api = getApi()
      const exam = await api.trashExam(examId)
      await this.load()
      return exam
    },
    async restoreExam(examId: string) {
      const api = getApi()
      const exam = await api.restoreExam(examId)
      await this.load()
      return exam
    },
    async importPackage() {
      const api = getApi()
      const exam = await api.importExamPackage()
      await this.load()
      return exam
    },
    async exportExamPackage(examId: string) {
      const api = getApi()
      return api.exportExamPackage(examId)
    }
  }
})
