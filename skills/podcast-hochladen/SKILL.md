---
name: podcast-hochladen
description: Veröffentlicht neue Podcast-Reihen oder -Folgen in Jura Wolpertinger, einschließlich Audio-Prüfung, M4A/WAV-zu-MP3-Konvertierung, Desktop-Katalog, Supabase-Metadaten, Storage-Upload und öffentlicher Verifikation. Verwenden, wenn eine Audiodatei als Podcast hochgeladen, eine Folge ergänzt, ein Podcast-Upload geprüft oder ein fehlgeschlagener Upload idempotent wiederholt werden soll.
---

# Podcast hochladen

## Grundmodell

Veröffentliche Podcasts immer in dieser Hierarchie:

`Rechtsgebiet -> Podcast-Reihe -> Folge`

Speichere globale Metadaten in `podcast_legal_areas`, `podcast_series` und `podcast_episodes`. Lade MP3-Dateien in den öffentlichen Supabase-Storage-Bucket `podcast-audio`. Verändere `podcast_episode_progress` nicht; dort bleibt privater Hörfortschritt pro Nutzer gespeichert.

## 1. Kontext und Metadaten klären

1. Lies zuerst `AGENTS.md`, `docs/agent-workflows/specs/2026-07-26-learning-navigation-statistics-podcasts-design.md`, `scripts/podcasts/publish-podcast.ts` und vorhandene Dateien unter `src/shared/podcasts/`.
2. Prüfe `git status --short` und erhalte fremde Änderungen.
3. Ermittle mindestens Rechtsgebiet, Reihentitel, Ausgabe, Folgentitel, Beschreibung, Veröffentlichungszeitpunkt und Quelldatei.
4. Verwende bei einer neuen Reihe neue feste UUIDs und eindeutige Slugs. Verwende bei einer weiteren Folge die vorhandene Reihen-ID und die nächste freie Folgennummer. Ändere IDs bei Wiederholungen niemals.
5. Leite den Storage-Pfad ausschließlich so ab:

```text
<reihen-slug>/<zweistellige-folgennummer>-<folgen-slug>.mp3
```

Prüfe vor dem Schreiben, dass weder ID noch Slug, Folgennummer oder Storage-Pfad mit einer anderen Veröffentlichung kollidieren.

## 2. Audio vorbereiten

Arbeite nie direkt auf der Quelldatei. Prüfe sie zuerst:

```bash
afinfo "/absoluter/pfad/zur/quelle.m4a"
```

Nutze ein eindeutiges temporäres Verzeichnis. Löse FFmpeg zuerst über den `PATH` auf. Installiere andernfalls das bereits für `generate-learning-podcast` vorgesehene `imageio-ffmpeg>=0.6,<1` ausschließlich in dieses temporäre Verzeichnis:

```bash
podcast_tmp_dir=$(mktemp -d)
podcast_ffmpeg_path=$(command -v ffmpeg || true)
if [ -z "$podcast_ffmpeg_path" ]; then
  python3 -m pip install --disable-pip-version-check \
    --target "$podcast_tmp_dir/pydeps" 'imageio-ffmpeg>=0.6,<1'
  podcast_ffmpeg_path=$(PYTHONPATH="$podcast_tmp_dir/pydeps" python3 -c \
    'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')
fi
```

Konvertiere nach Mono-MP3 mit ungefähr 128 kbit/s und prüfe das Ergebnis:

```bash
"$podcast_ffmpeg_path" -hide_banner -loglevel error -y \
  -i "/absoluter/pfad/zur/quelle.m4a" -vn -ac 1 -codec:a libmp3lame -b:a 128k \
  "$podcast_tmp_dir/folge.mp3"
afinfo "$podcast_tmp_dir/folge.mp3"
```

Nutze `ffprobe`, falls `afinfo` auf dem System nicht vorhanden ist. Verwende `afconvert` nicht für MP3: Auf aktuellen macOS-Versionen kann dessen gelisteter MPG3-Encoder beim Setzen des Zielformats mit `cfmt/fmt?` scheitern.

Stoppe, wenn die MP3 leer, nicht abspielbar, kein MPEG Layer 3 oder größer als `104857600` Bytes (100 MiB) ist. Übernimm die geprüfte Dauer in Sekunden mit höchstens drei Nachkommastellen in Katalog und Manifest.

## 3. Desktop-Katalog aktualisieren

1. Lege die neue Reihe als fokussierte Datei unter `src/shared/podcasts/` an oder ergänze die bestehende Reihe.
2. Verwende exakt dieselben IDs, Slugs, Texte, Dauer, Audio-URL und Veröffentlichungszeitpunkte wie im Upload-Manifest.
3. Ergänze den aggregierten Katalog in `src/shared/podcasts/catalog.ts` bei einer neuen Reihe.
4. Schreibe zuerst einen fehlschlagenden Test unter `tests/podcasts/`; implementiere danach den kleinsten Katalogschritt und führe den Test erneut aus.
5. Prüfe, dass `src/main/services/services.ts` den aggregierten `PODCAST_CATALOG` verwendet. Dadurch zeigt auch die lokale Desktop-App die Veröffentlichung.

## 4. Upload-Manifest anlegen

Lege ein JSON-Manifest unter `scripts/podcasts/manifests/` an. Speichere darin nur Katalogdaten, niemals Zugangsdaten oder lokale Audiodateipfade. Nutze diese Form:

```json
{
  "legalArea": {
    "id": "stabile-uuid",
    "slug": "oeffentliches-recht",
    "name": "Öffentliches Recht",
    "sortIndex": 20
  },
  "series": {
    "id": "stabile-uuid",
    "slug": "eindeutiger-reihen-slug",
    "title": "Reihentitel",
    "description": "Beschreibung",
    "edition": "August 2026",
    "sortIndex": 20,
    "publishedAt": "2026-08-09T00:00:00.000Z"
  },
  "episode": {
    "id": "stabile-uuid",
    "slug": "eindeutiger-folgen-slug",
    "number": 1,
    "title": "Folgentitel",
    "description": "Beschreibung",
    "durationSeconds": 1555.043,
    "publishedAt": "2026-08-09T00:00:00.000Z"
  }
}
```

Validiere UUIDs, Slugs, ISO-Zeitpunkte und die Übereinstimmung mit dem Desktop-Katalog in Tests.

## 5. Dry-Run ausführen

Führe den Publisher ohne `--apply` aus:

```bash
pnpm podcasts:publish -- \
  --url=https://app.jura-wolpi.de/api \
  --manifest=scripts/podcasts/manifests/<manifest>.json \
  --audio="$podcast_tmp_dir/folge.mp3"
```

Prüfe Reihentitel, Folgennummer, Storage-Pfad, Größe und Ziel-URL. Ein Dry-Run benötigt keinen Service-Role-Key und führt keine entfernten Schreibzugriffe aus. Stoppe bei einer geplanten Produktionsveröffentlichung, wenn die Ausgabe `127.0.0.1`, `localhost` oder eine andere lokale URL nennt.

## 6. Veröffentlichen

Behandle `../jura-supabase/.env` als lokale Standardkonfiguration. Verwende sie nicht versehentlich für Produktion. Gib niemals Werte von `SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `ANON_KEY` oder vergleichbaren Variablen aus.

Liegen Produktionswerte in einer anderen sicheren Env-Datei, nutze `--env-file=<pfad>` und zusätzlich immer die explizite Produktions-URL. Im aktuellen Betrieb liegen die Werte auf `server.02` unter `/home/docker-compose/jura-supabase-wolpi/.env`. Source diese Datei nicht vollständig: Sie enthält Werte, die nicht als Shell-Zuweisungen gequotet sind. Lies ausschließlich die beiden benötigten, exakt benannten Zeilen in Prozessvariablen und prüfe nur, dass sie nicht leer sind:

```bash
podcast_service_role_key="$(ssh server.02 'cd /home/docker-compose/jura-supabase-wolpi && awk -F= '\''$1 == "SERVICE_ROLE_KEY" { print substr($0,index($0,"=")+1); exit }'\'' .env')"
podcast_anon_key="$(ssh server.02 'cd /home/docker-compose/jura-supabase-wolpi && awk -F= '\''$1 == "ANON_KEY" { print substr($0,index($0,"=")+1); exit }'\'' .env')"
test -n "$podcast_service_role_key"
test -n "$podcast_anon_key"
```

Führe nach erfolgreichem Produktions-Dry-Run denselben Befehl genau einmal mit `--apply` aus. Übergib die beiden Werte nur an diesen Prozess:

```bash
SERVICE_ROLE_KEY="$podcast_service_role_key" ANON_KEY="$podcast_anon_key" \
pnpm podcasts:publish -- \
  --url=https://app.jura-wolpi.de/api \
  --manifest=scripts/podcasts/manifests/<manifest>.json \
  --audio="$podcast_tmp_dir/folge.mp3" \
  --apply
```

Der Publisher akzeptiert für die öffentliche Prüfung `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY` oder `ANON_KEY`. Verwende den auf dem Zielsystem tatsächlich belegten Namen; erfinde keinen neuen Schlüssel.

Der Publisher führt diese Reihenfolge aus:

1. Rechtsgebiet idempotent per fester ID upserten.
2. Reihe mit `is_published = false` upserten.
3. Folge mit `is_published = false` upserten.
4. MP3 mit `Content-Type: audio/mpeg` und `x-upsert: true` unter dem abgeleiteten Pfad hochladen.
5. öffentliche Audio-URL per HEAD und MIME-Type prüfen.
6. Folge veröffentlichen.
7. Reihe veröffentlichen.
8. anonymen `get_podcast_catalog`-RPC mit dem Publishable-Key prüfen.

Schlägt die letzte Katalogprüfung fehl, setzt der Publisher Folge und Reihe wieder auf unveröffentlicht. Schlägt ein früherer Schritt fehl, bleiben die vorbereiteten Metadaten unveröffentlicht. Wiederhole nach Behebung denselben Befehl mit unveränderten IDs und Slugs; die Upserts erzeugen keine Duplikate.

## 7. Öffentlich und lokal verifizieren

1. Rufe die ausgegebene MP3-URL ohne Anmeldung mit HEAD ab und erwarte HTTP 200 sowie `audio/mpeg`.
2. Prüfe den öffentlichen Katalog oder die produktive Podcast-Seite ohne Service-Role-Kontext.
3. Prüfe exakt eine Reihe und eine Folge mit den Manifest-IDs.
4. Spiele Anfang und einen späteren Abschnitt der Folge ab; prüfe Dauer und Seek.
5. Führe mindestens diese lokalen Checks aus:

```bash
pnpm vitest run tests/podcasts tests/main/services.test.ts tests/shared/schemas.test.ts \
  tests/renderer/podcastPlayer.test.ts tests/renderer/podcastsUi.test.ts
pnpm run typecheck
```

6. Führe den Publisher erneut ohne `--apply` aus und bestätige denselben Plan.
7. Melde Titel, Rechtsgebiet, öffentliche URL, geprüfte Dauer und alle ausgeführten Checks. Melde keine Zugangsdaten.

## Sicherheitsgrenzen

- Lösche keine bestehenden Katalogzeilen oder Storage-Objekte.
- Überschreibe nur den im aktuellen Manifest abgeleiteten Storage-Pfad.
- Veröffentliche nie vor erfolgreicher öffentlicher Audio-Prüfung.
- Verwende ausschließlich Service-Role-Zugangsdaten aus lokaler Umgebung, nie im Renderer oder Browser.
- Behandle Teilfehler als wiederholbaren Upsert, nicht als Anlass für manuelle Datenlöschung.
