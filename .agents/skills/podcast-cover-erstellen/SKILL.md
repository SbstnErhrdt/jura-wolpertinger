---
name: podcast-cover-erstellen
description: Erstellt oder ueberarbeitet konsistente, performante Podcast-Cover fuer Jura Wolpertinger. Verwenden, wenn ein thematisches Wolpi-Cover fuer eine Podcast-Reihe erzeugt, visuell geprueft, als PNG optimiert oder fuer den Podcast-Upload vorbereitet werden soll. Nicht fuer Audio-Konvertierung, Podcast-Metadaten oder allgemeine Marketinggrafiken verwenden.
---

# Podcast-Cover erstellen

## Grenzen

Dieser Skill verantwortet Motiv, Bildgenerierung, Wolpi-Konsistenz, lokale Ablage und PNG-Optimierung. Fuer Audio, Katalog, Manifest und Produktionsveroeffentlichung gilt `skills/podcast-hochladen/SKILL.md`.

## 1. Bestand und Identitaet pruefen

1. Lies Reihentitel, Episodenthema und Ausgabe.
2. Pruefe die vorhandenen Cover unter `src/renderer/public/assets/podcast-covers/`.
3. Nutze ein passendes Bild aus `assets/wolpi/` als visuelle Identitaetsreferenz.
4. Erhalte warmes braunes Fell, uebergrosse Hasenohren, kleines goldenes Geweih, gefiederte Fluegel, buschigen Schweif und das blau-goldene Paragrafen-Halstuch.

## 2. Eine klare Bildmetapher waehlen

Leite aus der Reihe eine einzige, auf 104 bis 144 Pixel Kantenlaenge erkennbare Bildmetapher ab. Gesicht und Hauptrequisite liegen im sicheren mittleren Bildbereich. Vermeide duenne Details und wichtige Elemente direkt am Rand.

Grenze verwandte Reihen durch unterschiedliche Metaphern ab. Verwende keine Schrift, Zahlenkolonnen, echten Formulare, Logos, Wasserzeichen, Wappen, Siegel oder sonstige Hoheitszeichen.

## 3. Mit ImageGen erzeugen

Nutze das eingebaute Bildmodell mit der kanonischen Wolpi-Referenz. Fordere quadratische, vollflaechige Album-Art im polierten Storybook-Stil mit tiefem Blau und warmem Gold an. Der Prompt nennt Thema, zentrale Metapher, Wolpi-Merkmale, Thumbnail-Komposition und alle Ausschluesse. Erzeuge keine Beschriftung im Bild.

Pruefe das Ergebnis mit `view_image`. Verwirf es, wenn Wolpi nicht wiedererkennbar ist, Ohren oder Geweih abgeschnitten sind, Schrift oder Hoheitszeichen erscheinen oder die Metapher in Thumbnail-Groesse unklar bleibt.

## 4. Ablage und Optimierung

Der Zielpfad lautet immer:

```text
src/renderer/public/assets/podcast-covers/<reihen-slug>.png
```

Optimiere das ausgewaehlte Bild mit:

```bash
.agents/skills/podcast-cover-erstellen/scripts/optimize-cover.sh \
  "/absoluter/pfad/zum/eingangsbild" \
  "src/renderer/public/assets/podcast-covers/<reihen-slug>.png"
```

Das Skript normalisiert auf 1024 x 1024 Pixel, entfernt Metadaten und versucht 256, 192 und 128 Farben. Ziel sind hoechstens 600 KB; mehr als 800 KB ist ungueltig. Unterschaerfe oder sichtbare Banding-Artefakte sind trotz bestandener Groessenpruefung ein Ablehnungsgrund.

## 5. Abschlusspruefung

1. Pruefe mit `file` und `magick identify`, dass die Datei ein quadratisches PNG mit exakt 1024 x 1024 Pixeln ist.
2. Pruefe mit `stat`, dass sie nicht groesser als 819200 Bytes ist.
3. Oeffne das finale PNG erneut und pruefe es in voller Groesse sowie als Thumbnail.
4. Uebergib danach Reihen-Slug, Serien-ID und Cover-Pfad an `skills/podcast-hochladen/SKILL.md`.

Der oeffentliche Pfad bleibt `<reihen-slug>/cover.png`; die Katalog-URL endet entsprechend auf `/<reihen-slug>/cover.png`.
