# Appweite Ladezustände: Web-Veröffentlichung

Am 21. September 2026 wurde der Feature-Branch
`feat/learning-podcast-skill-test` mit Merge-Commit `8f83551` in `main`
integriert und die Web-App unter `https://app.jura-wolpi.de/`
veröffentlicht. Das Deployment enthält die einheitlichen initialen
Skeletons, Fehler-/Retry-Zustände und aktionsbezogenen Ladeindikatoren. Die
Electron-E2E-Fenster bleiben in automatisierten Testläufen standardmäßig
verborgen und können mit `JURA_E2E_SHOW=1` sichtbar gestartet werden.

## Rollout

- Der authentifizierte Produktionsbuild mit der bestehenden Supabase-
  Konfiguration bestand beide Typechecks und die Build-Konfigurationsprüfung.
- Neue gehashte Assets wurden vor dem HTML übertragen. Bereits vorhandene
  Hash-Dateien blieben für geöffnete Browser-Sitzungen erhalten;
  `index.html` wurde zuletzt atomar aktiviert.
- Live-Assets: `assets/index-DY5uy0RS.js` und
  `assets/index-iPPl-nBs.css`.
- Die Vorversion ist unter
  `server.02:/home/docker-compose/jura-wolpi/backups/20260921-loading-states-df34fdb/app-before.tar.gz`
  gesichert.
- Es gab keine Datenbankmigration und kein Desktop-Release.

## Verifikation

- 529 Unit-/Integrationstests in 80 Dateien bestanden auf dem gemergten
  `main`.
- 11 Electron-E2E-Szenarien bestanden zuvor mit verborgenem Hauptfenster;
  der Test prüft den nativen `BrowserWindow.isVisible()`-Zustand.
- Der authentifizierte Kandidaten-Smoke bestand Login, 47-Karten-Lernlauf,
  Wiederholen, Rückgängig, Pause/Reload sowie den Prüfungseditor. Das
  Wegwerfkonto wurde entfernt.
- Der anschließende Live-Smoke bestätigte bytegleiche öffentliche HTML-,
  JavaScript- und CSS-Dateien, Katalogsuche, Pagination, segmentierte
  Lernstände, Empfehlungen, mobilen und dunklen Modus, Axe sowie die
  Prüfungsbibliothek. Auch dieses Wegwerfkonto wurde entfernt.
- Website, Web-App und authentifizierter Supabase-Health-Endpunkt antworteten
  erfolgreich. Nginx und Voice-API waren aktiv.
- Der unveränderte Desktop-Stable-Feed unter
  `https://downloads.jura-wolpi.de/desktop/stable` bestand die vollständige
  Feed-Verifikation.

Der Deployment-Smoke wurde an den aktuellen zugänglichen Vertrag des
segmentierten Lernstands angepasst: statt eines einzelnen `progressbar` prüft
er die vier explizit benannten Wissenszustände im `role="img"`-Label.
