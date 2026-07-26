# Beta Corner Ribbon

## Ziel

Der Beta-Hinweis sitzt sauber in der oberen rechten Ecke der Desktop-Sidebar. Er bleibt diagonal, ist vollständig lesbar und wirkt nicht zufällig am Rand abgeschnitten.

## Gestaltung

- Ein eigener, absolut positionierter Eckbereich begrenzt das Ribbon kontrolliert.
- Das rote Band läuft diagonal durch diesen Eckbereich; nur seine äußeren Enden werden symmetrisch an der Ecke maskiert.
- `BETA` bleibt vollständig sichtbar und erhält ausreichend Innenabstand.
- Das Ribbon überlappt weder Logo noch Produktname.
- Farbe, Typografie und Schatten bleiben in Light und Dark Mode identisch.
- Auf mobilen Ansichten verschwindet das Ribbon zusammen mit der Desktop-Sidebar.

## Umsetzung

- In `App.vue` erhält das Ribbon einen nicht-interaktiven Wrapper.
- In `main.css` übernimmt der Wrapper Positionierung und Zuschnitt; das innere Element übernimmt Rotation und Darstellung.
- Die bestehende Sidebar-Breite und Navigation bleiben unverändert.

## Prüfung

- Ein UI-Vertragstest prüft Wrapper, Position und Rotation.
- Desktop-Screenshots kontrollieren Lesbarkeit, Abstand zur Marke und saubere Kanten.
- Die bestehende mobile Navigation und der Electron-End-to-End-Test dürfen nicht regressieren.
