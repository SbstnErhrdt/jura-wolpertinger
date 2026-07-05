# Cloud MVP und Karteikarten Design

Datum: 2026-07-05

## Ziel

Jura Wolpertinger soll auf der bestehenden Electron/Vue-App aufbauen und eine gemeinsame Produktoberflaeche fuer Desktop und Web erhalten. Die Desktop-App bleibt lokal und standalone. Die Web-App unter `app.jura-wolpi.de` ist ein geschlossener Service hinter Login und nutzt Supabase als Remote-Backend. Beide Varianten sollen fachlich gleich funktionieren; die KI-Korrektur ist die bewusste Ausnahme.

## Produktregeln

- Die bestehende Vue/Electron-App bleibt die Basis. Bestehende Pruefungsfeatures werden wiederverwendet.
- Web und Desktop teilen Navigation, Routen, Domain-Begriffe und UI-Komponenten so weit wie moeglich.
- Die Web-App funktioniert nicht ohne Login. Ohne gueltige Supabase-Session werden keine App-Daten, Demo-Daten oder lokalen Browser-Daten geladen.
- Nutzer koennen sich in der Web-App selbst registrieren. Der Account ist kostenlos.
- Die Desktop-App funktioniert ohne Account lokal weiter.
- Desktop-Nutzer koennen spaeter ein Remote-Konto verbinden und lokale Daten synchronisieren.
- Cloud-KI-Korrektur ist im MVP sichtbar, aber deaktiviert. Desktop-KI kann weiter ueber den eigenen lokalen Key laufen.
- Lernzeit, Kalender, iCloud-Sync und Zeit-Auswertungen bleiben ausserhalb des MVP.

## App-Struktur

Nach Login startet die App auf einem neuen Home Screen. Home ist motivierend, knapp und handlungsorientiert. Der Screen soll vorhandene Wolpertinger-/Tier-PNGs nutzen, ohne verspielt zu wirken.

Home zeigt:

- Streak und Streak-Schutz
- faellige Karteikarten
- schnellen Einstieg in Wiederholen
- schnellen Einstieg in Pruefung schreiben
- wenige, positive Statussignale statt umfangreicher Analyse

Desktop nutzt eine linke Sidebar. Mobile nutzt eine mobile-freundliche Navigation, bei der Home und Karteikarten schnell erreichbar sind. Pruefungen bleiben auch mobil sichtbar, sind aber primaer fuer Desktop/Laptop optimiert.

## Navigation

Die Navigation wird nach Produktbereichen geordnet:

1. Home
2. Karteikarten
   - Wiederholen
   - Sammlungen
   - Karten
3. Pruefungen
   - Bibliothek
   - Schreiben
   - KI-Korrektur
   - Auswertung
4. Einstellungen
5. Hilfe
6. Account und Sync

Die vorhandenen Pruefungsseiten werden in den Bereich `Pruefungen` eingehaengt. Die bisherige `Bibliothek`, `Bewertung` und `Auswertung` werden fachlich umsortiert, nicht neu erfunden.

## Auth-Grenze

Die Web-App braucht eine echte Auth-Grenze, kein visuelles Overlay ueber einer bereits geladenen App.

Ablauf:

1. App startet.
2. Web-Umgebung erkennt fehlende Supabase-Session.
3. Nur Auth-UI wird gerendert.
4. Nach Login wird der User geladen.
5. User-Acknowledgement wird geprueft.
6. Erst danach wird die App-Shell mit Home, Karteikarten und Pruefungen geladen.

Wenn die Session ablaeuft, kehrt die Web-App in den Auth-Zustand zurueck und zeigt keine geschuetzten Daten weiter an.

## Karteikarten MVP

Karteikarten sind das erste vollwertige neue Lernmodul.

Der MVP enthaelt:

- Sammlungen
- persoenliche Ordner
- Tags
- Frage/Antwort-Karten mit Markdown
- Wiederholen-Flow mit Vorderseite und Rueckseite
- Selbstbewertung
- Review-Historie
- Scheduler mit faelligen Karten
- Seed-Import vorhandener Decks aus `/Users/sbstn/Documents/sabine/Karteikarten/decks`

Nicht im MVP:

- Bilder in Karten
- Aufbau-Typ mit KI-Abgleich
- automatisierte Erstellung aus Dokumenten
- Teilen, Freigeben und Kollaboration
- allgemeiner Nutzer-Importer

## Collections, Ordner und Tags

Eine Collection ist ein fachlicher Kartensatz. Sie ist die Einheit fuer Import, Kopie, Teilen und spaetere Kollaboration.

Ein Ordner ist persoenliche Organisation. Ordner gehoeren zum Nutzer und werden nicht automatisch aus fremden Collections uebernommen.

Tags sind flexible Filter ueber Collections und Ordner hinweg.

Regeln:

- Eine Karte gehoert genau zu einer Collection.
- Review-Historie gehoert zum Nutzer, nicht zur Collection.
- Public oder geteilte Collections werden beim Import als eigene Kopie uebernommen.
- Tags werden beim Kopieren mitgenommen, aber als Tags der eigenen Kopie gespeichert.
- Ordner werden beim Import nicht uebernommen. Der Nutzer waehlt einen Zielordner; Default ist `Unsortiert`.
- Seed-Karten bleiben zunaechst private Testdaten und werden erst nach fachlicher Pruefung public.

## Wiederholen und Bewertung

Der Review-Flow ist schnell und mobile-friendly:

1. Vorderseite anzeigen.
2. Tap oder Aktion zeigt Rueckseite.
3. Nutzer bewertet selbst.
4. App zeigt kurz das naechste Intervall.
5. Naechste Karte erscheint automatisch.

Bewertungsskala:

- `Nochmal`
- `Schwer`
- `Gut`
- `Leicht`

Intern werden stabile Werte `1` bis `4` gespeichert. `Nochmal` erscheint innerhalb derselben Session erneut, aber nicht sofort direkt danach. Erst eine bessere Bewertung erzeugt ein normales Wiederholungsintervall. Jede Bewertung wird in der Review-Historie gespeichert.

Waehrend des Wiederholens gibt es ein kleines Aktionsmenue:

- Bearbeiten
- Tags aendern
- Aus aktueller Session entfernen

## Streak

Der Streak zaehlt echte Lernaktivitaet:

- Karteikarte bewertet
- Pruefung geschrieben, gespeichert oder abgegeben

Nicht zaehlen:

- App oeffnen
- Karte nur ansehen
- Einstellungen aendern
- Collection verwalten

Eine Woche hat zwei freie Tage. Freie Tage erhalten den Streak, erhoehen ihn aber nicht. Wenn mehr als zwei Tage in einer Woche ohne Lernaktivitaet bleiben, bricht der Streak. Die Berechnung nutzt die lokale Zeitzone des Nutzers.

## Pruefungen

Pruefungen bleiben ein vollwertiger Produktbereich. Lokale Features sollen fachlich 1:1 auch remote funktionieren:

- Bibliothek
- Ordner und Tags
- Pruefung schreiben
- Speichern
- Abgeben
- Bewerten
- Auswerten

Die Cloud-KI-Korrektur ist im MVP sichtbar, aber deaktiviert. Die UI soll klar kommunizieren, dass sie in der Cloud-Version noch nicht freigeschaltet ist. Im Desktop bleibt der eigene OpenAI-Key der lokale Weg.

## Daten- und Adapterstrategie

Die gemeinsame UI soll gegen eine fachliche API arbeiten, nicht direkt gegen konkrete Persistenz.

Adapter:

- Desktop/local: Electron IPC, SQLite und lokales Dateisystem
- Web/remote: Supabase Auth, Postgres/RPCs und Storage

Die bestehende Browser-localStorage-Fallback-Logik darf nicht als produktive Web-Persistenz fuer `app.jura-wolpi.de` verwendet werden. Fuer lokale Entwicklung kann sie getrennt bleiben, darf aber nicht hinter dem echten Cloud-Login als Datenquelle laufen.

## Sync-Grundsatz

Desktop-Sync verbindet einen lokalen Nutzer mit einem Remote-Konto, ohne lokale Daten zu verlieren.

Grundregeln:

- lokale UUIDs bleiben stabil
- Remote-Verknuepfung wird separat gespeichert
- Upload/Download arbeitet append-only, wo fachlich moeglich
- Konflikte werden nicht still ueberschrieben
- Review-Historie und Pruefungsabgaben bleiben nachvollziehbar

## Erfolgskriterien

Der MVP ist erfolgreich, wenn:

- `app.jura-wolpi.de` ohne Login keine App-Funktion zeigt
- registrierte Nutzer nach Login den Home Screen sehen
- Karteikarten mobil angenehm wiederholt werden koennen
- Collections, Ordner, Tags und Review-Historie funktionieren
- vorhandene Pruefungsfeatures in der neuen Navigation weiterhin nutzbar sind
- Cloud-KI-Korrektur sichtbar, aber deaktiviert ist
- Desktop lokal weiter ohne Account funktioniert
- die Architektur spaeter Sync, Teilen und Lernzeit ermoeglicht, ohne sie im MVP mitzuschleppen

## Offene Nicht-MVP-Themen

- allgemeiner Importer fuer Nutzerdateien
- Bilder und Medien in Karteikarten
- Aufbau-Karten mit KI-Abgleich
- Public Collections und Kollaboration
- Cloud-KI-Korrektur mit Kostenkontrolle
- Lernzeit, Kalender, iCloud-Sync und Auswertungen
