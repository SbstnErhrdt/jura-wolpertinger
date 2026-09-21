# Historische Abgaben und Korrekturen im Browser

Der vorhandene Browser übernimmt neue Prüfungen, aber bislang keine nachträglich
ergänzten Abgaben vorhandener Prüfungen. Ein vollständiges Überschreiben würde
lokale Entwürfe und Bewertungen gefährden. Der gewählte, begrenzte Ansatz ergänzt
deshalb nur ausdrücklich benannte Bäume und quittiert sie einmal pro Prüfung.

## Vertrag

`exam.correctionImport` enthält:

```ts
{
  schemaVersion: 1,
  revision: 1, // positive, monoton steigende Ganzzahl pro Prüfung
  submissionIds: string[], // UUIDs der historischen Abgaben
  attachmentIds: string[], // UUIDs der zugehörigen Dateien
  previousStatus: 'draft' | 'in_progress' | 'submitted' | 'corrected' | 'archived',
  currentRevisionId: string | null // Entwurf vor dem Import
}
```

Die Abgaben müssen mit ihren Revisionen, Korrekturen und Kommentaren im gleichen
`payload_json.browserStore` liegen. Alle Objekte müssen dem Konto und dem passenden
Prüfungs-/Abgabenbaum gehören und Shared-Schemas erfüllen. Hashes von Revision,
Abgabe und Kommentaranker müssen übereinstimmen. Bestehende unveränderliche IDs
dürfen nur identische Objekte bezeichnen; Konflikte verwerfen die Übernahme des
ganzen Prüfungsvermerks. Unbekannte Versionen werden nicht interpretiert.

Vorhandene Korrekturen bleiben einschließlich bearbeiteter/entfernter Kommentare
erhalten. Neu übernommene Kommentare liegen sowohl in `correction.inlineComments`
als auch `browserStore.inlineComments`; beim Tabellenexport ist die im Browser
editierbare verschachtelte Liste maßgeblich. Dasselbe gilt beim Übernehmen in einen
anderen Browser: Eine vorhandene verschachtelte Liste ist verbindlich, auch wenn
sie leer ist. Eine veraltete flache Kopie darf weder Änderungen verwerfen noch
entfernte Kommentare wiederherstellen. Nur bei alten Korrekturen ohne das
verschachtelte Feld wird die flache Liste verwendet. Höhere Importrevisionen dürfen weitere
Bäume ergänzen; gleiche oder ältere Vermerke werden nicht erneut angewendet.

Der Remote-Status `submitted`/`corrected` wird nur übernommen, wenn der lokale
Status `previousStatus` entspricht, beide aktuellen Revisions-IDs dem Vermerk
entsprechen, passende Abgaben/Korrekturen existieren und die Prüfung weder
archiviert noch im Papierkorb ist. Entwurf, Titel, Notizen und Schlagwörter werden
dabei nicht ersetzt. Übernahme erfolgt beim ersten Laden einer Sitzung und vor
jedem Snapshot-Upload; Kontoänderungen während Netzwerkanfragen brechen ab.
Kann ein noch nicht übernommener Import wegen ungültiger Daten, unbekannter
Versionen oder unveränderlicher ID-Konflikte nicht ergänzt werden, bleibt beim
Laden die lokale Fassung erhalten. Vor einem Upload bricht derselbe Fall die
Online-Sicherung vollständig ab, damit keine historischen Daten verloren gehen.
Der aktuelle Entwurf bleibt lokal gespeichert.

## Historische Erstellungsdaten

`exam.dateImport` quittiert ausdrücklich freigegebene Datumsberichtigungen:

```ts
{
  schemaVersion: 1,
  revision: 1,
  userId: string,
  examId: string,
  previousCreatedAt: string,
  createdAt: string
}
```

Der Browser übernimmt ein neueres Datum nur bei passendem Konto, eindeutiger
Prüfung, gültigem ISO-Zeitstempel und unverändertem Ausgangsdatum. Ein bereits
passendes Zieldatum wird ebenfalls quittiert. Spätere lokale Datumsänderungen
bleiben bei identischem Vermerk erhalten. Ungültige oder kollidierende neue
Vermerke blockieren den Snapshot-Upload; der lokale Entwurf bleibt gespeichert.
Datum, Tags und Korrekturbäume werden unabhängig, aber vor demselben Upload
zusammengeführt. Der Tabellenexport verwendet das übernommene Erstellungsdatum.

Bereits geöffnete ältere App-Versionen kennen diesen Vermerk noch nicht. Die
Supabase-Migration `010_browser_exam_date_import_guard.sql` schützt daher
Browser-Snapshots mit vorhandenen Vermerken gegen deren Verlust. Fehlende,
veraltete oder inkonsistente Vermerke führen zu einer verständlichen Aufforderung
zum Neuladen. Desktop-Arbeitsbereiche und Konten ohne solche Vermerke bleiben
unberührt. Archivieren und Verschieben in den Papierkorb bleiben möglich.

Die Quelldokumentation muss die tatsächliche Präzision erhalten: Ein belegter
Dateitag wird als Berliner Kalendertag gespeichert und nicht als minutengenaue
Schreibzeit ausgegeben. Portal-Abgabezeiten belegen die Abgabe, nicht den Beginn
der Bearbeitung. `updatedAt` wird nicht pauschal zurückdatiert.

## Private Dateien

Standard-Anhangsobjekte werden durch `attachmentSchema` validiert. Dateien liegen
im privaten Bucket `user-files` unter
`users/<userId>/workspaces/<userId>/attachments/<attachmentId>/<storedName>`.
Der Download prüft Konto, zugehörige Prüfung und sichere Dateinamen, verwendet
die authentifizierte Storage-API und gibt den Blob nur als lokalen Download frei.

`file_manifest_json` enthält `{ attachmentId, relativePath, storagePath, size }`.
Vorhandene gültige Einträge desselben Kontoarbeitsbereichs bleiben erhalten;
Anhangszeilen erzeugen zusätzlich kanonische Einträge. Unsichere Pfade und fremde
Arbeitsbereiche werden nicht übernommen. Es entstehen keine öffentlichen URLs.

## Umsetzung und Prüfung

1. Regressionstests für vorhandene Prüfungen, Statusschutz, unveränderliche IDs,
   Konto-/Schema-/Hashfehler und erhaltene Dateimanifeste zunächst rot ausführen.
2. Begrenzte Importlogik und authentifizierten Download ergänzen; eigene Änderungen
   an Randbemerkungen beim Tabellenexport berücksichtigen.
3. Hilfe, About und User Stories aktualisieren; Typecheck, fokussierte Tests,
   vollständige Vitest-Suite und Produktionsbuild ausführen.
4. Isolierten Kandidaten auf dem zuvor verifizierten Produktionsstand aufbauen;
   nur diese Änderungen in den bereits bearbeiteten Hauptcheckout übertragen.

## Produktivprüfung am 20.09.2026

Der geprüfte Web-Kandidat wurde nach Sicherung der bisherigen App veröffentlicht.
HTML und referenzierte Assets wurden anschließend bytegenau mit dem Build
verglichen. Der Import erfolgte mit Kontoprüfung und Snapshot-Digest als
Nebenläufigkeitsschutz; ein vorheriger Probelauf wurde vollständig zurückgerollt.
Private Quelldateien, Importskripte und Sicherungen liegen außerhalb des App-Repos.

Die Live-Oberfläche zeigt zehn historische Abgaben, acht vorhandene Bewertungen
und 81 Randkommentare. Alle acht Bewertungsansichten wurden geöffnet und gegen
die vorbereiteten Noten, Kommentarzahlen und Rückmeldungstexte geprüft. Die
23 Originaldateien wurden nach dem Upload bytegenau zurückgelesen; öffentlicher
Zugriff auf den privaten Bucket wurde abgelehnt. Vorhandene Entwürfe, Notizen,
Schlagwörter und der separate Desktop-Snapshot blieben unverändert.

Typecheck, 51 gezielte Tests und Produktionsbuild bestanden. Die vollständige
Suite hatte 419 erfolgreiche Tests und drei bereits im unveränderten
Produktionsausgangspunkt nachgewiesene Podcast-Fehler. Eine unabhängige Prüfung
bestätigte Datenzuordnung, Schemas, Hashes, Kommentaranker und Konfliktschutz.

Veröffentlichter Index-SHA256:
`8c0f65f24caf424b7e6b35a23938021e6389fffa8c705b26626cde48f18975ed`.
