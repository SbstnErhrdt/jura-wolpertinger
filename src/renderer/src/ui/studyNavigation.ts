import type { StudyOverview } from '@shared/flashcardStudy'

export function studyEntry(overview?: StudyOverview) {
  if (overview?.activeRun) return {
    label: overview.activeRun.deferred === overview.activeRun.remaining ? `${overview.activeRun.remaining} offene Karten bearbeiten` : 'Durchgang fortsetzen',
    query: { collection: overview.collectionId, run: overview.activeRun.id, mode: overview.activeRun.mode }
  }
  const mode = overview?.newCards ? 'first_pass' : overview?.dueCards ? 'review' : 'all'
  return {
    label: !overview || (overview.newCards && !overview.reviewedCards) ? 'Sammlung durcharbeiten' : overview.newCards ? `${overview.newCards} neue Karten bearbeiten` : overview.dueCards ? 'Empfohlene Karten wiederholen' : 'Sammlung erneut durcharbeiten',
    query: { collection: overview?.collectionId, mode }
  }
}
