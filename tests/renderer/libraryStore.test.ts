import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { listExamsPage, listFolders } = vi.hoisted(() => ({ listExamsPage: vi.fn(), listFolders: vi.fn() }))
vi.mock('../../src/renderer/src/api', () => ({ getApi: () => ({ listExamsPage, listFolders }) }))
const storePath = '../../src/renderer/src/stores/library'
const { useLibraryStore } = await import(/* @vite-ignore */ storePath)
const page = (title: string) => ({ items: [{ title }], total: 1, page: 1, pageSize: 25, pageCount: 1 })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  listFolders.mockResolvedValue([])
  listExamsPage.mockResolvedValue(page('Alle'))
})

it('loads the folder from the route and clears a previous folder for the library root', async () => {
  const store = useLibraryStore()
  await store.load({ folderId: 'folder-a' })
  expect(listExamsPage).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', folderId: 'folder-a' }))
  listExamsPage.mockClear()
  await store.load({ folderId: undefined })
  expect(listExamsPage).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', folderId: undefined }))
})

it('keeps the most recently selected folder when an older response arrives later', async () => {
  let resolveOld!: (value: ReturnType<typeof page>) => void
  listExamsPage.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  listExamsPage.mockResolvedValueOnce(page('Ordner B'))
  const store = useLibraryStore()
  const old = store.loadExamPage({ folderId: 'folder-a' })
  await store.loadExamPage({ folderId: 'folder-b' })
  resolveOld(page('Ordner A'))
  await old
  expect(store.exams[0].title).toBe('Ordner B')
  expect(store.examFilter).toEqual({ folderId: 'folder-b' })
})

it('does not surface an obsolete request error after a newer folder loaded', async () => {
  let rejectOld!: (error: Error) => void
  listExamsPage.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject }))
  listExamsPage.mockResolvedValueOnce(page('Ordner B'))
  const store = useLibraryStore()
  const old = store.loadExamPage({ folderId: 'folder-a' })
  await store.loadExamPage({ folderId: 'folder-b' })
  rejectOld(new Error('Alte Anfrage fehlgeschlagen'))
  await old
  expect(store.error).toBeNull()
  expect(store.exams[0].title).toBe('Ordner B')
})

it('invalidates a pending folder page when reloading the library root before folders arrive', async () => {
  let resolveOld!: (value: ReturnType<typeof page>) => void
  let resolveFolders!: (value: unknown[]) => void
  listExamsPage.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  listFolders.mockImplementationOnce(() => new Promise(resolve => { resolveFolders = resolve }))
  const store = useLibraryStore()
  const old = store.loadExamPage({ folderId: 'folder-a' })
  const root = store.load({ folderId: undefined })
  resolveOld(page('Ordner A'))
  await old
  resolveFolders([])
  await root
  expect(listExamsPage).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'archived' }))
  expect(listExamsPage).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 'active', folderId: undefined }))
  expect(store.examFilter).toEqual({ folderId: undefined })
})
