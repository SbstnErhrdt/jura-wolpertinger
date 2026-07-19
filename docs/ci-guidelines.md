# CI Guidelines für Agents

Diese Guideline beschreibt die für Jura Wolpertinger `0.1.7` implementierten CI- und Release-Gates. Maßgeblich sind `.github/workflows/ci.yml`, `.github/workflows/release.yml` und die Scripts in `package.json`.

## Laufzeit und Installation

GitHub Actions verwendet Node `22`, pnpm `10.33.0` und eine Installation mit unverändertem Lockfile:

```bash
corepack pnpm install --frozen-lockfile
```

`better-sqlite3` ist nativ. `pnpm test`, `test:e2e`, `dist:dir` und die Release-Build-Scripts führen den jeweils notwendigen Node- oder Electron-Rebuild aus. Bei isolierten lokalen Checks muss der passende Rebuild ausdrücklich berücksichtigt werden.

## Normale CI

`.github/workflows/ci.yml` läuft für Pull Requests, Pushes auf `main` und manuelle Starts. Concurrency bricht ältere Läufe desselben Refs ab.

### Ubuntu: Checks und Web-Build

Der Job führt aus:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run typecheck
corepack pnpm test
corepack pnpm run build
corepack pnpm run build:web:production
```

Der authentifizierte Web-Build erhält ausschließlich diese nicht produktiven CI-Testwerte:

```text
VITE_JURA_REQUIRE_AUTH=1
VITE_SUPABASE_URL=https://supabase.invalid
VITE_SUPABASE_ANON_KEY=ci-placeholder-anon-key
```

Das sind keine GitHub Secrets. Produktive Supabase-Werte dürfen nicht für den Build-Test verwendet werden.

### macOS: Electron E2E und Accessibility

Der macOS-Job führt nach der Installation aus:

```bash
corepack pnpm run test:e2e
```

Playwright testet die Electron-App. Axe-Scans decken Home, Karteikarten-Sammlungen, Bibliothek, Bewertung und Auswertung ab. Verstöße mit `serious` oder `critical` blockieren CI. Bei einem Fehler werden `playwright-report` und `test-results` als Workflow-Artefakte hochgeladen.

### Windows: Packaging-Smoke

Der Windows-Job läuft nur bei Pushes auf `main` und manuellen Workflow-Starts:

```bash
corepack pnpm run dist:dir
```

Er erzeugt ein entpacktes Electron-Builder-Verzeichnis unter `release/<version>`, aber keinen Stable-Release. Fehlgeschlagene Build-Ausgaben aus `release` und `test-results` werden als Workflow-Artefakte gesichert.

## Änderungsbasierte Pflichtmatrix

| Änderung | Mindestprüfung |
| --- | --- |
| Nur Dokumentation | `git diff --check` und dokumentierte Befehle/Variablen gegen Source prüfen |
| Shared Types, Schemas, Main oder Services | `corepack pnpm run typecheck` und fokussierte Vitest-Dateien |
| Renderer/UI | Typecheck, fokussierte Renderer-Tests, betroffene E2E-Flows |
| Editor oder Prüfungsmodus | Typecheck, relevante Unit-Tests und Electron-E2E |
| Accessibility-Markup oder gemeinsame Styles | Accessibility-Contract-Test und vollständige Axe-E2E-Scans |
| Packaging, Icons oder Native Modules | Build, `rebuild:native` und `dist:dir` auf passender Plattform |
| Release-Scripts oder Feed | Release-Unit-Tests, Typecheck und ein Dry Run; keine echten Uploads ohne Auftrag |

Agents führen den kleinsten aussagekräftigen Check zuerst aus. Nicht ausführbare Checks werden im Abschluss mit Befehl, Grund und Restrisiko genannt. Zugangsdaten, `.release-stage/`, `release/`, Playwright-Berichte und Builder-Ausgaben werden nicht committed.

## Manueller Kandidaten-Workflow

`.github/workflows/release.yml` ist kein Publish-Workflow. Er wird manuell mit dem erforderlichen String-Input `version` gestartet und besitzt nur `contents: read`. Der Input muss exakt `package.json.version` entsprechen.

Die Matrix besteht aus:

| Ziel | Runner | Build | Staging-Eingang |
| --- | --- | --- | --- |
| `windows-x64` | `windows-latest` | `corepack pnpm run release:win --x64` | `release/<version>` |
| `linux-x64` | `ubuntu-latest` | `corepack pnpm run release:linux --x64` | `release/<version>` |

Jeder Job ruft danach `release:stage` für genau seine Plattform auf. Staging prüft zuerst alle vorgesehenen Versionsobjekte und schreibt ausschließlich fehlende unveränderliche Objekte unter `desktop/stable/<plattform>/<arch>/<version>/`. Vorhandene Objekte müssen in Bytes, erforderlichen Headern und SHA-512-/Größenmetadaten übereinstimmen; eine Abweichung verhindert sämtliche Uploads des Laufs. Der Workflow schreibt keine Live-`latest*.yml`, kein `manifest.json`, keinen GitHub Release und keinen Tag. `fail-fast` ist deaktiviert; deshalb können Kandidaten einer Plattform vorhanden sein, obwohl der andere Matrix-Job fehlschlägt. Veröffentlicht werden darf erst nach erfolgreichem Staging aller vier Plattformen einschließlich der beiden lokalen macOS-Builds.

## GitHub Actions Secrets

Der manuelle Kandidaten-Workflow referenziert exakt diese Repository Secrets:

```text
JURA_SYNC_SUPABASE_ANON_KEY
UPDATE_S3_ENDPOINT
UPDATE_S3_BUCKET
UPDATE_S3_ACCESS_KEY_ID
UPDATE_S3_SECRET_ACCESS_KEY
UPDATE_PUBLIC_BASE_URL
```

`JURA_SYNC_SUPABASE_ANON_KEY` ist der öffentliche Supabase-Client-Key, der in die installierbare Desktop-App eingebettet wird. Der Release-Build bricht ohne ihn ab. Keine weiteren RustFS-Namen werden vom aktuellen Workflow gelesen. `UPDATE_PUBLIC_BASE_URL` muss eine HTTPS-URL sein. Private Secret-Werte dürfen weder in Workflow-YAML, `.env.example`, Logs noch Build-Artefakten stehen. Für RustFS sollte der Actions-Schlüssel nur Objekte unter `desktop/stable/**` schreiben und lesen dürfen.

Apple-Zugangsdaten gehören nicht in diesen Workflow. macOS wird lokal mit `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_TEAM_ID` und einer Keychain-Identität oder `CSC_LINK` gebaut.

`release:stage` für `mac-arm64` und `mac-x64` läuft ausschließlich auf macOS. Vor dem Storage-Preflight prüft es die App-Bundles aus DMG und ZIP jeweils mit Codesign, Gatekeeper, Stapler und Architekturkontrolle. Der gepackte Renderer-Startup-Smoke läuft für DMG und ZIP nur bei der auf dem aktuellen Mac nativ ausführbaren Architektur; die fremde Architektur wird statisch vollständig geprüft.

## Live-Veröffentlichung

Nur ein Operator mit lokalen RustFS-Zugangsdaten führt die Live-Schaltung aus:

```bash
corepack pnpm run release:publish --version 0.1.7 --confirm "publish 0.1.7"
```

Ohne die exakte Bestätigung verweigert das Skript den Vorgang. Pro Plattform werden versionierte YAML, Artefakte und Blockmaps remote gelesen und anhand von Version, Größe, SHA-512 und Cache Header validiert. Erst danach wird das Live-`latest*.yml` dieser Plattform geschrieben. Die Reihenfolge ist `mac-arm64`, `mac-x64`, `windows-x64`, `linux-x64`; `manifest.json` folgt zuletzt.

Diese Garantie ist plattformweise, nicht global transaktional. Ein später Fehler rollt bereits geschriebene Plattform-Metadaten nicht zurück. Nach Behebung wird derselbe Publish-Befehl wiederholt oder eine vollständig gestagte ältere Version mit ihrer exakten Bestätigung publiziert.

Nach Publish oder Rollback ist verpflichtend:

```bash
corepack pnpm run release:verify --base-url https://downloads.jura-wolpi.de/desktop/stable
```

## Merge- und Release-Kriterien

Ein PR oder Release ist blockiert, wenn:

- Typecheck, Vitest, Build oder ein erforderlicher Plattformjob fehlschlägt.
- ein Axe-Befund der Schwere `serious` oder `critical` offen ist.
- native Änderungen ohne passenden Rebuild oder Packaging-Smoke bleiben.
- Release-Metadaten unvollständig sind oder nicht auf das eigene Versionsverzeichnis zeigen.
- Feed-Objekte falsche MIME- oder Cache Header liefern.
- ein produktiver Pfad noch die GitHub-Releases-API, den GitHub-Updater-Provider, `--publish always` oder `releases/latest/download` verwendet.
- Credentials oder generierte Kandidaten im Git-Diff auftauchen.

## Release-Audit

Der stale-reference-Audit darf historische Spezifikationen und Pläne als Dokumentation früherer Beispiele ausnehmen, muss aber produktiven Code, aktive Doku, Scripts und Workflows prüfen:

```bash
rg -n "api.github.com/repos/.*/releases|provider:\s*[\"']github|--publish always|releases/latest/download" src docs scripts electron-builder.json5 .github package.json
```

Treffer in aktiven Dateien müssen vor dem privaten Repositorybetrieb entfernt werden. Abschließend `git diff --check`, `git status --short` und den Branch-Diff gegen `main` prüfen; keine Release-Artefakte, Credentials oder Staging-Dateien dürfen verfolgt sein.
