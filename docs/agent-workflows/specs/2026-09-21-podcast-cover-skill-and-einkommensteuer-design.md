# Podcast-Cover-Skill und Grundskript Steuerrecht

**Datum:** 21. September 2026  
**Status:** fachlich freigegeben

## Ziel

Das Projekt erhaelt einen wiederverwendbaren Skill fuer konsistente, performante
Jura-Wolpi-Podcast-Cover. Anschliessend wird eine neue Podcast-Reihe zum
Grundskript Steuerrecht mit einer ersten Folge zur Systematik des
Einkommensteuerrechts veroeffentlicht. Die bestehenden Cover werden mit demselben
Qualitaetsstandard komprimiert, damit die Podcast-Uebersicht schneller laedt.

## Umfang

- Neuer Projekt-Skill unter
  `.agents/skills/podcast-cover-erstellen/SKILL.md`.
- Neue Reihe **Grundskript Steuerrecht** in der Ueberkategorie
  **Steuerrecht**.
- Erste Folge **Systematik des Einkommensteuerrechts im zweiten
  Staatsexamen** aus
  `/Users/sbstn/Downloads/Systematik_des_Einkommensteuerrechts_im_zweiten_Staatsexamen.m4a`.
- Ausgabe der Reihe: **April 2026**.
- Neues thematisches Cover fuer die Reihe.
- Optimierung und erneute Veroeffentlichung aller vorhandenen Podcast-Cover.
- Verzoegertes Laden und asynchrones Dekodieren der Cover in der
  Podcast-Uebersicht.

Nicht Teil des Vorhabens sind eine Migration zu WebP, mehrere responsive
Cover-Dateien oder Aenderungen am Audioplayer.

## Cover-Konzept

Wolpi sitzt an einem Steuerrechts-Schreibtisch. Bildlich unterschiedliche
Einkunftsarten, etwa Arbeit, Vermietung und Gewerbe, laufen in einer zentralen
Steuerberechnung zusammen. Die Darstellung vermittelt Systematik und Ordnung,
nicht die Abgabenordnung als Maschine; dadurch bleibt das Motiv klar von der
vorhandenen Reihe **Steuerrecht-AO** unterscheidbar.

Das Bild ist quadratisch, vollflaechig, textfrei und im warmen blau-goldenen
Storybook-Stil der vorhandenen Podcast-Cover gestaltet. Wolpi bleibt anhand der
Projekt-Referenz erkennbar. Amtliche Logos, Wappen, Siegel, echte Formulare,
Wasserzeichen und sonstige Hoheitszeichen werden nicht uebernommen. Gesicht und
zentrales Motiv muessen auch bei 104 bis 144 Pixel Kantenlaenge lesbar bleiben.

## Vertrag des neuen Skills

Der Skill wird verwendet, wenn ein Podcast-Cover fuer Jura Wolpi neu erstellt
oder ueberarbeitet werden soll. Er ist nicht fuer Audio-Konvertierung,
Podcast-Metadaten oder allgemeine Marketinggrafiken zustaendig; fuer den Upload
verweist er auf `skills/podcast-hochladen/SKILL.md`.

Der Ablauf des Skills ist:

1. Bestehende Podcast-Cover und die Wolpi-Referenz in `assets/wolpi` pruefen.
2. Aus Reihe und Folgeninhalt eine einzelne, auf Thumbnail-Groesse erkennbare
   Bildmetapher ableiten.
3. Mit dem eingebauten Bildmodell ein quadratisches, textfreies Cover ohne
   Logos, Siegel oder Wasserzeichen erzeugen.
4. Das Ergebnis auf 1024 x 1024 Pixel normalisieren, Metadaten entfernen und
   als indiziertes PNG mit hoechstens 256 Farben optimieren.
5. Das Cover unter
   `src/renderer/public/assets/podcast-covers/<series-slug>.png` ablegen.
6. Dateityp, quadratische Abmessungen, Dateigroesse und Lesbarkeit in
   Thumbnail-Groesse pruefen.
7. Das lokale Cover und den Katalogeintrag an den Podcast-Upload-Workflow
   uebergeben.

Der Skill setzt eine Zielgroesse von hoechstens 600 KB und ein hartes Limit von
800 KB. Wird das Ziel nicht erreicht, werden Farbzahl und PNG-Komprimierung
erneut angepasst, ohne die Bildabmessungen unter 1024 x 1024 Pixel zu senken.
Ein Test mit einem vorhandenen Cover reduzierte die Datei von 2,29 MB auf
454 KB ohne erkennbaren Qualitaetsverlust in der App-Darstellung.

## Podcast-Daten

- Ueberkategorie: `Steuerrecht`
- Reihentitel: `Grundskript Steuerrecht`
- Reihen-Slug: `grundskript-steuerrecht-april-2026`
- Ausgabe: `April 2026`
- Folgentitel: `Systematik des Einkommensteuerrechts im zweiten Staatsexamen`
- Folgen-Slug:
  `systematik-des-einkommensteuerrechts-im-zweiten-staatsexamen`
- Reihenbeschreibung: Eine klausurorientierte Lernreihe zu den Grundlagen und
  zur Systematik des Steuerrechts im zweiten Staatsexamen.
- Folgenbeschreibung: Die Systematik des Einkommensteuerrechts als Einstieg in
  das Grundskript Steuerrecht.
- Veroeffentlichungsdatum: 21. September 2026

Stabile UUIDs werden einmalig erzeugt und anschliessend in Katalog und Manifest
identisch verwendet. Die Quelldatei wird nach dem bestehenden Upload-Workflow
in ein browserkompatibles Mono-MP3 mit 128 kbit/s umgewandelt.

## Performance und UI

Alle bestehenden lokalen Podcast-Cover werden mit denselben 1024-Pixel- und
PNG-Optimierungsregeln verarbeitet. Danach werden die optimierten Dateien
idempotent unter ihren unveraenderten `cover.png`-Pfaden veroeffentlicht. Die
URLs und Katalog-IDs bleiben stabil, sodass keine Datenmigration erforderlich
ist.

Das Cover-Bild in der Uebersicht erhaelt `loading="lazy"` und
`decoding="async"`. Das erste sichtbare Cover darf der Browser weiterhin nach
seiner Priorisierung laden; es wird keine eigene Thumbnail-API eingefuehrt.

## Qualitaetssicherung

- Der neue Skill wird mit dem Validator des Skill-Creator-Workflows geprueft.
- Tests sichern die neue Kataloghierarchie, IDs, Slugs, Metadaten und
  Audioquelle ab.
- Tests sichern die Attribute fuer verzoegertes Laden und asynchrones
  Dekodieren ab.
- Ein Dry-Run prueft Audio- und Cover-Publikationsplaene vor externen
  Schreibvorgaengen.
- Nach der Veroeffentlichung werden oeffentlicher Katalog, Audio-URL,
  Cover-URL, MIME-Typen und Dateigroessen geprueft.
- Die Podcast-Uebersicht wird bei Desktop- und mobiler Breite visuell geprueft.

## Fehlerverhalten

Bei fehlerhafter Quelldatei, fehlgeschlagener Konvertierung, ungueltigem Cover,
abweichenden IDs oder fehlgeschlagener Produktionspruefung wird die
Veroeffentlichung abgebrochen und der konkrete Schritt gemeldet. Vorhandene
Produktionsdaten werden nur ueber die idempotenten Upsert-Wege des bestehenden
Podcast-Workflows aktualisiert.
