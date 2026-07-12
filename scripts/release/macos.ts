import { spawn } from 'node:child_process'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import {
  RELEASE_SMOKE_ENV,
  RELEASE_SMOKE_MARKER,
  RELEASE_SMOKE_USER_DATA_ENV
} from '../../src/shared/releaseSmoke'
import { collectReleaseArtifacts, type ReleasePlatform } from './model'

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'APPLE_API_KEY',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER',
  'APPLE_TEAM_ID'
] as const

const STRICT_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

const MAC_BUILD_TARGETS = [
  {
    platform: 'mac-arm64',
    archFlag: '--arm64',
    expectedArch: 'arm64',
    outputDirectory: '.release-stage/mac/arm64'
  },
  {
    platform: 'mac-x64',
    archFlag: '--x64',
    expectedArch: 'x86_64',
    outputDirectory: '.release-stage/mac/x64'
  }
] as const satisfies Array<{
  platform: ReleasePlatform
  archFlag: '--arm64' | '--x64'
  expectedArch: 'arm64' | 'x86_64'
  outputDirectory: string
}>

export interface CommandResult {
  stdout: string
  stderr: string
}

export type RunCommand = (
  command: string[],
  options?: {
    cwd?: string
    env?: Record<string, string | undefined>
    timeoutMs?: number
  }
) => Promise<CommandResult>

export interface ValidateMacReleaseEnvironmentInput {
  env: Record<string, string | undefined>
  version: string
  cwd: string
  runCommand?: RunCommand
  pathExists?: (path: string) => Promise<boolean>
}

export interface RunLocalMacReleaseInput extends ValidateMacReleaseEnvironmentInput {}

export interface LocalMacReleaseResult {
  version: string
  outputs: Array<{
    platform: 'mac-arm64' | 'mac-x64'
    outputDirectory: '.release-stage/mac/arm64' | '.release-stage/mac/x64'
  }>
}

export async function validateMacReleaseEnvironment(
  input: ValidateMacReleaseEnvironmentInput
): Promise<void> {
  if (!STRICT_SEMVER_PATTERN.test(input.version)) {
    throw new Error('Package version must be strict semver.')
  }

  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) => !input.env[name]?.trim())

  if (missing.length > 0) {
    throw new Error(
      `Missing required macOS release environment variables: ${missing.join(', ')}`
    )
  }

  const pathExists = input.pathExists ?? defaultPathExists
  const apiKeyPath = input.env.APPLE_API_KEY!.trim()
  const apiKeyExists = await pathExists(apiKeyPath)

  if (!apiKeyExists) {
    throw new Error('APPLE_API_KEY must point to an existing file.')
  }

  const hasCscLink = Boolean(input.env.CSC_LINK?.trim())

  if (hasCscLink) {
    return
  }

  const runCommand = input.runCommand ?? createCommandRunner()
  const identityResult = await runCommand(
    ['security', 'find-identity', '-v', '-p', 'codesigning'],
    {
      cwd: input.cwd,
      env: input.env
    }
  )

  if (!/Developer ID Application:/i.test(identityResult.stdout)) {
    throw new Error(
      'A Developer ID Application identity or CSC_LINK is required for local macOS release builds.'
    )
  }
}

export async function runLocalMacRelease(
  input: RunLocalMacReleaseInput
): Promise<LocalMacReleaseResult> {
  const runCommand = input.runCommand ?? createCommandRunner()

  await validateMacReleaseEnvironment({
    ...input,
    runCommand
  })

  await Promise.all(
    MAC_BUILD_TARGETS.map(({ outputDirectory }) =>
      rm(join(input.cwd, outputDirectory), { recursive: true, force: true })
    )
  )

  for (const command of [
    ['pnpm', 'run', 'build:icons'],
    ['pnpm', 'run', 'build'],
    ['pnpm', 'run', 'rebuild:native']
  ]) {
    await runCommand(command, {
      cwd: input.cwd,
      env: input.env
    })
  }

  for (const target of MAC_BUILD_TARGETS) {
    await runCommand(
      [
        'electron-builder',
        '--mac',
        target.archFlag,
        '--publish',
        'never',
        `--config.directories.output=${target.outputDirectory}`
      ],
      {
        cwd: input.cwd,
        env: input.env
      }
    )

    await validateMacReleaseArtifacts({
      cwd: input.cwd,
      inputDirectory: join(input.cwd, target.outputDirectory),
      platform: target.platform,
      expectedArch: target.expectedArch,
      runCommand,
      env: input.env
    })
  }

  return {
    version: input.version,
    outputs: MAC_BUILD_TARGETS.map(({ platform, outputDirectory }) => ({
      platform,
      outputDirectory
    }))
  }
}

export interface ValidateMacReleaseArtifactsInput {
  cwd: string
  inputDirectory: string
  platform: ReleasePlatform
  expectedArch: 'arm64' | 'x86_64'
  runCommand?: RunCommand
  env: Record<string, string | undefined>
  pathExists?: (path: string) => Promise<boolean>
}

export async function validateMacReleaseArtifacts(input: ValidateMacReleaseArtifactsInput) {
  const runCommand = input.runCommand ?? createCommandRunner()
  const pathExists = input.pathExists ?? defaultPathExists
  const artifacts = await collectReleaseArtifacts({
    directory: input.inputDirectory,
    platform: input.platform
  })
  const dmgArtifact = artifacts.find(
    (artifact) => artifact.kind === 'download' && artifact.fileName.endsWith('.dmg')
  )
  const zipArtifact = artifacts.find(
    (artifact) => artifact.kind === 'update' && artifact.fileName.endsWith('.zip')
  )

  if (!dmgArtifact) {
    throw new Error(`${input.platform} is missing DMG.`)
  }

  if (!zipArtifact) {
    throw new Error(`${input.platform} is missing ZIP.`)
  }

  const attachResult = await runCommand(
    ['hdiutil', 'attach', dmgArtifact.filePath, '-nobrowse', '-readonly'],
    {
      cwd: input.cwd,
      env: input.env
    }
  )
  const attachedVolume = parseAttachedVolume(`${attachResult.stdout}\n${attachResult.stderr}`)

  let validationError: Error | null = null
  let cleanupError: Error | null = null

  try {
    if (!attachedVolume.mountPoint) {
      throw new Error(`Unable to determine mounted volume for ${relative(input.cwd, dmgArtifact.filePath)}.`)
    }

    const mountedAppPath = await resolveAppPath({
      root: attachedVolume.mountPoint,
      artifactFileName: dmgArtifact.fileName,
      version: dmgArtifact.version,
      pathExists
    })
    await validateAppBundle({
      appPath: mountedAppPath,
      cwd: input.cwd,
      env: input.env,
      expectedArch: input.expectedArch,
      platform: input.platform,
      runCommand,
      pathExists
    })
  } catch (error) {
    validationError = error instanceof Error ? error : new Error(String(error))
  } finally {
    const cleanupTarget = attachedVolume.mountPoint ?? attachedVolume.deviceIdentifier

    if (cleanupTarget) {
      try {
        await detachMountedVolume({
          target: cleanupTarget,
          cwd: input.cwd,
          env: input.env,
          runCommand
        })
      } catch (detachError) {
        cleanupError = detachError instanceof Error ? detachError : new Error(String(detachError))
      }
    }
  }

  if (validationError && cleanupError) {
    throw new AggregateError(
      [validationError, cleanupError],
      'Mounted app validation failed and mounted-volume cleanup also failed.'
    )
  }

  if (cleanupError) {
    throw cleanupError
  }

  if (validationError) {
    throw validationError
  }

  const extractionDirectory = await mkdtemp(join(tmpdir(), 'jura-release-zip-'))

  try {
    await runCommand(['ditto', '-x', '-k', zipArtifact.filePath, extractionDirectory], {
      cwd: input.cwd,
      env: input.env
    })
    const extractedAppPath = await resolveAppPath({
      root: extractionDirectory,
      artifactFileName: zipArtifact.fileName,
      version: zipArtifact.version,
      pathExists
    })
    await validateAppBundle({
      appPath: extractedAppPath,
      cwd: input.cwd,
      env: input.env,
      expectedArch: input.expectedArch,
      platform: input.platform,
      runCommand,
      pathExists
    })
  } finally {
    await rm(extractionDirectory, { recursive: true, force: true })
  }
}

async function validateAppBundle(input: {
  appPath: string
  cwd: string
  env: Record<string, string | undefined>
  expectedArch: 'arm64' | 'x86_64'
  platform: ReleasePlatform
  runCommand: RunCommand
  pathExists: (path: string) => Promise<boolean>
}) {
  const executablePath = await findExpectedAppExecutable(input.appPath, input.pathExists)

  await input.runCommand(
    ['codesign', '--verify', '--deep', '--strict', '--verbose=2', input.appPath],
    { cwd: input.cwd, env: input.env }
  )
  await input.runCommand(
    ['spctl', '--assess', '--type', 'exec', '--verbose=4', input.appPath],
    { cwd: input.cwd, env: input.env }
  )
  await input.runCommand(['xcrun', 'stapler', 'validate', input.appPath], {
    cwd: input.cwd,
    env: input.env
  })

  const archResult = await input.runCommand(['lipo', '-archs', executablePath], {
    cwd: input.cwd,
    env: input.env
  })
  const discoveredArchitectures = archResult.stdout.trim().split(/\s+/).filter(Boolean)

  if (!discoveredArchitectures.includes(input.expectedArch)) {
    throw new Error(
      `Expected ${input.platform} app binary to include architecture ${input.expectedArch}.`
    )
  }

  const smokeUserDataDirectory = await mkdtemp(join(tmpdir(), 'jura-release-smoke-'))
  let smokeResult: CommandResult

  try {
    smokeResult = await input.runCommand([executablePath], {
      cwd: input.cwd,
      env: {
        ...input.env,
        [RELEASE_SMOKE_ENV]: '1',
        [RELEASE_SMOKE_USER_DATA_ENV]: smokeUserDataDirectory
      },
      timeoutMs: 30_000
    })
  } finally {
    await rm(smokeUserDataDirectory, { recursive: true, force: true })
  }

  if (!smokeResult.stdout.split(/\r?\n/).includes(RELEASE_SMOKE_MARKER)) {
    throw new Error(`${input.platform} packaged startup smoke did not emit the renderer-ready marker.`)
  }
}

async function resolveAppPath(input: {
  root: string
  artifactFileName: string
  version: string
  pathExists: (path: string) => Promise<boolean>
}) {
  const productName = readProductNameFromArtifactFileName(input.artifactFileName, input.version)
  const appPath = join(input.root, `${productName}.app`)
  const exists = await input.pathExists(appPath)

  if (!exists) {
    throw new Error(`Expected mounted app bundle ${productName}.app.`)
  }

  return appPath
}

async function findExpectedAppExecutable(
  appPath: string,
  pathExists: (path: string) => Promise<boolean>
): Promise<string> {
  const executableName = basename(appPath, '.app')
  const executablePath = join(appPath, 'Contents', 'MacOS', executableName)
  const exists = await pathExists(executablePath)

  if (!exists) {
    throw new Error(`Expected mounted app executable ${executableName}.`)
  }

  return executablePath
}

async function detachMountedVolume(input: {
  target: string
  cwd: string
  env: Record<string, string | undefined>
  runCommand: RunCommand
}) {
  try {
    await input.runCommand(['hdiutil', 'detach', input.target], {
      cwd: input.cwd,
      env: input.env
    })
  } catch (detachError) {
    const firstError = detachError instanceof Error ? detachError : new Error(String(detachError))

    try {
      await input.runCommand(['hdiutil', 'detach', input.target, '-force'], {
        cwd: input.cwd,
        env: input.env
      })
    } catch (forceDetachError) {
      const secondError = forceDetachError instanceof Error
        ? forceDetachError
        : new Error(String(forceDetachError))

      throw new AggregateError(
        [firstError, secondError],
        `Failed to detach mounted volume ${input.target}. Normal detach failed: ${firstError.message}. Force detach failed: ${secondError.message}.`
      )
    }
  }
}

function parseAttachedVolume(output: string) {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  let deviceIdentifier: string | null = null
  let mountPoint: string | null = null

  for (const line of lines) {
    const segments = line.split('\t').filter((segment) => segment.length > 0)
    const deviceCandidate = segments[0]
    const mountCandidate = segments.at(-1)

    if (!deviceIdentifier && deviceCandidate?.startsWith('/dev/')) {
      deviceIdentifier = deviceCandidate
    }

    if (mountCandidate?.startsWith('/')) {
      mountPoint = mountCandidate
    }
  }

  return {
    deviceIdentifier,
    mountPoint
  }
}

function readProductNameFromArtifactFileName(fileName: string, version: string) {
  const suffix = `-${version}-`
  const suffixIndex = fileName.indexOf(suffix)

  if (suffixIndex <= 0) {
    throw new Error(`Unable to derive product name from ${fileName}.`)
  }

  return fileName.slice(0, suffixIndex)
}

async function defaultPathExists(path: string) {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

export function createCommandRunner(): RunCommand {
  return async (command, options) => {
    const [file, ...args] = command

    return new Promise<CommandResult>((resolve, reject) => {
      const child = spawn(file, args, {
        cwd: options?.cwd,
        env: {
          ...process.env,
          ...options?.env
        },
        detached: Boolean(options?.timeoutMs) && process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''
      let settled = false
      const timeout = options?.timeoutMs
        ? setTimeout(() => {
            if (settled) return
            settled = true

            if (child.pid && process.platform !== 'win32') {
              try {
                process.kill(-child.pid, 'SIGKILL')
              } catch {
                child.kill('SIGKILL')
              }
            } else {
              child.kill('SIGKILL')
            }

            child.stdout.destroy()
            child.stderr.destroy()
            reject(new Error(`${file} timed out after ${options.timeoutMs}ms.`))
          }, options.timeoutMs)
        : null

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString()
      })

      child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString()
      })

      child.on('error', (error) => {
        if (settled) return
        settled = true
        if (timeout) clearTimeout(timeout)
        reject(error)
      })
      child.on('close', (code) => {
        if (settled) return
        settled = true
        if (timeout) clearTimeout(timeout)

        if (code === 0) {
          resolve({ stdout, stderr })
          return
        }

        const message = stderr.trim() || stdout.trim() || `${file} exited with code ${code}.`
        reject(new Error(message))
      })
    })
  }
}

export async function readPackageVersion(packageJsonPath: string) {
  const packageDocument = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    version?: unknown
  }

  if (typeof packageDocument.version !== 'string' || packageDocument.version.trim().length === 0) {
    throw new Error('package.json must define a version.')
  }

  return packageDocument.version.trim()
}
