# Podcast-Player: Icon-Ausrichtung

## Ziel

Die Symbole des Podcast-Players sitzen in allen zugehörigen Schaltflächen sichtbar mittig. Das gilt für Play und Pause in der Folgenliste und im globalen Player sowie für vorherige beziehungsweise nächste Folge, 15 Sekunden zurück, 30 Sekunden vor und das Auf- beziehungsweise Zuklappen des Players.

## Ursache

Die Schaltflächen definieren zwar feste Außenmaße, verlassen sich für die innere Ausrichtung aber auf das vom UI-Framework erzeugte Layout. Bei den Sprungschaltflächen kommt eine absolut positionierte Sekundenangabe ohne festgelegte Position hinzu. Dadurch können SVG und Zahl abhängig von Schaltflächengröße und Framework-Stilen gegeneinander verrutschen. Das dreieckige Play-Symbol wirkt trotz geometrischer Zentrierung optisch leicht nach links versetzt.

## Gestaltung

- Alle betroffenen Schaltflächen erhalten eine gemeinsame, explizite Zentrierung über ihre volle Breite und Höhe.
- Die SVG-Symbole werden als Blockelemente dargestellt, damit keine Textgrundlinie ihre vertikale Position beeinflusst.
- Die Angaben `15` und `30` werden in einer eigenen, die gesamte Schaltfläche füllenden Ebene mittig über dem jeweiligen Kreis-Pfeil platziert.
- Das Play-Dreieck wird für die optische Mitte um einen Pixel nach rechts verschoben. Pause und die übrigen symmetrischen Symbole bleiben geometrisch zentriert.
- Feste Schaltflächenmaße, Farben, Abstände, Klickziele, Beschriftungen und Bedienverhalten bleiben unverändert.

## Abgrenzung

Titel, Beschreibungen, Folgenzeilen, Metadaten, Player-Inhalte und responsive Umbrüche werden nicht verändert. Die Korrektur führt keine neue Komponente und keine neue Abhängigkeit ein.

## Prüfung

- Ein Regressionstest beschreibt die erforderliche Zentrierung und die definierte Position der Sekundenangaben.
- Der gezielte Renderer-Test läuft vor der Änderung rot und danach grün.
- `pnpm run typecheck` stellt sicher, dass die Vue- und TypeScript-Struktur unverändert gültig bleibt.
- Eine visuelle Prüfung kontrolliert Play, Pause, 15 Sekunden zurück und 30 Sekunden vor in der gerenderten Desktop-Ansicht.
