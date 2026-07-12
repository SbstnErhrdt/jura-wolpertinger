import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { readPackageVersion, runLocalMacRelease } from './release/macos'

async function main() {
  const cwd = process.cwd()
  const version = await readPackageVersion(join(cwd, 'package.json'))
  const result = await runLocalMacRelease({
    env: process.env,
    version,
    cwd
  })

  for (const output of result.outputs) {
    console.log(`${output.platform}: ${output.outputDirectory}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
