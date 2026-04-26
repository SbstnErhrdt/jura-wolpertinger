# Installation und Distribution

Diese Anleitung beschreibt, wie Nutzer Jura Wolpertinger installieren und was für öffentliche Releases bei Signaturen, Zertifikaten und Plattformwarnungen zu beachten ist.

## Download

Die App wird über GitHub Releases verteilt. Die Website verlinkt direkt auf die neuesten Dateien:

```text
Windows: https://github.com/SbstnErhrdt/jura-wolpertinger/releases/latest/download/Jura%20Wolpertinger-x64-win.exe
macOS Apple Silicon: https://github.com/SbstnErhrdt/jura-wolpertinger/releases/latest/download/Jura%20Wolpertinger-arm64-mac.dmg
macOS Intel: https://github.com/SbstnErhrdt/jura-wolpertinger/releases/latest/download/Jura%20Wolpertinger-x64-mac.dmg
Linux: https://github.com/SbstnErhrdt/jura-wolpertinger/releases/latest/download/Jura%20Wolpertinger-x64-linux.AppImage
```

Für macOS gibt es zwei Builds: `arm64` für Apple Silicon und `x64` für ältere Intel-Macs.

## Windows

### Installation

1. Windows-Installer herunterladen:

   ```text
   Jura Wolpertinger-x64-win.exe
   ```

2. Die `.exe` starten.
3. Dem Installationsdialog folgen.
4. Die App über Startmenü oder Desktop-Verknüpfung öffnen.

### Wenn Windows warnt

Bei unsignierten oder neuen Apps kann Windows SmartScreen warnen. Das bedeutet nicht automatisch, dass die App schädlich ist, sondern dass Windows dem Herausgeber oder der Datei noch nicht vertraut.

Für öffentliche Releases sollte die Windows-App signiert werden:

- Authenticode-Code-Signing-Zertifikat eines vertrauenswürdigen Anbieters oder Microsoft Trusted Signing.
- Optional EV-Zertifikat, wenn schneller Publisher-Reputation aufgebaut werden soll.
- Signierte Installer reduzieren SmartScreen-Warnungen, garantieren aber nicht, dass nie eine Warnung erscheint.

Aktueller Status im Projekt: Windows-Builds werden gebaut, aber noch nicht produktiv signiert.

## macOS

### Installation

1. Passende macOS-Datei herunterladen:

   ```text
   Jura Wolpertinger-arm64-mac.dmg
   Jura Wolpertinger-x64-mac.dmg
   ```

   Apple Silicon ist für Macs mit M1/M2/M3/M4. Intel ist für ältere Macs.

2. Die `.dmg` öffnen.
3. `Jura Wolpertinger.app` in den Programme-Ordner ziehen.
4. Die App aus `Programme` starten.

### Wenn macOS nachfragt

Wenn macOS beim ersten Start nachfragt, bestätige den Start der heruntergeladenen App. Die Release-Dateien werden für die normale Installation vorbereitet.

## Linux

### Installation per AppImage

1. Linux-Datei herunterladen:

   ```text
   Jura Wolpertinger-x64-linux.AppImage
   ```

2. Ausführbar machen:

   ```bash
   chmod +x "Jura Wolpertinger-x64-linux.AppImage"
   ```

3. Starten:

   ```bash
   ./Jura\ Wolpertinger-x64-linux.AppImage
   ```

### Linux-Signaturen

Linux hat kein zentrales Gatekeeper-/SmartScreen-System. Für AppImage-Verteilung sind Signaturen optional, aber empfehlenswert:

- SHA256-Checksums pro Release veröffentlichen.
- Optional AppImage mit GPG signieren.
- Wenn später `.deb` oder `.rpm` angeboten werden, sollten Paket-Repositories mit GPG signiert werden.

Aktueller Status im Projekt: Linux wird als AppImage gebaut. Checksums und GPG-Signaturen sind noch nicht eingerichtet.

## Für Maintainer

### Release erstellen

1. Version erhöhen:

   ```bash
   pnpm version patch
   ```

2. Tag und Commit pushen:

   ```bash
   git push origin main --tags
   ```

3. GitHub Actions baut und veröffentlicht die Release-Artefakte.

### Lokale Builds

```bash
pnpm run dist:mac
pnpm run release:win
pnpm run release:linux
```

Für lokale, nicht veröffentlichte Artefakte:

```bash
pnpm run dist
```

### Empfohlene nächste Schritte für produktive Distribution

1. Apple Developer ID Signierung und Notarisierung einrichten.
2. Windows Code Signing einrichten.
3. Checksums für alle Release-Artefakte erzeugen und veröffentlichen.
4. Optional Linux AppImage per GPG signieren.
5. GitHub Pages Landingpage auf `docs/` oder GitHub Actions aktivieren.

## Kurzantwort: Brauchen wir Zertifikate?

Für interne Tests: nein, aber Nutzer sehen je nach Plattform Warnungen.

Für öffentliche Releases: ja, sinnvoll und auf macOS faktisch notwendig. macOS braucht Developer ID Signierung plus Notarisierung für einen normalen Start ohne Gatekeeper-Probleme. Windows sollte mit einem vertrauenswürdigen Code-Signing-Zertifikat signiert werden, damit SmartScreen weniger aggressiv warnt. Linux braucht bei AppImage kein Vendor-Zertifikat, sollte aber Checksums und optional GPG-Signaturen bekommen.
