# Prüfungsordner und Breadcrumbs

Ziel: Ordnerauswahl, Browseradresse und Breadcrumb zeigen denselben Kontext; direkte Links, Neuladen und Browser-History bleiben zuverlässig.

Entscheidung: bestehende Route `/exams/library` mit `?folder=<stabile ID>` erweitern. `?folder=unassigned` zeigt Prüfungen ohne Ordner; ohne Parameter werden alle Einträge geladen. Keine Namens-Slugs, da Umbenennen bestehende Links erhalten soll. Die Detail-URL einer Prüfung bleibt stabil; ihr Ordner-Breadcrumb und der Bibliotheks-Rückweg verweisen auf die aktuelle Ordnerzuordnung.

Ursachen: Dashboard hält die Auswahl nur als Ref; Bibliothek und Ordner sind beide nicht verlinkte Breadcrumb-Elemente. CSS hebt sämtliche Nuxt-Breadcrumb-Spans hervor. Die Bibliotheksliste akzeptiert verspätete Antworten ohne Prüfung der zuletzt angeforderten Auswahl.

- [x] Navigation mit Test reproduzieren: Ordner klicken → URL, Reload, History, Klausur → Ordner, Bibliothek → Gesamtansicht, ohne Ordner, Umbenennen, archivierter Link.
- [x] Gemeinsame URL-Helfer und Route als Quelle der Ordnerauswahl nutzen. Nicht verfügbare Ordner nach abgeschlossener Ordnerabfrage mit Hinweis zur Gesamtansicht umleiten; andere Query-Parameter erhalten.
- [x] Initialfilter im Store explizit übernehmen; verspätete Listenantworten/Fehler anhand einer monotonen Anfrage-ID ignorieren. Aktuellen Filter schon bei Anfragebeginn setzen, damit zwischenzeitliche Nachladevorgänge ihn erhalten.
- [x] Bibliothek als Eltern-Link, Ordner als aktuelles Element; Detail-Ordner verlinken. In gemeinsamen Breadcrumbs nur letzten Eintrag als aktiv deklarieren und über `aria-current=page` hervorheben.
- [x] Hilfe und Nutzerbeschreibung anpassen; Über-Seite auf notwendigen Änderungsbedarf prüfen.
- [x] Typprüfung, Unit-Tests, vollständige Electron-E2E einschließlich Accessibility hell/dunkel. Isolierter Webbuild aus der bisherigen Veröffentlichung plus gezielten Änderungen; tatsächlichen Livezustand nach Rollout prüfen.

Bestehende Arbeitsdateien und fremde Änderungen erhalten. Keine Änderung am Prüfungsinhalt, Datenbankschema, Bewertungen oder Lernalgorithmus. Umsetzung in der laufenden Aufgabe aufgrund des erteilten Korrekturauftrags; kein zusätzlicher Freigabeschritt für die Wahl des Query-Parameters nötig.
