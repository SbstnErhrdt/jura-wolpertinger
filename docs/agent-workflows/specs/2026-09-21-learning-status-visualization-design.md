# Lernstandsfarben und Statistiklinks

Date: 2026-09-21

## Ziel

Sammlungsübersicht und Lernstatistik verwenden dieselbe verständliche Darstellung des letzten Lernstands. Nutzer:innen erkennen auf einen Blick, welche Karten noch unsicher, teilweise sicher, sicher oder noch unbearbeitet sind, und gelangen aus der Statistik direkt in die jeweilige Sammlung.

## Fachliche Semantik

Für jede aktuell lernbare Karte zählt ausschließlich die letzte wirksame Bewertung:

- `1` wird als `Nicht gewusst` dargestellt.
- `2` wird als `Teilweise gewusst` dargestellt.
- `3` und `4` werden gemeinsam als `Gewusst` dargestellt.
- Karten ohne wirksame Bewertung bilden den neutralen Rest `Noch nicht bearbeitet`.
- Archivierte, pausierte oder wegen Qualitätsproblemen ausgeschlossene Karten gehören nicht in den Nenner der segmentierten Leiste.

Die vorhandene Kennzahl „einmal bearbeitet“ bleibt unverändert. Die Farben ergänzen sie um Lernstand, ersetzen sie aber nicht.

## Oberfläche

- Eine gemeinsame `LearningStatusBar`-Komponente zeichnet alle segmentierten Balken und erzeugt den vollständigen, textlichen Alternativwert für assistive Technik.
- Rot steht für `Nicht gewusst`, Orange für `Teilweise gewusst`, Grün für `Gewusst`, die neutrale Spur für `Noch nicht bearbeitet`.
- Eine kompakte Legende auf der Sammlungsübersicht erklärt die vier Zustände; in der Statistik übernehmen die bereits sichtbaren Zeilenbezeichnungen diese Funktion.
- Die Gesamtverteilung in „Letzte Bewertung je Karte“ verwendet dieselben drei Bewertungsfarben.
- Die Sammlungszeilen der Statistik verwenden dieselbe segmentierte Leiste. Der Sammlungsname wird zusammen mit einem kleinen Pfeil als Router-Link zur Sammlungsdetailseite dargestellt; die gesamte Zeile bleibt nicht klickbar.
- Farben erhalten passende helle und dunkle Varianten und sind nie der einzige Informationsträger.

## Datenfluss

`StudyOverview` erhält gruppierte Statuszähler. Die lokale Engine berechnet sie direkt aus den bereits geladenen, lernbaren Karten. Das Cloud-RPC liefert dieselbe camelCase-Struktur. Die Statistikseite verknüpft ihre Sammlungsdaten mit den ohnehin geladenen Study-Overviews, sodass kein N+1-Laden einzelner Karten entsteht.

## Fehler- und Randfälle

- Eine Sammlung ohne lernbare Karten zeigt weiterhin „Keine lernbaren Karten“.
- Fehlende oder ältere Cloud-Antworten werden nicht still als Nullstände ausgegeben; die Zod-Vertragsprüfung bleibt verbindlich.
- Ein vollständig unbearbeiteter Bestand ist vollständig neutral, ein vollständig bewerteter Bestand enthält keinen neutralen Rest.
- Segmentbreiten werden gegen negative Werte und Rundungsüberläufe abgesichert.

## Tests

- Shared-Engine-Test für alle vier Bewertungswerte, unbearbeitete und ausgeschlossene Karten.
- Schema-/Cloud-Vertragstest für die neuen Zähler.
- UI-Vertragstest für gemeinsame Komponente, Legende, Farbklassen, ARIA-Text und Sammlungslinks.
- E2E-Prüfung der Segmentanzeige sowie der Navigation von Statistik zur Sammlung.
