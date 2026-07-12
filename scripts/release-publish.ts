import { readReleaseStorageConfig } from './release/config'
import { createS3ReleaseStorage, publishRelease } from './release/storage'

async function main() {
  const args = readArgs(process.argv.slice(2))
  const version = readRequiredValue(args.version, '--version')
  const confirm = readRequiredValue(args.confirm, '--confirm')
  const config = readReleaseStorageConfig(process.env)
  const storage = createS3ReleaseStorage(config)
  const result = await publishRelease({
    storage,
    version,
    confirm,
    publicBaseUrl: config.publicBaseUrl
  })

  console.log(`Published ${result.version}: ${result.publishedMetadataKeys.length} metadata files and ${result.manifestKey}.`)
}

function readArgs(argv: string[]) {
  const args: Record<string, string> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--version' || argument === '--confirm') {
      args[argument.slice(2)] = argv[index + 1]
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return args
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
