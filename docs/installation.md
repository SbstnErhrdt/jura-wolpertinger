# Installation und Distribution

Diese Anleitung gilt für Jura Wolpertinger `0.1.7`. Öffentliche Desktop-Builds kommen ausschließlich aus dem eigenen Stable-Feed. Ein öffentliches GitHub-Repository oder GitHub Release ist für Download und Updates nicht erforderlich.

## Download und Installation

Die Projektseite liest `https://downloads.jura-wolpi.de/desktop/stable/manifest.json` und bietet den passenden Download an. Bei einem nicht erreichbaren oder ungültigen Manifest bleibt der Download deaktiviert; es gibt keinen veralteten GitHub-Ersatzlink.

### Windows x64

1. `Jura Wolpertinger-0.1.7-x64-win.exe` herunterladen und starten.
2. Dem Installationsdialog folgen.
3. Die App über Startmenü oder Desktop-Verknüpfung öffnen.

Windows-Builds sind derzeit nicht produktiv signiert. SmartScreen kann deshalb warnen. Für eine spätere produktive Signierung ist ein vertrauenswürdiges Authenticode-Zertifikat oder Microsoft Trusted Signing erforderlich.

### macOS

Für Apple Silicon `Jura Wolpertinger-0.1.7-arm64-mac.dmg`, für Intel-Macs `Jura Wolpertinger-0.1.7-x64-mac.dmg` herunterladen. Die DMG öffnen, `Jura Wolpertinger.app` nach `Programme` ziehen und dort starten. Stable-macOS-Builds müssen mit einer Developer-ID signiert, von Apple notarisiert und mit dem Notarisierungsticket versehen sein.

### Linux x64

`Jura Wolpertinger-0.1.7-x64-linux.AppImage` herunterladen und ausführen:

```bash
chmod +x "Jura Wolpertinger-0.1.7-x64-linux.AppImage"
./Jura\ Wolpertinger-0.1.7-x64-linux.AppImage
```

Linux AppImages sind derzeit nicht mit GPG signiert. Größe und SHA-512 stehen im Stable-Manifest und in den Update-Metadaten.

## Updateverhalten

Gepackte Desktop-Apps prüfen nach dem Start den Stable-Feed für ihre Plattform und Architektur. `JURA_UPDATE_URL` überschreibt den Standardendpunkt nur für Tests. Ein Update wird automatisch heruntergeladen, aber nicht beim normalen Beenden installiert. Erst `Jetzt neu starten` installiert es; `Später` lässt die App weiterlaufen. Feed- und Netzwerkfehler blockieren den Start nicht.

## RustFS und DNS einrichten

`downloads.jura-wolpi.de` muss per DNS auf den öffentlichen RustFS-Endpunkt oder dessen HTTPS-Reverse-Proxy zeigen. Vor dem ersten Release gelten folgende Betriebsanforderungen:

- Gültiges TLS-Zertifikat für `downloads.jura-wolpi.de`; öffentliche URLs und `UPDATE_PUBLIC_BASE_URL` verwenden HTTPS.
- Anonymer Zugriff nur lesend auf `desktop/stable/**`; kein öffentliches Schreiben, Löschen oder Bucket-Listing.
- Schreibzugriff nur über getrennte RustFS-Zugangsdaten für lokale Operatoren und GitHub Actions.
- `GET` und `HEAD` müssen funktionieren. Byte-Range-Anfragen dürfen als `Accept-Ranges: bytes` angekündigt werden, müssen dann aber `Range: bytes=0-0` mit HTTP `206` beantworten.
- CORS erlaubt der aktuellen Projektseiten-Origin `https://sbstnerhrdt.github.io` sowie einer später ausdrücklich freigegebenen Ersatz-Origin `GET` und `HEAD` auf Manifest, YAML und Artefakte. Mindestens `Content-Type`, `Content-Length`, `Cache-Control` und `Accept-Ranges` müssen für Browser lesbar sein. Schreibmethoden werden nicht freigegeben.

Die Upload-Skripte setzen diese MIME-Typen:

| Datei | `Content-Type` |
| --- | --- |
| `manifest.json` | `application/json; charset=utf-8` |
| `latest*.yml` | `application/x-yaml; charset=utf-8` |
| ZIP | `application/zip` |
| DMG | `application/x-apple-diskimage` |
| EXE | `application/vnd.microsoft.portable-executable` |
| AppImage und Blockmap | `application/octet-stream` |

RustFS oder ein vorgeschalteter Proxy darf diese Werte nicht durch `text/html` ersetzen. Die exakten Cache Header sind:

- Versionsobjekte: `public, max-age=31536000, immutable`
- Live-`latest*.yml` und `manifest.json`: `no-cache`

## Release-Zugangsdaten

`.env.example` enthält ausschließlich unterstützte Variablennamen mit leeren Platzhaltern. Echte Werte gehören in die lokale Shell, eine ignorierte lokale Env-Datei, die macOS Keychain oder GitHub Actions Secrets und niemals in Git. Die Release-CLIs laden keine Env-Datei selbst; eine lokale Datei muss vor dem Aufruf in die Shell exportiert werden, beispielsweise mit `set -a; source .env.release; set +a`.

Für alle Stage-, Publish- und RustFS-Zugriffe sind exakt diese fünf Variablen erforderlich:

```text
UPDATE_S3_ENDPOINT
UPDATE_S3_BUCKET
UPDATE_S3_ACCESS_KEY_ID
UPDATE_S3_SECRET_ACCESS_KEY
UPDATE_PUBLIC_BASE_URL
```

`UPDATE_PUBLIC_BASE_URL` ist der Feed-Basisendpunkt ohne Objektpfad dahinter, produktiv also `https://downloads.jura-wolpi.de/desktop/stable`. Der S3-Client nutzt den konfigurierten Endpunkt mit Region `auto` und Path-Style-Zugriff. Im manuellen GitHub-Release-Workflow müssen alle fünf Namen als Repository Secrets angelegt sein. Vor einem Stage-Upload werden immer alle vorgesehenen Versionsobjekte geprüft. Fehlende Objekte werden mit `If-None-Match: *` hochgeladen und können daher auch bei einem konkurrierenden Lauf kein inzwischen angelegtes Objekt überschreiben. Ein Konflikt wird erneut vollständig geprüft. Vorhandene Objekte werden nur akzeptiert, wenn Bytes, MIME-Typ, immutable Cache Header sowie SHA-512- und Größenmetadaten übereinstimmen. Schon eine Abweichung beendet den Lauf ohne weiteren Upload.

## Release-Ablauf für `0.1.7`

### 1. Ausgangslage prüfen

Der Branch enthält die freizugebende Version und `package.json` meldet exakt `0.1.7`. Vor dem Staging müssen die vorgesehenen Tests und Builds erfolgreich sein. Ein Stage-Befehl lädt nur unveränderliche Kandidaten hoch; ein normaler Build und `--dry-run` schreiben keine Live-Metadaten.

### 2. Windows und Linux in CI stagen

Den Workflow `.github/workflows/release.yml` manuell mit dem Input `version` = `0.1.7` starten. Die Matrix:

- baut Windows x64 mit `corepack pnpm run release:win --x64` und staged aus `release/0.1.7`;
- baut Linux x64 mit `corepack pnpm run release:linux --x64` und staged aus `release/0.1.7`;
- bricht ab, wenn der Workflow-Input nicht exakt `package.json.version` entspricht;
- lädt nur `desktop/stable/<plattform>/<arch>/0.1.7/**` hoch und verändert weder `latest*.yml` noch `manifest.json`.

Beide Matrix-Jobs müssen erfolgreich sein. Ein einzelner erfolgreicher Job ist nur ein unvollständiger, noch nicht live geschalteter Kandidat.

### 3. macOS lokal bauen und prüfen

Voraussetzungen sind macOS, installierte Projektabhängigkeiten, Xcode-Werkzeuge und eine `Developer ID Application`-Identität in der Keychain oder `CSC_LINK`. Zusätzlich verlangt das Skript exakt:

```text
APPLE_API_KEY
APPLE_API_KEY_ID
APPLE_API_ISSUER
APPLE_TEAM_ID
```

`APPLE_API_KEY` muss auf eine vorhandene Apple-API-Schlüsseldatei zeigen. Das Skript gibt keine Zugangswerte aus. Dann ausführen:

```bash
corepack pnpm run release:mac:local
```

Der Befehl leert nur die beiden lokalen Ausgabeordner, baut gemeinsame App-Ressourcen, führt den nativen Electron-Rebuild aus und erzeugt nacheinander:

```text
.release-stage/mac/arm64
.release-stage/mac/x64
```

Für jede Architektur validiert er erforderliche DMG-, ZIP-, Blockmap- und YAML-Dateien. Er mountet die DMG, entpackt die ZIP und prüft beide App-Bundles mit `codesign --verify --deep --strict`, `spctl --assess`, `xcrun stapler validate` und `lipo -archs`. DMG- und ZIP-App der auf dem aktuellen Mac nativ ausführbaren Architektur werden zusätzlich mit `JURA_RELEASE_SMOKE=1` gestartet und müssen nach dem Laden des Haupt-Renderers `JURA_RELEASE_SMOKE_READY` ausgeben und erfolgreich enden. Die fremde Architektur bleibt bei der vollständigen statischen Prüfung. Der Befehl lädt nichts hoch.

### 4. macOS unveränderlich stagen

Optional zuerst ohne Schreibzugriff die lokalen Dateien und Zielschlüssel prüfen:

```bash
corepack pnpm run release:stage --platform mac-arm64 --input .release-stage/mac/arm64 --dry-run
corepack pnpm run release:stage --platform mac-x64 --input .release-stage/mac/x64 --dry-run
```

Danach mit gesetzten `UPDATE_*`-Variablen stagen:

```bash
corepack pnpm run release:stage --platform mac-arm64 --input .release-stage/mac/arm64
corepack pnpm run release:stage --platform mac-x64 --input .release-stage/mac/x64
```

Auch `release:stage` selbst führt für macOS beide App-Bundle-Prüfungen und den Startup-Smoke erneut aus, bevor es den Storage-Preflight beginnt. macOS-Staging wird auf anderen Betriebssystemen abgelehnt. Eine identische Wiederholung ist idempotent und überschreibt keine vorhandenen Versionsobjekte.

### 5. Stable explizit veröffentlichen

Erst wenn alle vier Kandidaten vollständig gestaged sind:

```bash
corepack pnpm run release:publish --version 0.1.7 --confirm "publish 0.1.7"
```

Die Bestätigung muss exakt `publish 0.1.7` lauten. Der Publisher validiert jede Plattform vollständig, bevor er deren Live-YAML schreibt, und veröffentlicht `manifest.json` zuletzt. Die Reihenfolge ist macOS ARM64, macOS x64, Windows x64, Linux x64, globales Manifest.

Die Atomarität gilt pro Plattform. Scheitert beispielsweise Windows, können die beiden macOS-Metadateien bereits auf `0.1.7` zeigen, während Windows, Linux und das Manifest noch die vorherige Version zeigen. Ursache beheben und denselben Publish-Befehl wiederholen; er validiert und schreibt deterministisch erneut. Nicht versuchen, einzelne Live-Dateien manuell zu mischen.

### 6. Öffentlichen Feed verifizieren

```bash
corepack pnpm run release:verify --base-url https://downloads.jura-wolpi.de/desktop/stable
```

Der Check verlangt im Manifest exakt vier eindeutige Ziele: macOS ARM64, macOS x64, Windows x64 und Linux x64. Jeder Eintrag muss dieselbe Manifest-Version tragen und unter dem vorgesehenen Plattform-, Architektur- und Versionspfad des angegebenen Basisendpunkts liegen. Danach liest der Check alle vier Live-YAMLs und prüft HTTPS-URLs, öffentliche Artefakt-`HEAD`-Antworten, Größen, die artefaktspezifischen MIME-Typen aus der Tabelle, Cache Header sowie angekündigte Byte Ranges. Erst nach diesem erfolgreichen Check den Release als abgeschlossen melden.

## Rollback

Ein Rollback schaltet eine vollständig erhaltene, bereits gestagte ältere Version wieder live. Es löscht keine Objekte und stuft bereits installierte neuere Apps nicht automatisch herunter.

```bash
corepack pnpm run release:publish --version 0.1.4 --confirm "publish 0.1.4"
corepack pnpm run release:verify --base-url https://downloads.jura-wolpi.de/desktop/stable
```

Auch der Rollback ist plattformweise atomar und schreibt das Manifest zuletzt. Fehlt ein älteres Objekt oder stimmt eine Prüfsumme nicht, verweigert der Publisher die betroffene Plattform; zuerst den unveränderlichen Kandidaten wiederherstellen, dann den Rollback erneut ausführen.

## Repository privat schalten

Die Umstellung erfolgt erst nach einem vollständig verifizierten Stable-Release in dieser Reihenfolge:

1. Bestätigen, dass App-Updater, Downloadseite und Dokumentation keine produktiven GitHub-Release-URLs mehr verwenden.
2. DNS, TLS, RustFS Public-Read, MIME, Cache, CORS und Range Requests mit `release:verify` prüfen.
3. Die fünf `UPDATE_*` Repository Secrets setzen und einen manuellen Windows-/Linux-Kandidatenlauf erfolgreich abschließen.
4. Lokalen signierten/notarisierten macOS-Build, Staging, expliziten Publish und Feed-Verifikation erfolgreich abschließen.
5. Sicherstellen, dass die öffentliche Projektseite aus einem privaten Repository weiter deployt werden darf; andernfalls ihr Hosting vor der Privacy-Änderung migrieren.
6. Benötigte Maintainer- und Actions-Zugriffe, Branch-Regeln und Secrets prüfen, dann erst die Repository-Sichtbarkeit auf privat ändern.
7. Nach der Umstellung normale CI, den manuellen Kandidaten-Workflow, die Projektseite, einen frischen Download und den Stable-Feed erneut prüfen.

Das Repository wird nicht vorgezogen privat geschaltet, solange Website-Hosting oder Release-Automation noch implizit öffentlichen Repository-Zugriff voraussetzen.
