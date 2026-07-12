# Release Hardening and Stable Update Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reproducible CI, blocking accessibility checks, locally signed macOS release builds, and an atomic RustFS-backed stable update feed that removes all runtime dependencies on public GitHub releases.

**Architecture:** Keep `electron-updater`, but resolve a platform/architecture-specific generic HTTPS feed at runtime. Build immutable version artifacts separately on local macOS and GitHub-hosted Windows/Linux runners, upload them through S3-compatible tooling, then publish mutable update metadata only after remote completeness verification. The landing page consumes the same public manifest as the app release pipeline.

**Tech Stack:** Electron 33, electron-builder, electron-updater, TypeScript, Vue 3, Playwright, Axe, Vitest, GitHub Actions, S3-compatible RustFS, Node 22, pnpm 10.33.0

## Global Constraints

- Only the `stable` update channel exists.
- The repository must not contain credentials, certificates, API keys, or private endpoints.
- macOS ARM64 and x64 artifacts are built, signed, notarized, and staged locally.
- Windows x64 and Linux x64 immutable artifacts are built in GitHub Actions.
- A build or dry run must never overwrite `latest*.yml` or `manifest.json`.
- Local SQLite behavior, Supabase web behavior, and the protected exam editor appearance remain unchanged.
- Serious and critical Axe violations block CI.

---

### Task 1: Generic Update Feed Runtime

**Files:**
- Create: `src/main/updateFeed.ts`
- Create: `tests/main/updateFeed.test.ts`
- Modify: `src/main/index.ts`
- Modify: `electron-builder.json5`

**Interfaces:**
- Produces: `resolveUpdateFeedUrl(input: { baseUrl?: string; platform: NodeJS.Platform; arch: string }): string | null`
- Produces: `configureAutoUpdaterFeed(updater, url)` integration in `src/main/index.ts`
- Consumes: `JURA_UPDATE_URL`, defaulting to `https://downloads.jura-wolpi.de/desktop/stable`

- [ ] **Step 1: Write failing resolver tests**

Test these exact mappings:

```ts
expect(resolveUpdateFeedUrl({ platform: 'darwin', arch: 'arm64' }))
  .toBe('https://downloads.jura-wolpi.de/desktop/stable/mac/arm64')
expect(resolveUpdateFeedUrl({ platform: 'darwin', arch: 'x64' }))
  .toBe('https://downloads.jura-wolpi.de/desktop/stable/mac/x64')
expect(resolveUpdateFeedUrl({ platform: 'win32', arch: 'x64' }))
  .toBe('https://downloads.jura-wolpi.de/desktop/stable/windows/x64')
expect(resolveUpdateFeedUrl({ platform: 'linux', arch: 'x64' }))
  .toBe('https://downloads.jura-wolpi.de/desktop/stable/linux/x64')
expect(resolveUpdateFeedUrl({ platform: 'freebsd', arch: 'x64' })).toBeNull()
```

Also test trailing-slash normalization and a custom local HTTP base URL.

- [ ] **Step 2: Run the resolver test and verify RED**

Run: `corepack pnpm vitest run tests/main/updateFeed.test.ts`

Expected: FAIL because `src/main/updateFeed.ts` does not exist.

- [ ] **Step 3: Implement the resolver and wire electron-updater**

Before registering listeners or checking for updates, call:

```ts
const feedUrl = resolveUpdateFeedUrl({
  baseUrl: process.env.JURA_UPDATE_URL,
  platform: process.platform,
  arch: process.arch
})
if (!feedUrl) return
autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })
```

Retain `autoDownload = true`, explicit restart confirmation, packaged-only behavior, E2E bypass, and non-fatal error logging.

- [ ] **Step 4: Change electron-builder publish metadata**

Replace the GitHub provider with a generic provider URL and include `${version}` in macOS, Windows, and Linux artifact names. Keep DMG+ZIP, NSIS, and AppImage targets unchanged.

- [ ] **Step 5: Run focused verification**

Run: `corepack pnpm vitest run tests/main/updateFeed.test.ts tests/main/appIdentity.test.ts && corepack pnpm run typecheck`

Expected: all tests and typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/updateFeed.ts src/main/index.ts electron-builder.json5 tests/main/updateFeed.test.ts
git commit -m "feat: use hosted stable update feed"
```

### Task 2: Release Artifact and Manifest Model

**Files:**
- Create: `scripts/release/model.ts`
- Create: `scripts/release/files.ts`
- Create: `tests/release/releaseModel.test.ts`
- Modify: `tsconfig.node.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `ReleasePlatform = 'mac-arm64' | 'mac-x64' | 'windows-x64' | 'linux-x64'`
- Produces: `collectReleaseArtifacts(input): Promise<ReleaseArtifact[]>`
- Produces: `buildPublicManifest(input): ReleaseManifest`
- Produces: `rewriteUpdateMetadata(input): Promise<string>`
- Consumes: electron-builder artifacts, blockmaps, and `latest*.yml`

- [ ] **Step 1: Add tooling dependencies**

Add `tsx`, `yaml`, `@aws-sdk/client-s3`, and `@axe-core/playwright` as development dependencies. Include `scripts/**/*.ts` in `tsconfig.node.json`.

- [ ] **Step 2: Write failing artifact-model tests**

Use temporary fixture directories to assert:

- platform-specific required files are detected;
- missing ZIP/DMG/EXE/AppImage, blockmap, or update metadata fails with a platform-specific error;
- SHA-512 and byte size are calculated from file bytes;
- metadata artifact URLs become `<version>/<encoded-filename>`;
- manifest output is deterministic and contains no local filesystem path;
- duplicate platform/architecture entries are rejected.

- [ ] **Step 3: Run tests and verify RED**

Run: `corepack pnpm vitest run tests/release/releaseModel.test.ts`

Expected: FAIL because the release model does not exist.

- [ ] **Step 4: Implement pure release-model functions**

Keep filesystem discovery, hashing, YAML parsing, metadata rewriting, and manifest generation independent of S3 and environment variables. Sort platforms and files deterministically before JSON serialization.

- [ ] **Step 5: Run tests and typecheck**

Run: `corepack pnpm vitest run tests/release/releaseModel.test.ts && corepack pnpm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.node.json scripts/release tests/release/releaseModel.test.ts
git commit -m "feat: add release artifact manifest model"
```

### Task 3: RustFS Staging and Atomic Publishing

**Files:**
- Create: `scripts/release/storage.ts`
- Create: `scripts/release/config.ts`
- Create: `scripts/release-stage.ts`
- Create: `scripts/release-publish.ts`
- Create: `scripts/verify-release-feed.ts`
- Create: `tests/release/releaseStorage.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `readReleaseStorageConfig(env): ReleaseStorageConfig`
- Produces: `immutableObjectKey(platform, version, filename): string`
- Produces: `mutableMetadataKey(platform, filename): string`
- Produces: `stageRelease(input): Promise<StageResult>`
- Produces: `publishRelease(input): Promise<PublishResult>`
- Consumes: the pure artifact model from Task 2 and S3-compatible RustFS

- [ ] **Step 1: Write failing storage and safety tests**

Use an in-memory fake S3 client. Assert:

- all five required environment variables are validated without printing values;
- stage uploads only `desktop/stable/<platform>/<arch>/<version>/...`;
- stage applies immutable cache headers;
- dry run performs no write call;
- publish refuses incomplete remote platform sets or checksum mismatches;
- publish uploads all `latest*.yml` before uploading `manifest.json` last;
- confirmation text must exactly equal `publish <version>`;
- mutable metadata uses `no-cache`, while version objects use `public, max-age=31536000, immutable`.

- [ ] **Step 2: Run tests and verify RED**

Run: `corepack pnpm vitest run tests/release/releaseStorage.test.ts`

Expected: FAIL because storage tooling does not exist.

- [ ] **Step 3: Implement configuration and S3 adapter**

Construct `S3Client` with the custom endpoint, region `auto`, supplied credentials, and `forcePathStyle: true`. Never log config values. Expose narrow `put`, `head`, and `get` methods so tests can use a fake client.

- [ ] **Step 4: Implement stage, publish, and feed verification CLIs**

Supported invocations:

```bash
pnpm release:stage -- --platform mac-arm64 --input .release-stage/mac/arm64 --dry-run
pnpm release:publish -- --version 0.1.6 --confirm "publish 0.1.6"
pnpm release:verify -- --base-url https://downloads.jura-wolpi.de/desktop/stable
```

`release:verify` checks manifest JSON, all metadata files, artifact `HEAD` requests, expected content lengths, HTTPS URLs, MIME types, Range support where advertised, and cache headers.

- [ ] **Step 5: Run focused tests**

Run: `corepack pnpm vitest run tests/release/releaseStorage.test.ts tests/release/releaseModel.test.ts && corepack pnpm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/release scripts/release-stage.ts scripts/release-publish.ts scripts/verify-release-feed.ts tests/release
git commit -m "feat: stage and publish rustfs releases"
```

### Task 4: Local Signed macOS Release Build

**Files:**
- Create: `scripts/release-mac-local.ts`
- Create: `scripts/release/macos.ts`
- Create: `tests/release/macosRelease.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `validateMacReleaseEnvironment(input): Promise<void>`
- Produces: separate `.release-stage/mac/arm64` and `.release-stage/mac/x64` outputs
- Consumes: Apple API variables, Keychain signing identity or `CSC_LINK`, and Task 2 artifact validation

- [ ] **Step 1: Write failing validation tests**

Assert that local release validation:

- accepts either a discoverable Developer ID Application identity or `CSC_LINK`;
- requires Apple API key path, key ID, issuer, and team ID;
- never includes secret values in errors;
- rejects a package version that is not strict semver;
- builds arm64 and x64 into separate output directories;
- executes codesign, spctl, stapler, DMG mount validation, and architecture inspection before reporting success.

- [ ] **Step 2: Run tests and verify RED**

Run: `corepack pnpm vitest run tests/release/macosRelease.test.ts`

Expected: FAIL because macOS release tooling does not exist.

- [ ] **Step 3: Implement local build orchestration**

Run icon preparation, production build, native Electron rebuild, then two isolated electron-builder invocations:

```text
--mac --arm64 --publish never --config.directories.output=.release-stage/mac/arm64
--mac --x64 --publish never --config.directories.output=.release-stage/mac/x64
```

Validate every generated app bundle and artifact. Do not upload or publish from `release:mac:local`.

- [ ] **Step 4: Add scripts and ignored staging path**

Add `release:mac:local`, `release:stage`, `release:publish`, and `release:verify` scripts. Ignore `.release-stage/`.

- [ ] **Step 5: Run pure tests and a credential-presence audit**

Run: `corepack pnpm vitest run tests/release/macosRelease.test.ts && corepack pnpm run typecheck`

Then check only whether required local credential names or a Keychain identity are available; do not print secret values.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json scripts/release-mac-local.ts scripts/release/macos.ts tests/release/macosRelease.test.ts
git commit -m "feat: add local signed mac release build"
```

### Task 5: Website Manifest Migration

**Files:**
- Create: `docs/downloads-core.js`
- Create: `tests/website/downloads.test.ts`
- Modify: `docs/downloads.js`
- Modify: `docs/index.html`
- Modify: `README.md`

**Interfaces:**
- Produces: `selectDownload(manifest, os, arch)` and `formatDownloadLabel(asset)`
- Consumes: `https://downloads.jura-wolpi.de/desktop/stable/manifest.json`

- [ ] **Step 1: Write failing website tests**

Test Windows x64, macOS ARM64, macOS Intel, Linux x64, unknown OS, malformed manifest, missing platform, URL selection, and human-readable size. Assert the source contains neither `api.github.com` nor `browser_download_url`.

- [ ] **Step 2: Run tests and verify RED**

Run: `corepack pnpm vitest run tests/website/downloads.test.ts`

Expected: FAIL because the manifest adapter does not exist.

- [ ] **Step 3: Implement manifest-driven downloads**

Fetch the public manifest with `cache: 'no-cache'`, validate the minimum shape before updating links, preserve current OS recommendation behavior, and retain the unavailable state on failure.

- [ ] **Step 4: Update static download references**

Remove README and page links that point to `releases/latest/download`. Link the landing page or public manifest-derived download surface instead.

- [ ] **Step 5: Run tests**

Run: `corepack pnpm vitest run tests/website/downloads.test.ts tests/renderer/homeUi.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/downloads-core.js docs/downloads.js docs/index.html README.md tests/website/downloads.test.ts
git commit -m "feat: load downloads from hosted release manifest"
```

### Task 6: CI and Accessibility Gates

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `playwright.config.ts`
- Modify: `tests/e2e/app.e2e.spec.ts`
- Create: `tests/renderer/accessibilityContract.test.ts`

**Interfaces:**
- Produces: PR/main validation workflow and manual immutable Windows/Linux candidate workflow
- Consumes: `@axe-core/playwright`, release stage CLI, GitHub repository secrets

- [ ] **Step 1: Write failing CI and accessibility contract tests**

Assert workflow source includes:

- pull request and `main` triggers;
- Node 22 and pnpm 10.33.0;
- Ubuntu typecheck/test/build/web-production job;
- macOS E2E job;
- Windows main/manual packaging job;
- concurrency cancellation and Playwright artifact upload;
- no GitHub release provider or `--publish always` in the release workflow.

Assert the E2E source invokes Axe on Home, collections, library, correction, and analytics and filters violations to `serious` and `critical`.

- [ ] **Step 2: Run tests and verify RED**

Run: `corepack pnpm vitest run tests/renderer/accessibilityContract.test.ts`

Expected: FAIL because workflow and Axe gates are missing.

- [ ] **Step 3: Implement normal CI**

Use Ubuntu for install/typecheck/test/build/web build with:

```yaml
VITE_JURA_REQUIRE_AUTH: '1'
VITE_SUPABASE_URL: https://supabase.invalid
VITE_SUPABASE_ANON_KEY: ci-placeholder-anon-key
```

Use macOS for `pnpm run test:e2e`. Run Windows `pnpm run dist:dir` only on `main` or manual dispatch. Upload Playwright reports and test results on failure.

- [ ] **Step 4: Replace the GitHub release workflow**

Make it manual with a required version input. Build only Windows x64 and Linux x64, verify input equals `package.json` version, and invoke `release:stage` for immutable RustFS uploads. Do not mutate stable metadata.

- [ ] **Step 5: Add Axe scans and fix violations**

Add a helper that calls `new AxeBuilder({ page }).analyze()`, filters `serious` and `critical`, and reports rule IDs, selectors, and help URLs. Scan each required route after its UI settles. Fix violations in shared Nuxt UI configuration or page markup while preserving exam editor geometry.

- [ ] **Step 6: Run focused and E2E verification**

Run:

```bash
corepack pnpm vitest run tests/renderer/accessibilityContract.test.ts
corepack pnpm run typecheck
corepack pnpm run rebuild:native
corepack pnpm playwright test
```

Expected: all checks pass with no serious or critical Axe violations.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml playwright.config.ts tests/e2e/app.e2e.spec.ts tests/renderer/accessibilityContract.test.ts
git commit -m "ci: add release and accessibility gates"
```

### Task 7: Documentation, Packaging, and Final Verification

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/installation.md`
- Modify: `docs/ci-guidelines.md`
- Modify: `docs/user-stories.md`
- Modify: `.env.example` if present, otherwise create `.env.example` with names only

**Interfaces:**
- Produces: operator instructions for DNS/RustFS, local macOS build, staging, publishing, rollback, repository privacy, and CI secrets
- Consumes: all commands and environment names implemented in Tasks 1-6

- [ ] **Step 1: Update documentation**

Set the documented app version to `0.1.5`. Document feed layout, MIME/cache/CORS requirements, required secret names, local Keychain/Apple requirements, candidate workflow, explicit publish confirmation, rollback, and the order for making the GitHub repository private.

- [ ] **Step 2: Run source leak and stale-reference audit**

Run:

```bash
rg -n "api.github.com/repos/.*/releases|provider:\s*[\"']github|--publish always|releases/latest/download" src docs scripts electron-builder.json5 .github package.json
```

Expected: no production updater, website, or workflow reference remains. Historical design documents may be excluded explicitly.

- [ ] **Step 3: Run complete verification**

Run:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run typecheck
corepack pnpm rebuild better-sqlite3
corepack pnpm vitest run
corepack pnpm run build
VITE_JURA_REQUIRE_AUTH=1 VITE_SUPABASE_URL=https://supabase.invalid VITE_SUPABASE_ANON_KEY=ci-placeholder-anon-key corepack pnpm run build:web:production
corepack pnpm run rebuild:native
corepack pnpm playwright test
corepack pnpm run dist:dir
```

Expected: install, typecheck, all tests, both production builds, Electron E2E, accessibility scans, and packaging smoke pass.

- [ ] **Step 4: Run local signed macOS candidate build**

If the credential-presence audit passes, run `corepack pnpm release:mac:local`. Validate both architectures and report output paths, signatures, notarization, and sizes. Do not stage or publish without configured RustFS credentials and the explicit publish confirmation.

- [ ] **Step 5: Commit documentation**

```bash
git add .env.example docs/architecture.md docs/installation.md docs/ci-guidelines.md docs/user-stories.md
git commit -m "docs: document private release operations"
```

- [ ] **Step 6: Final repository audit**

Run `git diff --check`, `git status --short`, inspect the complete branch diff against `main`, and verify no generated release artifacts, credentials, or staging files are tracked.
