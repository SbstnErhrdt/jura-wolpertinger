import { spawn } from 'node:child_process'
import { access, readFile, rm } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { basename, join, relative } from 'node:path'
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

    await validateBuiltMacArtifacts({
      cwd: input.cwd,
      outputDirectory: target.outputDirectory,
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

async function validateBuiltMacArtifacts(input: {
  cwd: string
  outputDirectory: string
  platform: ReleasePlatform
  expectedArch: 'arm64' | 'x86_64'
  runCommand: RunCommand
  env: Record<string, string | undefined>
}) {
  const absoluteOutputDirectory = join(input.cwd, input.outputDirectory)
  const artifacts = await collectReleaseArtifacts({
    directory: absoluteOutputDirectory,
    platform: input.platform
  })
  const dmgArtifact = artifacts.find(
    (artifact) => artifact.kind === 'download' && artifact.fileName.endsWith('.dmg')
  )

  if (!dmgArtifact) {
    throw new Error(`${input.platform} is missing DMG.`)
  }

  const attachResult = await input.runCommand(
    ['hdiutil', 'attach', dmgArtifact.filePath, '-nobrowse', '-readonly'],
    {
      cwd: input.cwd,
      env: input.env
    }
  )
  const mountPoint = readMountedVolumePath(`${attachResult.stdout}\n${attachResult.stderr}`)

  if (!mountPoint) {
    throw new Error(`Unable to determine mounted volume for ${relative(input.cwd, dmgArtifact.filePath)}.`)
  }

  let validationError: Error | null = null

  try {
    const mountedAppPath = await resolveMountedAppPath({
      mountPoint,
      dmgFileName: dmgArtifact.fileName,
      version: dmgArtifact.version
    })
    const mountedExecutablePath = await findExpectedAppExecutable(mountedAppPath)

    await input.runCommand(
      ['codesign', '--verify', '--deep', '--strict', '--verbose=2', mountedAppPath],
      {
        cwd: input.cwd,
        env: input.env
      }
    )
    await input.runCommand(
      ['spctl', '--assess', '--type', 'exec', '--verbose=4', mountedAppPath],
      {
        cwd: input.cwd,
        env: input.env
      }
    )
    await input.runCommand(['xcrun', 'stapler', 'validate', mountedAppPath], {
      cwd: input.cwd,
      env: input.env
    })

    const archResult = await input.runCommand(['lipo', '-archs', mountedExecutablePath], {
      cwd: input.cwd,
      env: input.env
    })
    const discoveredArchitectures = archResult.stdout.trim().split(/\s+/).filter(Boolean)

    if (!discoveredArchitectures.includes(input.expectedArch)) {
      throw new Error(
        `Expected ${input.platform} app binary to include architecture ${input.expectedArch}.`
      )
    }
  } catch (error) {
    validationError = error instanceof Error ? error : new Error(String(error))
  } finally {
    try {
      await input.runCommand(['hdiutil', 'detach', mountPoint], {
        cwd: input.cwd,
        env: input.env
      })
    } catch (detachError) {
      if (!validationError) {
        throw detachError
      }
    }
  }

  if (validationError) {
    throw validationError
  }
}

async function resolveMountedAppPath(input: {
  mountPoint: string
  dmgFileName: string
  version: string
}) {
  const productName = readProductNameFromDmgFileName(input.dmgFileName, input.version)
  const mountedAppPath = join(input.mountPoint, `${productName}.app`)
  const exists = await defaultPathExists(mountedAppPath)

  if (!exists) {
    throw new Error(`Expected mounted app bundle ${productName}.app.`)
  }

  return mountedAppPath
}

async function findExpectedAppExecutable(appPath: string): Promise<string> {
  const executableName = basename(appPath, '.app')
  const executablePath = join(appPath, 'Contents', 'MacOS', executableName)
  const exists = await defaultPathExists(executablePath)

  if (!exists) {
    throw new Error(`Expected mounted app executable ${executableName}.`)
  }

  return executablePath
}

function readMountedVolumePath(output: string) {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  for (const line of lines.reverse()) {
    const segments = line.split('\t').filter((segment) => segment.length > 0)
    const candidate = segments.at(-1)

    if (candidate?.startsWith('/')) {
      return candidate
    }
  }

  return null
}

function readProductNameFromDmgFileName(fileName: string, version: string) {
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
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString()
      })

      child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString()
      })

      child.on('error', reject)
      child.on('close', (code) => {
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
