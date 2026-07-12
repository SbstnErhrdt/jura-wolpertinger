import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  runLocalMacRelease,
  validateMacReleaseEnvironment,
  type RunCommand
} from '../../scripts/release/macos'

const temporaryDirectories: string[] = []
const VERSION = '1.2.3'
const PRODUCT_NAME = 'Jura Wolpertinger'

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

describe('runLocalMacRelease', () => {
  it('builds arm64 and x64 into separate output directories and validates signed artifacts', async () => {
    const workspace = await createWorkspace()
    const commands: string[] = []
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
        const mountRoot = join(
          workspace,
          '.mounts',
          command[2]?.includes('-arm64-') ? 'arm64' : 'x64'
        )
        await mkdir(mountRoot, { recursive: true })
        await writeMountedAppFixture(mountRoot)
        return { stdout: `/dev/disk4\tApple_HFS\t${mountRoot}\n`, stderr: '' }
      }

      if (command[0] === 'lipo') {
        return {
          stdout: command.at(-1)?.includes('arm64.app') ? 'arm64' : 'x86_64',
          stderr: ''
        }
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
    expect(commands.some((command) => command.startsWith('codesign --verify --deep --strict'))).toBe(true)
    expect(commands.some((command) => command.startsWith('spctl --assess --type exec'))).toBe(true)
    expect(commands.some((command) => command.startsWith('xcrun stapler validate'))).toBe(true)
    expect(commands.some((command) => command.startsWith('hdiutil attach'))).toBe(true)
    expect(commands.some((command) => command.startsWith('hdiutil detach'))).toBe(true)
    expect(commands.some((command) => command.startsWith('lipo -archs'))).toBe(true)
    expect(
      commands.some((command) =>
        command.startsWith('tsx scripts/release-stage.ts') ||
        command.startsWith('tsx scripts/release-publish.ts') ||
        command.startsWith('aws s3')
      )
    ).toBe(false)
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

async function writeMountedAppFixture(directory: string) {
  const appDirectory = join(directory, `${PRODUCT_NAME}.app`, 'Contents', 'MacOS')
  await mkdir(appDirectory, { recursive: true })
  await writeFile(join(appDirectory, PRODUCT_NAME), 'mounted executable')
}
