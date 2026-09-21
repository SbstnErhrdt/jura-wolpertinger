import { STUDY_CATALOG_PAGE_SIZE, studyCatalogQuerySchema, type StudyCatalog, type StudyCollection, type StudyOverview, type StudyRecommendation } from './flashcardStudy'

export function studyProgress(overview: StudyOverview): number | null {
  if (overview.eligibleCards === 0) return null
  if (overview.reviewedCards >= overview.eligibleCards) return 100
  return Math.max(0, Math.min(99, Math.round(100 * overview.reviewedCards / overview.eligibleCards)))
}

/** Summaries only; cloud filtering and ranking happen in the equivalent bounded RPC. */
export function buildStudyCatalog(collections: StudyCollection[], search = '', page = 1): StudyCatalog {
  const query = studyCatalogQuerySchema.parse({ search, page })
  const byId = (a: StudyCollection, b: StudyCollection) => a.id.localeCompare(b.id)
  const eligible = collections.filter(c => c.overview.eligibleCards > 0)
  const due = eligible.filter(c => c.overview.dueCards > 0)
    .sort((a, b) => b.overview.dueCards - a.overview.dueCards || byId(a, b))[0]
  const active = eligible.filter(c => c.overview.activeRun?.status === 'active' && c.overview.activeRun.remaining > 0)
    .sort((a, b) => b.overview.activeRun!.updatedAt.localeCompare(a.overview.activeRun!.updatedAt) || byId(a, b))[0]
  const fresh = eligible.filter(c => c.overview.newCards > 0)
    .sort((a, b) => a.overview.newCards - b.overview.newCards || byId(a, b))[0]
  const recommendation: StudyRecommendation | null = due ? { kind: 'review', collection: due }
    : active ? { kind: 'resume', collection: active }
    : fresh ? { kind: 'new', collection: fresh } : null
  const term = query.search.toLocaleLowerCase('de')
  const matches = collections.filter(c => c.name.toLocaleLowerCase('de').includes(term) || (c.subject ?? '').toLocaleLowerCase('de').includes(term)).sort(byId)
  const offset = (query.page - 1) * STUDY_CATALOG_PAGE_SIZE
  return {
    items: matches.slice(offset, offset + STUDY_CATALOG_PAGE_SIZE), total: matches.length,
    collectionCount: collections.length, eligibleCollectionCount: eligible.length, recommendation
  }
}
