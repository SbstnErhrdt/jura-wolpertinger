# Tags, gemeinsame Breadcrumbs und monatliche Auswertung

Beim Anklicken eines Tag-Vorschlags verlor das Eingabefeld zuerst den Fokus.
Dadurch wurde der noch unvollständige Suchtext gespeichert, bevor der Klick den
vollständigen Vorschlag übernehmen konnte. Die Vorschläge verhindern jetzt den
vorzeitigen Fokuswechsel bei `pointerdown`; der vorhandene Klick übernimmt den
vollständigen Tag. Freie Eingaben mit Enter und Tab bleiben erhalten.

Alle 15 Ansichten mit Breadcrumbs verwenden nun `AppBreadcrumb`. Die Komponente
legt Schriftfamilie, Schriftgröße, Gewicht, aktive Zustände, Fokusdarstellung
und die Behandlung langer Pfade zentral fest. Doppelte globale Darstellungsregeln
wurden entfernt. Vorhandene Links und die Hierarchie bleiben erhalten.

Der Bewertungsverlauf bildet das arithmetische Mittel der gefilterten Bewertungen
je Kalendermonat. Die X-Achse enthält jeden Monat des Zeitraums einschließlich
Jahr; Monate ohne Bewertung bleiben leer und unterbrechen die Linie. Lange
Zeiträume sind horizontal verschiebbar. Hover, Tastaturfokus und Antippen zeigen
Monat, Durchschnitt mit bis zu zwei Nachkommastellen und Anzahl der Bewertungen.
Die Berechnung rundet die Eingangswerte nicht. Escape schließt den Tooltip auch,
wenn der Tastaturfokus außerhalb des Diagramms liegt. Hilfe, Über-Seite und
User-Stories beschreiben das neue Verhalten.

## Lokale Prüfung

- Typecheck im isolierten Kandidaten und im Hauptcheckout bestanden.
- Alle 186 Renderer-Tests in 36 Dateien bestanden.
- Alle neun Electron-E2E-Tests bestanden, einschließlich Axe-Prüfungen,
  Prüfungsmodus, Bewertung, PDF-Ausgabe, Lernen, Bibliotheksnavigation,
  Tag-Auswahl sowie Breadcrumbs auf 18 Routenvarianten in beiden Farbmodi.
- Der Diagrammtest prüft unter anderem Jahreswechsel, halbe Punkte,
  Nullbewertungen, leere Monate, Datumsfilter, Tastatur, Touch und Tooltip-Grenzen.
  Für den separaten Hover-Treffertest wird der Zeiger nach Escape ausdrücklich
  aus dem Diagramm bewegt, damit die SVG-Trefferfläche aus einem eindeutigen
  Ausgangszustand betreten wird. Die vorherige implizite Scroll-/Hover-Sequenz
  war im Gesamtlauf nicht zuverlässig.
- Produktionsbuild bestanden; unabhängige Reviews ohne offene P1/P2-Befunde.
- `git diff --check` bestanden. Die vollständige Backend-/Service-Testsuite und
  Desktop-Pakete wurden für diese Renderer-Änderung nicht erneut gebaut.

Der Kandidat `/tmp/jura-wolpi-interface-build-20260920` basiert auf dem bereits
veröffentlichten Pagination-Fix. Seine 28 geänderten Quell-, Test- und
Dokumentationsdateien wurden gezielt in den bestehenden Hauptcheckout übertragen.
Andere laufende Änderungen wurden nicht in den Web-Kandidaten aufgenommen.

## Web-Verifikation

Die Prüfung verwendet den bestehenden Kontodatenbestand ausschließlich lesend.
Produktionsänderungen an Klausuren, Bewertungen oder Anhängen sind für diese
Oberflächenkorrektur nicht erforderlich. Personenbezogene Berichte und Bilder
liegen ausschließlich im privaten Import-Arbeitsverzeichnis.

Der Kandidat wurde zusätzlich mit dem tatsächlichen Konto in Chromium geprüft:
40 vollständige Entwurfstexte, 28 vollständige bewertete Abgaben und ihre
Verknüpfungen, Bibliotheksseiten mit 25/15 beziehungsweise 25/1 Einträgen,
Breadcrumb-Typografie auf vier Kernrouten in beiden Farbmodi, alle 15 belegten
Monatsdurchschnitte, 23 durchgehende Monatsbeschriftungen einschließlich Jahr
sowie Tag-Auswahl und Touch auf 390 Pixel Bildschirmbreite. Keine JavaScript-
Fehler oder API-Schreibversuche; der Kontodatenbestand blieb unverändert.

Die Web-Veröffentlichung sicherte die vorherige App unter
`server.02:/home/docker-compose/jura-wolpi/backups/20260920-interface-consistency/app-before.tar.gz`.
Neue Assets wurden zuerst übertragen, vorhandene gehashte Assets beibehalten
und `index.html` zuletzt atomar ersetzt. Vorheriger und neuer Index wurden per
Prüfsumme kontrolliert; eine zwischenzeitliche andere Veröffentlichung hätte
den Vorgang abgebrochen. Der neue öffentliche Index entspricht dem Kandidaten.
Einstiegsdateien: `index-Ca0B6FBD.js` und `index-BeSEeX0s.css`.

Nach der Veröffentlichung wurde dieselbe vollständige Chromium-Prüfung gegen
die öffentliche Live-App erneut erfolgreich ausgeführt. Öffentlicher Index,
JavaScript und CSS stimmen bytegenau mit dem geprüften Kandidaten überein.
Alle 40 Entwürfe, 28 bewerteten Abgaben, Monatswerte, Breadcrumb-Prüfungen und
mobilen Tag-/Touch-Prüfungen bestanden erneut. Keine JavaScript-Fehler,
API-Schreibversuche oder Änderung des Kontodatenbestands.

Es gab keine Datenbankänderung und keinen Desktop-Release.
