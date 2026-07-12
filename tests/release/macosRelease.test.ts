import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCommandRunner,
  runLocalMacRelease,
  validateMacReleaseArtifacts,
  validateMacReleaseEnvironment,
  type RunCommand
} from '../../scripts/release/macos'
import { runReleaseStage } from '../../scripts/release/stage'

const temporaryDirectories: string[] = []
const VERSION = '1.2.3'
const PRODUCT_NAME = 'Jura Wolpertinger'
const RELEASE_SMOKE_MARKER = 'JURA_RELEASE_SMOKE_READY'

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('validateMacReleaseEnvironment', () => {
  it('accepts a discoverable Developer ID Application identity', async () => {
    const commands: string[] = []
    const runCommand: RunCommand = async (command) => {
      commands.push(command.join(' '))

      if (command[0] === 'security') {
        return {
          stdout: '  1) ABCDEF1234567890 "Developer ID Application: Example Corp (ABCDE12345)"',
          stderr: ''
        }
      }

      return { stdout: '', stderr: '' }
    }

    await expect(
      validateMacReleaseEnvironment({
        env: validEnvironment(),
        version: VERSION,
        cwd: '/tmp/workspace',
        runCommand,
        pathExists: async () => true
      })
    ).resolves.toBeUndefined()

    expect(commands).toEqual(['security find-identity -v -p codesigning'])
  })

  it('accepts CSC_LINK when no local Developer ID Application identity is discoverable', async () => {
    const runCommand: RunCommand = async (command) => {
      if (command[0] === 'security') {
        return {
          stdout: '  1) ABCDEF1234567890 "Apple Development: Example Corp (ABCDE12345)"',
          stderr: ''
        }
      }

      return { stdout: '', stderr: '' }
    }

    await expect(
      validateMacReleaseEnvironment({
        env: {
          ...validEnvironment(),
          CSC_LINK: 'base64:local-certificate'
        },
        version: VERSION,
        cwd: '/tmp/workspace',
        runCommand,
        pathExists: async () => true
      })
    ).resolves.toBeUndefined()
  })

  it('requires Apple API variables by name without exposing secret values', async () => {
    await expect(
      validateMacReleaseEnvironment({
        env: {
          APPLE_API_KEY: '/private/AuthKey_SECRET_123.p8',
          APPLE_API_KEY_ID: 'SECRETKEY123',
          APPLE_API_ISSUER: undefined,
          APPLE_TEAM_ID: undefined
        },
        version: VERSION,
        cwd: '/tmp/workspace',
        runCommand: async () => ({ stdout: '', stderr: '' }),
        pathExists: async () => true
      })
    ).rejects.toThrow(
      'Missing required macOS release environment variables: APPLE_API_ISSUER, APPLE_TEAM_ID'
    )

    await expect(
      validateMacReleaseEnvironment({
        env: {
          ...validEnvironment(),
          APPLE_API_KEY: '/private/AuthKey_SECRET_123.p8'
        },
        version: VERSION,
        cwd: '/tmp/workspace',
        runCommand: async () => ({ stdout: '', stderr: '' }),
        pathExists: async () => false
      })
    ).rejects.not.toThrow(/AuthKey_SECRET_123|SECRETKEY123/)
  })

  it('rejects versions that are not strict semver', async () => {
    await expect(
      validateMacReleaseEnvironment({
        env: validEnvironment(),
        version: '1.2',
        cwd: '/tmp/workspace',
        runCommand: async () => ({ stdout: '', stderr: '' }),
        pathExists: async () => true
      })
    ).rejects.toThrow('Package version must be strict semver.')
  })
})

describe('createCommandRunner', () => {
  it('enforces its timeout even when a spawned child keeps stdio open', async () => {
    const runCommand = createCommandRunner()
    const startedAt = Date.now()

    await expect(
      runCommand(
        [
          process.execPath,
          '-e',
          "require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' }); setInterval(() => {}, 1000)"
        ],
        { timeoutMs: 100 }
      )
    ).rejects.toThrow(/timed out after 100ms/i)

    expect(Date.now() - startedAt).toBeLessThan(1_000)
  })
})

describe('runReleaseStage', () => {
  it('rejects mac staging when the host is not macOS', async () => {
    const validateMacArtifacts = vi.fn()
    const stage = vi.fn()

    await expect(
      runReleaseStage({
        platform: 'mac-arm64',
        inputDirectory: '/tmp/mac-release',
        storage: {} as never,
        hostPlatform: 'linux',
        validateMacArtifacts,
        stage
      })
    ).rejects.toThrow(/mac staging.*macOS/i)

    expect(validateMacArtifacts).not.toHaveBeenCalled()
    expect(stage).not.toHaveBeenCalled()
  })

  it('validates the mac candidate before handing it to immutable storage staging', async () => {
    const calls: string[] = []
    const validateMacArtifacts = vi.fn(async () => {
      calls.push('validate')
    })
    const stage = vi.fn(async () => {
      calls.push('stage')
      return {
        platform: 'mac-x64' as const,
        version: VERSION,
        plannedKeys: [],
        uploadedKeys: []
      }
    })

    await runReleaseStage({
      platform: 'mac-x64',
      inputDirectory: '/tmp/mac-release',
      storage: {} as never,
      hostPlatform: 'darwin',
      env: {},
      validateMacArtifacts,
      stage
    })

    expect(calls).toEqual(['validate', 'stage'])
    expect(validateMacArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        inputDirectory: '/tmp/mac-release',
        platform: 'mac-x64',
        expectedArch: 'x86_64'
      })
    )
  })
})

describe('validateMacReleaseArtifacts', () => {
  it('validates and startup-smokes the app payloads from both DMG and ZIP', async () => {
    const workspace = await createWorkspace()
    const outputDirectory = join(workspace, '.release-stage', 'mac', 'arm64')
    const mountRoot = join(workspace, '.mounts', 'arm64')
    const commands: Array<{ command: string[]; env?: Record<string, string | undefined> }> = []
    await writeMacReleaseFixture(outputDirectory, 'arm64')
    await mkdir(mountRoot, { recursive: true })
    await writeMountedAppFixture(mountRoot)

    const runCommand: RunCommand = async (command, options) => {
      commands.push({ command, env: options?.env })

      if (command[0] === 'hdiutil' && command[1] === 'attach') {
        return { stdout: `/dev/disk4\tApple_HFS\t${mountRoot}\n`, stderr: '' }
      }

      if (command[0] === 'lipo') {
        return { stdout: 'arm64', stderr: '' }
      }

      if (command.at(-1)?.endsWith(join('Contents', 'MacOS', PRODUCT_NAME)) && command.length === 1) {
        return { stdout: `${RELEASE_SMOKE_MARKER}\n`, stderr: '' }
      }

      return { stdout: '', stderr: '' }
    }

    await validateMacReleaseArtifacts({
      cwd: workspace,
      inputDirectory: outputDirectory,
      platform: 'mac-arm64',
      expectedArch: 'arm64',
      env: {},
      runCommand,
      pathExists: async () => true
    })

    expect(commands.filter(({ command }) => command[0] === 'codesign')).toHaveLength(2)
    expect(commands.filter(({ command }) => command[0] === 'spctl')).toHaveLength(2)
    expect(commands.filter(({ command }) => command[0] === 'xcrun')).toHaveLength(2)
    expect(commands.filter(({ command }) => command[0] === 'lipo')).toHaveLength(2)
    expect(commands.some(({ command }) => command[0] === 'ditto' && command.slice(1, 3).join(' ') === '-x -k')).toBe(true)
    const smokeCommands = commands.filter(({ command }) =>
      command.at(-1)?.endsWith(join('Contents', 'MacOS', PRODUCT_NAME)) && command.length === 1
    )
    expect(smokeCommands).toHaveLength(2)
    expect(smokeCommands.map(({ env }) => env?.JURA_RELEASE_SMOKE)).toEqual(['1', '1'])
  })

  it('rejects a packaged app that exits without the renderer-ready smoke marker', async () => {
    const workspace = await createWorkspace()
    const outputDirectory = join(workspace, '.release-stage', 'mac', 'arm64')
    const mountRoot = join(workspace, '.mounts', 'arm64')
    await writeMacReleaseFixture(outputDirectory, 'arm64')
    await mkdir(mountRoot, { recursive: true })
    await writeMountedAppFixture(mountRoot)

    const runCommand: RunCommand = async (command) => {
      if (command[0] === 'hdiutil' && command[1] === 'attach') {
        return { stdout: `/dev/disk4\tApple_HFS\t${mountRoot}\n`, stderr: '' }
      }

      if (command[0] === 'lipo') {
        return { stdout: 'arm64', stderr: '' }
      }

      return { stdout: '', stderr: '' }
    }

    await expect(
      validateMacReleaseArtifacts({
        cwd: workspace,
        inputDirectory: outputDirectory,
        platform: 'mac-arm64',
        expectedArch: 'arm64',
        env: {},
        runCommand,
        pathExists: async () => true
      })
    ).rejects.toThrow(/startup smoke.*marker/i)
  })
})

describe('runLocalMacRelease', () => {
  it('builds arm64 and x64 into separate output directories and validates signed artifacts', async () => {
    const workspace = await createWorkspace()
    const commands: string[] = []
    const mountRoots = new Map<'arm64' | 'x64', string>()
    let activeArch: 'arm64' | 'x64' = 'arm64'
    const runCommand: RunCommand = async (command, options) => {
      commands.push(command.join(' '))

      if (command[0] === 'security') {
        return {
          stdout: '  1) ABCDEF1234567890 "Developer ID Application: Example Corp (ABCDE12345)"',
          stderr: ''
        }
      }

      if (command[0] === 'electron-builder') {
        const outputArgument = command.find((entry) => entry.startsWith('--config.directories.output='))

        if (!outputArgument) {
          throw new Error('missing builder output argument')
        }

        const outputDirectory = outputArgument.slice('--config.directories.output='.length)
        const arch = command.includes('--arm64') ? 'arm64' : 'x64'
        await writeMacReleaseFixture(join(options?.cwd ?? workspace, outputDirectory), arch)

        return { stdout: '', stderr: '' }
      }

      if (command[0] === 'hdiutil' && command[1] === 'attach') {
        const arch = command[2]?.includes('-arm64-') ? 'arm64' : 'x64'
        activeArch = arch
        const mountRoot = join(workspace, '.mounts', arch)
        mountRoots.set(arch, mountRoot)
        await mkdir(mountRoot, { recursive: true })
        await writeMountedAppFixture(mountRoot)
        return { stdout: `/dev/disk4\tApple_HFS\t${mountRoot}\n`, stderr: '' }
      }

      if (command[0] === 'lipo') {
        return {
          stdout: activeArch === 'arm64' ? 'arm64' : 'x86_64',
          stderr: ''
        }
      }

      if (command[0] === 'ditto' && command[1] === '-x' && command[2] === '-k') {
        await writeMountedAppFixture(command[4]!)
        return { stdout: '', stderr: '' }
      }

      if (command.length === 1 && command[0]?.endsWith(join('Contents', 'MacOS', PRODUCT_NAME))) {
        return { stdout: `${RELEASE_SMOKE_MARKER}\n`, stderr: '' }
      }

      return { stdout: '', stderr: '' }
    }

    const result = await runLocalMacRelease({
      env: validEnvironment(),
      version: VERSION,
      cwd: workspace,
      runCommand,
      pathExists: async () => true
    })

    expect(result.outputs).toEqual([
      {
        platform: 'mac-arm64',
        outputDirectory: '.release-stage/mac/arm64'
      },
      {
        platform: 'mac-x64',
        outputDirectory: '.release-stage/mac/x64'
      }
    ])

    expect(commands).toEqual(
      expect.arrayContaining([
        'pnpm run build:icons',
        'pnpm run build',
        'pnpm run rebuild:native',
        'electron-builder --mac --arm64 --publish never --config.directories.output=.release-stage/mac/arm64',
        'electron-builder --mac --x64 --publish never --config.directories.output=.release-stage/mac/x64'
      ])
    )

    expect(commands.some((command) => command.includes('--publish always'))).toBe(false)
    expect(commands).toContain(
      `codesign --verify --deep --strict --verbose=2 ${join(mountRoots.get('arm64')!, `${PRODUCT_NAME}.app`)}`
    )
    expect(commands).toContain(
      `codesign --verify --deep --strict --verbose=2 ${join(mountRoots.get('x64')!, `${PRODUCT_NAME}.app`)}`
    )
    expect(commands).toContain(
      `spctl --assess --type exec --verbose=4 ${join(mountRoots.get('arm64')!, `${PRODUCT_NAME}.app`)}`
    )
    expect(commands).toContain(
      `spctl --assess --type exec --verbose=4 ${join(mountRoots.get('x64')!, `${PRODUCT_NAME}.app`)}`
    )
    expect(commands).toContain(
      `xcrun stapler validate ${join(mountRoots.get('arm64')!, `${PRODUCT_NAME}.app`)}`
    )
    expect(commands).toContain(
      `xcrun stapler validate ${join(mountRoots.get('x64')!, `${PRODUCT_NAME}.app`)}`
    )
    expect(commands.some((command) => command.startsWith('hdiutil attach'))).toBe(true)
    expect(commands.some((command) => command.startsWith('hdiutil detach'))).toBe(true)
    expect(commands).toContain(
      `lipo -archs ${join(mountRoots.get('arm64')!, `${PRODUCT_NAME}.app`, 'Contents', 'MacOS', PRODUCT_NAME)}`
    )
    expect(commands).toContain(
      `lipo -archs ${join(mountRoots.get('x64')!, `${PRODUCT_NAME}.app`, 'Contents', 'MacOS', PRODUCT_NAME)}`
    )
    expect(
      commands.some((command) =>
        command.startsWith(`codesign --verify --deep --strict --verbose=2 ${join(workspace, '.release-stage')}`) ||
        command.startsWith(`spctl --assess --type exec --verbose=4 ${join(workspace, '.release-stage')}`) ||
        command.startsWith(`xcrun stapler validate ${join(workspace, '.release-stage')}`) ||
        command.startsWith(`lipo -archs ${join(workspace, '.release-stage')}`)
      )
    ).toBe(false)
    expect(
      commands.some((command) =>
        command.startsWith('tsx scripts/release-stage.ts') ||
        command.startsWith('tsx scripts/release-publish.ts') ||
        command.startsWith('aws s3')
      )
    ).toBe(false)
  })

  it('rejects a mounted app whose product name does not match the expected release artifact', async () => {
    const workspace = await createWorkspace()
    const runCommand: RunCommand = async (command, options) => {
      if (command[0] === 'security') {
        return {
          stdout: '  1) ABCDEF1234567890 "Developer ID Application: Example Corp (ABCDE12345)"',
          stderr: ''
        }
      }

      if (command[0] === 'electron-builder') {
        const outputArgument = command.find((entry) => entry.startsWith('--config.directories.output='))

        if (!outputArgument) {
          throw new Error('missing builder output argument')
        }

        const outputDirectory = outputArgument.slice('--config.directories.output='.length)
        const arch = command.includes('--arm64') ? 'arm64' : 'x64'
        await writeMacReleaseFixture(join(options?.cwd ?? workspace, outputDirectory), arch)

        return { stdout: '', stderr: '' }
      }

      if (command[0] === 'hdiutil' && command[1] === 'attach') {
        const mountRoot = join(workspace, '.mounts', 'arm64')
        await mkdir(mountRoot, { recursive: true })
        await writeMountedAppFixture(mountRoot, 'Wrong Product')
        return { stdout: `/dev/disk4\tApple_HFS\t${mountRoot}\n`, stderr: '' }
      }

      return { stdout: '', stderr: '' }
    }

    await expect(
      runLocalMacRelease({
        env: validEnvironment(),
        version: VERSION,
        cwd: workspace,
        runCommand,
        pathExists: async () => true
      })
    ).rejects.toThrow(`Expected mounted app bundle ${PRODUCT_NAME}.app.`)
  })

  it('fails when architecture inspection does not match the expected build', async () => {
    const workspace = await createWorkspace()
    const runCommand: RunCommand = async (command, options) => {
      if (command[0] === 'security') {
        return {
          stdout: '  1) ABCDEF1234567890 "Developer ID Application: Example Corp (ABCDE12345)"',
          stderr: ''
        }
      }

      if (command[0] === 'electron-builder') {
        const outputArgument = command.find((entry) => entry.startsWith('--config.directories.output='))

        if (!outputArgument) {
          throw new Error('missing builder output argument')
        }

        const outputDirectory = outputArgument.slice('--config.directories.output='.length)
        const arch = command.includes('--arm64') ? 'arm64' : 'x64'
        await writeMacReleaseFixture(join(options?.cwd ?? workspace, outputDirectory), arch)

        return { stdout: '', stderr: '' }
      }

      if (command[0] === 'hdiutil' && command[1] === 'attach') {
        const mountRoot = join(workspace, '.mounts', 'shared')
        await mkdir(mountRoot, { recursive: true })
        await writeMountedAppFixture(mountRoot)
        return { stdout: `/dev/disk4\tApple_HFS\t${mountRoot}\n`, stderr: '' }
      }

      if (command[0] === 'lipo') {
        return { stdout: 'x86_64', stderr: '' }
      }

      return { stdout: '', stderr: '' }
    }

    await expect(
      runLocalMacRelease({
        env: validEnvironment(),
        version: VERSION,
        cwd: workspace,
        runCommand,
        pathExists: async () => true
      })
    ).rejects.toThrow('Expected mac-arm64 app binary to include architecture arm64.')
  })

  it('detaches the mounted volume when mounted-app validation fails', async () => {
    const workspace = await createWorkspace()
    const commands: string[] = []
    const mountRoot = join(workspace, '.mounts', 'arm64')
    const runCommand: RunCommand = async (command, options) => {
      commands.push(command.join(' '))

      if (command[0] === 'security') {
        return {
          stdout: '  1) ABCDEF1234567890 "Developer ID Application: Example Corp (ABCDE12345)"',
          stderr: ''
        }
      }

      if (command[0] === 'electron-builder') {
        const outputArgument = command.find((entry) => entry.startsWith('--config.directories.output='))

        if (!outputArgument) {
          throw new Error('missing builder output argument')
        }

        const outputDirectory = outputArgument.slice('--config.directories.output='.length)
        const arch = command.includes('--arm64') ? 'arm64' : 'x64'
        await writeMacReleaseFixture(join(options?.cwd ?? workspace, outputDirectory), arch)

        return { stdout: '', stderr: '' }
      }

      if (command[0] === 'hdiutil' && command[1] === 'attach') {
        await mkdir(mountRoot, { recursive: true })
        await writeMountedAppFixture(mountRoot)
        return { stdout: `/dev/disk4\tApple_HFS\t${mountRoot}\n`, stderr: '' }
      }

      if (
        command[0] === 'codesign' &&
        command.at(-1) === join(mountRoot, `${PRODUCT_NAME}.app`)
      ) {
        throw new Error('mounted codesign failed')
      }

      if (command[0] === 'lipo') {
        return { stdout: 'arm64', stderr: '' }
      }

      return { stdout: '', stderr: '' }
    }

    await expect(
      runLocalMacRelease({
        env: validEnvironment(),
        version: VERSION,
        cwd: workspace,
        runCommand,
        pathExists: async () => true
      })
    ).rejects.toThrow('mounted codesign failed')

    expect(commands).toContain(`hdiutil detach ${mountRoot}`)
  })

  it('detaches by device identifier when attach succeeds but mount-path parsing fails', async () => {
    const workspace = await createWorkspace()
    const commands: string[] = []
    const deviceIdentifier = '/dev/disk7'
    const runCommand: RunCommand = async (command, options) => {
      commands.push(command.join(' '))

      if (command[0] === 'security') {
        return {
          stdout: '  1) ABCDEF1234567890 "Developer ID Application: Example Corp (ABCDE12345)"',
          stderr: ''
        }
      }

      if (command[0] === 'electron-builder') {
        const outputArgument = command.find((entry) => entry.startsWith('--config.directories.output='))

        if (!outputArgument) {
          throw new Error('missing builder output argument')
        }

        const outputDirectory = outputArgument.slice('--config.directories.output='.length)
        const arch = command.includes('--arm64') ? 'arm64' : 'x64'
        await writeMacReleaseFixture(join(options?.cwd ?? workspace, outputDirectory), arch)

        return { stdout: '', stderr: '' }
      }

      if (command[0] === 'hdiutil' && command[1] === 'attach') {
        return {
          stdout: `${deviceIdentifier}\tGUID_partition_scheme\n${deviceIdentifier}s1\tApple_HFS\n`,
          stderr: ''
        }
      }

      if (command[0] === 'hdiutil' && command[1] === 'detach') {
        return { stdout: '', stderr: '' }
      }

      return { stdout: '', stderr: '' }
    }

    await expect(
      runLocalMacRelease({
        env: validEnvironment(),
        version: VERSION,
        cwd: workspace,
        runCommand,
        pathExists: async () => true
      })
    ).rejects.toThrow(`Unable to determine mounted volume for .release-stage/mac/arm64/${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg.`)

    expect(commands).toContain(`hdiutil detach ${deviceIdentifier}`)
  })

  it('retries force detach and surfaces cleanup failure together with the original validation error', async () => {
    const workspace = await createWorkspace()
    const commands: string[] = []
    const mountRoot = join(workspace, '.mounts', 'arm64')
    const runCommand: RunCommand = async (command, options) => {
      commands.push(command.join(' '))

      if (command[0] === 'security') {
        return {
          stdout: '  1) ABCDEF1234567890 "Developer ID Application: Example Corp (ABCDE12345)"',
          stderr: ''
        }
      }

      if (command[0] === 'electron-builder') {
        const outputArgument = command.find((entry) => entry.startsWith('--config.directories.output='))

        if (!outputArgument) {
          throw new Error('missing builder output argument')
        }

        const outputDirectory = outputArgument.slice('--config.directories.output='.length)
        const arch = command.includes('--arm64') ? 'arm64' : 'x64'
        await writeMacReleaseFixture(join(options?.cwd ?? workspace, outputDirectory), arch)

        return { stdout: '', stderr: '' }
      }

      if (command[0] === 'hdiutil' && command[1] === 'attach') {
        await mkdir(mountRoot, { recursive: true })
        await writeMountedAppFixture(mountRoot)
        return { stdout: `/dev/disk4\tApple_HFS\t${mountRoot}\n`, stderr: '' }
      }

      if (
        command[0] === 'codesign' &&
        command.at(-1) === join(mountRoot, `${PRODUCT_NAME}.app`)
      ) {
        throw new Error('mounted codesign failed')
      }

      if (command[0] === 'hdiutil' && command[1] === 'detach' && command[2] === mountRoot && command.length === 3) {
        throw new Error('normal detach failed')
      }

      if (command[0] === 'hdiutil' && command[1] === 'detach' && command[2] === mountRoot && command[3] === '-force') {
        throw new Error('force detach failed')
      }

      if (command[0] === 'lipo') {
        return { stdout: 'arm64', stderr: '' }
      }

      return { stdout: '', stderr: '' }
    }

    const result = await runLocalMacRelease({
      env: validEnvironment(),
      version: VERSION,
      cwd: workspace,
      runCommand,
      pathExists: async () => true
    }).catch((error) => error)

    expect(result).toBeInstanceOf(AggregateError)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toBeInstanceOf(Error)
    expect(result.errors[1]).toBeInstanceOf(Error)
    expect(result.errors[0].message).toBe('mounted codesign failed')
    expect(result.errors[1].message).toContain('force detach failed')
    expect(commands).toContain(`hdiutil detach ${mountRoot}`)
    expect(commands).toContain(`hdiutil detach ${mountRoot} -force`)
  })
})

function validEnvironment() {
  return {
    APPLE_API_KEY: '/private/AuthKey_TEST123.p8',
    APPLE_API_KEY_ID: 'TEST123456',
    APPLE_API_ISSUER: '11111111-2222-3333-4444-555555555555',
    APPLE_TEAM_ID: 'ABCDE12345'
  }
}

async function createWorkspace() {
  const directory = join(
    tmpdir(),
    `jura-wolpertinger-macos-release-${Date.now()}-${Math.random().toString(16).slice(2)}`
  )
  temporaryDirectories.push(directory)
  await mkdir(directory, { recursive: true })
  return directory
}

async function writeMacReleaseFixture(directory: string, arch: 'arm64' | 'x64') {
  await mkdir(directory, { recursive: true })

  const appDirectory = join(directory, `${arch}.app`, 'Contents', 'MacOS')
  await mkdir(appDirectory, { recursive: true })
  await writeFile(join(appDirectory, PRODUCT_NAME), `${arch} executable`)

  const zipFile = `${PRODUCT_NAME}-${VERSION}-${arch}-mac.zip`
  const dmgFile = `${PRODUCT_NAME}-${VERSION}-${arch}-mac.dmg`

  await writeFile(join(directory, zipFile), `${arch} zip bytes`)
  await writeFile(join(directory, `${zipFile}.blockmap`), `${arch} blockmap bytes`)
  await writeFile(join(directory, dmgFile), `${arch} dmg bytes`)
  await writeFile(
    join(directory, 'latest-mac.yml'),
    [
      `version: ${VERSION}`,
      `path: ${zipFile}`,
      'files:',
      `  - url: ${zipFile}`,
      '    sha512: placeholder',
      '    size: 10',
      `  - url: ${dmgFile}`,
      '    sha512: placeholder',
      '    size: 9'
    ].join('\n')
  )
}

async function writeMountedAppFixture(directory: string, appName = PRODUCT_NAME) {
  const appDirectory = join(directory, `${appName}.app`, 'Contents', 'MacOS')
  await mkdir(appDirectory, { recursive: true })
  await writeFile(join(appDirectory, appName), 'mounted executable')
}
