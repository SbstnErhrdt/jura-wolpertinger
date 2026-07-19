import type { LearningCardQualityReason, LearningCardQualityStatus, ReviewRating } from '@shared/schemas'

export const cardQualityOptions: Array<{ label: string; value: LearningCardQualityStatus; description: string }> = [
  { label: 'Gut', value: 'good', description: 'Diese Karte kann weiter wiederholt werden.' },
  { label: 'Überarbeiten', value: 'needs_work', description: 'Diese Karte wird bis zur Überarbeitung nicht wiederholt.' },
  { label: 'Problematisch', value: 'problematic', description: 'Diese Karte sollte fachlich geprüft werden.' }
]

export const cardQualityReasonOptions: Array<{ label: string; value: LearningCardQualityReason }> = [
  { label: 'unklar', value: 'unclear' },
  { label: 'zu lang', value: 'too_long' },
  { label: 'zu knapp', value: 'too_short' },
  { label: 'fachlich prüfen', value: 'check_law' },
  { label: 'doppelt', value: 'duplicate' },
  { label: 'Formatierung', value: 'formatting' }
]

export function cardQualityLabel(status: LearningCardQualityStatus | null): string {
  if (status === 'good') return 'Gut'
  if (status === 'needs_work') return 'Überarbeiten'
  if (status === 'problematic') return 'Problematisch'
  return 'Nicht bewertet'
}

export function cardQualityTone(status: LearningCardQualityStatus | null): string {
  if (status === 'good') return 'quality-good'
  if (status === 'needs_work') return 'quality-needs-work'
  if (status === 'problematic') return 'quality-problematic'
  return 'quality-unrated'
}

export function learningRatingLabel(rating: ReviewRating | null): string {
  if (rating === 1) return 'Nochmal'
  if (rating === 2) return 'Schwer'
  if (rating === 3) return 'Gut'
  if (rating === 4) return 'Leicht'
  return 'Noch nicht bewertet'
}
