# Releases

Jura Wolpertinger nutzt GitHub Releases als Distributions- und Update-Kanal. Die Nutzerinstallation ist in [installation.md](installation.md) beschrieben.

## Release erstellen

1. App-Version erhöhen:

   ```bash
   pnpm version patch
   ```

2. Commit und Tag pushen:

   ```bash
   git push origin main --tags
   ```

3. GitHub Actions startet `.github/workflows/release.yml`, validiert die App, baut macOS-, Windows- und Linux-Pakete und veröffentlicht Installer plus Auto-Update-Metadaten im GitHub Release.

## Lokaler Build

Diesen Befehl verwenden, wenn lokal Installer-Artefakte ohne Veröffentlichung gebaut werden sollen:

```bash
pnpm run dist
```

## Auto-Updates

Gepackte Apps prüfen kurz nach dem Start auf Updates aus GitHub Releases. Wenn ein Update heruntergeladen wurde, fragt die App vor Neustart und Installation nach.

macOS-Auto-Updates brauchen Code Signing. Unsigned Development-Builds können zwar veröffentlicht und manuell heruntergeladen werden, produktive Auto-Updates auf macOS sollten aber erst nach Developer-ID-Signierung und Notarisierung aktiviert werden.

Private GitHub-Repositories eignen sich für internes Release-Testing. Für externe Nutzer müssen Release-Artefakte für die installierte App erreichbar sein, üblicherweise über ein öffentliches GitHub-Release-Repository oder einen separaten Update-Server.

## Signaturen

- macOS: Developer ID Application Zertifikat, Hardened Runtime und Notarization einrichten.
- Windows: Authenticode-Code-Signing-Zertifikat oder Microsoft Trusted Signing einrichten.
- Linux: Checksums veröffentlichen, AppImage optional per GPG signieren.
