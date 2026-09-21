# Podcastsuche

Date: 2026-09-21

## Ziel

Die Podcastübersicht erhält eine schnelle, verständliche Suche, die Rechtsgebiete, Reihen und einzelne Folgen findet, ohne den kleinen globalen Katalog serverseitig neu zu laden.

## Suchverhalten

- Die Suche prüft Rechtsgebiet, Reihentitel, Beschreibung, Ausgabe sowie Titel und Beschreibung aller Folgen.
- Groß-/Kleinschreibung und deutsche Diakritika beeinflussen Treffer nicht; Eingaben werden beschnitten und normalisiert.
- Trifft nur eine Folge, bleibt die zugehörige Reihe als Ergebnis sichtbar.
- Rechtsgebietsüberschriften erscheinen nur, wenn darunter mindestens eine passende Reihe verbleibt.
- Die Reihenfolge des Katalogs bleibt unverändert.

## Oberfläche

- Unter dem Seitenkopf steht ein Suchfeld mit der Bezeichnung `Podcasts durchsuchen` und dem Platzhalter `Rechtsgebiet, Reihe oder Folge`.
- Eine Live-Statuszeile nennt die Zahl der gefundenen Reihen.
- Ein sichtbarer Zurücksetzen-Button erscheint nur bei aktiver Suche.
- Bei null Treffern erscheint ein eigener, ruhiger Leerzustand; Lade- und Fehlerzustand bleiben davon getrennt.
- Die bestehenden Karten, Cover, Fortschrittsbalken und Links bleiben unverändert.

## Architektur

Die Filterlogik liegt als reine, separat testbare Hilfsfunktion in `src/renderer/src/ui/podcastCatalogSearch.ts`. `PodcastsView.vue` hält nur Suchzustand und Darstellung. Es gibt keine neue API, keine neue Abhängigkeit und kein Laden aller nutzerspezifischen Daten.

## Tests

- Unit-Tests für Normalisierung, Treffer über alle Felder, Folgen-Treffer, Gruppierung und null Treffer.
- UI-Vertragstest für Suchfeld, Trefferzahl, Zurücksetzen und Leerzustand.
- E2E-Smoke für Suche und Navigation in eine gefundene Reihe.
