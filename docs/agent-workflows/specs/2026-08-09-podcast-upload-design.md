# Podcast-Upload: Polizei- und Sicherheitsrecht

## Ziel

Die vorhandene Audiodatei `Klausurfallen_im_bayerischen_Polizei-_und_Versammlungsrecht.m4a` wird als neue Podcast-Reihe in Jura Wolpertinger veröffentlicht. Der Upload muss für Web- und Desktop-App konsistent, idempotent und öffentlich verifizierbar sein. Zusätzlich entsteht ein Repository-Skill, der spätere Podcast-Uploads reproduzierbar beschreibt.

## Katalogdaten

- Rechtsgebiet: `Öffentliches Recht`
- Reihe: `Polizei- und Sicherheitsrecht`
- Ausgabe: `August 2026`
- Folge 1: `Klausurfallen im bayerischen Polizei- und Versammlungsrecht`
- Beschreibung: knappe Einordnung als Lernfolge zu typischen Klausurfallen im bayerischen Polizei- und Versammlungsrecht
- Veröffentlichung: August 2026

Reihe und Folge erhalten feste UUIDs und Slugs. Wiederholte Ausführungen aktualisieren dadurch dieselben Datensätze, statt Duplikate anzulegen.

## Architektur und Datenfluss

Der bestehende Katalog bleibt dreistufig:

`Rechtsgebiet -> Podcast-Reihe -> Folge`

Supabase speichert Rechtsgebiet, Reihe und Folge in `podcast_legal_areas`, `podcast_series` und `podcast_episodes`. Die Audiodatei liegt im öffentlichen Storage-Bucket `podcast-audio`. Hörfortschritt bleibt davon getrennt und wird privat pro Nutzer in `podcast_episode_progress` gespeichert.

Da der Storage-Bucket ausschließlich MP3 akzeptiert, wird die angelieferte AAC/M4A-Datei vor dem Upload in eine MP3-Datei umgewandelt. Die Quelldatei bleibt unverändert. Der Upload verwendet den bereits eingerichteten Service-Role-Zugang ausschließlich lokal; Zugangsdaten werden weder in Dateien noch in Ausgaben übernommen.

Der Veröffentlichungsablauf lautet:

1. Quelldatei, Audioformat, Dauer und Dateigröße prüfen.
2. MP3 erzeugen und erneut technisch prüfen.
3. Rechtsgebiet idempotent anlegen oder aktualisieren.
4. Reihe und Folge mit `is_published = false` upserten.
5. MP3 mit aktiviertem Storage-Upsert hochladen.
6. öffentlich abrufbare Audiodatei prüfen.
7. Folge und danach Reihe veröffentlichen.
8. öffentlichen Katalog-RPC und Audio-URL prüfen.

Die Desktop-App besitzt zusätzlich einen eingecheckten Fallback-Katalog. Er wird um dieselbe Reihe erweitert, damit lokale Nutzung und Web-App denselben Podcast anzeigen.

## Wiederverwendbarer Upload

Ein generischer, dry-run-fähiger Uploadweg ersetzt keine bestehende BayBO-Veröffentlichung, sondern ergänzt sie für einzelne oder weitere Folgen. Eingaben sind Audiodatei, Rechtsgebiet, Reihe, Ausgabe, Folgentitel, Beschreibung sowie stabile Slugs und IDs. Ohne `--apply` führt der Weg keine Produktionsänderung aus.

Der neue Skill liegt unter `skills/podcast-hochladen`. Sein sichtbarer Name lautet `Podcast hochladen`, der technische Name `podcast-hochladen`. Er beschreibt:

- benötigte Metadaten und zulässige Audioformate
- sichere MP3-Konvertierung
- Dry-Run und idempotente Veröffentlichung
- Reihenfolge von Metadaten- und Storage-Schritten
- öffentliche Verifikation
- Verhalten bei Teilfehlern und erneuter Ausführung
- Schutz von Service-Role-Zugangsdaten

## Fehlerbehandlung

- Fehlende oder unlesbare Quellen stoppen vor jeder Produktionsänderung.
- Dateien über dem Bucket-Limit von 100 MiB stoppen vor dem Upload.
- Fehlende Zugangsdaten erlauben weiterhin den Dry-Run, aber keine Veröffentlichung.
- Metadaten bleiben bis zum erfolgreichen Audio-Upload unveröffentlicht.
- Schlägt die Verifikation fehl, werden Reihe und Folge nicht veröffentlicht.
- Eine erneute Ausführung repariert denselben Datensatz und denselben Storage-Pfad idempotent.
- Bestehende fremde Podcast-Reihen und Audiodateien werden nicht gelöscht oder überschrieben.

## Verifikation

- Tests prüfen die erzeugten Metadaten, stabilen IDs, Slugs, Storage-Pfade und die neue Desktop-Katalogreihe.
- Typecheck und relevante Podcast-Tests prüfen die App-Integration.
- Der Skill wird mit dem offiziellen Skill-Validator geprüft.
- Nach dem Produktionslauf werden Katalog-RPC, MP3-URL, MIME-Type, Dateigröße und Abspielbarkeit öffentlich geprüft.
- Der Abschluss nennt die ausgeführten Checks und verbleibende Einschränkungen.

## Nicht Bestandteil

- Keine Upload-Oberfläche in der App
- Kein Löschen oder Archivieren bestehender Podcasts
- Kein neues Artwork
- Keine Änderung am privaten Hörfortschrittsmodell
- Kein allgemeines Medienverwaltungssystem
