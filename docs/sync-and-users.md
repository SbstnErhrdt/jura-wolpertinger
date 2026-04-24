# Nutzer- und Synchronisationskonzept

## Ziel

Die App bleibt zuerst offline-ready. Nutzer können lokal arbeiten, schnell zwischen Profilen wechseln und später ein Remote-Konto verbinden, ohne dass lokale Klausuren, Abgaben, Bewertungen oder Anhänge verloren gehen.

## Lokales Modell

- Jeder Nutzer hat eine UUID in `users.id`.
- `meta.current_user_id` bestimmt den aktiven Arbeitsbereich.
- Fachliche Tabellen tragen `user_id`: Ordner, Klausuren, Revisionen, Abgaben, Bewertungen, Inline-Kommentare, Anhänge und Tags.
- Onboarding ist pro Nutzer gespeichert: `onboarding_completed_at` und `tour_completed_at`.
- Der Demo-Nutzer ist ein eigener Nutzer vom Typ `demo`; dadurch bleiben Beispieldaten von echten lokalen Daten getrennt.

## Remote-Verknüpfung

Bei einer späteren Anmeldung sollte die lokale UUID nicht sofort gelöscht werden. Der sichere Ablauf:

1. Lokalen Nutzer mit Remote-Konto verknüpfen und `remote_user_id` setzen.
2. Lokale Objekte anhand ihrer UUIDs, Zeitstempel und Inhalts-Hashes zum Server übertragen.
3. Serverantwort mit Remote-IDs oder Sync-Ständen lokal speichern.
4. Erst nach erfolgreicher Bestätigung Konflikte zusammenführen oder Dubletten markieren.

So bleibt der lokale Arbeitsstand erhalten, auch wenn Login, Netzwerk oder Server-Sync fehlschlägt.

## Mehrere Nutzer

Mehrere lokale und remote-verknüpfte Nutzer dürfen parallel existieren. Der Wechsel setzt nur `current_user_id`; Daten werden nicht verschoben. Für spätere Team- oder Geräte-Szenarien kann ein Nutzer mehrere Remote-Identitäten oder Geräte-Sync-Stände bekommen, ohne die lokale Besitz-UUID aufzugeben.

## Konfliktregeln

- UUID gewinnt vor Titel oder Namen.
- Inhaltliche Konflikte werden nicht still überschrieben.
- Revisionen und Abgaben sind append-only und eignen sich als sichere Sync-Historie.
- Anhänge werden über Metadaten plus Dateigröße und optional Hash verglichen.
- Tags sollten normalisiert werden, damit Auswertungen lokal und remote dieselbe Bedeutung haben.

## Onboarding

Die Einstiegstour nutzt Driver.js. Neue Nutzer werden gefragt, ob sie die Tour starten möchten. Der Schwerpunkt liegt auf Nutzerwechsel, lokaler Speicherung, Tagging, Bewertung und Auswertung. Die Tour kann jederzeit über die Sidebar oder die Hilfeseite erneut gestartet werden.
