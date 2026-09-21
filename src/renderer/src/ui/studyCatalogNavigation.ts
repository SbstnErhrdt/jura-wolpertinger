import type { StudyCollection, StudyRecommendation } from '@shared/flashcardStudy'
import { studyEntry } from './studyNavigation'

/** Keep each tile's established first-pass priority separate from the global suggestion. */
export function collectionEntry(collection: StudyCollection) {
  return studyEntry({ ...collection.overview, activeRun: collection.defaultRun })
}

export function recommendationEntry(recommendation: StudyRecommendation): { label: string; reason: string; query: Record<string, string> } {
  const { collection, kind } = recommendation
  const overview = collection.overview
  if (kind === 'review') return {
    label: 'Jetzt wiederholen',
    reason: overview.dueCards === 1 ? 'Eine Karte ist zur Wiederholung fällig.' : `${overview.dueCards} Karten sind zur Wiederholung fällig.`,
    query: { collection: collection.id, mode: 'review' }
  }
  const run = overview.activeRun
  if (kind === 'resume' && run) return {
    label: run.remaining === run.deferred ? 'Offene Karten bearbeiten' : 'Durchgang fortsetzen',
    reason: run.remaining === run.deferred
      ? `${run.remaining} zurückgestellte ${run.remaining === 1 ? 'Karte wartet' : 'Karten warten'} noch auf dich.`
      : `In deinem begonnenen Durchgang ${run.remaining === 1 ? 'ist noch eine Karte' : `sind noch ${run.remaining} Karten`} offen.`,
    query: { collection: collection.id, run: run.id, mode: run.mode }
  }
  return {
    label: overview.reviewedCards ? 'Neue Karten bearbeiten' : 'Sammlung starten',
    reason: overview.reviewedCards ? `Noch ${overview.newCards} ${overview.newCards === 1 ? 'Karte' : 'Karten'} erstmals bearbeiten.`
      : `Ein überschaubarer Einstieg mit ${overview.newCards} ${overview.newCards === 1 ? 'Karte' : 'Karten'}.`,
    query: { collection: collection.id, mode: 'first_pass' }
  }
}
