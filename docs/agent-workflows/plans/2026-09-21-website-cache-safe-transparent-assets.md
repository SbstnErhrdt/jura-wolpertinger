# Cache-sichere transparente Website-Medien – Implementierungsplan

**Ziel:** Aktuelle transparente Wolpis und Screenshots werden über gehashte
URLs ausgeliefert; Linux erhält ein echtes Plattform-Symbol.

**Architektur:** Hugo Resources übernimmt Bilder aus `website/assets/images`,
fingerprintet sie und setzt die generierten URLs in Templates und Social-Meta-
Daten ein. Tests prüfen Transparenzanteil, Template-Verwendung und UI-Layout.

## Aufgaben

- [x] Regressionstests für Asset-Fingerprints, Mindesttransparenz und das
      Linux-Symbol ergänzen und den roten Ausgangszustand bestätigen.
- [x] Wolpi-Grafiken und Screenshots in die Hugo-Asset-Pipeline verschieben.
- [x] Ein lokales Tux-SVG mit dokumentierter Quelle ergänzen.
- [x] Homepage, Seitenlayouts und Social-Metadaten auf fingerprintete
      Ressourcen umstellen.
- [x] Den Browser-Testserver auf die neuen Asset-Pfade anpassen.
- [x] Fokussierte Website-Tests, Hugo-Build, visuellen Browsercheck,
      Gesamttests und Typecheck ausführen.
- [ ] Den verfolgten `docs/`-Website-Build aktualisieren, committen, pushen,
      deployen und die öffentliche Auslieferung kontrollieren.
