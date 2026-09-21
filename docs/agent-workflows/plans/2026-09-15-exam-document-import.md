# Übernahme vorhandener Prüfungsarbeiten

**Ziel:** 22 vom Nutzer bereitgestellte Word-Ausarbeitungen vollständig und lesbar in das ausdrücklich benannte Online-Konto übernehmen.

**Vorgehen:** DOCX-Inhalte in die vorhandenen Tiptap-Absätze konvertieren; automatische Word-Nummerierung materialisieren. Neue Prüfungen und Ordner additiv in den kontoeigenen Browser-Snapshot einfügen. Die bestehende Desktop-Sicherung bleibt unverändert. Keine Noten oder historischen Abgabetermine erfinden; die Arbeiten bleiben im Status „In Bearbeitung“.

**Erforderliche Lade-Korrektur:** Beim ersten Bibliothekszugriff nach einem Seitenstart fehlende Online-Prüfungen samt abhängigen Datensätzen ergänzen. Bestehende lokale IDs, Bearbeitungen und Abgaben behalten Vorrang. Vor einer Online-Sicherung nochmals fehlende Prüfungen ergänzen, damit eine ältere Sitzung den Import nicht entfernt. Nach asynchronen Antworten Konto und lokale Eigentümerschaft erneut prüfen.

- [x] Dateien, OOXML-Sonderfälle, Konto und vorhandene Sicherungen prüfen.
- [x] Texttreue und Word-Nummerierungen mit gerenderten Quellen vergleichen.
- [x] Alle 22 Arbeiten im ausgelieferten Editor mit isolierten API-Antworten prüfen.
- [x] Fehler beim Laden eines bestehenden Browser-Speichers und beim späteren Sichern mit roten Regressionstests belegen.
- [x] Additive Übernahme implementieren, lokale Datensätze unverändert lassen.
- [x] Typprüfung, relevante Tests und unabhängiges Review abschließen.
- [x] Webkorrektur aus dem zuletzt veröffentlichten Quellstand plus gezielter Änderung bauen und prüfen.
- [x] Kontogebundenen Import mit aktuellem Backup und Transaktionsprüfung ausführen.
- [x] Produktiven Datensatz, Eigentümerschaft und Darstellung abschließend verifizieren.

Ergebnis: 379 Tests in 65 Dateien erfolgreich; vier neue Regressionstests betreffen bestehende Browser, spätere Imports und Kontowechsel während Laden/Sichern. Alle 22 produktiven Prüfungen mit kontogebundenem Lesezugriff im echten Browser geöffnet und der vollständige Absatztext verglichen. Der Live-Build enthält `index-Ch0Bw76X.js`; die CSS-Datei bleibt `index-BK9tmaiS.css`. Die vorhandene Desktop-Sicherung wurde vollständig unverändert nachgewiesen.

Die generelle Konfliktlösung gleichzeitiger Bearbeitungen derselben Prüfung ist nicht Teil dieser Änderung. Die bestehenden Hilfe- und Über-Texte beschreiben bereits die Bibliothek und das Speichern; es wird kein neuer Bedienablauf hinzugefügt.
