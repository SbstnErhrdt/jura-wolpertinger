# Agent Instructions

Diese Datei ist die verbindliche Arbeitsanweisung für Coding-Agents in diesem Repository.

## Projektkontext

Jura Wolpertinger ist eine lokale Electron/Vue-App für juristische Übungsprüfungen in Bayern. Die App soll lokal, schlicht und prüfungsnah bleiben: schreiben, speichern, abgeben, bewerten, exportieren und auswerten.

Wichtige Begriffe:

- Produktname: `Jura Wolpertinger`
- UI-Begriff: `Prüfung`
- Code-Begriff: `exam`
- Paketformat: `.jura`
- Bewertungssystem: Bayern `0-18`, inklusive halber Punkte

## Architektur lesen

Vor größeren Änderungen zuerst lesen:

- [README.md](README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/ci-guidelines.md](docs/ci-guidelines.md)
- [docs/user-stories.md](docs/user-stories.md)

## Technische Grenzen

- Renderer-Code darf nicht direkt auf SQLite oder das Dateisystem zugreifen.
- Persistente Daten laufen über IPC, Main Process Services und Shared Types.
- Neue IPC-Funktionen müssen in `src/shared/ipc.ts`, `src/preload/index.ts` und `src/main/index.ts` konsistent typisiert werden.
- Datenbankänderungen brauchen eine Migration in `src/main/services/database.ts`.
- Bei Datenbankänderungen `DATABASE_SCHEMA_VERSION` in `src/shared/constants.ts` erhöhen.
- `.jura` Import/Export muss über Zod-Schemas validiert bleiben.
- Abgaben sind Snapshots. Späteres Bearbeiten darf bestehende Submissions nicht verändern.
- Korrekturen und Inline-Kommentare beziehen sich auf Submissions, nicht auf den aktuellen Entwurf.
- Normale UI-Aktionen dürfen nichts hart löschen. Papierkorb/Archiv muss Soft-Delete bleiben.
- `assets/icon.png` und `assets/submission.png` sind die zentralen Asset-Quellen.
- Generierte Icon-/Renderer-Kopien nicht manuell pflegen, wenn ein Script oder Vite-Sync dafür existiert.

## UI-Regeln

- Der Prüfungsmodus ist eine Referenzoberfläche und darf nicht versehentlich "modernisiert" werden.
- Veränderungen am Editor müssen hellen und dunklen Modus prüfen.
- Buttons, Toggles und aktive States müssen klar erkennbar sein.
- Keine dekorativen UI-Umbauten ohne konkreten Nutzen.
- Die App soll lokal, ruhig und arbeitsorientiert wirken.
- Die Zielgruppe sind Jura-Studierende und Referendarinnen/Referendare ohne technische Vorkenntnisse. UI-Texte müssen fachlich, einfach und nicht-technisch formuliert sein.
- Technische Begriffe wie `JSON`, `API`, `Sync`, `Export`, `Import`, `Cloud-Key` oder Dateiformatnamen dürfen im Nutzer-UI nur stehen, wenn sie wirklich notwendig sind. Bevorzugt werden alltagstaugliche Begriffe wie `Karteikarten-Datei sichern`, `Karteikarten-Datei auswählen`, `Daten übertragen`, `mit der Online-Version verbinden`.
- Primäre Nutzerflows müssen ohne technisches Vorwissen verständlich sein. Wenn ein Button eine Aktion direkt ausführt, muss der Text dies klar sagen, z. B. `Account jetzt erstellen`, `Karteikarte speichern`, `Datei auswählen`.
- Erstellen und Bearbeiten von Inhalten muss über Modals oder eigene Detailseiten laufen, nicht über Inline-Formulare in Listen oder Übersichten.
- Löschen, Archivieren oder andere potentiell destruktive Aktionen brauchen immer ein Confirm-Modal mit klarer Beschreibung der Folge.
- Hierarchien sollen in der UI sichtbar navigierbar sein. Ein untergeordnetes Objekt wird im Kontext seines übergeordneten Objekts erstellt, z. B. Karteikarten innerhalb einer geöffneten Sammlung, nicht lose auf der Sammlungsübersicht.
- Übersichtsseiten zeigen Orientierung und Einstiegspunkte; Detailseiten zeigen die eigentliche Arbeitsoberfläche mit Liste, Suche, Sortierung, Kennzahlen und Aktionen im Kontext.

## Datenmodell-Regeln

- Neue persistente Felder müssen versioniert gedacht werden.
- Migrationen müssen idempotent für den vorgesehenen Versionsschritt sein.
- Tests für Migrationen, Scores, Submissions und `.jura` sollten angepasst werden.
- `score_points` akzeptiert fachlich `0-18` in `0.5` Schritten.
- Tags sind aktuell in JSON-Feldern aktiv; die normalisierten Tabellen sind vorbereitet.
- Cloud-Listen, Review-Batches und Sync-Flows dürfen nicht clientseitig "alles laden und filtern". Große Datenmengen müssen serverseitig begrenzt, paginiert oder per RPC geladen werden.
- Supabase-REST-Abfragen mit `.in(...)` brauchen bewusst kleine Chunks und Regressionstests, sobald die ID-Liste aus Nutzerdaten wachsen kann.

## Arbeitsweise

- Vor Änderungen `git status --short` ansehen.
- Bestehende, fremde Änderungen nicht zurücksetzen.
- Lokale Patterns bevorzugen statt neue Frameworks oder Abstraktionen einzuführen.
- Für Datei- und Textsuche `rg` verwenden.
- Manuelle Edits mit Patch-Tools machen, nicht durch ungeprüfte Shell-Overwrite-Tricks.
- Keine neuen Abhängigkeiten ohne klaren Grund.
- `docs/user-stories.md` bei neuen Features, UI-Konzepten oder geänderten Nutzerflows aktuell halten.
- Nach Änderungen passende Checks aus `docs/ci-guidelines.md` ausführen.
- Im Abschluss nennen, welche Checks gelaufen sind und welche bewusst nicht.

## Pflichtchecks nach Änderungsart

| Änderung | Mindestcheck |
| --- | --- |
| TypeScript, Vue, Main, Preload, Shared | `pnpm run typecheck` |
| Services, Schemas, Migrationen, `.jura` | `pnpm test` |
| Editor, Dashboard, Bewertung, Auswertung | `pnpm run typecheck` plus relevante Tests |
| Prüfungsmodus oder kritischer UI-Flow | `pnpm run test:e2e` wenn lokal möglich |
| Packaging, Icons, Electron Builder | `pnpm run dist:dir` |
| Nur Dokumentation | Markdown-/Link-Sanity reicht |

## CI-Verhalten

Agents sollen CI nicht als nachträgliche Formalität behandeln. Wenn eine Änderung wahrscheinlich in CI brechen kann, muss sie lokal vorgeprüft werden. Falls ein Check wegen lokaler Umgebung nicht läuft, muss der Abschluss das klar sagen.

Empfohlene Reihenfolge für größere PRs:

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm run test:e2e
```

`pnpm run test:e2e` ist langsamer und baut die App. Bei reinen Main-/Schema-Änderungen ist er nicht immer Pflicht, bei UI- und Editor-Änderungen aber sehr wertvoll.

## Lizenz und Scope

Das Projekt ist nicht-kommerziell lizenziert. Keine Änderung darf den Eindruck erwecken, die App sei offiziell, zertifiziert oder für echte Prüfungsverfahren zugelassen.
