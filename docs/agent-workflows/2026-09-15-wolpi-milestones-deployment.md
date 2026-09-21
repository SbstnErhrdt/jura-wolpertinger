# Wolpi-Erfolgsmomente: Umsetzung und Web-Rollout

Am 15. September 2026 nach Freigabe des Konzepts implementiert, getestet und auf `https://app.jura-wolpi.de/` veröffentlicht.

## Verhalten

- Nach zehn, zwanzig und weiteren Zehnerschwellen erscheint ein wechselndes vorhandenes Wolpi-Motiv für vier Sekunden. Alle bestätigten Einschätzungen zählen, auch „Nicht gewusst“.
- Die Anzeige steht im normalen Seitenfluss, verdeckt weder Frage noch Bewertung und übernimmt nicht den Fokus. Sie ist schließbar; beim bewussten Weiterlernen wird sie ausgeblendet. Reduzierte Bewegung sowie helle und dunkle Darstellung sind berücksichtigt.
- Bestätigte unterschiedliche Karten und bereits gezeigte Schwellen werden pro Nutzer und Durchgang lokal auf dem jeweiligen Gerät gespeichert. Pausen und Neuladen erhalten den Motivationszähler; neue Durchgänge beginnen separat. Keine geräteübergreifende Synchronisierung der Motivationsdaten.
- Erneutes Senden zählt nicht doppelt. Rückgängigmachen entfernt das Ereignis aus dem Zähler; anschließendes erneutes Bewerten wiederholt die Gratulation nicht.
- Auch wenn nach einer Zehnerschwelle nur zurückgestellte Karten offen sind, erscheint das Bild. Beim echten Abschluss bleibt ein Abschlussbild in der Zusammenfassung stehen, einschließlich kleiner Sammlungen; kein zusätzlicher Zehnerjubel am selben Abschluss.
- Lernalgorithmen, Datenbankschema und bestehende Lernstände bleiben unverändert. Hilfe, Über-Seite und Nutzerbeschreibung sind angepasst.

## Verifikation

| Prüfung | Ergebnis |
| --- | --- |
| Neue Verhaltenstests | Sieben Tests zuerst fehlgeschlagen, anschließend bestanden; Schwellen, Duplikate, Undo, Neuladen, Isolation, Speicherfehler und Abschluss |
| Vollständige Unit-Suite | 375 Tests in 65 Dateien bestanden |
| Typecheck und Produktionsbuild | Bestanden |
| Electron-End-to-End | Beide vollständigen Tests bestanden, einschließlich bestehendem Prüfungsablauf und erweitertem Lernen mit 47 Karten sowie Abschlüssen mit 1, 10 und 11 Karten |
| Unabhängige Codeprüfung | Randfall „nur zurückgestellte Karten offen“ gefunden, im E2E reproduziert und korrigiert; gezielte Nachprüfung ohne weitere Befunde |
| Darstellung und Accessibility | Desktop und 390-Pixel-Ansicht visuell geprüft, hell/dunkel und reduzierte Bewegung; Axe ohne ernste/kritische Befunde |
| Browserprüfung vor Veröffentlichung | Kandidaten-Dateien im Testbrowser unter der späteren App-Origin, echte Anmeldung und Schnittstelle mit temporärem Testkonto; bestanden |
| Öffentliche Dateien nach Veröffentlichung | Index sowie beide referenzierten JS-/CSS-Dateien und alle 39 Wolpi-Bilder bytegenau mit dem Build verglichen |
| Authentifizierter Live-Test | Anmeldung, Sammlung/Karte anlegen, 47 unterschiedliche Karten, Zehnerbilder und Motivwechsel, absichtlich verlorene Speicherantwort plus Retry mit derselben Ereignis-ID, Undo, Pause, Reload, Paketgrenze, Zurückstellen, Abschluss und exakte Bewertungszahlen bestanden |
| Bestehende Bereiche | Prüfungsentwurf erstellen und bearbeiten ohne JavaScript-Seitenfehler; Website und Voice-Health erreichbar; bestehender Desktop-Feed verifiziert |

Temporäre Testkonten und ihre Daten wurden nach den Prüfungen entfernt. Keine Nachrichten oder E-Mails versandt.

Die lokale Voransicht auf einer anderen Origin wurde von der vorhandenen Content Security Policy am Zugriff auf die produktive Anmeldung gehindert. Der Kandidat wurde deshalb im Testbrowser mit seiner späteren Origin geprüft; die Sicherheitsregeln der App wurden nicht verändert. Im Live-Prüfskript wurde außerdem die Auswahl des „Neue Karteikarte“-Buttons auf den Seitenkopf eingegrenzt, da die leere Sammlung einen zweiten gleichnamigen Einstieg anbietet.

## Veröffentlichung

Build isoliert unter `/tmp/jura-wolpi-milestones-build-20260915`, auf Basis des bereits ausgelieferten Lernablaufs. Unabhängige lokale Podcaständerungen wurden nicht mit veröffentlicht. Bestehende Arbeitsdateien wurden nicht zurückgesetzt.

Vorherige Webversion gesichert auf `server.02` unter `/home/docker-compose/jura-wolpi/backups/20260915-wolpi/app-before.tar.gz`. Neue Assets zuerst übertragen, `index.html` anschließend durch Umbenennen ausgetauscht. Frühere gehashte Assets für bereits offene Seiten erhalten.

Öffentlich verifizierte Hauptdateien:

- `assets/index-DdT0XtMJ.js`
- `assets/index-BK9tmaiS.css`

Der Rollout betrifft die Webversion. Der gemeinsame Renderer wurde auch in Electron getestet; neue Desktop-Installationspakete wurden nicht gebaut oder veröffentlicht.

Wiederholbare Live-Prüfung aus dem App-Repository: `node scripts/verify-production-study.cjs`. Mit `JURA_STUDY_BUILD_DIR` kann derselbe Ablauf statische Kandidaten-Dateien im eigenen Testbrowser prüfen, ohne die Live-Dateien auszutauschen. Zugangsdaten bleiben im Prozessspeicher. Details zu Sicherung und Veröffentlichung stehen im bestehenden Deployment-Runbook.
