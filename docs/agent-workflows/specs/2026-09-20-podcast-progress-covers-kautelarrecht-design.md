# Podcast-Fortschritt, Wolpi-Cover und Kautelarrecht

## Ziel

Die Podcast-Übersicht zeigt den Hörfortschritt jeder Reihe so klar wie die
Sammlungsübersicht den Karteikartenfortschritt. Jede veröffentlichte Reihe erhält
ein eigenes thematisches Wolpi-Cover. Zusätzlich wird der Podcast
„Kautelarrecht von Erbrecht bis MoPeG“ veröffentlicht.

## Fachliche Einordnung

Der neue Podcast wird so eingeordnet:

`Zivilrecht → Kautelarrecht → Kautelarrecht von Erbrecht bis MoPeG`

Die Reihe trägt die Ausgabe `September 2026`. Sie erhält stabile UUIDs und
Slugs. Die M4A-Quelle wird unverändert gelassen und für den Upload in eine
temporäre Mono-MP3 mit ungefähr 128 kbit/s konvertiert.

## Fortschrittsanzeige

Jede Podcast-Karte zeigt einen barrierefreien Fortschrittsbalken. Der Prozentwert
wird über die gehörte Zeit aller Folgen der Reihe berechnet:

- eine abgeschlossene Folge zählt mit ihrer vollständigen Katalogdauer;
- eine angefangene Folge zählt höchstens bis zu ihrer Katalogdauer;
- eine noch nicht gestartete Folge zählt mit null Sekunden;
- Reihen ohne positive Gesamtdauer zeigen null Prozent.

Neben dem Prozentwert steht, wie viele Folgen vollständig abgeschlossen sind.
Der Balken übernimmt Abstände, Höhe, Farben und Dunkelmodus-Verhalten der
Karteikarten-Sammlungen. ARIA-Werte nennen Reihe, Prozentwert und Abschlüsse.

## Podcast-Cover

Für jede Reihe entsteht ein quadratisches, textfreies Cover im vorhandenen
Wolpi-Illustrationsstil. Wolpi bleibt anhand von Fell, großen Ohren, kleinem
Geweih, Flügeln und blau-goldenem Paragrafen-Halstuch klar wiedererkennbar.
Themenspezifische Requisiten unterscheiden die Reihen:

- BayBO: Bauplan, Winkel und bayerisches Gebäude;
- Kommunalrecht: Rathaus und Gemeinderat;
- Polizei- und Sicherheitsrecht: Schutzschild, Absperrung und Gesetzbuch;
- Steuerrecht-AO: Akten, Rechner und geordnete Zahnräder;
- Übersichtssammlung Strafrecht: Waage, Urteilsaufbau und Strafzumessung;
- Vorläufiger Rechtsschutz: Schild und Schwert vor einem Gericht;
- Kautelarrecht: Notariatstisch, Vertrag, Stammbaum und Gesellschaftsbezug.

Die Bilder enthalten keine Schrift, Logos oder amtlichen Hoheitszeichen. Die
finalen Dateien werden im Repository gespeichert und öffentlich unter dem
jeweiligen Reihenpfad im Podcast-Storage veröffentlicht. `artworkUrl` bleibt die
einzige Katalogquelle; die bisherige blaue Wolpi-Kachel dient als Fallback, wenn
kein Bild vorhanden ist oder das Bild nicht geladen werden kann.

## Datenfluss und Komponenten

- Eine kleine, reine Shared-Funktion berechnet Prozentwert und Abschlüsse aus
  `PodcastEpisode[]`.
- `PodcastsView.vue` rendert Cover, Beschriftung und Balken pro Reihe.
- `PodcastSeriesView.vue` verwendet dasselbe Cover mit sinnvoller
  Alternativbeschreibung beziehungsweise dekorativer Kennzeichnung.
- Katalogdateien und produktive Serienzeilen erhalten identische öffentliche
  `artworkUrl`-Werte.
- Das neue Kautelarrecht-Manifest und der lokale Desktop-Katalog verwenden
  identische IDs, Texte, Dauer, Zeitpunkte und URLs.
- Die Hilfe erläutert, dass der Balken gehörte Zeit zeigt und der Abschlusszähler
  nur vollständig gehörte Folgen zählt.

## Fehlerverhalten

Fehlender Fortschritt wird als null behandelt. Positionen kleiner null oder
größer als die Folgendauer werden auf den gültigen Bereich begrenzt. Ein
fehlerhaftes Cover darf weder Navigation noch Textdarstellung blockieren; die
vorhandene Wolpi-Platzhalterkachel übernimmt.

## Tests und Veröffentlichung

Die Umsetzung erfolgt testgetrieben:

1. Unit-Tests für leere, teilweise gehörte, überlange und abgeschlossene Folgen.
2. UI-Vertragstests für Cover-Fallback, Beschriftung, Prozentwert und ARIA-Balken.
3. Katalog-/Manifest-Test für Kautelarrecht.
4. Publisher- und Katalogtests für stabile URLs und Metadaten.
5. Typecheck, relevante Vitest-Suiten, Build und responsive Browserprüfung.
6. Produktions-Dry-Run, idempotenter Audio-/Metadaten-Upload, Cover-Upload,
   Web-Deployment und anschließende öffentliche Prüfung von Katalog, Audio,
   Bildern und Podcast-Seite.

## Nicht im Umfang

Es gibt keinen Cover-Editor, keine nutzerdefinierten Bilder und keine neue
Podcast-Datenbankstruktur. Der bestehende private Folgenfortschritt bleibt
unverändert.
