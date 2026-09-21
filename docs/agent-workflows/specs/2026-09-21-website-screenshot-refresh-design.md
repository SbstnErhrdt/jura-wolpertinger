# Website- und Screenshot-Aktualisierung

Date: 2026-09-21

## Ziel

Die öffentliche Website zeigt die aktuelle App mit ruhigen, glaubwürdigen Produktbildern. Wolpi bleibt ein Markenakzent, erscheint aber als sauber freigestelltes Motiv statt als quadratisches Bild mit weißem Hintergrund.

## Visuelle Richtung

- Die bestehende app-nahe Sprache aus tiefem Blau, hellen Arbeitsflächen und zurückhaltenden Konturen bleibt bestehen.
- Produktbilder werden gerade, scharf und in einheitlichen Rahmen gezeigt; künstliche Perspektivverzerrung und konkurrierende Schatten werden reduziert.
- Der Hero verwendet einen aktuellen echten App-Screenshot und einen freigestellten winkenden Wolpi.
- Karteikarten- und Desktopabschnitt verwenden ebenfalls echte Alpha-Freisteller. Die Figuren dürfen Inhalte nicht überdecken und werden auf Mobilgeräten kleiner oder unterhalb des Inhalts platziert.
- Wolpi-Dateien werden webtauglich komprimiert und lazy geladen, soweit sie nicht das Hero-Motiv sind.

## Screenshot-Satz

Die Website erhält einen konsistenten Satz echter, lokaler App-Aufnahmen mit neutralen Demo-Daten und derselben Desktopgröße:

1. Home mit Lernaktionen.
2. Karteikarten-Sammlungen mit segmentierten Lernständen.
3. Podcastbibliothek mit Suche und Covern.
4. Karteikarten-Wiederholung.
5. Prüfungsbibliothek.
6. Lernstatistik mit farbigen Zuständen.

Die Bilder enthalten keine privaten Nutzerdaten, keine Browser-Chrome und keine künstlich generierte Benutzeroberfläche. Sie werden für schnelle Auslieferung ohne sichtbaren Qualitätsverlust optimiert.

## Website-Inhalt

- Der Funktionsbereich nennt Podcasts als gleichwertige Lerneinheit.
- Die App-Vorschau erhält aktualisierte Bildunterschriften und eine klarere Hierarchie: eine große Sammlungsansicht, danach ein ausgewogenes Raster der übrigen Kernabläufe.
- Screenshotflächen erhalten konsistente Innenabstände, Konturen und dezente Schatten.
- Download-IDs, Betriebssystem-Erkennung, Release-Feed und Installationspfade bleiben unverändert.

## Assets

Die drei vorhandenen Wolpi-Motive dienen als Editierziele. ImageGen entfernt ausschließlich den weißen Hintergrund und erhält Figur, Kleidung, Gegenstände, Schriftzüge und Pose. Die finalen Projektdateien besitzen echte Transparenz und werden zusätzlich auf Dateigröße geprüft.

## Tests und Prüfung

- Asset-Test prüft das Vorhandensein, Alpha-Transparenz und eine vernünftige Dateigrößenobergrenze der Wolpis.
- Website-Vertragstest prüft alle sechs Screenshot-Referenzen und unveränderte Download-Hooks.
- Hugo-Build und vorhandene Downloadtests laufen.
- Desktop- und Mobilansicht werden als Screenshots visuell geprüft.
