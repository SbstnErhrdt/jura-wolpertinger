# Podcast-Cover auf Übersichtskarten

## Ziel

Die thematischen Podcast-Cover sollen auf der Podcast-Übersicht ohne den derzeitigen blauen Innenrahmen erscheinen und etwas mehr visuelles Gewicht erhalten. Die Kartenstruktur, Fortschrittsanzeige und mobile Lesbarkeit bleiben unverändert.

## Darstellung

- Ein vorhandenes Reihen-Cover wird vollflächig und quadratisch dargestellt.
- Für echte Cover entfallen Hintergrundfarbe, Rahmen und Innenabstand des bisherigen Cover-Containers.
- Die abgerundeten Ecken und das Zuschneiden mit `object-fit: cover` bleiben erhalten.
- Die Cover-Spalte wächst auf Desktop moderat von `132px` auf `144px`.
- Unter dem bestehenden mobilen Breakpoint wächst sie von `96px` auf `104px`.
- Das Fallback mit Jura-Wolpi-Icon und „Jura Audio“ behält den blauen Hintergrund, Rahmen und Innenabstand. Dadurch bleibt ein fehlendes oder nicht ladbares Cover klar erkennbar.

## Technische Umsetzung

`PodcastArtwork.vue` kennzeichnet den Container nur dann mit einer zusätzlichen Artwork-Klasse, wenn eine Bild-URL vorhanden ist und das Bild nicht in den Fehlerzustand gewechselt ist. CSS setzt die vollflächige Darstellung ausschließlich für diese Klasse um. Die Rasterbreiten werden in den vorhandenen Desktop- und Mobile-Regeln angepasst; weitere Komponenten oder Datenmodelle ändern sich nicht.

## Tests und Abnahme

- Ein Renderer-Vertragstest prüft die Artwork-Klasse, die rahmenlose CSS-Regel sowie die beiden Größenwerte.
- Der Test muss vor der Implementierung am fehlenden Verhalten scheitern und danach bestehen.
- Typecheck und die fokussierten Podcast-UI-Tests müssen erfolgreich sein.
- Ein visueller Smoke-Test prüft Desktop und mobilen Breakpoint.
- Nach dem Produktionsbuild wird die Live-Podcast-Seite geprüft.
