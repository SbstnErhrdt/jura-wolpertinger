# Lernpodcast-Skill aus juristischen PDF-Skripten

Datum: 2026-07-20

## Ziel

Das Repository erhaelt einen eigenstaendigen Skill `generate-learning-podcast`, der ein
hochgeladenes juristisches PDF-Skript vollautomatisch in eine Serie aus lernorientierten
MP3-Folgen umwandelt. Der Skill dient als kontrollierbarer Prototyp vor einer spaeteren
Integration in Jura Wolpertinger. Er nutzt die OpenAI API fuer semantische Analyse,
Sprechertexte, Quellenpruefung, Sprachsynthese und Audio-Transkription. Deterministische
Pipeline-Skripte verwalten Dateien, Zwischenstaende, Wiederaufnahme, Audio-Schnitt und
Validierung.

Parallel wird der bestehende Skill
`/Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen` in das Repository
uebernommen. Die Uebernahme veraendert seine fachliche Kartenlogik nicht.

## Abgrenzung der ersten Version

Die erste Version verarbeitet genau ein PDF pro Lauf und verwendet ausschliesslich dessen Inhalt
als fachliche Quelle. Sie recherchiert keine Gesetze, Urteile oder externen Erlaeuterungen und
nimmt keine Aktualitaetspruefung vor. Sie erzeugt Dateien in einem lokalen Ausgabeordner, aber
keine App-Oberflaeche, Datenbankeintraege, Cloud-Jobs oder Plattformintegration.

Die Pipeline laeuft nach dem Start ohne menschliche Freigabeschritte bis zum Ende. Analyseplan,
Quellennachweise und Pruefberichte bleiben als Zwischenartefakte erhalten, dienen aber nicht als
Pause oder Approval-Gate.

## Nutzeraufruf

Der Skill soll auf Auftraege wie diese reagieren:

- `Erstelle aus diesem PDF einen juristischen Lernpodcast.`
- `Mach aus dem hochgeladenen Skript eine MP3-Lernserie.`
- `Erzeuge Lernpodcast-Folgen aus <pfad-zum-skript.pdf>.`

Pflichtinput ist ein lesbares PDF. Optional kann der Nutzer einen Ausgabeordner angeben. Ohne
Angabe schreibt der Skill nach `output/learning-podcasts/<pdf-slug>/` relativ zum aktuellen
Arbeitsverzeichnis.

## Didaktisches Format

Die Ausgabe ist kein vertontes Abstract und kein Hoerbuch. Jede Folge bildet eine abgeschlossene
Lerneinheit und folgt diesem Grundmuster:

1. Kurzer Einstieg und Lernziel.
2. Der studentische Moderator fuehrt in das Problem ein.
3. Wolpi erklaert den Stoff schrittweise aus dem PDF.
4. Der Moderator fragt an typischen Missverstaendnissen oder Abgrenzungen nach.
5. Zwei bis drei direkte Abruffragen geben den Hoerenden jeweils eine echte Denkpause.
6. Mindestens ein Mini-Fall, eine Abgrenzung oder eine Anwendung verbindet Wissen und Klausurpraxis,
   sofern das PDF dafuer eine Grundlage enthaelt.
7. Eine knappe Wiederholung nennt die tragenden Punkte.
8. Ein ruhiger, unterstuetzender Abschluss beendet die Folge.

Eine Folge soll normalerweise 10 bis 15 Minuten dauern. Die fachliche Einheit ist wichtiger als
eine harte Zeitgrenze. Eine Folge darf den Korridor ueberschreiten, wenn andernfalls ein
Pruefungsschema, Streitstand oder Fallbeispiel auseinandergerissen wuerde.

Die Planung rechnet mit etwa 135 gesprochenen Woertern pro Minute. Der normale Zielbereich liegt
damit bei 1.350 bis 2.025 gesprochenen Woertern pro Folge. Denkpausen dauern standardmaessig fuenf
Sekunden und zaehlen zur Gesamtdauer.

## Rollen und Ton

### Studentischer Moderator

Der Moderator hat eine maennlich gelesene, erwachsene Stimme. Er ist neugierig und vernuenftig
vorbereitet, aber nicht allwissend. Seine Nachfragen bilden echte Lernhuerden ab. Er darf eine
verbreitete Fehlannahme formulieren, wird aber nicht kuenstlich ahnungslos oder zur Witzfigur.

### Wolpi

Wolpi ist die juristische Fachstimme. Die Stimme wirkt warm, hell, ruhig und leicht verspielt.
Wolpi erklaert praezise, gelassen und gelegentlich mit einem kleinen trockenen Witz. Fehler und
Unsicherheiten werden unterstuetzend behandelt, ohne uebertriebenes Lob und ohne belehrenden Ton.
Wolpi stellt keine Autoritaet, offizielle Pruefungsstelle oder Rechtsberatung dar.

Beide Stimmen sprechen natuerliches Deutsch. Dauergeplaenkel, aufgesetzte Radioshow-Sprache,
erfundene persoenliche Anekdoten und Humor auf Kosten der fachlichen Genauigkeit sind unzulaessig.
Die Standardstimme des Moderators ist `cedar`, die Standardstimme von Wolpi ist `marin`. Beide IDs
bleiben ueber Laufparameter konfigurierbar. Ein deutscher Audio-Smoke-Test prueft die Defaults auf
Rollenklarheit, Aussprache und Konsistenz; besteht eine Stimme den Test nicht, muss vor Abschluss
der Implementierung ein anderer eingebauter OpenAI-Voice-Slug als neuer Default festgelegt werden.

## Automatische PDF-Aufteilung

Die Pipeline leitet die Serie aus der Dokumentstruktur ab:

1. Metadaten, Seitenzahl, Textabdeckung und Dokument-Hash bestimmen.
2. Inhaltsverzeichnis, Ueberschriften, Nummerierungen und wiederkehrende Layoutsignale erkennen.
3. Kapitel in semantische Lerneinheiten aus Definitionen, Normen, Schemata, Streitstaenden,
   Abgrenzungen und Beispielen zerlegen.
4. Zu grosse Einheiten an fachlichen Grenzen teilen.
5. Zu kleine Nachbareinheiten zusammenfassen, wenn sie inhaltlich zusammengehoeren.
6. Aus geschaetzter Wortzahl und Sprechdauer 10- bis 15-minuetige Folgen planen.

Fehlt ein brauchbares Inhaltsverzeichnis, nutzt die Pipeline Ueberschriften, Themenwechsel,
Nummerierungen und semantische Aehnlichkeit als Fallback. Sie trennt nie allein nach fester
Seiten- oder Zeichenzahl.

## Quellenbindung

Das PDF ist die einzige fachliche Wissensquelle. Jede fachliche Aussage im internen Transkript
erhaelt mindestens einen Quellanker mit PDF-Seite und, soweit erkennbar, Abschnitt. Externe
Kenntnisse des Modells duerfen weder Luecken fuellen noch das Skript aktualisieren.

Ein separater Quellenpruefschritt vergleicht alle fachlichen Sprecher-Turns mit den referenzierten
PDF-Ausschnitten. Nicht belegte oder widerspruechliche Aussagen werden automatisch ueberarbeitet
und erneut geprueft. Pro Folge sind zwei Ueberarbeitungszyklen erlaubt. Bleibt eine Aussage danach
unsicher, wird die Folge nicht als erfolgreich ausgeliefert; Zwischenartefakte und
Qualitaetsbericht bleiben fuer die automatische Wiederaufnahme erhalten.

Seitenangaben werden nicht routinemaessig gesprochen. Sie erscheinen im begleitenden Markdown-
Transkript direkt an den jeweiligen Abschnitten. Jede Folge enthaelt einen knappen Hinweis, dass
sie KI-generiert ist, nur das hochgeladene Skript erklaert und keine Aktualitaetspruefung ersetzt.

## Pipeline

### 1. Eingabepruefung

- PDF-Pfad aufloesen und Dateityp pruefen.
- Leere, verschluesselte oder nicht lesbare PDFs mit klarer Fehlermeldung ablehnen.
- Dokument-Hash und technische Metadaten erfassen.
- PDF lokal in den Laufordner kopieren, damit Wiederaufnahme nicht vom urspruenglichen Pfad
  abhaengt.

### 2. Extraktion und Analyse

- Text seitenweise extrahieren; Seitenbilder bei Scan- oder Layoutbedarf beruecksichtigen.
- Layoutartefakte erkennen, ohne juristischen Wortlaut zu veraendern.
- Inhaltsstruktur und fachliche Konzepte als strukturierte JSON-Artefakte erzeugen.
- Aussprachekandidaten fuer Paragraphen, Abkuerzungen, Aktenzeichen, lateinische Begriffe und
  Fachwoerter sammeln.

### 3. Serienplanung

- Folgen anhand der fachlichen Struktur planen.
- Lernziele, Quellseiten, Zielwortzahl, Abruffragen und Anwendungsform pro Folge festlegen.
- `series-plan.json` und `series-plan.md` schreiben und ohne Pause weiterarbeiten.

### 4. Sprechertext

- Zuerst eine strukturierte Folge mit Sprecher-Turns, Rollen, Sprechhinweisen, Pausen und
  Quellankern erzeugen.
- Gesprochene Sprache statt vorgelesener Schriftsprache verwenden.
- Juristische Begriffe, Normen und Pruefungsreihenfolgen originalnah erhalten.
- Denkpausen explizit als nicht gesprochene Audiosegmente modellieren.

### 5. Quellenpruefung

- Jeden fachlichen Turn gegen seine Quellanker pruefen.
- Fehlende Belege, Ueberdehnungen und interne Widersprueche erkennen.
- Beanstandete Turns begrenzt neu schreiben und erneut pruefen.
- Nur bestandene Turns fuer die Sprachsynthese freigeben.

### 6. Sprachsynthese

- Jeden Turn separat mit der festen Stimme seiner Rolle erzeugen.
- WAV oder PCM als verlustarmes Zwischenformat verwenden.
- Lange Turns vor der TTS-Anfrage an Satz- oder Absatzgrenzen teilen.
- Ausspracheanweisungen und Rollenstil pro Anfrage konsistent anwenden.
- Fehlgeschlagene Turns einzeln wiederholen, statt eine ganze Folge neu zu erzeugen.

### 7. Audio-Produktion

- Turn-Audio, Denkpausen und kurze Uebergaenge in der richtigen Reihenfolge zusammensetzen.
- Lautheit fuer gesprochenes Mono-Audio normalisieren und Clipping vermeiden.
- Erst die fertige Folge einmalig als MP3 encodieren.
- Mono-MP3 mit 128 kbit/s erzeugen und auf -19 LUFS bei maximal -1,5 dB True Peak normalisieren.
- Einheitliche ID3-Metadaten mit Serie, Folgennummer, Titel, Quelle und KI-Hinweis setzen.

### 8. Audio-Pruefung

- Die fertige Folge mit einem OpenAI-Transkriptionsmodell ruecktranskribieren.
- Normen, Zahlen, Namen, Fachbegriffe und Vollstaendigkeit mit dem freigegebenen Sprechertext
  vergleichen.
- Betroffene Turns bei erkennbaren Abweichungen neu erzeugen und die Folge erneut bauen.
- Ergebnis und verbleibende Warnungen in `audio-check.json` schreiben.

### 9. Abschluss

- Manifest und lesbare Zusammenfassung mit Folgenzahl, Gesamtdauer, Modellen, Stimmen,
  Prompt-Versionen, Dokument-Hash und Pruefstatus erzeugen.
- Nur vollstaendige, bestandene Folgen als erfolgreich melden.
- Teilfertige Artefakte fuer eine spaetere Wiederaufnahme behalten.

## Ausgabeformat

Ein Lauf erzeugt folgende Struktur:

```text
output/learning-podcasts/<pdf-slug>/
├── manifest.json
├── series-plan.json
├── series-plan.md
├── source/
│   ├── source.pdf
│   ├── inspection.json
│   └── chunks/*.pdf
├── episodes/
│   ├── 01-<thema>/
│   │   ├── 01-<thema>.mp3
│   │   ├── transcript.md
│   │   ├── draft.json
│   │   ├── source-check.json
│   │   ├── audio-transcript.txt
│   │   ├── audio-check.json
│   │   └── work/*.wav
│   └── ...
├── analysis/
│   ├── source-map.json
│   ├── concepts.json
│   └── pronunciation.json
└── summary.json
```

MP3 ist das auszuliefernde Audioformat. Verlustarme Turn-Dateien duerfen fuer Wiederaufnahme im
Produktionsordner verbleiben. Ein spaeterer Aufraeumparameter kann sie nach erfolgreicher
Gesamtpruefung entfernen, ist aber nicht Teil der ersten Version.

## Zustandsmodell und Wiederaufnahme

`manifest.json` speichert pro Pipeline-Stufe `pending`, `running`, `completed` oder `failed` sowie
Artefakt-Hashes. Ein erneuter identischer Lauf setzt an der letzten vollstaendigen Stufe fort.
Geaenderte Quelle, Prompt-Version, Modellkonfiguration oder relevante Pipeline-Version invalidieren
nur die davon abhaengigen Stufen.

Schreibvorgaenge erfolgen atomar ueber temporaere Dateien und anschliessendes Umbenennen. Eine
unterbrochene Datei gilt nie als abgeschlossene Stufe.

## Fehlerbehandlung

Die Pipeline arbeitet bei behebbaren Fehlern automatisch weiter:

- Unsichere Gliederung: semantischen Fallback verwenden.
- Schemafehler einer Modellantwort: hoechstens drei Anfragen pro Artefakt versuchen.
- Nicht belegter Turn: neu schreiben, erneut pruefen, andernfalls entfernen.
- Einzelner TTS-Fehler: nur diesen Turn wiederholen, hoechstens drei Versuche.
- Audioabweichung: betroffene Turns neu erzeugen und Folge erneut bauen.
- Rate Limit oder temporaerer API-Fehler: hoechstens fuenf Versuche mit exponentiellem Backoff
  zwischen einer und 30 Sekunden.

Ein Lauf bricht nur bei unlesbarem oder verschluesseltem PDF, fehlendem API-Key, dauerhaftem
API-Fehler, fehlender lokaler Audio-Laufzeit oder einem nicht behebbaren Validierungsfehler ab.
Der Abschluss nennt den letzten erfolgreichen Schritt und den Wiederaufnahmebefehl.

## Datenschutz und API-Nutzung

Der OpenAI API-Key wird ausschliesslich aus der Umgebung gelesen und nie in Artefakte oder Logs
geschrieben. Responses-Anfragen verwenden soweit mit dem jeweiligen Schritt vereinbar
`store: false`. Hochgeladene temporaere API-Dateien werden nach dem Lauf geloescht; lokale
Zwischenartefakte verbleiben im benannten Ausgabeordner. Prompts und Manifeste speichern nur
Modellnamen, Prompt-Versionen und technische IDs, keine Zugangsdaten.

## Laufzeit und Modellkonfiguration

Die Pipeline setzt Python 3.12 oder neuer sowie die in einem Skill-eigenen Requirements-File
festgehaltenen Python-Bibliotheken voraus. Fuer Audio verwendet sie zuerst den explizit
konfigurierten FFmpeg-Pfad, danach ein Binary aus `PATH` und zuletzt das durch
`imageio-ffmpeg` bereitgestellte Binary. MP3-Dauer und ID3-Metadaten werden mit `mutagen`
validiert; ein separates `ffprobe` ist deshalb nicht erforderlich. PDF- und Audio-Abhaengigkeiten
werden beim Start geprueft, bevor kostenpflichtige API-Aufrufe beginnen.

Standardmodelle sind:

- Textanalyse, Planung, Sprechertext und Quellenpruefung: `gpt-5.6`
- Sprachsynthese: `gpt-4o-mini-tts`
- Audio-Ruecktranskription: `gpt-4o-mini-transcribe`

Alle Modell- und Voice-IDs koennen ueber dokumentierte Laufparameter ueberschrieben werden. Das
Manifest speichert die tatsaechlich verwendeten IDs. Der API-Key wird ausschliesslich aus
`OPENAI_API_KEY` gelesen.

## Skill-Struktur

Der neue Skill liegt unter:

```text
skills/generate-learning-podcast/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   ├── run_pipeline.py
│   ├── config.py
│   ├── manifest.py
│   ├── models.py
│   ├── inspect_pdf.py
│   ├── openai_steps.py
│   ├── pipeline.py
│   ├── render_audio.py
│   ├── validate_output.py
│   └── requirements.txt
└── references/
    ├── artifact-schemas.md
    ├── legal-source-rules.md
    └── voice-and-pronunciation.md
```

`SKILL.md` bleibt eine knappe Orchestrierungsanweisung. JSON-Schemata, juristische
Quellenregeln und detaillierte Sprecherregeln liegen in den Referenzen. Wiederholbare oder
fehleranfaellige Arbeit liegt in den Python-Skripten.

## Uebernahme des Karteikarten-Skills

Der vorhandene Skill wird nach `skills/karteikarten-erstellen/` kopiert. Uebernommen werden:

- `SKILL.md`
- `DIDAKTIK.md`
- `FORMAT.md`
- `SKRIPTE.md`
- ein neu erzeugtes `agents/openai.yaml` mit UI-Metadaten fuer den Repository-Skill
- die Python-Dateien unter `scripts/`

Nicht uebernommen werden `.DS_Store`, `__pycache__` und `.pyc`-Dateien. Verweise von
`.agents/skills/karteikarten-erstellen/...` werden auf `skills/karteikarten-erstellen/...`
umgestellt. Inhaltliche Heuristiken und das bestehende Kartenformat bleiben unveraendert.

Da der urspruengliche Test ausserhalb des Skill-Ordners von konkreten Decks im Sabine-Projekt
abhaengt, wird er nicht unveraendert kopiert. Stattdessen erhaelt die Repository-Uebernahme einen
kleinen selbststaendigen Smoke-Test fuer JSON-Validierung, Duplex-Paginierung, Pfadauflosung und
PDF-Erzeugung mit temporaeren Beispieldaten.

## Verifikation

### Podcast-Skill

- Skill-Metadaten mit `quick_validate.py` pruefen.
- Unit-Tests fuer PDF-Inspektion, Slugs, Manifest-Zustaende und Resume-Invalidierung ausfuehren.
- Strukturierte Modellantworten gegen die Artefakt-Schemata validieren.
- Audio-Schnitt mit synthetischen Test-Turns ohne API pruefen.
- Einen kleinen PDF-Smoke-Test mit OpenAI API ausfuehren, wenn ein API-Key verfuegbar ist.
- MP3-Dauer, MPEG-Eigenschaften und ID3-Metadaten mit `mutagen` pruefen und das Ergebnis
  vollstaendig probehoeren oder stichprobenartig visuell und akustisch kontrollieren.

### Karteikarten-Skill

- Skill-Metadaten mit `quick_validate.py` pruefen.
- Alle Python-Skripte kompilieren.
- Selbststaendigen Smoke-Test mit temporaerem Deck ausfuehren.
- Erzeugtes Test-PDF rendern und auf abgeschnittene oder ueberlappende Inhalte pruefen.

## Nicht Teil dieser Version

- Integration in Electron-, Web- oder Supabase-Oberflaechen
- Benutzerkonten, Abrechnung, serverseitige Job-Queues oder Cloud-Speicherung
- Recherche ausserhalb des PDFs
- Aktualitaets- oder Rechtspruefung
- Live-Unterbrechung oder Realtime-Gespraech mit den Sprechern
- Video-MP4, Waveform-Video, Untertitelvideo oder Podcast-Feed
- Individuelle Personalisierung anhand eines Nutzerprofils
- Automatische Uebernahme von Abruffragen als Karteikarten in die App

Diese Punkte koennen spaeter auf den versionierten Zwischenartefakten aufbauen, ohne die erste
Pipeline neu zu entwerfen.
