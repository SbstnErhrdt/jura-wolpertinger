# Release-Härtung und eigener Stable-Updatekanal

## Ziel

Jura Wolpertinger erhält eine reproduzierbare CI, automatisierte Accessibility-Prüfungen und einen von öffentlichen GitHub-Releases unabhängigen Updatekanal. Das Repository kann danach privat betrieben werden. Windows- und Linux-Artefakte werden in GitHub Actions gebaut; signierte und notarisierte macOS-Artefakte werden lokal mit den vorhandenen Apple-Zugangsdaten gebaut. Veröffentlicht wird ausschließlich über einen stabilen HTTPS-Feed auf dem eigenen S3-kompatiblen RustFS-Speicher.

## Abgrenzung

- Es gibt nur den Kanal `stable`; ein Beta-Kanal wird nicht angelegt.
- Das Vorhaben veröffentlicht noch keinen Release-Tag und schaltet keinen ungetesteten Build live.
- Apple- und Windows-Zertifikate werden nicht im Repository gespeichert.
- Die bestehende lokale SQLite- und die Supabase-Webversion bleiben fachlich unverändert.
- Signierung wird technisch vorbereitet und für macOS lokal ausgeführt. Windows-Signierung bleibt optional, bis ein Zertifikat vorhanden ist.

## Update-Feed

Die App verwendet weiterhin `electron-updater`, wechselt aber vom GitHub-Provider zum generischen HTTPS-Provider. Der Feed wird zur Laufzeit anhand von Plattform und Architektur gewählt, damit macOS ARM64 und Intel getrennte `latest-mac.yml` verwenden können.

```text
https://downloads.jura-wolpi.de/desktop/stable/
├── manifest.json
├── mac/
│   ├── arm64/
│   │   ├── latest-mac.yml
│   │   └── 0.1.6/...
│   └── x64/
│       ├── latest-mac.yml
│       └── 0.1.6/...
├── windows/x64/
│   ├── latest.yml
│   └── 0.1.6/...
└── linux/x64/
    ├── latest-linux.yml
    └── 0.1.6/...
```

Versionsverzeichnisse sind unveränderlich. Die `latest*.yml`-Dateien referenzieren Artefakte relativ im jeweiligen Versionsverzeichnis. `manifest.json` enthält Version, Veröffentlichungszeitpunkt, Plattform, Architektur, Dateiname, Größe, SHA-512 und öffentliche Download-URL und ist die einzige Datenquelle der Downloadseite.

Die App verwendet standardmäßig `https://downloads.jura-wolpi.de/desktop/stable`. Für Tests kann `JURA_UPDATE_URL` den Basisendpunkt überschreiben. Feed- oder Netzwerkfehler blockieren den App-Start nicht. Ein Update wird weiter automatisch heruntergeladen, aber erst nach einer bewussten Neustartbestätigung installiert.

## Veröffentlichung und Atomarität

Build und Veröffentlichung sind getrennt:

1. Windows und Linux werden per manuellem GitHub-Workflow für die Version aus `package.json` gebaut und in unveränderliche RustFS-Versionspfade hochgeladen.
2. macOS ARM64 und Intel werden lokal gebaut, signiert und notarisiert.
3. `release:stage` prüft lokal Signatur, Notarisierung, Artefaktnamen, Blockmaps, Metadaten und Prüfsummen und lädt die unveränderlichen macOS-Versionsdateien hoch.
4. `release:publish` liest alle vier Remote-Plattformverzeichnisse zurück und verweigert die Veröffentlichung, wenn ein Artefakt, eine Prüfsumme oder eine erwartete Architektur fehlt.
5. Erst danach werden `latest*.yml` und zuletzt `manifest.json` hochgeladen. Dadurch zeigt die Website niemals auf einen unvollständigen Release.

`release:publish` verlangt eine explizite Bestätigung mit der exakten Version. Ein normaler Build oder Stage-Befehl verändert den Live-Feed nicht. Rollback veröffentlicht erneut die Metadaten und das Manifest einer bereits vorhandenen älteren Version; bereits installierte neuere Apps werden nicht automatisch herabgestuft.

## Lokaler macOS-Build

`pnpm release:mac:local` baut ARM64 und Intel mit den lokal vorhandenen `CSC_*`- und Apple-Notarisierungsvariablen. Zugangsdaten dürfen aus lokaler Shell, Keychain oder ignorierter Env-Datei kommen und werden nie ausgegeben oder committed.

Der lokale Smoke umfasst:

- `codesign --verify --deep --strict`
- `spctl --assess`
- `xcrun stapler validate`
- DMG-Mount und Prüfung des App-Bundles
- Start-Smoke für die auf dem aktuellen Mac ausführbare Architektur
- statische Architekturprüfung für beide App-Bundles

Fehlende Credentials oder ein fehlgeschlagener Apple-Schritt brechen den Release-Build ab. Ein unsigniertes Artefakt darf nicht in den Stable-Feed gelangen.

## RustFS und Secrets

RustFS wird über die S3-kompatible API angesprochen. Der öffentliche Downloadpfad ist ausschließlich lesbar; Schreibzugang besteht nur lokal und in GitHub Actions.

```text
UPDATE_S3_ENDPOINT
UPDATE_S3_BUCKET
UPDATE_S3_ACCESS_KEY_ID
UPDATE_S3_SECRET_ACCESS_KEY
UPDATE_PUBLIC_BASE_URL
```

Die Upload-Skripte protokollieren Dateinamen, Version und Zielpfad, aber keine Credentials. CORS erlaubt der Downloadseite ausschließlich lesende `GET`- und `HEAD`-Anfragen. HTTPS, korrekte MIME-Typen, Range Requests und Cache Header werden in einem Feed-Smoke geprüft. Versionsdateien erhalten immutable Cache Header; `latest*.yml` und `manifest.json` kurze oder revalidierende Cache Header.

## CI

Ein neuer Workflow läuft bei Pull Requests, Pushes auf `main` und manuell:

- Ubuntu: Installation mit pnpm 10.33.0 und Node 22, Typecheck, vollständige Vitest-Suite, Electron-Build und authentifizierter Supabase-Webbuild mit nicht geheimen CI-Testwerten.
- macOS: vollständiger Electron-Playwright-E2E-Test bei Pull Requests und auf `main`.
- Windows: `dist:dir` Packaging-Smoke nur auf `main` und bei manueller Ausführung.
- Fehlgeschlagene Playwright-Berichte und relevante Builder-Logs werden als CI-Artefakte hochgeladen.
- Concurrency bricht veraltete Runs desselben Branches ab.

Der Release-Workflow veröffentlicht keine GitHub-Releases mehr. Sein manueller Windows-/Linux-Kandidatenlauf lädt ausschließlich unveränderliche Versionsartefakte zu RustFS; das Umschalten des Stable-Feeds bleibt der explizite lokale Finalisierungsschritt.

## Accessibility

`@axe-core/playwright` prüft mindestens Home, Karteikarten-Sammlungen, Bibliothek, Bewertung und Auswertung. Verstöße der Schweregrade `serious` und `critical` blockieren CI. Zusätzlich bleiben gezielte Regressionstests für Navigation, Breadcrumbs, sichtbaren Tastaturfokus, Dialogbeschriftungen und eindeutige Namen bestehen.

Gefundene Verstöße werden an den gemeinsamen Nuxt-UI-Komponenten oder zentralen Styles behoben. Die geschützte Prüfungsansicht wird nur verändert, wenn ein konkreter Accessibility-Verstoß dies erfordert und ihre bestehende Geometrie und Erscheinung erhalten bleibt.

## Website

`docs/downloads.js` verwendet nicht mehr die GitHub-Releases-API, sondern `manifest.json`. Betriebssystemerkennung und Empfehlung bleiben erhalten. Bei nicht erreichbarem Feed zeigt jede Downloadkarte einen verständlichen Fehlerzustand und keine veraltete GitHub-URL.

README, Installationsdokumentation, Architektur und CI-Dokumentation werden auf Version `0.1.5`, den privaten Repositorybetrieb, den Stable-Feed und den lokalen macOS-Releaseprozess aktualisiert.

## Tests und Erfolgskriterien

- Feed-URL-Auflösung ist für macOS ARM64/Intel, Windows x64 und Linux x64 unit-getestet.
- Staging- und Manifest-Skripte werden mit temporären Artefaktverzeichnissen getestet, ohne Netzwerkzugriff oder echte Secrets.
- Ein lokaler HTTP-Testserver validiert `electron-updater`-Metadaten, relative Artefaktpfade und Fehlerverhalten.
- Website-Manifestparsing und Plattformauswahl sind getestet.
- Typecheck, vollständige Tests, Produktionsbuild, Supabase-Webbuild, Electron-E2E und lokaler macOS-Packaging-Smoke sind grün.
- Kein produktiver Code und keine Downloadseite referenziert danach die GitHub-Releases-API oder den GitHub-Updater-Provider.
- Ein Dry Run kann niemals `latest*.yml` oder `manifest.json` überschreiben.
