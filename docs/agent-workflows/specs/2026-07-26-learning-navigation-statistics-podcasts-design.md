# Lernnavigation, Statistik und Podcasts

## Ziel

Jura Wolpertinger erhält eine ruhigere Navigation, eine aussagekräftige Karteikarten-Statistik und einen global verfügbaren Podcast-Bereich, der in lokaler Desktop-Nutzung und in der Supabase-Web-App denselben Funktionsumfang anbietet.

## Navigation

- Der bestehende Desktop-App-Shell bleibt erhalten; der Prüfungseditor und der Prüfungsmodus werden nicht verändert.
- Der Beta-Hinweis sitzt gedreht oben rechts in der Sidebar und beansprucht keine eigene Zeile.
- Die Hauptnavigation bleibt in fachliche Abschnitte gegliedert.
- Der Sidebar-Footer zeigt einen kompakten Account-Trigger. Ein Nuxt-UI-Dropdown enthält Nutzerwechsel, Nutzeranlage, Profil/Einstellungen, Tour, Theme und gegebenenfalls Abmelden.
- Podcasts werden als eigener Hauptbereich mit direktem mobilen Einstieg geführt.
- Mobile Navigation und Breadcrumbs spiegeln die neuen Routen konsistent.

## Karteikarten-Statistik

Die Statistik beantwortet drei Fragen:

1. Was habe ich zuletzt getan?
2. Wie sicher beherrsche ich meine Karten?
3. In welchen Sammlungen sollte ich weiterarbeiten?

Angezeigt werden:

- Wiederholungen heute, in den letzten sieben Tagen und insgesamt
- aktuelle Lernserie und Anzahl gelernter Tage in den letzten 14 Tagen
- Anteil mindestens einmal wiederholter Karten
- Verteilung der letzten Bewertungen in `Nochmal`, `Schwer`, `Gut`, `Leicht`
- tägliche Aktivität der letzten 14 Tage
- Fortschritt je Sammlung mit Karten, bereits gesehenen Karten, empfohlenen Karten und mittlerer Bewertung

SQLite berechnet die Statistik für den aktiven lokalen Nutzer. Supabase stellt dieselbe Form über ein authentifiziertes RPC bereit. Der Browser-Fallback berechnet sie aus seinem lokalen Store.

## Podcasts

### Katalog

Der Katalog ist global und öffentlich lesbar:

`Rechtsgebiet -> Podcast-Serie -> Folgen`

Die erste Serie ist:

- Rechtsgebiet: Öffentliches Recht
- Podcast: Bayerische Bauordnung – Grundlagen, Verfahren, Bauaufsicht und Abstandsflächenrecht
- Ausgabe: April 2026
- Folgen: 18 MP3-Dateien aus `output/learning-podcasts/baybo-april-2026`

Supabase speichert Katalogmetadaten in `podcast_series` und `podcast_episodes`. MP3-Dateien liegen im öffentlichen Storage-Bucket `podcast-audio`. Schreibzugriffe bleiben dem Service-Role vorbehalten.

### Fortschritt

Fortschritt ist pro Nutzer privat und umfasst:

- aktuelle Position
- bekannte Dauer
- Abschlussstatus
- zuletzt gehört
- Aktualisierungszeitpunkt

SQLite speichert Fortschritt pro lokalem Nutzer. Supabase speichert ihn in `podcast_episode_progress` mit RLS. Beim Desktop-Online-Sync gewinnt pro Folge der Datensatz mit dem neueren `updated_at`; bei gleichem Zeitstempel gewinnt der weiter fortgeschrittene Stand.

### Player

Ein globaler Player bleibt bei Routenwechseln aktiv. Er bietet:

- Play/Pause
- 15 Sekunden zurück und 30 Sekunden vor
- Seek
- Wiedergabegeschwindigkeit
- vorherige/nächste Folge
- automatische Fortschrittsspeicherung, bei Pause, beim Verlassen und am Folgenende
- Abschluss ab 95 Prozent oder höchstens 30 Sekunden Rest
- mobilen Mini-Player und eine große Playeransicht
- Media-Session-Metadaten und Systemaktionen, sofern der Browser sie unterstützt

## Fehler- und Offlineverhalten

- Schlägt das Laden des globalen Katalogs fehl, zeigt die UI einen klaren Wiederholen-Zustand.
- Bereits geladene Audiodaten werden dem Browser-Cache überlassen; vollständiger Offline-Download ist nicht Teil dieses Schritts.
- Lokaler Hörfortschritt geht ohne Online-Verbindung nicht verloren.
- Fortschrittsspeicherung blockiert die Wiedergabe nicht. Fehler werden gesammelt und bei der nächsten Positionsänderung erneut versucht.

## Daten- und Sicherheitsgrenzen

- MP3-Dateien sind öffentlich; Nutzerfortschritt ist privat.
- Der Browser erhält niemals Service-Role- oder Storage-Schreibschlüssel.
- Nur das Seed-/Upload-Skript verwendet Service-Role-Zugangsdaten.
- Bestehende Lern- und Prüfungsdaten bleiben migrationskompatibel.

## Tests

- Schema- und Statistiktests für SQLite
- SQL/RLS-Tests für öffentlichen Katalog und privaten Fortschritt
- Browser- und Cloud-API-Vertragstests
- Komponentenverträge für Sidebar, Statistik und Podcast-Player
- Electron-E2E für Navigation, Statistiken und fortgesetzte Wiedergabe
- Responsive Screenshots für Desktop und Mobil

