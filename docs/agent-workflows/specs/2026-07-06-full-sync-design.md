# Full Sync Design

Datum: 2026-07-06

## Ziel

Die Desktop-App kann einen lokalen Arbeitsbereich mit der Online-Version verbinden und alle fachlichen Nutzerdaten online sichern oder von dort auf ein Gerät holen. Der erste sichere Schnitt ist ein vollständiger Nutzerdaten-Snapshot pro Arbeitsbereich, ergänzt um Datei-Uploads in Supabase Storage.

## Scope

Synchronisiert werden:

- lokaler Nutzername und Arbeitsbereich
- Ordner
- Prüfungen
- Revisionen und Autosaves
- Abgaben
- Anhänge als Dateien im Storage
- Korrekturen
- Inline-Kommentare
- Lernaufgaben
- Karteikarten-Sammlungen
- Karteikarten
- Schlagwörter
- Wiederholungsverlauf und Fälligkeiten

Nicht synchronisiert werden:

- KI-Schlüssel
- Entwicklungszugänge
- lokale technische App-Zustände
- temporäre rohe KI-Entwürfe, solange sie nicht in normale Korrekturen übernommen wurden

## Nutzerreise

Die Einstellungen enthalten eine Karte `Online-Version`. Nicht verbundene Desktop-Nutzer sehen `Mit Online-Version verbinden`. Der Button öffnet ein Modal mit E-Mail und Passwort. Nach erfolgreicher Anmeldung sieht der Nutzer drei klare Aktionen:

- `Lokale Daten online sichern`
- `Online-Daten auf dieses Gerät holen`
- `Alles abgleichen`

Während der Übertragung zeigt ein Modal den Fortschritt für Daten und Dateien. Nach Abschluss zeigt die App eine Zusammenfassung: Zeitpunkt, Anzahl Datenbereiche und Anzahl Dateien. Fehler werden ohne technische Anbieterbegriffe beschrieben.

## Architektur

Der Renderer ruft nur IPC-Methoden auf. Anmeldung, Snapshot-Bau, Datenbankzugriff, Storage-Upload und Restore laufen im Main Process.

Supabase bekommt:

- Tabelle `user_sync_snapshots` für versionierte Snapshots
- Storage Bucket `user-files`
- Storage-Pfade `users/{auth.uid}/workspaces/{local_user_id}/attachments/{attachment_id}/{stored_name}`
- RLS/Policies, die Tabellen- und Dateizugriff auf den angemeldeten Nutzer begrenzen

Der Snapshot enthält alle synchronisierten SQLite-Tabellen als strukturierte JSON-Daten. Anhänge bleiben als Dateien im Storage; der Snapshot enthält Metadaten und Storage-Pfad.

## Konfliktregeln

Für den ersten Schnitt gibt es bewusst drei Nutzeraktionen statt stiller Konfliktauflösung:

- `Lokale Daten online sichern` überschreibt den Online-Snapshot dieses Arbeitsbereichs.
- `Online-Daten auf dieses Gerät holen` ersetzt lokale fachliche Daten dieses Arbeitsbereichs durch den Online-Snapshot.
- `Alles abgleichen` lädt zuerst den neuesten Online-Snapshot, führt fehlende lokale und fehlende Online-Objekte anhand stabiler UUIDs zusammen und bricht bei unterschiedlichen Inhalten gleicher UUID mit einer verständlichen Konfliktmeldung ab.

Keine Aktion löscht Dateien oder Daten ohne vorherige Nutzerentscheidung.

## Tests

Mindesttests:

- SQL-Test für RLS und Storage-Pfad-Policy.
- Main-Service-Test, der einen lokalen Arbeitsbereich mit Prüfung, Anhang, Korrektur und Karteikarten als Snapshot baut.
- Main-Service-Test für Restore aus Snapshot.
- Renderer-Test, dass die Settings-UI nicht-technische Sync-Texte verwendet.

## Erfolgskriterien

- Ein Desktop-Nutzer kann sich mit einem Online-Konto verbinden.
- Lokale Prüfungs- und Lern-Daten können online gesichert werden.
- Anhänge werden in Supabase Storage unter einem nutzergebundenen Pfad abgelegt.
- Ein zweites Gerät kann denselben Snapshot laden.
- Nutzer sehen keine Begriffe wie Supabase, JSON oder API im Sync-Flow.
