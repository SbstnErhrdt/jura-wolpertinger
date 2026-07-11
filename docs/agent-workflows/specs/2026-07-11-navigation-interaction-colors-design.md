# Konsistente Navigationszustände

## Ziel

Desktop-Navigation, mobile Navigation und Breadcrumbs verwenden auf jeder Seite eine gemeinsame, klar erkennbare Farblogik für Standard-, Hover-, Aktiv- und Tastaturfokuszustände. Light und Dark Mode erhalten jeweils kontrastreiche, zum bestehenden Jura-Wolpertinger-Theme passende Farben.

## Gestaltung

- Die Desktop-Sidebar behält ihren blauen Hintergrund. Hover hellt den jeweiligen Eintrag dezent auf und setzt Text sowie Icon weiß. Der aktive Eintrag bleibt stärker hervorgehoben als Hover.
- Die mobile Navigation verwendet im Light Mode eine hellblaue Hover-Fläche mit dunkler blauer Schrift. Der aktive Eintrag erhält eine kräftigere, dauerhaft sichtbare Fläche. Im Dark Mode werden entsprechend dunkle Flächen und helle Schrift verwendet.
- Verlinkte Breadcrumb-Einträge verwenden dieselbe hellblaue beziehungsweise dunkelblaue Hover-Logik wie die mobile Navigation. Der aktuelle Breadcrumb bleibt als kräftig blauer Pill-Zustand eindeutig erkennbar.
- Alle interaktiven Navigationselemente erhalten einen einheitlichen `:focus-visible`-Rahmen mit ausreichendem Abstand. Fokus darf weder abgeschnitten noch ausschließlich über Farbe vermittelt werden.
- Hover verändert keine Abmessungen, Abstände oder Typografie. Icons verwenden weiterhin `currentColor`.

## Technische Umsetzung

Die Zustände werden zentral in `src/renderer/src/styles/main.css` definiert. Selektoren orientieren sich an den bestehenden Klassen `.nav`, `.mobile-nav` und `.app-breadcrumb`, damit alle aktuellen und zukünftigen Seiten automatisch dieselben Regeln erhalten. Nuxt-UI-interne Zustandsattribute werden nur dort ergänzt, wo Router-Klassen nicht ausreichen.

## Verifikation

- Renderer-Regressionstests prüfen, dass Hover-, Active-, Focus- und Dark-Mode-Regeln für alle drei Navigationsarten vorhanden sind.
- Typecheck und vollständige Unit-Test-Suite müssen erfolgreich sein.
- Light und Dark Mode werden auf Desktop und Mobile im Browser visuell geprüft.
- Dabei werden aktive und inaktive Ziele sowie Breadcrumb-Links auf mehreren Seiten kontrolliert; es darf keinen horizontalen Überlauf oder Layoutsprung geben.
