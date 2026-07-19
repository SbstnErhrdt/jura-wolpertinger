# Flashcard Priority Scheduler Design

## Goal

Karteikarten sollen jederzeit lernbar sein. Der Scheduler darf Nutzer nicht mit "Keine Karten faellig" blockieren, nur weil ein gespeicherter Zeitpunkt in der Zukunft liegt. Zeitpunkte bleiben intern hilfreich, aber die UX wird von "faellig oder nicht" auf "empfohlen und priorisiert" umgestellt.

## Current Problem

Heute wird `due_at` als harter Filter genutzt:

- Lokal in SQLite filtert `getReviewBatch` auf `due_at <= now`.
- Im Browser-Fallback wird genauso auf `dueAt <= now` gefiltert.
- In Supabase liefert `get_review_batch` nur Prompts, deren Schedule fehlt oder deren `due_at <= now` ist.

Das fuehrt zu schlechten Situationen: Der Nutzer will lernen, sieht aber keine Karten. Fuer Jura-Studierende ist das nicht nachvollziehbar; sie erwarten, dass Lernen immer moeglich ist.

## Decision

Wir entfernen `due_at` nicht sofort physisch aus den Datenbanken. Stattdessen aendern wir die Bedeutung:

- `due_at` wird technisch vorerst als `next_suggested_at` behandelt.
- Die App verwendet den Zeitpunkt nicht mehr als harte Sichtbarkeitsgrenze.
- Review-Batches enthalten immer Karten, solange passende Karten existieren.
- Karten mit erreichtem oder ueberschrittenem Zeitpunkt erhalten eine hoehere Prioritaet.
- Spaeter kann das Feld in einer eigenen Migration umbenannt werden, wenn alle Clients aktualisiert sind.

So vermeiden wir riskante Sync-Migrationen und loesen trotzdem das UX-Problem.

## Learning Modes

Die UI soll nicht mehr nur "faellige Karten" kennen, sondern klare Lernmodi:

- `Empfohlen ueben`: sortiert nach Lernprioritaet, bevorzugt ueberfaellige, neue und schwache Karten.
- `Alle Karten ueben`: erlaubt eine Runde durch alle Karten der Sammlung oder des aktuellen Filters.
- `Schwierige Karten`: bevorzugt Karten mit `last_rating` 1 oder 2 und viele `lapses`.
- `Neue Karten`: Karten ohne Bewertung oder ohne Schedule.
- `Zufaellige Runde`: mischt passende Karten, damit Nutzer auch frei wiederholen koennen.

Wenn keine empfohlenen Karten existieren, faellt die App automatisch auf lernbare Karten zurueck und sagt nicht "Keine Karten faellig".

## Scheduler Model

Die materialisierte Schedule-Tabelle bleibt bestehen. Sie enthaelt pro Nutzer und Karte den aktuellen Lernstand:

- `next_suggested_at` oder vorerst `due_at`
- `last_reviewed_at`
- `last_rating`
- `reps`
- `lapses`
- optional spaeter `priority_score`
- optional spaeter `memory_state`: `new`, `learning`, `review`, `weak`, `mastered`

Die erste Umsetzung berechnet Prioritaet zur Abfragezeit. Ein gespeicherter `priority_score` ist erst sinnvoll, wenn wir Performance-Probleme sehen oder komplexere Algorithmen einfuehren.

## Batch Selection

Der Server und die lokalen Adapter liefern weiter groessere Batches. Die Auswahl wird aber anders:

1. Filtere nach Nutzer, Sammlung, Schlagwort, Archivstatus und Ausschlussliste.
2. Berechne eine Prioritaet:
   - ueberfaellig oder empfohlen: hoch
   - `last_rating` 1 oder 2: hoch
   - neue Karten: hoch bis mittel
   - viele `lapses`: hoch
   - kuerzlich sicher beantwortete Karten: niedrig
3. Sortiere nach Modus und Prioritaet.
4. Liefere bis zum Limit Karten zurueck.

Damit bleibt die bestehende Smooth-Batch-UX mit `excludeCardIds` erhalten.

## Review Recording

Beim Bewerten wird weiterhin ein Review-Event geschrieben. Danach aktualisiert der Scheduler den naechsten empfohlenen Zeitpunkt:

- `Nochmal`: sehr bald wieder vorschlagen
- `Schwer`: bald wieder vorschlagen
- `Gut`: spaeter wieder vorschlagen
- `Leicht`: deutlich spaeter wieder vorschlagen

Der Unterschied: Dieser Zeitpunkt verhindert nicht mehr, dass die Karte in einem freien Lernmodus auftaucht.

## Cloud And Local Consistency

Alle drei Pfade muessen dieselbe Semantik bekommen:

- Electron/SQLite
- Browser-Fallback
- Supabase/RPC

Cloud bleibt authoritative fuer Web-App und synchronisierte Desktop-App. Lokale Daten duerfen denselben Scheduler nachbilden, damit Offline-Lernen konsistent bleibt. Beim Sync werden Schedule-Daten weiter synchronisiert, aber nicht als harte Sperre interpretiert.

## UX Copy

Technische Begriffe werden nicht angezeigt. Insbesondere nicht:

- `due_at`
- `Scheduler`
- `JSON`
- `RPC`

Stattdessen:

- "Empfohlen"
- "Heute sinnvoll"
- "Schwierige Karten"
- "Alle Karten"
- "Weiter ueben"

Leere Zustaende sollen erklaeren, was wirklich fehlt, z. B. "In dieser Sammlung gibt es noch keine Karteikarten."

## Migration Strategy

Phase 1:

- Verhalten aendern, Feldnamen intern weitgehend behalten.
- Tests fuer "Review liefert auch nicht empfohlene Karten" ergaenzen.
- UI-Texte von "faellig" auf "empfohlen" umstellen, wo der Begriff Nutzer blockiert oder irritiert.

Phase 2:

- Optional DB-Feld semantisch sauber umbenennen:
  - Supabase: `due_at` zu `next_suggested_at`
  - SQLite: `due_at` zu `next_suggested_at`
  - API-Mapping abwaertskompatibel halten, bis alte Clients nicht mehr relevant sind.

Phase 3:

- Optional besseren Algorithmus einfuehren, z. B. FSRS-naehere Parameter. Das ist nicht Teil dieses Umbaus.

## Acceptance Criteria

- Nutzer kann in einer Sammlung immer eine Wiederholung starten, solange Karten vorhanden sind.
- "Keine Karten faellig" verschwindet als blockierender Zustand.
- Empfohlene Karten werden weiter bevorzugt.
- `Nochmal`, `Schwer`, `Gut`, `Leicht` aktualisieren weiterhin den Lernstand und die naechste Empfehlung.
- Electron, Browser-Fallback und Cloud verhalten sich gleich.
- Sync verliert keine Review-Historie und keine Schedule-Daten.
- Tests decken lokale, Browser- und Supabase-Auswahl ab.
