# Releases

Jura Wolpertinger verteilt Desktop-Releases und Auto-Updates ausschließlich über den eigenen Stable-Feed unter `https://downloads.jura-wolpi.de/desktop/stable`. GitHub Releases sind weder Download- noch Update-Kanal. Die Nutzerinstallation ist in [installation.md](installation.md) beschrieben.

## Kandidaten erstellen

1. Version in `package.json` setzen und die vollständige Verifikationsmatrix ausführen.
2. Den manuellen Workflow `.github/workflows/release.yml` mit derselben Version starten. Er baut und staged Windows x64 sowie Linux x64, veröffentlicht aber keine Live-Metadaten.
3. macOS ARM64 und x64 lokal mit `corepack pnpm run release:mac:local` Developer-ID-signieren, notarisieren und prüfen.
4. Beide macOS-Kandidaten mit `release:stage` unveränderlich in RustFS ablegen.

Normale lokale Pakete ohne Veröffentlichung entstehen mit:

```bash
corepack pnpm run dist
```

## Stable veröffentlichen

Erst nach vollständigem Staging aller vier Plattformen darf ein Operator die Live-Metadaten umschalten:

```bash
corepack pnpm run release:publish --version 0.1.5 --confirm "publish 0.1.5"
corepack pnpm run release:verify --base-url https://downloads.jura-wolpi.de/desktop/stable
```

Die Veröffentlichung ist pro Plattform atomar: Jede Plattform wird vollständig remote validiert, bevor ihr `latest*.yml` geschrieben wird. `manifest.json` folgt zuletzt. Ein Rollback veröffentlicht auf dieselbe Weise eine vollständig erhaltene ältere Version; bereits installierte neuere Apps werden nicht automatisch heruntergestuft.

## Auto-Updates

Gepackte Apps verwenden nur den Stable-Feed ihrer Plattform und Architektur. Feedfehler blockieren den Start nicht. Ein Update darf im Hintergrund laden, wird aber erst nach der ausdrücklichen Aktion `Jetzt neu starten` installiert.

macOS-Releases benötigen Developer-ID-Signierung, Hardened Runtime, Notarisierung und Stapling. Für Windows ist produktives Authenticode oder Microsoft Trusted Signing vorgesehen. Linux-AppImages können zusätzlich per GPG signiert werden.

Das Repository darf privat sein, sobald Stable-Feed, Downloadseite, CI-Secrets und Zugriffe unabhängig vom öffentlichen GitHub-Repository verifiziert sind. Die vollständige Betriebs-, Rollback- und Privacy-Reihenfolge steht in [installation.md](installation.md).
