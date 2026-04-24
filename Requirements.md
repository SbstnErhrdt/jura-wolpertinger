# Jura Wolpertinger - Requirements

## Ziel

Eine lokale Electron-App, mit der juristische Pruefungen erstellt, geschrieben, verwaltet, abgegeben, exportiert und korrigiert werden koennen.

Die App ist zuerst eine einfache Standalone-App. Ein Server oder Sync kann spaeter ergaenzt werden, darf aber die lokale Nutzung nicht voraussetzen.

## Referenz

- Demo-Portal: https://bayern-demo.classtime.com/student/bayernDemoPortal
- Demo-Klausur: https://bayern-demo.classtime.com/code/J6JDNJ

Die sichtbare Funktionalitaet der Bayern-Demo soll fuer den Schreibmodus moeglichst 1:1 nachgebaut werden. Es wird keine fremde Classtime-Implementierung uebernommen; die Demo dient nur als Verhaltens- und UI-Referenz.

## Grundprinzipien

- Local first: Alle Daten liegen lokal auf dem Rechner.
- Plain and simple: Kein komplexes Rechte-, Account-, Cloud- oder Verschluesselungssystem im MVP.
- Exportierbar: Eine Klausur kann als einzelne `.jura`-Datei weitergegeben werden.
- Nachvollziehbar: Abgaben, Korrekturen und spaetere Bearbeitungen bleiben zeitlich nachvollziehbar.
- Migrationsfaehig: Persistierte Datenstrukturen haben explizite Versionsnummern.

## Kernobjekte

- Ordner: Lokale Sammlung fuer Pruefungen.
- Klausur: Arbeitsdokument mit Text, Metadaten, Anhaengen, Tags, Abgaben und Korrekturen.
- Anhang: Relevante Datei zur Klausur, z.B. Sachverhalt, PDF, Scan, Loesungsskizze.
- Abgabe: Unveraenderliche Momentaufnahme einer Klausur zu einem Zeitpunkt.
- Korrektur: Bewertung, Bewertungskommentar und Inline-Kommentare auf einer Abgabe.
- Kommentar: Kommentar auf eine Textstelle, Textzeile oder Textauswahl einer konkreten Abgabe.
- Tag: Freie Markierung zur Organisation und Auswertung.

## MVP-Funktionen

### Klausurverwaltung

- Nutzer kann mehrere Pruefungen erstellen.
- Nutzer kann Ordner erstellen, um Pruefungen abzulegen.
- Pruefungen koennen zwischen Ordnern verschoben werden.
- Pruefungen haben mindestens:
  - Titel
  - Rechtsgebiet oder freie Kategorie
  - Status
  - Tags
  - Erstellungsdatum
  - Aenderungsdatum
- Statuswerte:
  - `draft`
  - `in_progress`
  - `submitted`
  - `corrected`
  - `archived`

### Dateisystem pro Klausur

- Jede Klausur hat ein kleines lokales Dateisystem fuer klausurrelevante Dateien.
- Importierte Dateien werden in die App/Klausur kopiert, nicht nur verlinkt.
- Anhaenge koennen mindestens geoeffnet, umbenannt und entfernt werden.
- Typische Anhaenge:
  - Sachverhalt als PDF
  - Sachverhalt als Text
  - Skizzen oder Notizen
  - Musterloesung
  - externe Korrekturdateien

### Schreibmodus

Der Editor soll sich an der Bayern-Demo orientieren:

- Bearbeitungsfeld wirkt wie ein reduziertes Textverarbeitungsprogramm.
- Standard-Schriftgroesse: 12 pt.
- Erlaubte Schriftgroessen: 11 pt, 12 pt, 14 pt.
- Schriftart: Arial oder vergleichbare Sans-Serif-Schrift.
- Schriftfarbe: schwarz.
- Keine automatische Rechtschreibpruefung.
- Keine Tippfehler-Markierung.
- Keine Suche.
- Kein Suchen und Ersetzen.
- Kein Countdown.
- Keine Uhr.
- Keine eigene Zoom-Funktion.

Erlaubte Formatierungen:

- Fett, Shortcut `Ctrl+B` / `Cmd+B`
- Kursiv, Shortcut `Ctrl+I` / `Cmd+I`
- Unterstreichen, Shortcut `Ctrl+U` / `Cmd+U`
- Hervorheben, Shortcut `Ctrl+H` / `Cmd+H`
- Linksbund
- Rechtsbund
- Zentriert
- Blocksatz
- Einzug vergroessern
- Einzug verkleinern

Weitere Editor-Funktionen:

- Kopieren
- Ausschneiden
- Einfuegen
- Rueckgaengig
- Wiederholen
- Drag and Drop von markiertem Text
- Geschuetztes Leerzeichen
- Weicher Zeilenumbruch
- Tabulatoren fuer einfache Tabstopps

Nicht Teil des Schreibmodus:

- Automatische Listenfunktion
- Automatischer Index
- Rechtschreibpruefung
- Grammatikpruefung
- Cloud-Speicherung

### Pruefungsmodus

- Die App bietet normalen Schreibmodus und optionalen Pruefungsmodus.
- Der Pruefungsmodus ist nicht verpflichtend.
- Der Pruefungsmodus soll die Bayern-Demo-Funktionalitaet nachbilden.
- Der Pruefungsmodus blendet verwaltende und korrigierende Funktionen aus.
- Optional:
  - Vollbild
  - reduzierte Navigation
  - keine Korrekturansicht
  - keine Export-/Import-Aktionen waehrend der Bearbeitung

### PDF-Vorschau und Export

- Klausurtext kann als PDF-Vorschau angezeigt werden.
- PDF-Vorschau enthaelt einen automatisch ergaenzten Korrekturrand.
- Hervorhebungen werden im PDF grau dargestellt.
- Exportformate im MVP:
  - PDF fuer Abgabe oder Ausdruck
  - `.jura` fuer Weitergabe und Korrektur

### Abgabe

- Nutzer kann eine Klausur abgeben.
- Abgeben erzeugt eine unveraenderliche Momentaufnahme.
- Die Klausur darf danach weiterbearbeitet werden.
- Spaetere Bearbeitung veraendert die abgegebene Version nicht.
- Eine Klausur kann mehrere Abgaben haben.
- Jede Abgabe enthaelt:
  - Abgabe-ID
  - Zeitstempel
  - referenzierte Textrevision
  - Inhalts-Hash
  - optional exportiertes PDF

### Korrekturmodus

- Eine `.jura`-Datei kann an einen Korrektor weitergegeben werden.
- Der Korrektor darf den Klausurtext nicht bearbeiten.
- Der Korrektor darf:
  - Inline-Kommentare setzen
  - Bewertungskommentar schreiben
  - Gesamtbewertung eintragen
  - Tags setzen
- Bewertungssystem: Bayern, 0 bis 18 Punkte.
- Es gibt genau eine Gesamtbewertung pro Korrektur.
- Es gibt einen allgemeinen Bewertungskommentar zusaetzlich zu einzelnen Inline-Kommentaren.

### Kommentare

- Kommentare koennen sich auf Textzeilen oder Textauswahlen beziehen.
- Kommentare sollen stabil bleiben.
- Korrekturkommentare haengen deshalb immer an einer konkreten Abgabe, nicht am veraenderbaren Arbeitsdokument.
- Wenn nach der Abgabe weitergeschrieben wird, bleiben die Kommentare auf der urspruenglichen Abgabe korrekt positioniert.
- Kommentar-Metadaten:
  - Kommentar-ID
  - Ziel-Abgabe
  - Autor-Anzeige
  - Erstellungsdatum
  - Kommentartext
  - Textanker
  - Textzitat
  - Kontext vor/nach der Auswahl
  - Status

Kommentarstatus:

- `open`
- `resolved`
- `archived`

### Tags und Zusatznotizen

- Tags koennen auf Pruefungen gesetzt werden.
- Tags koennen optional auf Korrekturen oder Kommentare gesetzt werden.
- Zusaetzliche freie Notizen pro Klausur sind erlaubt.
- Tags sind freie Strings.

### Tracking

- Punkteverlauf ueber Pruefungen hinweg.
- Filterung nach Ordner, Rechtsgebiet, Status und Tags.
- Anzeige wichtiger Metadaten:
  - Anzahl Pruefungen
  - Anzahl abgegebener Pruefungen
  - Anzahl korrigierter Pruefungen
  - Durchschnittspunktzahl
  - letzte Bearbeitung

## `.jura`-Dateiformat

Eine `.jura`-Datei ist technisch ein ZIP-Archiv.

Vorgeschlagene Struktur:

```text
manifest.json
document.json
content/current.json
content/revisions/<revision-id>.json
submissions/<submission-id>/submission.json
submissions/<submission-id>/content.json
submissions/<submission-id>/export.pdf
corrections/<correction-id>/correction.json
attachments/<attachment-id>/<original-filename>
```

### `manifest.json`

```json
{
  "format": "jura-klausur",
  "formatVersion": 1,
  "minimumAppVersion": "0.1.0",
  "createdWithAppVersion": "0.1.0",
  "documentSchemaVersion": 1,
  "createdAt": "2026-04-23T00:00:00.000Z",
  "documentId": "uuid"
}
```

### `document.json`

```json
{
  "schemaVersion": 1,
  "documentType": "jura-klausur",
  "id": "uuid",
  "title": "Klausur",
  "status": "in_progress",
  "folderPath": ["Zivilrecht", "Schuldrecht"],
  "tags": ["zivilrecht", "uebung"],
  "notes": "",
  "createdAt": "2026-04-23T00:00:00.000Z",
  "updatedAt": "2026-04-23T00:00:00.000Z",
  "currentRevisionId": "uuid",
  "submissions": [],
  "corrections": [],
  "attachments": []
}
```

### Textrevision

```json
{
  "schemaVersion": 1,
  "editorSchemaVersion": 1,
  "id": "uuid",
  "createdAt": "2026-04-23T00:00:00.000Z",
  "kind": "autosave",
  "contentFormat": "slate-v1",
  "content": []
}
```

### Abgabe

```json
{
  "schemaVersion": 1,
  "id": "uuid",
  "submittedAt": "2026-04-23T00:00:00.000Z",
  "revisionId": "uuid",
  "contentHash": "sha256",
  "canContinueEditing": true,
  "pdfPath": "submissions/<submission-id>/export.pdf"
}
```

### Korrektur

```json
{
  "schemaVersion": 1,
  "id": "uuid",
  "targetSubmissionId": "uuid",
  "createdAt": "2026-04-23T00:00:00.000Z",
  "updatedAt": "2026-04-23T00:00:00.000Z",
  "score": {
    "system": "bayern-0-18",
    "points": 0
  },
  "gradingComment": "",
  "tags": [],
  "inlineComments": []
}
```

### Inline-Kommentar

```json
{
  "schemaVersion": 1,
  "id": "uuid",
  "targetSubmissionId": "uuid",
  "createdAt": "2026-04-23T00:00:00.000Z",
  "status": "open",
  "body": "",
  "anchor": {
    "type": "text-selection",
    "editorSchemaVersion": 1,
    "startPath": [0, 0],
    "startOffset": 0,
    "endPath": [0, 0],
    "endOffset": 10,
    "selectedText": "",
    "prefix": "",
    "suffix": "",
    "contentHash": "sha256"
  },
  "tags": []
}
```

## Lokale App-Datenbank

Die App kann intern SQLite nutzen.

MVP-Tabellen:

- `meta`
- `folders`
- `exams`
- `exam_revisions`
- `submissions`
- `corrections`
- `inline_comments`
- `attachments`
- `tags`
- `exam_tags`

### `meta`

Die lokale Datenbank enthaelt mindestens:

- `schema_version`
- `app_version`
- `created_at`
- `last_migrated_at`

## Versionierung und Migration

Alle dauerhaft gespeicherten Root-Objekte enthalten `schemaVersion`.

Versionierte Bereiche:

- lokale SQLite-Datenbank: `schema_version`
- `.jura`-Paket: `formatVersion`
- Klausur-Dokument: `documentSchemaVersion`
- Editor-Inhalt: `editorSchemaVersion`
- einzelne JSON-Objekte: `schemaVersion`

Migrationsregeln:

- Migrationen laufen schrittweise, z.B. `1 -> 2 -> 3`.
- Jede Migration ist deterministisch und idempotent, soweit praktisch moeglich.
- Vor einer destruktiven Migration wird eine Backup-Kopie erstellt.
- Unbekannte neuere Versionen werden nicht automatisch geoeffnet, sondern mit Hinweis abgelehnt.
- Aeltere Versionen werden beim Oeffnen migriert.
- Exportierte `.jura`-Dateien behalten ihre urspruengliche Struktur, bis sie explizit neu gespeichert/exportiert werden.

## Spaetere Features

- Server oder Sync im Hintergrund.
- Mehrere Geraete.
- Korrektor-Workflow mit separater App-Rolle.
- Import/Export ganzer Ordner.
- Vergleich zwischen Abgabe und spaeterer Bearbeitung.
- Detailliertere Statistik nach Rechtsgebiet und Tags.
- Vorlagen fuer Klausurtypen.
- Optionaler Timer, aber nicht als Standard fuer Bayern-Demo-Modus.

## Nicht-Ziele im MVP

- Benutzerkonten.
- Cloud-Zwang.
- Komplexes Berechtigungssystem.
- Verschluesselung oder Passwortschutz.
- Echte Betriebssystem-Sperre gegen andere Apps.
- Automatische Bewertung durch KI.
