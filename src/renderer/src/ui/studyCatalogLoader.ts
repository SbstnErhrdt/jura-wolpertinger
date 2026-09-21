import { ref } from 'vue'
import type { StudyCatalog } from '@shared/flashcardStudy'

export function createStudyCatalogLoader(fetchCatalog: (search: string, page: number) => Promise<StudyCatalog>) {
  const catalog = ref<StudyCatalog | null>(null)
  const loading = ref(false)
  const error = ref('')
  let sequence = 0
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function request(search: string, page: number, delay = 0): Promise<void> | void {
    if (disposed) return
    const requestId = ++sequence
    clearTimeout(timer)
    loading.value = true
    error.value = ''
    async function execute(): Promise<void> {
      try {
        const result = await fetchCatalog(search, page)
        if (requestId === sequence) catalog.value = result
      } catch {
        if (requestId === sequence) error.value = 'Die Sammlungen konnten nicht geladen werden. Bitte versuche es erneut.'
      } finally {
        if (requestId === sequence) loading.value = false
      }
    }
    if (delay > 0) timer = setTimeout(() => { void execute() }, delay)
    else return execute()
  }
  function dispose(): void { disposed = true; sequence++; clearTimeout(timer) }
  return { catalog, loading, error, request, dispose }
}
