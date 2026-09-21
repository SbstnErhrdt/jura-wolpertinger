# Klausuren hinter Seite 1 wieder erreichbar

Die Bibliothek verwendete am Nuxt-UI-Seitenwähler `model-value` und
`update:model-value`, während die installierte Komponente `page` und `update:page`
erwartet. Dadurch wechselte die aktive Schaltfläche zu Seite 2, die Klausurliste
blieb aber auf Seite 1. Der Fehler wurde sowohl in der veröffentlichten Web-App
als auch in einem neuen Electron-End-to-End-Test vor der Änderung reproduziert.

Der Seitenwähler steuert jetzt die vorhandene paginierte Ladefunktion. Die
Kennzahlen Abgegeben, Korrigiert und Schnitt sind ausdrücklich als Werte der
aktuellen Seite beschriftet. Die Gesamtzahl Prüfungen bleibt die Anzahl aller
Treffer im gewählten Ordner. Die Hilfe erklärt Seitenwechsel, Seitenumfang und
den Weg von einer Bewertung zur Prüfung. Die Über-Seite wurde geprüft; ihre
allgemeine Funktionsbeschreibung bleibt zutreffend.

## Prüfung und Veröffentlichung

- Typecheck und Produktionsbuild bestanden.
- 16 relevante Renderer-Tests bestanden.
- Zwei Electron-End-to-End-Tests bestanden: 40 Klausuren auf zwei Seiten, keine
  fehlenden oder doppelten Ziele, Vor-/Zurücknavigation, 50 Einträge auf einer
  Seite sowie Ordnerwechsel, Reload, History und bestehende Breadcrumb-Navigation.
- Unabhängiges Code-Review ohne P1/P2-Befunde.
- Der isolierte Web-Kandidat und anschließend die Live-App zeigten 25/15
  Klausuren sowie 25/1 Einträge im größeren Ordner. Alle 40 Klausurtexte und
  28 Bewertungsansichten wurden vollständig mit dem aktuellen Kontodatenbestand
  verglichen. Der öffentliche Build stimmt bytegenau mit dem Kandidaten überein.
- Die Browserprüfung erlaubte ausschließlich lesende API-Anfragen. Es gab keine
  Schreibversuche oder JavaScript-Fehler; der Kontodatenbestand blieb unverändert.

Kandidat: `/tmp/jura-wolpi-pagination-build-20260920`, auf Basis der zuvor exakt
verifizierten Produktionsquellen aus `/tmp/jura-wolpi-corrections-build-20260920`.
Unabhängige Änderungen im Hauptcheckout wurden nicht veröffentlicht. Die neuen
Assets wurden zuerst kopiert und `index.html` zuletzt atomar ersetzt. Bestehende
gehashte Assets blieben erhalten. Sicherung:
`server.02:/home/docker-compose/jura-wolpi/backups/20260920-exam-pagination/app-before.tar.gz`.

Keine Datenbankänderung und kein Desktop-Release. Die vollständige Vitest-Suite
wurde für diese begrenzte UI-Änderung nicht erneut ausgeführt; die betroffenen
Renderer- und Navigationsprüfungen sind oben aufgeführt. Personenbezogene
Prüfergebnisse und Screenshots bleiben im privaten Import-Arbeitsverzeichnis.
