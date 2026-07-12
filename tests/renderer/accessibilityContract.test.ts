import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import YAML from 'yaml'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../..')

async function readRepoFile(path: string): Promise<string> {
  return readFile(resolve(repoRoot, path), 'utf8')
}

async function readWorkflow(path: string): Promise<Record<string, unknown>> {
  return YAML.parse(await readRepoFile(path)) as Record<string, unknown>
}

function jobNamed(workflow: Record<string, unknown>, name: string): Record<string, unknown> {
  const jobs = workflow.jobs as Record<string, Record<string, unknown>>
  const job = jobs?.[name]
  expect(job, `Expected workflow job "${name}"`).toBeDefined()
  return job
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ')
}

describe('CI and accessibility release contract', () => {
  it('defines PR/main CI with pinned pnpm, Node 22, platform gates, and failure artifacts', async () => {
    const source = await readRepoFile('.github/workflows/ci.yml')
    const workflow = await readWorkflow('.github/workflows/ci.yml')
    const on = workflow.on as Record<string, unknown>

    expect(on.pull_request, 'CI must run on pull requests').toBeDefined()
    expect(on.push, 'CI must run on main pushes').toEqual({ branches: ['main'] })
    expect(workflow.concurrency, 'CI must cancel superseded runs').toMatchObject({
      'cancel-in-progress': true
    })
    expect(source).toContain('pnpm/action-setup@v5')
    expect(source).toMatch(/version:\s*10\.33\.0/)
    expect(source).toContain('actions/setup-node@v6')
    expect(source).toMatch(/node-version:\s*22/)

    const ubuntu = jobNamed(workflow, 'ubuntu-validation')
    expect(ubuntu['runs-on']).toBe('ubuntu-latest')
    expect(source).toContain('pnpm run typecheck')
    expect(source).toContain('pnpm test')
    expect(source).toContain('pnpm run build')
    expect(source).toContain('pnpm run build:web:production')
    expect(source).toContain("VITE_JURA_REQUIRE_AUTH: '1'")
    expect(source).toContain('VITE_SUPABASE_URL: https://supabase.invalid')
    expect(source).toContain('VITE_SUPABASE_ANON_KEY: ci-placeholder-anon-key')

    const e2e = jobNamed(workflow, 'macos-e2e')
    expect(e2e['runs-on']).toBe('macos-latest')
    expect(source).toContain('pnpm run test:e2e')
    expect(source).toContain('actions/upload-artifact@v6')
    expect(source).toContain('playwright-report')
    expect(source).toContain('test-results')
    expect(source).toMatch(/if:\s*\$\{\{\s*failure\(\)\s*\}\}/)

    const windows = jobNamed(workflow, 'windows-package')
    expect(windows['runs-on']).toBe('windows-latest')
    expect(source).toContain('pnpm run dist:dir')
    expect(source).toMatch(/^\s+release\s*$/m)
    expect(source).not.toMatch(/^\s+dist\s*$/m)
    expect(source).toMatch(/github\.event_name == 'workflow_dispatch' \|\| github\.ref == 'refs\/heads\/main'/)
  })

  it('keeps release manual, immutable, version-checked, and free of mutable GitHub publishing', async () => {
    const source = await readRepoFile('.github/workflows/release.yml')
    const normalizedSource = normalizeText(source)
    const workflow = await readWorkflow('.github/workflows/release.yml')
    const on = workflow.on as Record<string, unknown>

    expect(on.push, 'release must not publish from tag pushes').toBeUndefined()
    expect(on.workflow_dispatch).toMatchObject({
      inputs: {
        version: {
          required: true
        }
      }
    })
    expect(source).toContain('pnpm/action-setup@v5')
    expect(source).toMatch(/version:\s*10\.33\.0/)
    expect(source).toMatch(/node-version:\s*22/)
    expect(source).toContain("node -e \"const pkg=require('./package.json');")
    expect(source).toContain('corepack pnpm run release:win --x64')
    expect(source).toContain('corepack pnpm run release:linux --x64')
    expect(source).not.toMatch(/release:(?:win|linux) -- --x64/)
    expect(source).toContain('UPDATE_PUBLIC_BASE_URL: ${{ secrets.UPDATE_PUBLIC_BASE_URL }}')
    expect(source).toContain('corepack pnpm run release:stage --platform windows-x64 --input release/${{ inputs.version }}')
    expect(source).toContain('corepack pnpm run release:stage --platform linux-x64 --input release/${{ inputs.version }}')
    expect(source).not.toContain('pnpm run release:stage -- --platform')
    expect(source).toContain('release/${{ inputs.version }}')
    expect(source).not.toContain('RELEASE_PUBLIC_BASE_URL')
    expect(source).not.toContain('--input dist')
    expect(source).not.toMatch(/mac(?:os|-arm64|-x64)/i)
    expect(normalizedSource).not.toMatch(/--publish\s+always/)
    expect(normalizedSource).not.toMatch(/provider:\s*github/i)
    expect(normalizedSource).not.toMatch(/softprops\/action-gh-release|gh\s+release/i)
    expect(normalizedSource).not.toContain('release:publish')
  })

  it('runs Axe on the required app surfaces and blocks only serious or critical violations', async () => {
    const source = await readRepoFile('tests/e2e/app.e2e.spec.ts')

    expect(source).toContain("from '@axe-core/playwright'")
    expect(source).toContain('new AxeBuilder({ page })')
    expect(source).toContain('.analyze()')
    expect(source).toContain("['serious', 'critical']")
    expect(source).toContain('violation.id')
    expect(source).toContain('violation.helpUrl')
    expect(source).toContain('node.target')

    for (const surface of ['home', 'collections', 'library', 'correction', 'analytics']) {
      expect(source, `Missing Axe surface scan for ${surface}`).toContain(`scanAccessibility(page, '${surface}')`)
    }
  })
})
