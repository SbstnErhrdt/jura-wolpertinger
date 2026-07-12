import { readReleaseStorageConfig } from './release/config'
import { createS3ReleaseStorage, stageRelease } from './release/storage'
import { type ReleasePlatform } from './release/model'

async function main() {
  const args = readArgs(process.argv.slice(2))
  const platform = readRequiredReleasePlatform(args.platform)
  const inputDirectory = readRequiredValue(args.input, '--input')
  const config = readReleaseStorageConfig(process.env)
  const storage = createS3ReleaseStorage(config)
  const result = await stageRelease({
    storage,
    platform,
    inputDirectory,
    dryRun: args.dryRun
  })

  if (args.dryRun) {
    console.log(`Dry run for ${result.platform} ${result.version}: ${result.plannedKeys.length} immutable objects checked.`)
    return
  }

  console.log(`Staged ${result.uploadedKeys.length} immutable objects for ${result.platform} ${result.version}.`)
}

function readArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--dry-run') {
      args.dryRun = true
      continue
    }

    if (argument === '--platform' || argument === '--input') {
      args[argument.slice(2)] = argv[index + 1]
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return {
    platform: typeof args.platform === 'string' ? args.platform : undefined,
    input: typeof args.input === 'string' ? args.input : undefined,
    dryRun: args.dryRun === true
  }
}

function readRequiredReleasePlatform(value: string | undefined): ReleasePlatform {
  if (
    value === 'mac-arm64' ||
    value === 'mac-x64' ||
    value === 'windows-x64' ||
    value === 'linux-x64'
  ) {
    return value
  }

  throw new Error('--platform must be one of mac-arm64, mac-x64, windows-x64, linux-x64.')
}

function readRequiredValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
