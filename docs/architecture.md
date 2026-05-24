# Technische Dokumentation

Diese Dokumentation beschreibt die aktuelle Architektur von Jura Wolpertinger. Sie ist als Arbeitsgrundlage für Weiterentwicklung, Reviews und spätere Migrationen gedacht.

Stand: App `0.1.4`, Datenbank-Schema `3`, `.jura` Format `1`.

## Zielbild

Jura Wolpertinger ist eine lokale Desktop-App. Die Renderer-App zeigt Vue-Oberflächen, der Electron Main Process kontrolliert Datenbank, Dateien, PDF-Export und `.jura` Import/Export. Der Renderer greift nicht direkt auf SQLite oder das Dateisystem zu, sondern nutzt die sichere Preload-Bridge.

```mermaid
flowchart LR
  subgraph Renderer["Renderer: Vue 3"]
    Dashboard["Bibliothek"]
    Editor["Prüfungseditor"]
    Correction["Bewertung"]
    Analytics["Auswertung"]
    Help["Hilfe und Onboarding"]
    About["About"]
  end

  subgraph Preload["Preload Bridge"]
    Api["window.jura API"]
  end

  subgraph Main["Electron Main Process"]
    Ipc["IPC Handler"]
    Services["AppServices"]
    Pdf["PDF Export"]
    Package[".jura Import/Export"]
  end

  subgraph Storage["Lokale Persistenz"]
    Db[("SQLite database.sqlite")]
    Files["userData/files"]
    Packages[".jura ZIP Dateien"]
    PdfFiles["PDF Dateien"]
  end

  Dashboard --> Api
  Editor --> Api
  Correction --> Api
  Analytics --> Api
  Help --> Api
  About --> Api
  Api --> Ipc
  Ipc --> Services
  Services --> Db
  Services --> Files
  Services --> Package
  Package --> Packages
  Pdf --> PdfFiles
  Services --> Pdf
```

## Persistenz

Electron speichert produktive Daten unter `app.getPath("userData")`. Die App trennt strukturierte Daten und Dateien:

```text
database.sqlite
files/exams/<examId>/attachments/<attachmentId>/<storedName>
files/exams/<examId>/exports/...
backups/...
```

SQLite ist die Quelle für Nutzer, Prüfungen, Ordner, Revisionen, Abgaben, Bewertungen, Kommentare und Metadaten. Anhänge werden in den App-Speicher kopiert und über `attachments.relative_path` referenziert. Jede fachliche Zeile trägt eine `user_id`, damit lokale Nutzer getrennt bleiben und eine spätere Server-Synchronisation eindeutig mappen kann.

## Datenbankmodell

```mermaid
erDiagram
  META {
    string key PK
    string value
  }

  USERS {
    string id PK
    string display_name
    string kind
    string remote_user_id
    string onboarding_completed_at
    string tour_completed_at
    string created_at
    string updated_at
  }

  FOLDERS {
    string id PK
    string user_id FK
    string name
    string parent_id FK
    string created_at
    string updated_at
    string trashed_at
  }

  EXAMS {
    string id PK
    string user_id FK
    string title
    string folder_id FK
    string status
    string tags_json
    string notes
    string legal_area
    string exam_type
    string source_name
    string source_url
    string current_revision_id FK
    string created_at
    string updated_at
  }

  EXAM_REVISIONS {
    string id PK
    string user_id FK
    string exam_id FK
    string created_at
    string kind
    string content_format
    string content_hash
    string content_json
  }

  SUBMISSIONS {
    string id PK
    string user_id FK
    string exam_id FK
    string submitted_at
    string revision_id FK
    string content_hash
    string pdf_path
  }

  CORRECTIONS {
    string id PK
    string user_id FK
    string submission_id FK
    string created_at
    string updated_at
    number score_points
    string grading_comment
    string tags_json
  }

  INLINE_COMMENTS {
    string id PK
    string user_id FK
    string correction_id FK
    string submission_id FK
    string created_at
    string status
    string body
    string anchor_json
    string tags_json
  }

  ATTACHMENTS {
    string id PK
    string user_id FK
    string exam_id FK
    string original_name
    string stored_name
    string mime_type
    number size
    string relative_path
    string role
    string created_at
  }

  AI_CORRECTION_DRAFTS {
    string id PK
    string user_id FK
    string submission_id FK
    string correction_id FK
    string status
    string provider
    string model
    string prompt_version
    number score_points
    string score_reasoning
    string grading_comment
    string strengths_json
    string weaknesses_json
    string tags_json
    string confidence
    string improvement_suggestions_json
    string inline_comments_json
    string created_at
    string updated_at
  }

  LEARNING_TASKS {
    string id PK
    string user_id FK
    string submission_id FK
    string correction_id FK
    string ai_draft_id FK
    string category
    string priority
    string status
    string title
    string detail
    string created_at
    string updated_at
  }

  AI_SETTINGS {
    string user_id PK
    string provider
    string api_key
    string model
    string updated_at
  }

  TAGS {
    string id PK
    string user_id FK
    string name
    string created_at
  }

  EXAM_TAGS {
    string user_id FK
    string exam_id PK
    string tag_id PK
  }

  USERS ||--o{ FOLDERS : owns
  USERS ||--o{ EXAMS : owns
  USERS ||--o{ EXAM_REVISIONS : owns
  USERS ||--o{ SUBMISSIONS : owns
  USERS ||--o{ CORRECTIONS : owns
  USERS ||--o{ INLINE_COMMENTS : owns
  USERS ||--o{ ATTACHMENTS : owns
  USERS ||--o{ AI_CORRECTION_DRAFTS : owns
  USERS ||--o{ LEARNING_TASKS : owns
  USERS ||--o| AI_SETTINGS : configures
  USERS ||--o{ TAGS : owns
  FOLDERS ||--o{ FOLDERS : contains
  FOLDERS ||--o{ EXAMS : stores
  EXAMS ||--o{ EXAM_REVISIONS : has
  EXAM_REVISIONS ||--o{ SUBMISSIONS : freezes
  EXAMS ||--o{ SUBMISSIONS : receives
  SUBMISSIONS ||--o{ CORRECTIONS : has
  CORRECTIONS ||--o{ INLINE_COMMENTS : contains
  SUBMISSIONS ||--o{ INLINE_COMMENTS : anchors
  SUBMISSIONS ||--o{ AI_CORRECTION_DRAFTS : proposes
  SUBMISSIONS ||--o{ LEARNING_TASKS : trains
  CORRECTIONS ||--o{ AI_CORRECTION_DRAFTS : accepts
  CORRECTIONS ||--o{ LEARNING_TASKS : creates
  AI_CORRECTION_DRAFTS ||--o{ LEARNING_TASKS : derives
  EXAMS ||--o{ ATTACHMENTS : owns
  EXAMS ||--o{ EXAM_TAGS : can_link
  TAGS ||--o{ EXAM_TAGS : can_link
```

### Tabellen

| Bereich | Tabelle | Zweck | Wichtige Regeln |
| --- | --- | --- | --- |
| Versionierung | `meta` | Schema-, App- und Migrationsstand | `schema_version` wird beim Start geprüft |
| Nutzer | `users` | lokale, Demo- und später Remote-verknüpfte Nutzer | `current_user_id` liegt in `meta`; Onboarding-Status ist pro Nutzer |
| Organisation | `folders` | Ordnerbaum und Papierkorb für Ordner | `trashed_at` ist Soft-Delete |
| Prüfung | `exams` | Hauptobjekt mit Titel, Status, Tags, Notizen und Metadaten | `legal_area`, `exam_type`, `source_name`, `source_url` beschreiben die Prüfung; `status = archived` ist Papierkorb |
| Inhalt | `exam_revisions` | unveränderliche Editor-Versionen | Autosave und manuelles Speichern erzeugen neue Zeilen |
| Abgabe | `submissions` | Snapshot einer Revision | referenziert eine Revision und bleibt unverändert |
| Bewertung | `corrections` | Gesamtbewertung und Bewertungskommentar | Punkte werden per Zod auf `0-18` in `0.5` Schritten validiert |
| Inline-Kommentare | `inline_comments` | Kommentare auf Textauswahl | Anker speichern ProseMirror-Positionen plus Kontext |
| Dateien | `attachments` | Dateimetadaten | Datei liegt im App-Speicher unter `relative_path`; `role` unterscheidet Aufgabenstellung, Bearbeitervermerk, Musterlösung und Sonstiges |
| KI-Korrektur | `ai_correction_drafts` | Rohentwürfe aus einer KI-Korrekturanfrage | bleiben lokale Vorschläge bis Annahme oder Ablehnung |
| Lernaufgaben | `learning_tasks` | aus angenommenen KI-Entwürfen abgeleitete Aufgaben | lokale Auswertungsartefakte, nicht Teil des `.jura` Pakets |
| KI-Einstellungen | `ai_settings` | OpenAI-Schlüssel und Modell pro Nutzer | bleibt lokal und wird nie exportiert |
| Tags | `tags`, `exam_tags` | vorbereitetes normalisiertes Tag-Modell | aktuelle UI nutzt primär `tags_json` |

Hinweis zu `score_points`: Die Spalte stammt aus Schema v1 mit SQLite-Integer-Affinität. SQLite speichert halbe Punkte trotzdem korrekt als Zahl. Wenn später ein strikteres Datenbanksystem oder eine striktere Migration kommt, sollte die Spalte explizit auf `REAL` oder `NUMERIC` migriert werden.

## Nutzer und Synchronisation

`users.id` ist der lokale Besitz-Anker für alle Daten. Neue lokale Nutzer, der Demo-Nutzer und später verknüpfte Remote-Nutzer bekommen jeweils eine UUID. Beim Nutzerwechsel wird `meta.current_user_id` gesetzt; alle Listen, Exporte, Importe und Bewertungen lesen anschließend nur Daten dieses Nutzers.

Für eine spätere Anmeldung sollte die App lokale Daten nicht überschreiben. Stattdessen wird der lokale Nutzer mit einem Remote-Konto verknüpft (`remote_user_id`) und erst nach erfolgreicher Server-Bestätigung zusammengeführt. Konflikte lassen sich dadurch als Zuordnungsproblem lösen: lokale UUID, Remote-ID, Änderungszeit und Inhalts-Hash bleiben vergleichbar. Mehrere lokale oder Remote-verknüpfte Nutzer können deshalb nebeneinander existieren, ohne dass beim schnellen Wechsel Daten verloren gehen.

Onboarding ist ebenfalls nutzerbezogen. `onboarding_completed_at` verhindert, dass ein Nutzer die Einstiegstour erneut ungefragt sieht; `tour_completed_at` dokumentiert den Abschluss der Driver.js-Tour. Die Tour kann jederzeit über Hilfe oder Sidebar neu gestartet werden.

## Statusmodell

```mermaid
stateDiagram-v2
  [*] --> draft: createExam
  draft --> in_progress: saveRevision
  in_progress --> submitted: submitExam
  submitted --> in_progress: weiter bearbeiten
  submitted --> corrected: updateCorrection mit Punkten
  corrected --> in_progress: neue Bearbeitung

  draft --> archived: trashExam
  in_progress --> archived: trashExam
  submitted --> archived: trashExam
  corrected --> archived: trashExam
  archived --> in_progress: restoreExam mit Revision
  archived --> draft: restoreExam ohne Revision
```

Die Abgabe ist kein Endzustand für die Bearbeitung. Nutzer können nach der Abgabe weiterarbeiten. Die Bewertung bleibt trotzdem an den abgegebenen Snapshot gebunden.

## Autosave und Abgabe

```mermaid
sequenceDiagram
  participant R as Renderer Editor
  participant A as window.jura
  participant M as Main IPC
  participant S as AppServices
  participant D as SQLite

  R->>A: saveRevision(examId, content, "autosave")
  A->>M: exams:saveRevision
  M->>S: saveRevision()
  S->>S: hashJson(content)
  S->>D: INSERT exam_revisions
  S->>D: UPDATE exams.current_revision_id, status
  D-->>S: ok
  S-->>R: ExamRevision

  R->>A: submitExam(examId)
  A->>M: exams:submit
  M->>S: submitExam()
  S->>D: read current revision
  S->>D: INSERT submissions(revision_id, content_hash)
  S->>D: UPDATE exams.status = submitted
  S-->>R: Submission
```

### Invarianten

- Jede Prüfung startet mit einer initialen TipTap-Revision.
- Autosave überschreibt keine alte Revision.
- `submissions.revision_id` zeigt auf die Revision, die abgegeben wurde.
- `submissions.content_hash` macht den Snapshot nachvollziehbar.
- Weiteres Bearbeiten nach Abgabe erzeugt neue Revisionen, verändert aber die bestehende Abgabe nicht.

## Korrekturmodell

```mermaid
sequenceDiagram
  participant C as Korrekturansicht
  participant A as window.jura
  participant S as AppServices
  participant D as SQLite

  C->>A: getSubmission(submissionId)
  A->>S: getSubmission()
  S->>D: read submission + revision + corrections
  S-->>C: read-only Inhalt

  C->>A: createCorrection(submissionId)
  A->>S: createCorrection()
  S->>D: INSERT corrections falls nicht vorhanden
  S-->>C: Correction

  C->>A: addInlineComment(selection, body, tags)
  A->>S: addInlineComment()
  S->>S: validate anchor
  S->>D: INSERT inline_comments

  C->>A: updateCorrection(score, comment, tags)
  A->>S: updateCorrection()
  S->>S: validate bayern-0-18
  S->>D: UPDATE corrections
  S->>D: UPDATE exams.status = corrected wenn score gesetzt
```

Inline-Kommentare referenzieren eine Submission, nicht den aktuellen Arbeitsstand der Prüfung. Dadurch bleiben Kommentare stabil, auch wenn danach weitergeschrieben wird.

## KI-Korrektur

Die KI-Korrektur ist eine ausdrückliche Nutzeraktion und die einzige Stelle, an der normale Prüfungsdaten die lokale App verlassen. Der Renderer sieht weiterhin nur `window.jura`; API-Schlüssel, Dateizugriff, Promptbau und der Cloud-Aufruf laufen im Main Process über Services. Im MVP wird nur ein eigener OpenAI-Schlüssel unterstützt, den Nutzer:innen lokal hinterlegen.

Eine KI-Antwort wird zuerst als `ai_correction_drafts` gespeichert. Erst wenn der Entwurf angenommen wird, entstehen normale Korrekturen, Inline-Kommentare und Lernaufgaben in den bestehenden Tabellen. Ablehnen oder Überschreiben verändert die Abgabe nicht. `.jura` Pakete exportieren angenommene Korrekturen als normale Korrekturdaten, schließen aber Secrets, AI Settings, rohe oder nicht angenommene KI-Entwürfe und lokale Lernaufgaben bewusst aus.

## `.jura` Paketformat

`.jura` ist ein ZIP-Paket. Der Import validiert `manifest.json` und lehnt neuere unbekannte Formatversionen ab.

```text
example.jura
|-- manifest.json
|-- document.json
|-- content/
|   |-- current.json
|   `-- revisions/<revisionId>.json
|-- submissions/<submissionId>/
|   |-- submission.json
|   `-- content.json
|-- corrections/<correctionId>/
|   `-- correction.json
`-- attachments/<attachmentId>/
    |-- attachment.json
    `-- <originalName>
```

```mermaid
flowchart TD
  ExportStart["exportExamPackage(examId)"] --> ReadExam["Prüfung, Revisionen, Abgaben, Korrekturen lesen"]
  ReadExam --> Manifest["manifest.json schreiben"]
  ReadExam --> Document["document.json schreiben"]
  ReadExam --> Revisions["content/revisions schreiben"]
  ReadExam --> Submissions["submissions schreiben"]
  ReadExam --> Corrections["corrections schreiben"]
  ReadExam --> Attachments["attachments kopieren"]
  Manifest --> Zip["ZIP erzeugen"]
  Document --> Zip
  Revisions --> Zip
  Submissions --> Zip
  Corrections --> Zip
  Attachments --> Zip
  Zip --> JuraFile[".jura Datei"]

  ImportStart["importExamPackage(path)"] --> Validate["manifest + document + Schemas validieren"]
  Validate --> VersionCheck{"formatVersion <= supported?"}
  VersionCheck -->|nein| Reject["Import abbrechen"]
  VersionCheck -->|ja| IdMap["ID-Konflikte remappen"]
  IdMap --> WriteFiles["Anhänge in userData schreiben"]
  WriteFiles --> Tx["SQLite Transaction"]
  Tx --> Imported["importierte Prüfung"]
```

### Import-Regeln

- Bei ID-Konflikten werden neue UUIDs vergeben.
- Wenn eine Prüfung mit derselben ID existiert, bekommt der Importtitel den Zusatz `(importiert)`.
- `document.json` enthält die Prüfungsmetadaten `legalArea`, `examType`, `sourceName` und `sourceUrl`.
- `attachments/<id>/attachment.json` enthält die Attachment-Rolle; alte Pakete ohne Rolle werden als `other` importiert.
- AI Settings, API Keys, rohe KI-Entwürfe und Lernaufgaben sind keine Paketbestandteile.
- Anhänge werden vor der Datenbanktransaktion geschrieben und bei Fehlern wieder entfernt.
- Unbekannte neuere `.jura` Versionen werden abgelehnt.

## Auswertung

Die Auswertung basiert ausschliesslich auf bewerteten Korrekturen. Filterzustand liegt im Renderer unter `localStorage` mit dem Key `jura-wolpertinger-analytics-filters-v1`.

```mermaid
flowchart LR
  Corrections[("corrections mit score")]
  Submissions[("submissions")]
  Exams[("exams")]
  Query["listAnalyticsEntries"]
  Filter["Zeitraum- und Tagfilter"]
  Metrics["Kennzahlen"]
  Trend["Verlaufslinie"]
  Monthly["Monatsdurchschnitt"]
  Table["Detailtabelle"]
  Storage["localStorage Filterstate"]

  Corrections --> Query
  Submissions --> Query
  Exams --> Query
  Query --> Filter
  Storage --> Filter
  Filter --> Metrics
  Filter --> Trend
  Filter --> Monthly
  Filter --> Table
  Filter --> Storage
```

```mermaid
flowchart TB
  Entries["Bewertete Abgaben"]
  DateStart["Startdatum"]
  DateEnd["Enddatum oder heute"]
  TagSet["Prüfungs- und Korrekturtags"]
  Presets["3 Monate / 6 Monate / Reset"]
  Result["Gefilterte Eintraege"]
  Average["Durchschnitt"]
  Best["Beste Bewertung"]
  Count["Anzahl Bewertungen"]
  Series["Zeitreihe 0-18"]

  Entries --> Result
  DateStart --> Result
  DateEnd --> Result
  TagSet --> Result
  Presets --> DateStart
  Presets --> DateEnd
  Result --> Average
  Result --> Best
  Result --> Count
  Result --> Series
```

## IPC Oberflaeche

Der Renderer nutzt ausschliesslich `window.jura`. Die API ist in `src/shared/ipc.ts` typisiert und wird im Main Process auf sichere Handler gemappt.

| Bereich | API |
| --- | --- |
| Ordner | `listFolders`, `createFolder`, `updateFolder`, `trashFolder`, `restoreFolder` |
| Prüfungen | `listExams`, `createExam`, `getExam`, `updateExam`, `trashExam`, `restoreExam` |
| Schreiben | `saveRevision`, `submitExam` |
| Abgaben | `getSubmission` |
| Auswertung | `listAnalyticsEntries` |
| KI-Einstellungen | `getAiSettingsStatus`, `saveAiSettings` |
| KI-Korrektur | `generateAiCorrectionDraft`, `listAiCorrectionDrafts`, `acceptAiCorrectionDraft`, `rejectAiCorrectionDraft` |
| Lernaufgaben | `listLearningTasks`, `updateLearningTaskStatus` |
| Dateien | `addAttachment`, `openAttachment` |
| Austausch | `exportExamPackage`, `importExamPackage` |
| PDF | `exportExamPdf` |
| Korrektur | `createCorrection`, `updateCorrection`, `addInlineComment` |

## Migrationen

Beim Datenbankstart wird `meta.schema_version` gelesen. Neue Installationen erzeugen Schema v1 und wenden danach Migrationen bis zur aktuellen Version an.

```mermaid
flowchart TD
  Start["openDatabase()"] --> HasMeta{"meta Tabelle vorhanden?"}
  HasMeta -->|nein| CreateCurrent["createSchema()"]
  CreateCurrent --> Ready["Schema v3 bereit"]

  HasMeta -->|ja| ReadVersion["schema_version lesen"]
  ReadVersion --> Newer{"Version > supported?"}
  Newer -->|ja| StopNewer["Start abbrechen"]
  Newer -->|nein| TooOld{"Version < 1?"}
  TooOld -->|ja| StopOld["Start abbrechen"]
  TooOld -->|nein| IsV1{"Version == 1?"}
  IsV1 -->|ja| MigrateV2["migrateV1ToV2()"]
  MigrateV2 --> MigrateV3["migrateV2ToV3()"]
  IsV1 -->|nein| IsV2{"Version == 2?"}
  IsV2 -->|ja| MigrateV3
  MigrateV3 --> Ready
  IsV2 -->|nein| IsCurrent{"Version == 3?"}
  IsCurrent -->|ja| Repair["fehlende Spalten/Tabellen reparieren"]
  Repair --> Ready
  IsCurrent -->|nein| Missing["fehlende Migration melden"]
```

Aktuelle Migrationen:

| Von | Nach | Änderung |
| --- | --- | --- |
| leer | 1 | Basis-Schema mit Prüfungen, Revisionen, Abgaben, Korrekturen, Kommentaren, Anhängen und Tags |
| 1 | 2 | `folders.trashed_at` für Soft-Delete von Ordnern |
| 2 | 3 | Prüfungsmetadaten, Attachment-Rollen, `ai_correction_drafts`, `learning_tasks`, `ai_settings` |

## Datenlebenszyklus

```mermaid
flowchart LR
  Create["Prüfung erstellen"]
  Write["Schreiben"]
  Autosave["Autosave Revisionen"]
  Submit["Abgeben"]
  Correct["Bewerten und kommentieren"]
  Analyze["Auswerten"]
  Export[".jura / PDF exportieren"]
  Trash["Papierkorb"]

  Create --> Write
  Write --> Autosave
  Autosave --> Submit
  Submit --> Correct
  Correct --> Analyze
  Submit --> Export
  Correct --> Export
  Create --> Trash
  Write --> Trash
  Submit --> Trash
  Correct --> Trash
  Trash --> Write
```

## Technische Leitplanken

- Kein Account und kein Hintergrundserver im MVP; Cloud-Aufrufe passieren nur bei ausdrücklicher KI-Korrekturanfrage mit lokal hinterlegtem eigenem OpenAI-Schlüssel.
- Keine harte Loeschung über die normale UI: Ordner nutzen `trashed_at`, Prüfungen den Status `archived`.
- Korrekturen dürfen den abgegebenen Text nicht verändern.
- `.jura` Daten werden immer über Zod-Schemas validiert.
- Renderer-Dateien und produktive Dateien haben unterschiedliche Quellen: `assets/submission.png` ist die zentrale Quelle für das Abgabe-Bild, der Renderer bekommt eine gespiegelte Kopie.
- Das Datenmodell ist versioniert. Neue Felder sollten entweder optional sein oder eine explizite Migration bekommen.

## Offene technische Punkte

- `tags` und `exam_tags` sind vorbereitet, die UI nutzt aktuell `tags_json`. Eine spätere Migration kann Tags normalisieren.
- `score_points` sollte in einer zukuenftigen Migration von Integer-Affinitaet auf eine explizite numerische Spalte umgestellt werden.
- Papierkorb für Prüfungen ist derzeit statusbasiert (`archived`), waehrend Ordner `trashed_at` nutzen. Wenn Wiederherstellung genauer werden soll, waere ein eigenes `exams.trashed_at` plus `previous_status` sauberer.
- PDF-Pfade sind im Schema vorgesehen. Die aktuelle Exportlogik gibt primär den gewählt gespeicherten Pfad zurück.
