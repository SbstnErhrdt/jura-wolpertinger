import { validateMacReleaseArtifacts } from './macos'
import { stageRelease, type StageReleaseInput } from './storage'

type ValidateMacArtifacts = typeof validateMacReleaseArtifacts
type Stage = typeof stageRelease

export interface RunReleaseStageInput extends StageReleaseInput {
  hostPlatform?: NodeJS.Platform
  cwd?: string
  env?: Record<string, string | undefined>
  validateMacArtifacts?: ValidateMacArtifacts
  stage?: Stage
}

export async function runReleaseStage(input: RunReleaseStageInput) {
  if (input.platform === 'mac-arm64' || input.platform === 'mac-x64') {
    if ((input.hostPlatform ?? process.platform) !== 'darwin') {
      throw new Error('mac staging is supported only on macOS.')
    }

    const validateMacArtifacts = input.validateMacArtifacts ?? validateMacReleaseArtifacts
    await validateMacArtifacts({
      cwd: input.cwd ?? process.cwd(),
      inputDirectory: input.inputDirectory,
      platform: input.platform,
      expectedArch: input.platform === 'mac-arm64' ? 'arm64' : 'x86_64',
      env: input.env ?? process.env
    })
  }

  const stage = input.stage ?? stageRelease
  return stage({
    storage: input.storage,
    platform: input.platform,
    inputDirectory: input.inputDirectory,
    dryRun: input.dryRun
  })
}
