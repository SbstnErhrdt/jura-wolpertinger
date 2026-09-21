# Appweite Ladezustände

Date: 2026-09-21

## Ziel

Jura Wolpertinger unterscheidet in allen datenabhängigen Oberflächen zuverlässig zwischen noch nicht geladenen Daten, echten leeren oder numerischen Ergebnissen, Hintergrundaktualisierungen, laufenden Nutzeraktionen und Fehlern. Beim App-Start oder Seitenwechsel dürfen deshalb keine vorläufigen `0`-Werte, falschen Leerzustände oder kurzzeitig falschen Verbindungszustände erscheinen.

Die Umsetzung verwendet die bereits installierten Nuxt-UI-Komponenten, insbesondere `USkeleton`, und führt keine neue Abhängigkeit ein. Statische Informationsseiten erhalten keine künstlichen Ladezustände.

## Verbindliches Zustandsmodell

Jede datenabhängige Oberfläche ordnet ihre Anzeige genau einem der folgenden Zustände zu:

1. `loading-initial`: Für die aktuelle Oberfläche liegt noch kein erfolgreich geladener Datenstand vor. Die Inhaltsgeometrie wird mit passenden Skeletons reserviert. Echte Kennzahlen, Leerzustände und Fehlerhinweise sind verborgen.
2. `ready`: Daten wurden erfolgreich geladen. Erst jetzt dürfen echte Nullwerte, Kennzahlen und fachliche Leerzustände erscheinen.
3. `refreshing`: Ein bereits sichtbarer Datenstand wird neu geladen. Die vorhandenen Inhalte bleiben stabil und bedienbar, soweit die laufende Aktion dies zulässt. Ein kompakter Spinner oder Statushinweis und `aria-busy="true"` zeigen die Aktualisierung an.
4. `action-busy`: Eine ausdrücklich gestartete Nutzeraktion läuft. Nur die auslösende Aktion und unmittelbar kollidierende Bedienelemente werden gesperrt; der auslösende Button zeigt seinen Nuxt-UI-Ladeindikator.
5. `error`: Der notwendige Ladevorgang ist fehlgeschlagen. Statt erfundener Werte erscheint ein verständlicher `UAlert` mit einer Aktion `Erneut versuchen`. Wenn zuvor valide Daten vorhanden waren, bleiben sie sichtbar und der Fehler erscheint ergänzend.

`loading-initial` und `refreshing` sind gegenseitig ausgeschlossen. Ein erster fehlgeschlagener Ladevorgang führt zu `error`, nicht zu einem leeren `ready`-Zustand. Ein Hintergrundfehler verwirft keine zuvor geladenen Daten.

## Gemeinsame UI-Bausteine

Eine kleine gemeinsame Komponente bündelt nur die wiederkehrende Zugänglichkeits- und Statussemantik:

- `AppLoadingState.vue` rendert einen mit `role="status"` und `aria-live="polite"` ausgezeichneten Ladebereich.
- Sie erhält einen konkreten deutschen Statussatz, zum Beispiel `Lernstatistik wird geladen`.
- Ihr visueller Slot enthält ansichtsspezifische `USkeleton`-Anordnungen. Es gibt keinen universellen Skeleton, der unterschiedliche Seitengeometrien erzwingt.
- Skeleton-Flächen selbst sind für assistive Technik verborgen; der Statussatz bleibt zugänglich.
- Bestehende Nuxt-UI-Button-Ladezustände werden für Nutzeraktionen weiterverwendet.

Die Ansichten verwalten ihre fachlichen Ladephasen weiterhin lokal oder über ihren vorhandenen Store. Es wird kein allgemeiner Async-State-Store eingeführt. Bestehende Store-Zustände werden nur dort erweitert, wo eine Ansicht sonst nicht zwischen erster Ladung und Aktualisierung unterscheiden kann.

## App-Start und Authentifizierung

`App.vue` trennt das Auflösen der Authentifizierung und das Laden des lokalen App-Kontexts von einem tatsächlich abgemeldeten Zustand:

- Solange der Auth-Status noch `loading` ist, erscheint ein kurzer, ruhiger, markenkonformer Vollflächen-Ladezustand.
- Das Anmelde-Gate erscheint erst, nachdem feststeht, dass eine Anmeldung erforderlich und keine Sitzung vorhanden ist.
- Die normale App-Navigation erscheint erst, wenn der für sie notwendige Nutzer- und Versionskontext bereitsteht.
- Ein Bootstrap-Fehler zeigt einen klaren Fehlerhinweis und eine erneute Ladeaktion, statt einen falschen Login- oder Inhaltszustand vorzutäuschen.

## Abdeckung der Ansichten

### Home

Die vier Kennzahlen und zugehörigen Schnellinformationen werden während der ersten Ladung durch gleich große Skeleton-Karten ersetzt. Die bisherigen Fallbacks `?? 0` dürfen nur nach erfolgreicher Ladung als echte fachliche Nullwerte wirken. Ein späteres Aktualisieren hält den letzten Dashboardstand sichtbar.

### Prüfungsbibliothek und Prüfungsdetails

Die Bibliothek behält ihre bereits vorhandenen Listen-Skeletons und erhält für Hintergrundaktualisierungen eine kompakte, nicht springende Anzeige. `ExamView.vue` zeigt während der ersten Prüfungsladung eine Skeleton-Struktur für Kopf, Metadaten und Arbeitsbereich statt einer vollständig leeren Seite. Fehler und nicht vorhandene Prüfungen werden erst nach abgeschlossener Ladung unterschieden.

### Bewertung

`CorrectionView.vue` zeigt vor Abschluss der ersten Abgabenabfrage keine Meldung `Keine abgegebenen Prüfungen` und keine scheinbar leere Auswahl. Liste, Auswahlbereich und Bewertungsformular erhalten passende Skeletons. Speichern, Kommentare und weitere Mutationen zeigen einen Ladeindikator an der jeweiligen Aktion und verhindern Doppelausführungen.

### Auswertung

`AnalyticsView.vue` zeigt Kennzahlenkarten, Diagrammbereiche und Lernaufgaben als Skeletons, bis alle für die erste Darstellung notwendigen Abfragen abgeschlossen sind. Nullwerte und der leere Lernaufgaben-Zustand erscheinen ausschließlich für erfolgreich geladene Ergebnisse. Filter- oder Zeitraumänderungen behalten die vorhandenen Diagramme während der Aktualisierung sichtbar.

### Einstellungen und Verbindung

`SettingsView.vue` zeigt weder den initialen Platzhalternamen noch einen vermeintlich getrennten Online-Status, bevor Nutzerprofil und Verbindungsstatus aufgelöst sind. Die betroffenen Karten verwenden Skeletons. Bereits vorhandene Ladeindikatoren für Speichern, Verbindung und Datenübertragung bleiben aktionsbezogen; fehlende Aktionszustände werden ergänzt.

### Karteikarten

- Sammlungsübersicht: Der bisherige reine Text `Die Übersicht wird geladen …` wird durch strukturähnliche Skeleton-Karten ersetzt.
- Sammlungsdetail, Wiederholung und Lernstatistik: Bestehende Skeletons bleiben erhalten und werden auf einheitliche Statussemantik und `aria-busy` geprüft.
- Hintergrundaktualisierungen halten bekannte Sammlungen, Karten und Lernstände sichtbar.
- Import, Export, Erstellen, Bearbeiten, Qualitätsbewertung und Löschen zeigen den Ladezustand an der jeweils gestarteten Aktion.

### Podcasts

Podcastübersicht und Reihendetail behalten ihre vorhandenen `USkeleton`-Darstellungen. Sie werden an dieselbe zugängliche Ladeansage und die Trennung von Erstladung und Aktualisierung angepasst. Suche und lokale Filterung erhalten keinen künstlichen Netzwerk-Ladeindikator. Bereits geladene Cover und Fortschritte bleiben bei Hintergrundaktualisierungen sichtbar.

### Statische Seiten

About, Hilfe und andere ausschließlich statische Ansichten erhalten keine Skeletons. Ein Ladeindikator erscheint nur, wenn tatsächlich asynchrone Daten oder eine Nutzeraktion ausstehen.

## Layout und visuelle Regeln

- Skeletons bilden die spätere Struktur grob nach: Kennzahlenkarte zu Kennzahlenkarte, Listenzeile zu Listenzeile, Diagrammfläche zu Diagrammfläche.
- Die reservierte Höhe verhindert große Layoutsprünge.
- Skeletons verwenden vorhandene Abstände, Rundungen und Farbtokens und funktionieren im hellen und dunklen Modus.
- Animationen respektieren `prefers-reduced-motion`; notwendige Information bleibt ohne Bewegung erhalten.
- Vollflächen-Lader sind ausschließlich für den kurzen App-Bootstrap zulässig. Seiteninhalte verwenden lokale Skeletons.
- Hintergrundaktualisierungen dürfen die gesamte Seite nicht mit einem Overlay blockieren.

## Zugänglichkeit

- Datenregionen setzen während Erstladung und Aktualisierung `aria-busy="true"`.
- Jede Ladeanzeige besitzt einen konkreten, zugänglichen deutschen Statustext.
- Rein visuelle Skeletons sind mit `aria-hidden="true"` von assistiver Technik ausgeschlossen.
- Buttons verwenden während einer Aktion ihren sichtbaren und semantischen Ladezustand und sind gegen erneute Auslösung gesperrt.
- Fehlerhinweise sind als `UAlert` wahrnehmbar und die Wiederholen-Aktion ist per Tastatur erreichbar.
- Farbe und Animation sind nie der einzige Informationsträger.

## Fehler- und Randfälle

- Erfolgreich geladene `0` bleibt sichtbar und wird nicht als Ladezustand behandelt.
- Eine erfolgreich geladene leere Liste zeigt ihren fachlichen Leerzustand.
- Bei Teilfehlern werden erfolgreiche Bereiche nicht durch globale Fehleranzeigen ersetzt.
- Bei schnellem Seitenwechsel dürfen verspätete Antworten keinen Zustand einer nicht mehr aktuellen Ansicht überschreiben.
- Eine Aktion mit Fehler endet wieder in einem bedienbaren Zustand und zeigt die vorhandene Fehlermeldung; sie bleibt nicht dauerhaft `loading`.
- Offline verfügbare Desktop-Daten dürfen nicht wegen eines optionalen Cloud-Checks global blockiert werden.

## Dokumentation

`docs/user-stories.md` erhält eine übergreifende User Story für verlässliche Lade-, Leer-, Aktualisierungs- und Fehlerzustände. About und Hilfe werden geprüft; eine Textänderung ist nur erforderlich, wenn Nutzer:innen durch einen geänderten Ablauf neue Bedienhinweise benötigen. Rein visuelle Skeletons werden dort nicht als eigene Produktfunktion beschrieben.

## Tests und Abnahmekriterien

Die Umsetzung erfolgt testgetrieben. Vor jeder Produktionsänderung wird ein fokussierter Test ergänzt und mit dem erwarteten Fehler ausgeführt.

Mindestens folgende Verträge werden automatisiert geprüft:

- `AppLoadingState` liefert Statussemantik, verbirgt visuelle Skeletons und akzeptiert ansichtsspezifischen Inhalt.
- Home rendert vor erfolgreicher Ladung keine `0`-Kennzahlen und danach echte Nullwerte korrekt.
- App-Bootstrap zeigt während der Auth-Auflösung keinen Anmeldedialog.
- Auswertung, Bewertung und Einstellungen zeigen während der Erstladung weder falsche Leerzustände noch falsche Standardwerte.
- Prüfung und Karteikarten-Sammlungsübersicht besitzen strukturähnliche Skeletons.
- Bestehende Podcast-, Statistik-, Sammlungsdetail- und Wiederholungs-Skeletons erfüllen die gemeinsame Semantik.
- Relevante Mutationen sperren ihre auslösende Aktion und geben sie in `finally` wieder frei.
- Initiale Fehler zeigen eine Wiederholen-Aktion; Hintergrundfehler lassen vorhandene Daten sichtbar.

Abschließend laufen fokussierte Renderer-Tests, `pnpm run typecheck`, `pnpm test`, `pnpm run build` und wegen der appweiten UI- sowie Accessibility-Änderungen nach lokaler Möglichkeit `pnpm run test:e2e`. Heller und dunkler Modus sowie schmale und breite Viewports werden für die zentralen Ansichten visuell geprüft.

## Nicht-Ziele

- Keine Änderung an fachlichen Kennzahlen, Datenabfragen oder Persistenzformaten.
- Keine neue globale State-Management-Abstraktion.
- Keine dekorative Neugestaltung der Ansichten.
- Keine künstlichen Mindestwartezeiten oder Skeletons für synchrone lokale Filter.
- Keine vollständige Sperre der App während einzelner Hintergrundabfragen oder Mutationen.
