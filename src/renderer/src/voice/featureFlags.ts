import type { FeatureFlags } from '@shared/ipc'

export type FeatureFlagKey = 'flashcards_voice_agent'

export function hasFeatureFlag(flags: FeatureFlags, key: FeatureFlagKey): boolean {
  return flags[key] === true
}
