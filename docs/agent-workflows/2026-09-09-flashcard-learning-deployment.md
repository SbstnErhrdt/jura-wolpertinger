# Karteikarten-Lernablauf: Umsetzung und Web-Deployment

Datum: 9. September 2026. Auftrag: freigegebenes Konzept umsetzen und produktiv deployen. Ziel: große Sammlungen erstmals vollständig und nachvollziehbar durcharbeiten.

## Ausgelieferter Umfang

- Gespeicherter Durchgang pro Sammlung mit stabiler Reihenfolge. Vorhandene Bewertungen bleiben erhalten und zählen beim ersten Durchgang als bearbeitet.
- Karten werden in begrenzten Paketen nachgeladen. Die Paketgröße von 40 beendet keinen Durchgang; schlechte Bewertungen verdrängen keine offenen Karten.
- Zurückstellen ohne Bewertung, ausdrückliches Bearbeiten zurückgestellter Karten, Pause und Fortsetzen nach Neuladen, richtige Abschluss- und Fortschrittszähler.
- Drei Selbsteinschätzungen, Frage und Antwort gemeinsam sichtbar, Rückgängig mit Wiederherstellung des Zeitplans, Schutz vor doppelten Bewertungen.
- Gesonderte empfohlene Wiederholungen, unsichere Karten und freiwilliger erneuter Gesamtdurchgang. Hilfe, Über-Seite und Nutzerbeschreibungen angepasst.
- Sprachbewertung schlägt eine Einschätzung vor; erst die Bestätigung speichert die Lernbewertung.
- Gemeinsamer Vertrag für Browser, SQLite und Supabase. Atomare Übertragung von Fortschritt und Durchgang mit Konfliktprüfung; rückgängig gemachte Bewertungen werden auch geräteübergreifend berücksichtigt.
- Lesbare Markdown-Listen und gefilterte Links/HTML, mobile Breite und Kontraste im hellen und dunklen Modus geprüft.

## Deployment

- Web-App: `https://app.jura-wolpi.de/`, statische Dateien unter `server.02:/home/docker-compose/jura-wolpi/app`.
- Datenbank: `009_flashcard_study_runs.sql`, anschließend gezielte, rückwärtskompatible Ergänzung des atomaren Fortschritts-RPC für das Löschen eines durch Undo zurückgenommenen ersten Zeitplans. Beide Applies transaktional mit `ON_ERROR_STOP=1`; PostgREST-Schema neu geladen.
- Voice-API: gezielte Änderung an `src/assessment.ts`, Container neu gebaut und gestartet.
- Web-Build mit produktiver Anmeldung und Supabase-Konfiguration; Schlüssel nur im Prozessspeicher, keine Schlüssel in diesem Bericht.
- Isoliertes Build-Verzeichnis. Bereits vorhandene, unabhängige Podcast-Änderungen wurden erhalten und nicht mit veröffentlicht. Gehashte Assets zuerst, `index.html` zuletzt veröffentlicht; frühere Assets für offene Browserseiten erhalten.
- Keine neue Desktop-Installationsdatei veröffentlicht. Desktop-Persistenz und Übertragung sind im Quellcode implementiert und getestet.

Backups vor dem ersten Apply auf dem Server, Verzeichnis `/home/docker-compose/jura-wolpi/backups/20260909-study/`: `app-before.tar.gz` (bisherige Oberfläche und Voice-Quelldatei) und `database-before.dump` (vollständiger PostgreSQL-Dump); Zugriff auf Eigentümer beschränkt. Die Schemaerweiterungen bleiben mit bisherigen Aufrufern kompatibel.

## Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Vollständige App-Test-Suite | 368 Tests in 64 Dateien bestanden |
| Vue-/Node-Typecheck und Produktionsbuild | Bestanden |
| Electron-End-to-End | 2 Tests bestanden: bestehender Prüfungsablauf und neuer Durchgang mit 47 Karten |
| Große Sammlung | Über Paketgrenze hinaus, falsche Antworten, Pause, Undo, Reload, zurückgestellte Karte und Abschluss geprüft |
| Darstellung/Barrierefreiheit | Desktop, 390-Pixel-Ansicht, kein horizontaler Überlauf, Axe ohne ernste/kritische Fehler im Lernablauf hell/dunkel |
| Voice-API | 34 Tests und Typecheck bestanden; produktiver Health-Endpunkt erfolgreich |
| SQL lokal | Alle 8 Suiten bestanden |
| SQL produktiv | 7 relevante Suiten mit vollständigem Rollback bestanden: Grundlage, Voice und alle fünf Lernablauf-/Übertragungssuiten |
| Desktop-Feed | Bestehender Stable-Feed erfolgreich verifiziert |
| Unabhängige Reviews | Traversal, Undo, Konflikte und atomare Übertragung geprüft; Null-Zeitplan-Ergänzung freigegeben |

Die unveränderte Podcast-Suite `008` erwartet einen leeren Katalog und kollidierte produktiv mit einem bereits vorhandenen Slug. Ihre Testtransaktion wurde zurückgerollt; lokal besteht sie. Keine produktiven Podcast-Inhalte wurden geändert.

Ein zusätzlicher Regressionstest hält die Antwort der Sammlungsabfrage gezielt zurück. Vor der Korrektur war der Lernstart bereits aktiv und eine verspätete Antwort konnte nach Navigation zurück zur Übersicht führen. Die Oberfläche wartet jetzt auf einen vollständigen Ladestand und verwirft Antworten, die nicht mehr zur geöffneten Seite gehören.

Der wiederholbare authentifizierte Produktionscheck liegt in `scripts/verify-production-study.cjs` und wird aus dem App-Repository mit `node scripts/verify-production-study.cjs` ausgeführt. Er benötigt den konfigurierten SSH-Zugang und Playwright Chromium, erstellt ein bestätigtes temporäres Konto ohne E-Mail-Versand und entfernt ausschließlich dessen eigene Prüfdaten und Konto im Abschlussblock. Er prüft Anmeldung, Erstellen von Sammlung/Karte, verzögerte Antworten, 47 unterschiedliche Karten, exakte Bewertungszahlen, beide Fortschritts-RPC-Signaturen und das Erstellen/Beschreiben eines Klausurentwurfs.

Noch nicht durchgeführt: qualitative Tests mit Personen aus der Zielgruppe, eine echte gesprochene Produktionssitzung sowie Bau und Veröffentlichung neuer Desktop-Installer. Diese sind keine behaupteten Ergebnisse der technischen Prüfungen.

## Abschließender öffentlicher Check

Abgeschlossen um 19:51 Uhr MESZ. Öffentliche `index.html` und beide referenzierten Assets stimmen bytegenau mit dem Produktionsbuild überein: `assets/index-i-2yaWcG.js` und `assets/index-DyHhjRoZ.css`. Website und Voice-Health-Endpunkt erreichbar; Edge, Voice-API und Datenbank laufen.

Der finale authentifizierte Browsercheck besteht vollständig:

- Vier- und Fünf-Argument-Fortschritts-RPC über die öffentliche Schnittstelle erfolgreich.
- Anmeldung sowie Erstellen einer privaten Sammlung und Karte über die Oberfläche erfolgreich.
- Verzögerte Sammlungsantwort aktiviert keinen verfrühten Lernstart und überschreibt keine spätere Navigation.
- Verzögerte Antwort eines anderen Durchgangs derselben Sammlung ersetzt die gewählte Auswahl nicht.
- Alle 47 unterschiedlichen Karten erreicht, einschließlich falscher Bewertungen, Undo, Pause, Neuladen, Überschreiten der Paketgrenze, Zurückstellen und echtem Abschluss. Genau 47 aktive Bewertungen und eine zurückgenommene Bewertung gespeichert.
- Prüfungsbibliothek geöffnet, Klausurentwurf erstellt und Text geschrieben; keine JavaScript-Seitenfehler.
- Temporäre Sammlung, Prüfdaten und Testkonto erfolgreich entfernt.

Die letzten unabhängigen Prüfungen bestätigen zusätzlich, dass verspätete Profil-/Batchantworten und ein Wechsel von Durchgang/Modus keine alte Auswahl wiederherstellen. Die Webversion ist veröffentlicht; es stehen keine weiteren Deployment-Schritte für diesen Auftrag aus.
