# KI-gestuetzter Trainingsloop fuer das 2. Staatsexamen

Datum: 2026-05-24

## Ziel

Jura Wolpertinger soll Kandidatinnen und Kandidaten kurz vor dem 2. Staatsexamen beim klausurnahen Lernen unterstuetzen. Der erste Bauabschnitt erweitert den bestehenden Workflow aus Schreiben, Abgeben, Bewerten und Auswerten um einen KI-gestuetzten Korrektur- und Nachbereitungsloop.

Die App liefert keine fremden Klausurentexte mit. Nutzerinnen und Nutzer bringen eigene Unterlagen ein, zum Beispiel Klausuren aus AG, Repetitorium, Hemmer, freier Quelle oder eigener Sammlung. Diese Unterlagen werden lokal als Uploads verwaltet und koennen fuer eine KI-Korrektur freigegeben werden.

## Produktumfang

Der Trainingsloop besteht aus fuenf Schritten:

1. Pruefung anlegen und mit Rechtsgebiet, Klausurtyp, Quelle, Anbieter, Quellen-URL und Uploads versehen.
2. Unter Pruefungsbedingungen schreiben und als unveraenderlichen Snapshot abgeben.
3. KI-Korrektur auf Basis von Aufgabenstellung, Musterloesung, Abgabe, Klausurtyp und Bewertungsrubrik erstellen lassen.
4. Korrekturvorschlag menschlich pruefen, bearbeiten, uebernehmen oder verwerfen.
5. Aus bestaetigter Korrektur konkrete Verbesserungsvorschlaege, Fehlerprofile und Lernaufgaben ableiten.

Die KI nimmt im Workflow die Rolle eines Korrektors ein. Sie erstellt eine normale Korrektur mit Punktvorschlag, Gesamtkommentar, Inline-Kommentaren, Fehlerkategorien und Verbesserungshinweisen. Sie ersetzt aber keine offizielle oder zertifizierte Pruefungskorrektur.

## Zielgruppe und Leitplanken

Die Zielgruppe sind juristische Referendarinnen und Referendare, die kurz vor dem 2. Staatsexamen viele Klausuren schreiben und Korrekturen systematischer nutzen wollen.

Leitplanken:

- Keine offizielle Pruefungszulassung oder Zertifizierung suggerieren.
- Keine fremden Klausurentexte buendeln oder als App-Inhalt ausliefern.
- KI-Ergebnisse immer als Korrekturvorschlag kennzeichnen, bis ein Mensch sie uebernimmt.
- Normale manuelle Korrektur muss ohne KI nutzbar bleiben.
- Renderer-Code greift nicht direkt auf Dateisystem, SQLite oder API-Keys zu.

## Quellen- und Uploadmodell

Bestehende Attachments werden fachlich um Rollen erweitert:

- `assignment`: Aufgabenstellung oder Sachverhalt
- `candidate_note`: Bearbeitervermerk oder Zusatzhinweis
- `model_solution`: Musterloesung, Loesungsskizze oder Erwartungshorizont
- `other`: sonstige Unterlagen

Pruefungen erhalten zusaetzliche Metadaten:

- Rechtsgebiet: Zivilrecht, Strafrecht, Oeffentliches Recht, gemischt oder frei benannt
- Klausurtyp: Urteil, Beschluss, Relation, Anklage, Gutachten, Schriftsatz, sonstiger Typ
- Quelle oder Anbieter als Freitext
- optionale Quellen-URL

Diese Daten dienen der Prompt-Erstellung, Auswertung und spaeteren Empfehlung der naechsten Uebung. Sie sind keine Behauptung, dass die App die Quelle besitzt oder weiterverbreiten darf.

## KI-Architektur

Die erste Version nutzt ausschliesslich Cloud-KI mit eigenem API-Key pro Nutzerin oder Nutzer.

Architektur:

- Renderer zeigt Einstellungen, Upload-Auswahl, KI-Start, Review und Uebernahme.
- Preload exponiert typisierte IPC-Funktionen.
- Main Process verwaltet API-Key, Prompt-Aufbau, Dateiauszug, Cloud-Request und Antwortvalidierung.
- Persistenz laeuft ueber bestehende Services und SQLite-Migrationen.

Der API-Key darf nicht im Renderer liegen. Er sollte ueber den Main Process gespeichert werden, vorzugsweise ueber eine sichere OS-Keychain oder eine spaeter austauschbare Secret-Storage-Schicht. Falls fuer einen fruehen MVP eine einfachere Speicherung noetig ist, muss die UI klar darauf hinweisen und die Architektur den Wechsel auf sichere Speicherung vorsehen.

Ohne API-Key bleibt die manuelle Korrektur voll nutzbar. Die KI-Funktion zeigt dann eine kurze Einrichtungshilfe.

## KI-Korrekturworkflow

Die KI-Korrektur bezieht sich immer auf eine Submission, nicht auf den aktuellen Entwurf.

Input:

- abgegebener Text der Submission
- Aufgabenstellung oder Sachverhalt, sofern vorhanden
- Musterloesung oder Loesungsskizze, sofern vorhanden
- Klausurtyp und Rechtsgebiet
- Bewertungsrubrik und Bayern-Punkteskala `0-18` inklusive halber Punkte
- bestehende Hinweise oder Tags, falls fuer die Korrektur ausgewaehlt

Output:

- Punktvorschlag nach Bayern `0-18`
- Begruendung des Punktvorschlags
- Gesamtkommentar
- Staerken
- gewichtete Schwaechen
- Fehler- und Thementags
- konkrete Verbesserungsvorschlaege
- optionale Inline-Kommentarvorschlaege
- Lernaufgaben fuer die Nachbereitung
- Sicherheitseinschaetzung, besonders wenn Aufgabenstellung oder Musterloesung fehlen

Die Antwort wird per Zod-Schema validiert. Fehlerhafte oder unvollstaendige Antworten werden nicht direkt als Korrektur uebernommen.

## Integration in bestehende Korrekturstruktur

Die KI erzeugt keinen parallelen Bewertungsbereich. Ihre Vorschlaege ergaenzen die bestehende Datenstruktur:

- `corrections`: Punktzahl und Gesamtkommentar nach menschlicher Uebernahme
- `inline_comments`: konkrete Textkommentare nach Uebernahme
- `tags_json`: vorgeschlagene Fehler-, Themen- und Klausurtyp-Tags
- neue Struktur fuer Verbesserungsvorschlaege und Lernaufgaben

Ein KI-Korrekturvorschlag benoetigt einen eigenen Status:

- `draft`: KI-Ergebnis liegt vor und wartet auf Review
- `accepted`: Vorschlag wurde uebernommen
- `rejected`: Vorschlag wurde verworfen
- `superseded`: Vorschlag wurde durch neueren Entwurf ersetzt

Auswertung und Lernsteuerung beruecksichtigen nur bestaetigte Korrektur- und Nachbereitungsdaten.

## Bewertungsrubrik fuer Prompts

Die Prompt-Rubrik soll knapp und reproduzierbar sein. Sie beruht auf allgemeinen Grundsaetzen der juristischen Klausurbewertung und wird nicht als langer Fremdtext in den Prompt kopiert.

Die KI soll insbesondere pruefen:

- Wurden tragende Probleme und Normen erkannt?
- Wurden sie vertretbar, methodisch sauber und differenziert geloest?
- Ist der Aufbau klar, klausurtypgerecht und schwerpunktorientiert?
- Ist die Darstellung nuechtern, folgerichtig und korrekturfreundlich?
- Welche Basiselemente tragen die Mindestleistung?
- Welche vertiefenden Zusatzprobleme fehlen oder sind falsch gewichtet?
- Welche konkrete Aenderung bringt bei der naechsten Klausur am meisten Punkte?

Der Punktvorschlag muss immer begruendet werden. Die KI soll nicht nur Fehler benennen, sondern erklaeren, wie Aufbau, Formulierung, Schwerpunktsetzung oder Pruefungsschritt besser geloest werden koennen.

## UI-Konzept

### Pruefung anlegen und bearbeiten

Die bestehende Pruefungsmaske wird um fachliche Metadaten und Upload-Rollen erweitert. Die UI bleibt ruhig und arbeitsorientiert. Quelle und Anbieter sind einfache Freitextfelder; Klausurtyp und Rechtsgebiet koennen als Auswahl mit freiem Fallback umgesetzt werden.

### Bewertung

Die bestehende Korrekturansicht erhaelt einen Button `KI-Korrektur vorschlagen`. Der Button ist nur aktiv, wenn eine Submission ausgewaehlt ist. Vor der ersten Nutzung erscheint ein Datenschutzhinweis: Aufgabenstellung, Musterloesung, Abgabe und ausgewaehlte Metadaten werden an den konfigurierten KI-Anbieter uebertragen.

Der Korrekturvorschlag wird in derselben Ansicht dargestellt wie menschliche Korrekturen:

- Punktvorschlag mit sichtbarer KI-Markierung
- Begruendung
- Gesamtkommentar
- Inline-Kommentarvorschlaege
- Verbesserungsvorschlaege
- Aktionen: uebernehmen, bearbeiten, verwerfen

### Nachbereitung

Nach Uebernahme einer Korrektur entstehen Lernaufgaben oder Verbesserungsvorschlaege. Sie koennen Status und Prioritaet erhalten und sind mit Rechtsgebiet, Klausurtyp und Fehlerkategorie verbunden.

### Auswertung

Die Auswertung kann zusaetzlich zu Punkten und Tags zeigen:

- haeufige Fehlerkategorien
- offene Lernaufgaben
- Klausurtypen mit wiederkehrenden Schwaechen
- naechste sinnvolle Uebung nach Rechtsgebiet, Klausurtyp und Fehlerprofil

## Fehlerfaelle

- Kein API-Key: Einrichtungshilfe anzeigen, manuelle Korrektur bleibt nutzbar.
- Ungueltiger API-Key: Verbindungstest und klare Fehlermeldung.
- Keine Musterloesung: KI-Korrektur erlauben, aber mit niedrigerer Sicherheit kennzeichnen.
- Zu grosse Dateien oder Kontexte: Nutzerin oder Nutzer muss Unterlagen kuerzen oder Auswahl reduzieren.
- API-Timeout oder Netzfehler: Korrekturvorgang abbrechen, keine Teiluebernahme.
- Unsichere Inline-Anker: Kommentar als allgemeiner Hinweis anzeigen, nicht falsch im Text verankern.
- Schemafehler in KI-Antwort: Antwort nicht uebernehmen, Fehler protokollieren und Retry anbieten.

## Datenschutz und Transparenz

Vor erster KI-Nutzung muss klar sein:

- Welche Inhalte an den KI-Anbieter uebertragen werden.
- Dass die Korrektur nicht lokal/offline erfolgt.
- Dass die Bewertung ein KI-Vorschlag und keine offizielle Korrektur ist.
- Dass hochgeladene fremde Unterlagen nur von der Nutzerin oder dem Nutzer bereitgestellt werden.

Die App sollte keine Cloud-Pflicht einfuehren. KI ist optional.

## Tests und Checks

Mindestchecks fuer die Umsetzung:

- `pnpm run typecheck` fuer Renderer, Main, Preload und Shared Types
- `pnpm test` fuer Services, Schemas, Migrationen und Prompt-/Antwortvalidierung
- Renderer-Tests fuer Uebernehmen, Bearbeiten und Verwerfen von KI-Vorschlaegen
- Tests fuer `0-18` Punkte inklusive halber Punkte
- Tests fuer Submission-Bezug statt aktuellem Entwurf
- E2E-Smoke fuer KI-Button mit gemockter API, wenn lokal praktikabel

## Nicht im ersten Bauabschnitt

- Betreiberseitiger KI-Zugang ohne eigenen API-Key
- Lokale Modelle oder lokale Modellinstallation
- Mitgelieferte fremde Klausuren oder Loesungsskizzen
- Automatische endgueltige Bewertung ohne menschliche Review
- Vollstaendiger Lernkalender fuer die letzten Wochen vor dem Examen
- Cloud-Sync oder Account-System

## Offene Umsetzungsentscheidungen fuer den Plan

- Konkreter KI-Anbieter und Modellname
- Secret-Storage-Implementierung fuer API-Keys
- Dateiextraktion aus PDFs und anderen Uploads
- Tabellenzuschnitt fuer KI-Entwuerfe und Lernaufgaben
- Prompt-Versionierung und Speicherung der verwendeten Prompt-Version
