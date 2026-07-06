import { defineStore } from 'pinia'
import type { ExamListItem, FolderDto, ListExamsInput } from '@shared/ipc'
import { getApi } from '../api'

const DEFAULT_EXAM_PAGE_SIZE = 25

export const useLibraryStore = defineStore('library', {
  state: () => ({
    exams: [] as ExamListItem[],
    archivedExams: [] as ExamListItem[],
    folders: [] as FolderDto[],
    loading: false,
    refreshing: false,
    error: null as string | null,
    examPage: 1,
    examPageSize: DEFAULT_EXAM_PAGE_SIZE,
    examPageCount: 1,
    examTotal: 0,
    archivedExamTotal: 0,
    examFilter: {} as Pick<ListExamsInput, 'folderId'>
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
      this.error = null
      try {
        const api = getApi()
        const [folders] = await Promise.all([api.listFolders()])
        this.folders = folders
        await Promise.all([this.loadExamPage({ page: 1 }), this.loadArchivedExams()])
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Einträge konnten nicht geladen werden.'
      } finally {
        this.loading = false
      }
    },
    async loadExamPage(input: Partial<ListExamsInput> = {}) {
      const api = getApi()
      const nextPage = input.page ?? this.examPage
      const nextPageSize = input.pageSize ?? this.examPageSize
      const nextFilter = {
        ...this.examFilter,
        ...(Object.prototype.hasOwnProperty.call(input, 'folderId') ? { folderId: input.folderId } : {})
      }
      const request: ListExamsInput = {
        status: 'active',
        sort: 'updated',
        page: nextPage,
        pageSize: nextPageSize,
        ...nextFilter
      }
      this.refreshing = !this.loading
      this.error = null
      try {
        const page = await api.listExamsPage(request)
        this.exams = page.items
        this.examTotal = page.total
        this.examPage = page.page
        this.examPageSize = page.pageSize
        this.examPageCount = page.pageCount
        this.examFilter = nextFilter
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Einträge konnten nicht geladen werden.'
      } finally {
        this.refreshing = false
      }
    },
    async loadArchivedExams() {
      const api = getApi()
      const page = await api.listExamsPage({ status: 'archived', page: 1, pageSize: 100 })
      this.archivedExams = page.items
      this.archivedExamTotal = page.total
    },
    async reloadCurrentExamPage() {
      await Promise.all([this.loadExamPage(), this.loadArchivedExams()])
      if (!this.exams.length && this.examPage > 1) {
        await this.loadExamPage({ page: this.examPage - 1 })
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
      await this.reloadCurrentExamPage()
      return exam
    },
    async moveExam(examId: string, folderId: string | null) {
      const api = getApi()
      const exam = await api.updateExam({ id: examId, folderId })
      await this.reloadCurrentExamPage()
      return exam
    },
    async renameExam(examId: string, title: string) {
      const api = getApi()
      const exam = await api.updateExam({ id: examId, title })
      await this.reloadCurrentExamPage()
      return exam
    },
    async trashExam(examId: string) {
      const api = getApi()
      const exam = await api.trashExam(examId)
      await this.reloadCurrentExamPage()
      return exam
    },
    async restoreExam(examId: string) {
      const api = getApi()
      const exam = await api.restoreExam(examId)
      await this.reloadCurrentExamPage()
      return exam
    },
    async importPackage() {
      const api = getApi()
      const exam = await api.importExamPackage()
      await this.reloadCurrentExamPage()
      return exam
    },
    async exportExamPackage(examId: string) {
      const api = getApi()
      return api.exportExamPackage(examId)
    }
  }
})
