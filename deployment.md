# Deployment

Diese Datei beschreibt den operativen Deployment-Prozess fuer Jura Wolpertinger. Sie ergaenzt `docs/releases.md`, `docs/installation.md` und `docs/ci-guidelines.md` mit den konkreten Schritten, die beim aktuellen Setup verwendet werden.

## Grundsaetze

- Produktive Desktop-Releases laufen ueber `https://downloads.jura-wolpi.de/desktop/stable`, nicht ueber GitHub Releases.
- Versionsobjekte unter `desktop/stable/<plattform>/<arch>/<version>/` sind immutable. Wenn ein Kandidat fuer eine Version bereits abweichend existiert, wird nicht ueberschrieben, sondern die App-Version erhoeht.
- Live geschaltet werden nur mutable Metadaten: `latest*.yml` je Plattform und zuletzt `manifest.json`.
- Die Downloadseite liest das Live-Manifest dynamisch. Statische Platzhalter im HTML sind normal, solange `/js/downloads.js` das Manifest laedt.
- Secrets werden nie in Git, Markdown oder Logs geschrieben. Dokumentiert werden nur Variablennamen.

## Repositories und Server

Lokale Pfade:

```text
/Users/sbstn/Documents/erhardt/repositories/jura-klausuren-wolpertinger/jura-klausuren-wolpertinger
/Users/sbstn/Documents/erhardt/repositories/jura-klausuren-wolpertinger/jura-supabase
/Users/sbstn/Documents/erhardt/repositories/jura-klausuren-wolpertinger/jura-voice-api
```

Produktiver Server:

```text
ssh server.02
/home/docker-compose/jura-wolpi
/home/docker-compose/jura-supabase-wolpi
```

Domains:

```text
https://jura-wolpi.de
https://app.jura-wolpi.de
https://downloads.jura-wolpi.de/desktop/stable
```

## Vor jedem Deploy

```bash
git status --short --branch
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm run typecheck
```

Je nach Aenderung zusaetzlich:

```bash
pnpm test
pnpm run test:e2e
```

Bei reinen Dokumentationsaenderungen reichen Markdown-/Link-Sanity und `git diff --check`.

## Web-App deployen

Die Web-App wird statisch gebaut und auf `server.02` unter `/home/docker-compose/jura-wolpi/app` ausgeliefert. Die App muss mit der produktiven Supabase-Konfiguration gebaut werden.

1. Produktive Supabase-Werte bereitstellen, ohne sie auszugeben:

```bash
export VITE_SUPABASE_URL="https://app.jura-wolpi.de/api"
export VITE_SUPABASE_ANON_KEY="<aus sicherer Quelle>"
```

2. Build ausfuehren:

```bash
pnpm run build:web:production
```

3. Build-Dateien auf den Server synchronisieren:

```bash
rsync -az --delete out/renderer/ server.02:/home/docker-compose/jura-wolpi/app/
```

4. Nginx/Container pruefen oder neu laden, wenn Konfiguration geaendert wurde:

```bash
ssh server.02 'cd /home/docker-compose/jura-wolpi && docker compose ps'
ssh server.02 'cd /home/docker-compose/jura-wolpi && docker compose up -d nginx'
```

5. Oeffentlich pruefen:

```bash
curl -fsS https://app.jura-wolpi.de/ >/dev/null
curl -I -fsS https://app.jura-wolpi.de/
```

## Website deployen

Die Website liegt im Hugo-Projekt `website/`; der statische Output wird unter `docs/` erzeugt und auf `server.02` unter `/home/docker-compose/jura-wolpi/site` ausgeliefert.

1. Hugo-Seite bauen:

```bash
hugo --source website --destination ../docs --cleanDestinationDir --minify
```

2. Website lokal kurz pruefen:

```bash
rg -n "Jura Wolpertinger|Download|Karteikarten" docs/index.html docs/installation.html docs/download/index.html
```

3. Auf den Server synchronisieren:

```bash
rsync -az --delete docs/ server.02:/home/docker-compose/jura-wolpi/site/
```

4. Oeffentlich pruefen:

```bash
curl -fsS https://jura-wolpi.de/ >/dev/null
curl -fsS https://jura-wolpi.de/download/ >/dev/null
curl -fsS https://jura-wolpi.de/js/downloads.js | rg "manifest|downloads"
```

## Desktop-Release deployen

Der Standardweg ist GitHub Actions. Der Workflow `.github/workflows/release.yml` baut und staged alle vier Kandidaten:

- macOS ARM64
- macOS x64
- Windows x64
- Linux x64

### Version setzen

Vor einem neuen Desktop-Release muss die Version in diesen Dateien konsistent sein:

```text
package.json
src/shared/constants.ts
docs/installation.md
docs/releases.md
docs/ci-guidelines.md
docs/architecture.md
```

Wenn fuer die Zielversion bereits abweichende immutable Objekte existieren, Version erhoehen. Nicht loeschen oder ueberschreiben.

### Release-Workflow starten

```bash
gh workflow run Release --repo SbstnErhrdt/jura-wolpertinger --ref main -f version=<version>
gh run list --repo SbstnErhrdt/jura-wolpertinger --workflow Release --limit 5
```

Den Run beobachten:

```bash
gh run view <run-id> --repo SbstnErhrdt/jura-wolpertinger --json status,conclusion,jobs
```

Erst wenn alle vier Matrix-Jobs erfolgreich sind, ist der Release-Kandidat vollstaendig gestaged.

### Stable live schalten

Fuer Publish werden diese Variablen benoetigt:

```text
UPDATE_S3_ENDPOINT
UPDATE_S3_BUCKET
UPDATE_S3_ACCESS_KEY_ID
UPDATE_S3_SECRET_ACCESS_KEY
UPDATE_PUBLIC_BASE_URL
```

Produktive Werte muessen aus einer sicheren Quelle in die Shell geladen werden. Beispiel fuer das aktuelle Setup:

```bash
export UPDATE_S3_ENDPOINT="https://app.jura-wolpi.de/storage/v1/s3"
export UPDATE_S3_BUCKET="stub"
export UPDATE_PUBLIC_BASE_URL="https://downloads.jura-wolpi.de/desktop/stable"
export UPDATE_S3_ACCESS_KEY_ID="<aus sicherer Quelle>"
export UPDATE_S3_SECRET_ACCESS_KEY="<aus sicherer Quelle>"
```

Dann:

```bash
pnpm run release:publish --version <version> --confirm "publish <version>"
```

Der Publisher validiert alle vier Plattformen remote, schreibt die Plattform-Metadaten und danach `manifest.json`.

### Stable verifizieren

```bash
pnpm run release:verify --base-url https://downloads.jura-wolpi.de/desktop/stable
curl -fsS https://downloads.jura-wolpi.de/desktop/stable/manifest.json | jq -r '.version, (.releases[] | "\(.platform)/\(.arch): \(.fileName)")'
```

macOS-Downloads separat pruefen:

```bash
curl -I -fsS "https://downloads.jura-wolpi.de/desktop/stable/mac/arm64/<version>/Jura%20Wolpertinger-<version>-arm64-mac.dmg"
curl -I -fsS "https://downloads.jura-wolpi.de/desktop/stable/mac/x64/<version>/Jura%20Wolpertinger-<version>-x64-mac.dmg"
curl -fsS https://downloads.jura-wolpi.de/desktop/stable/mac/arm64/latest-mac.yml
curl -fsS https://downloads.jura-wolpi.de/desktop/stable/mac/x64/latest-mac.yml
```

Erwartet sind unter anderem:

- `HTTP/2 200`
- `accept-ranges: bytes`
- DMG: `content-type: application/x-apple-diskimage`
- Versionsobjekte: `cache-control: public, max-age=31536000, immutable`
- `latest*.yml` und `manifest.json` zeigen auf dieselbe Version

## Supabase-Schema deployen

Schema-Aenderungen liegen im Repo `jura-supabase`. Vor produktivem Apply lokal testen.

```bash
cd /Users/sbstn/Documents/erhardt/repositories/jura-klausuren-wolpertinger/jura-supabase
./scripts/apply-local-sql.sh
./scripts/test-sql.sh
```

Produktiv nur gezielt anwenden:

```bash
ssh server.02 'cd /home/docker-compose/jura-supabase-wolpi && docker compose ps'
ssh server.02 'docker exec -i jura-supabase-db psql -U postgres -d postgres' < sql/app/<migration>.sql
```

Danach produktive SQL-Tests mit Rollback laufen lassen, wenn vorhanden.

## Voice API deployen

Voice-API-Code liegt in `jura-voice-api` und wird auf `server.02` unter `/home/docker-compose/jura-wolpi/voice-api` betrieben.

```bash
cd /Users/sbstn/Documents/erhardt/repositories/jura-klausuren-wolpertinger/jura-voice-api
pnpm test
rsync -az --delete --exclude node_modules --exclude .git ./ server.02:/home/docker-compose/jura-wolpi/voice-api/
ssh server.02 'cd /home/docker-compose/jura-wolpi && docker compose up -d --build voice-api'
ssh server.02 'cd /home/docker-compose/jura-wolpi && docker compose logs --tail=100 voice-api'
```

Oeffentliche Requests laufen ueber `https://app.jura-wolpi.de/voice/...`.

## Nach jedem Deploy

Mindestens pruefen:

```bash
curl -fsS https://jura-wolpi.de/ >/dev/null
curl -fsS https://app.jura-wolpi.de/ >/dev/null
pnpm run release:verify --base-url https://downloads.jura-wolpi.de/desktop/stable
git status --short --branch
```

Bei App-Deploys zusaetzlich einen Browser-Smoke fuer Login, Karteikarten und Pruefungen machen. Bei Desktop-Releases pruefen, dass `manifest.json` die erwartete Version nennt und die Downloadseite die Links aus dem Manifest liest.

## Fehlerbilder

### Immutable mismatch

Beispiel:

```text
Immutable content length mismatch for .../0.1.7/...
```

Bedeutung: Ein Objekt fuer diese Version existiert bereits mit anderen Bytes. Nicht ueberschreiben. Version erhoehen und neu stagen.

### Downloadseite zeigt HTML-Placeholder

Das ist normal, solange das JavaScript live das Manifest laedt. Pruefen:

```bash
curl -fsS https://jura-wolpi.de/js/downloads.js | rg "manifest|downloads"
curl -fsS https://downloads.jura-wolpi.de/desktop/stable/manifest.json | jq -r '.version'
```

### Publish mit `Unknown argument: --`

Die Release-Skripte akzeptieren keinen zusaetzlichen pnpm-Separator. Richtig:

```bash
pnpm run release:publish --version <version> --confirm "publish <version>"
```

Nicht:

```bash
pnpm run release:publish -- --version <version> --confirm "publish <version>"
```

