# FKK- und AG-Übungsklausuren: Übernahme und historische Daten

## Ergebnis

Fünf Portalabgaben wurden anhand des vollständigen Textes bestehenden Entwürfen
zugeordnet. Es entstanden keine zusätzlichen Prüfungen. Ergänzt wurden fünf
unveränderliche Abgabenrevisionen, fünf Bewertungen, 30 verankerte Randkommentare
und 37 Originaldateien. Der Bestand umfasst danach 40 Prüfungen, 35 Abgaben,
33 Bewertungen, 176 Randkommentare und 112 Anhänge.

Die Dateien enthalten Originalabgaben, korrigierte PDFs, Bewertungsbögen,
Sachverhalte, Lösungen, Präsentationen und allgemeine Kursmaterialien.
Ein weiterer vorhandener FKK-Entwurf erhielt nur Materialien: Im Portal war
keine Abgabe vorhanden. Nicht zugängliche frühere FKK-Abschnitte wurden nicht als
fehlende oder abgegebene Arbeiten interpretiert.

PDF-Kommentare, DOCX-Tabellen und grafische Hinweise wurden separat geprüft.
32 Korrekturseiten wurden visuell kontrolliert; 38 grafische Hinweise sind
beschrieben. Fünf unsichere handschriftliche Lesarten bleiben ausdrücklich als
unsicher gekennzeichnet. Originaldateien wurden unverändert aufbewahrt.

Alle 40 Prüfungen erhielten geprüfte Tags. Die 223 vorhandenen Zuordnungen blieben
erhalten; 281 wurden ergänzt. Browser-Felder, JSON-Felder und die normalisierten
Tag-Tabellen sind konsistent: 226 unterschiedliche Tags, 504 Zuordnungen.

`createdAt` wurde auf belegte historische Zeitpunkte gesetzt: 35 Portal-Abgabezeiten
mit Minutenpräzision, fünf belegte Quelldateitage mit Tagespräzision in
Europe/Berlin. Diese Zeitpunkte belegen nicht den tatsächlichen Schreibbeginn.
Titel, Ordner, Notizen, Entwürfe und bestehende unveränderliche Objekte blieben
erhalten; der separate Desktop-Snapshot wurde nicht verändert.

## Synchronisation und Veröffentlichung

Die neue Browserlogik übernimmt versionierte `dateImport`-Vermerke unter Wahrung
lokaler Änderungen. Details stehen im [Importvertrag](2026-09-20-correction-import-contract.md).
Die Supabase-Migration `010_browser_exam_date_import_guard.sql` verhindert, dass
ältere bereits geöffnete App-Versionen diese Vermerke verlieren. Schutz und
Datensatz wurden in derselben Transaktion aktiviert; der Datensatz-Import war
durch Konto, Arbeitsbereich, Snapshot-Digest und bisheriges Dateimanifest begrenzt.

Der isolierte Web-Kandidat basiert auf dem zuvor veröffentlichten Interface-Stand.
Nur die gezielten Datumsänderungen wurden in den vorhandenen Hauptcheckout
übertragen. Die Web-Dateien wurden nach Sicherung veröffentlicht, zuerst die
Assets und zuletzt atomar der Index. Veröffentlichter Index-SHA256:

`7af1eb02a8b0ed6026f32960e12a69524f515e83e86008a1a97c49347fcbb883`

Server-Sicherung:
`/home/docker-compose/jura-wolpi/backups/20260920-exam-date-import/app-before.tar.gz`.
Personenbezogene Quellen, Vorher-/Nachher-Sicherungen, Zuordnungen und
Importwerkzeuge bleiben außerhalb des App-Repositories im privaten Importordner.

## Prüfung

- Typecheck und Produktionsbuild erfolgreich; 221 Renderer-Tests erfolgreich.
- Vollständige Vitest-Suite: 454 erfolgreich, drei bereits im unveränderten
  Ausgangspunkt nachgewiesene unabhängige Podcast-Fehler. Keine Podcast-Änderungen.
- 24 SQL-Integrationsfälle erfolgreich in einer lokalen Testdatenbank und gegen
  eine temporäre Kopie des tatsächlichen Schemas; Probeläufe zurückgerollt.
  Die Migration wurde lokal zweimal erfolgreich angewandt.
- Alter vollständiger Kontosnapshot wird produktiv abgewiesen, aktueller
  Kontosnapshot akzeptiert; dieser Schreibtest wurde vollständig zurückgerollt.
- Kandidat und veröffentlichte App jeweils mit frischem und altem Browserbestand
  geprüft: alle 40 Texte, Daten und Tags, fünf vollständige Bewertungen und
  30 Randkommentare korrekt; keine Browserfehler oder Produktionsschreibversuche.
- Alle 37 Originale nach Upload und über tatsächliche App-Downloads bytegenau
  geprüft. Öffentliche HTML-/Asset-Dateien entsprechen dem geprüften Build.
- Vollständiger produktiver Snapshot und Dateimanifest entsprechen den geprüften
  Importdateien; übrige Snapshots und bestehende Inhalte sind unverändert.

Electron-E2E wurde für die reine Cloud-Datumsergänzung nicht erneut ausgeführt.
Die vorherigen neun Interface-E2E-Tests waren erfolgreich; hier wurden stattdessen
die betroffenen Browser- und Datenbanksynchronisationspfade direkt geprüft.
