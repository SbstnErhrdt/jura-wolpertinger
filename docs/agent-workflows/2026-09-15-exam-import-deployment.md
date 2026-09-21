# Online-Prüfungen nach externer Übernahme laden

## Änderung

Die Webbibliothek prüft beim ersten Zugriff nach einem Seitenstart wieder den Online-Stand. Prüfungen, die lokal noch fehlen, werden zusammen mit Ordnern, Revisionen, Abgaben und zugehörigen Korrekturdaten ergänzt. Bereits vorhandene lokale Prüfungen und ihre Bearbeitungen bleiben unverändert. Vor dem Sichern wird die Ergänzung erneut ausgeführt, damit eine ältere Sitzung später hinzugefügte Prüfungen nicht durch einen älteren Stand entfernt.

Kontowechsel während ausstehender Antworten werden vor dem Schreiben geprüft. Die allgemeine Konfliktlösung für gleichzeitige Änderungen an derselben Prüfung bleibt außerhalb dieses Eingriffs.

## Prüfung und Auslieferung

- Typprüfung und 379 Tests in 65 Dateien erfolgreich.
- Vier neue Regressionstests; die beiden ursprünglichen Fehler vor der Korrektur rot nachgewiesen.
- Unabhängiges Review einschließlich reproduzierter und behobener Kontowechsel-Rennen.
- Alle 22 übernommenen Prüfungen im tatsächlichen Editor vollständig mit den konvertierten Quellabsätzen verglichen; Hell- und Dunkelmodus visuell geprüft.
- Produktionsnaher Browsertest mit kurzlebigem Testkonto: Karteikarten-Lernablauf sowie Prüfungsanlage und Schreiben erfolgreich; Testkonto entfernt.
- Produktiv zusätzlich alle 22 Prüfungen mit kontogebundenem Lesezugriff aus dem Online-Snapshot geladen und geprüft; API-Schreibzugriffe im Prüfbrowser blockiert. Keine Anmeldung, Passwortänderung oder Nachricht ausgelöst.
- Vorherige Produktionsquellen in isolierter Kopie plus gezielter Änderung gebaut; keine weiteren lokalen Podcast-Arbeiten ausgeliefert.
- Assets ohne Löschen bestehender Dateien synchronisiert, HTML zuletzt atomar aktiviert. Öffentliche HTML-, JS- und CSS-Dateien bytegleich mit dem geprüften Build.

Live: `assets/index-Ch0Bw76X.js`, unverändertes CSS `assets/index-BK9tmaiS.css`.

Rückfallsicherung: `server.02:/home/docker-compose/jura-wolpi/backups/20260915-exam-import/app-before.tar.gz`. Bei einem Rückfall zuerst laufende Prüfungsbearbeitungen berücksichtigen; der vorherige Build lädt externe Ergänzungen in bestehenden Browsern nicht zuverlässig.

Der personenbezogene Import samt Originalen, Hashes, SQL, Vorher-/Nachher-Sicherungen und Prüfungsergebnissen liegt ausschließlich im privaten Arbeitsordner `sabine/Klausuren-Import/2026-09-15` außerhalb des App-Repositorys. Die bestehende Desktop-Sicherung wurde nicht geändert. Kein Desktop-Release erforderlich, da nur der Browser-Ladeweg betroffen ist.
