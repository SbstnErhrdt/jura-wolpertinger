# Ordnernavigation der Prüfungsbibliothek

Die Bibliothek hält ihre Ordnerauswahl in `#/exams/library?folder=<Ordner-ID>`. `folder=unassigned` steht für Prüfungen ohne Ordner; ohne Parameter werden alle Einträge geladen. Die stabile ID erhält Links nach Umbenennungen. Der Ordnername steht als Seitenüberschrift und als einzige aktuelle Breadcrumb-Ebene. „Bibliothek“ ist auf Ordnerebene ein Elternlink zur Gesamtansicht. Aus einer Prüfung führen Ordner-Breadcrumb und Bibliotheks-Rückweg zur zugehörigen Auswahl.

Fehlende oder archivierte Ordner werden nach abgeschlossener Ordnerabfrage mit Hinweis durch die Gesamtansicht ersetzt; andere Query-Parameter bleiben erhalten. Die Prüfung läuft auch bei Query-Wechseln innerhalb derselben Seite. Verspätete Listenantworten und Fehler dürfen die zuletzt angeforderte Auswahl nicht ersetzen, auch wenn gerade die Ordnerliste geladen wird.

Gemeinsame Nuxt-Breadcrumbs deklarieren genau den letzten Eintrag als aktiv. Hervorhebung erfolgt über `aria-current=page`, statt jeden unverlinkten Text als aktuelle Seite darzustellen. Hilfe und Nutzerbeschreibung sind ergänzt; die bestehende Projektbeschreibung auf der Über-Seite bleibt zutreffend. Prüfungseditor, Inhalte, Datenbankschema und Lernalgorithmus wurden nicht geändert.

## Prüfungen

- Fehlende Ordner-URL im Electron-Navigationstest vor der Korrektur reproduziert.
- Vier Store-Regressionen jeweils zunächst fehlgeschlagen: Initialfilter/Zurücksetzen, vertauschte Antworten, verspäteter Fehler und alte Antwort während des erneuten Ordnerladens. Danach bestanden.
- Typprüfung sowie 390 Tests in 66 Dateien bestanden.
- Alle drei Electron-End-to-End-Tests bestanden: neue Ordnernavigation, bestehender Prüfungs-/Abgabe-/Korrekturablauf sowie Lernen mit großer Sammlung. Navigation umfasst direkte Adresse, Reload, History, Ordner-Rückweg, Gesamtansicht, ohne Ordner, nicht verfügbare Ordner, Umbenennen, Archivieren und Accessibility hell/dunkel.
- Unabhängiges Review: fehlende Validierung bei reinem Query-Wechsel identifiziert und korrigiert; Nachprüfung ohne weitere Befunde.
- Isolierten Web-Kandidaten und anschließend die Liveversion mit kontogebundenem Lesezugriff geprüft: Ordner mit 8/14 Prüfungen, Gesamtansicht mit 22 Prüfungen, Direktlinks, Reload, History und genau eine hervorgehobene Breadcrumb-Ebene in beiden Darstellungen. Keine Schreibrequests erlaubt; Kontosnapshot vor/nach der Navigation identisch.
- Öffentliches HTML, JS und CSS bytegleich mit dem geprüften Kandidaten. Bestehende gehashte Dateien beim Rollout erhalten, HTML zuletzt atomar aktiviert.

`pnpm test` traf lokal auf die global installierte falsche pnpm-Hauptversion im verschachtelten Aufruf. Derselbe erforderliche Ablauf wurde erfolgreich mit explizitem `corepack pnpm rebuild better-sqlite3` und `corepack pnpm exec vitest run` ausgeführt. Keine Abhängigkeiten oder globalen Einstellungen dafür verändert.

## Rollout

Nur gezielte Navigationsänderungen auf Basis der zuvor veröffentlichten Quellen aus `/tmp/jura-wolpi-tags-build-20260920` gebaut. Arbeitskopie des Kandidaten: `/tmp/jura-wolpi-folder-build-20260920`. Unabhängige lokale Podcast-Arbeiten bleiben unberührt und wurden nicht veröffentlicht.

Live: `assets/index-CV4UhVng.js`, `assets/index-s77GhG3t.css`.

Vorversion gesichert unter `server.02:/home/docker-compose/jura-wolpi/backups/20260920-exam-navigation/app-before.tar.gz`. Kein Desktop-Installationspaket veröffentlicht; der gemeinsame Renderer wurde in Electron getestet. Personenbezogene Browser-Prüfungen und Screenshots liegen ausschließlich im privaten Import-Arbeitsverzeichnis außerhalb dieses Repositorys.
