# Sammlungsübersicht: Web-Veröffentlichung

Am 20. September 2026 auf ausdrücklichen Veröffentlichungsauftrag live geschaltet:
Fortschrittsbalken, paginierte Sammlungssuche und eine begründete globale
Lernempfehlung (Wiederholen → Fortsetzen → neue Karten).

## Umfang und Sicherung

Der isolierte Kandidat `/tmp/jura-wolpi-catalog-build-20260920.2JpI0K` basiert auf
den exakt zur bisherigen Live-Version passenden Quellen aus
`/tmp/jura-wolpi-date-import-build-20260920`. Nur die zwölf betreffenden
Quell-/Hilfedateien und ihre Tests wurden übernommen. Unabhängige lokale
Podcast-Änderungen wurden nicht veröffentlicht. Der stark veränderte
Hauptcheckout wurde weder zurückgesetzt noch durch Pull/Merge verändert.
Keine Dependency-Änderung, kein Desktop-Release, kein Git-Push.

Vorherige Web-App gesichert unter
`server.02:/home/docker-compose/jura-wolpi/backups/20260920-flashcard-catalog/app-before.tar.gz`.
Die ausgerollte Migration liegt daneben als `011_study_collection_catalog.sql`.
Die zuvor nicht vorhandene, lesende RPC wurde zuerst transaktional angelegt,
danach der PostgREST-Schemacache neu geladen. Keine Migration bestehender
Lernstände und keine Änderungen an Karteninhalten.

Neue Assets wurden zuerst übertragen, vorhandene gehashte Assets behalten und
`index.html` zuletzt atomar aktiviert. Prüfungen von Ausgangsindex und
Kandidaten-Hashes schützen vor dem Überschreiben einer anderen Veröffentlichung.

- Vorheriger Index SHA-256: `7af1eb02a8b0ed6026f32960e12a69524f515e83e86008a1a97c49347fcbb883`
- Live-Index SHA-256: `bde66b83f9f85d1cb863c77c402d3819fe242aaf49f03741678c8fdb7f4feec0`
- JavaScript: `assets/index-DITOWXRd.js`
- CSS: `assets/index-7HgZ2vBW.css`

## Verifikation

- Isolierter `build:web:production` einschließlich beider Typechecks und
  Prüfung der Produktions-Auth-Konfiguration bestanden.
- 85 fokussierte Shared-/Browser-/Cloud-/UI-Tests im Kandidaten bestanden.
- SQL-Katalogtests lokal und nach Installation in Produktion bestanden;
  sämtliche Testdaten der SQL-Prüfung wurden zurückgerollt.
- `scripts/verify-production-study-catalog.cjs` gegen Kandidat und anschließend
  gegen die öffentliche Live-App bestanden. Der Test verwendet ausschließlich
  neu angelegte private Wegwerfkonten mit normalem Passwort-Login; Testkonten
  und Sammlungen werden auch im Fehlerfall gezielt entfernt. Keine Anmeldung
  als reale Nutzer, keine Ausgabe oder Speicherung von Zugangsdaten.
- Geprüft: 29 Sammlungen mit Seiten von 24/5, Suche/Reset/Leertreffer,
  globaler Vorschlag trotz Suchfilter, 50%-Fortschritt, unveränderte Durchgänge
  nach Katalogabfragen, direkter Wiederholungsstart, exakte Fortsetzung sowie
  Auswahl einer kleinen neuen Sammlung. Prüfungsbibliothek erreichbar.
- Chromium mobil/desktop, Hell-/Dunkelmodus, keine horizontalen Überläufe,
  keine JavaScript-Fehler und keine ernsten/kritischen Axe-Befunde in der
  Sammlungsübersicht. Ein initialer Fehler im Prüfskript wurde durch einen
  expliziten Browserkontext für Axe behoben; keine Produktänderung erforderlich.
- Öffentliches HTML, JavaScript und CSS bytegleich mit dem geprüften Kandidaten.
- Zusätzliche ausschließlich lesende Datenbankprüfung: Sabines Konto liefert
  29 lernbare Sammlungen, 24 Einträge auf Seite eins und eine Wiederholung als
  aktuelle Empfehlung. Keine Testbewertungen in diesem Konto.
- Website, App und Voice-Health: HTTP 200. Bestehender Desktop-Stable-Feed mit
  `release:verify` erfolgreich geprüft, nicht verändert.

Die vollständige Electron-Suite wurde für diesen reinen Rollout nicht erneut
ausgeführt. Der separat dokumentierte intermittierende Bibliotheks-Kontrasttest
aus der Implementierungsprüfung bleibt außerhalb dieses Features; die neuen
Produktions-Browserprüfungen sind vollständig grün.

## Rückweg

Bei Bedarf ausschließlich den vorherigen App-Index aus der Sicherung in eine
temporäre Datei extrahieren, prüfen und atomar wieder aktivieren. Die alten
gehashten Assets sind weiterhin vorhanden. Die additive, lesende RPC kann
für einen Frontend-Rollback unverändert bestehen bleiben. Kein Löschen von
Karten, Nutzerkonten oder Lerndaten für einen Rollback erforderlich.
