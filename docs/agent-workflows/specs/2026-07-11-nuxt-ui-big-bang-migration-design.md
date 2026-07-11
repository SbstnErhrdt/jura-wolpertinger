# Nuxt UI Big-Bang-Migration

## Ziel

Die gesamte Produktoberflaeche von Jura Wolpertinger wird in einem zusammenhaengenden Umbau auf `@nuxt/ui` v4 portiert. Es gibt keinen Parallelbetrieb der alten und neuen allgemeinen UI und keine schrittweise Freischaltung. Nach Abschluss verwenden alle Ansichten ausser der vollstaendig geschuetzten Pruefungsansicht Nuxt-UI-Komponenten und das gemeinsame Nuxt-UI-Theming.

Die Anwendung bleibt eine Vue-3-Anwendung auf Electron Vite. Nuxt UI wird ueber seine offizielle Vue-/Vite-Integration verwendet; ein Wechsel auf das Nuxt-Framework ist nicht Teil der Migration.

## Harte Randbedingungen

- Die komplette Pruefungsansicht bleibt unveraendert. Das umfasst `ExamView.vue`, `ExamEditor.vue`, Normal- und Fokusmodus, Toolbar, Timer, Aufgabendarstellung, Statusanzeigen, Abgabeablauf, Dialoge und alle Styles, die diese Ansicht benoetigt.
- Die Pruefungsansicht muss nach der Migration visuell genauso aussehen wie vorher.
- Die lokale Desktop-Version verwendet weiterhin Electron IPC, SQLite ueber `better-sqlite3` und das lokale Dateisystem.
- Die Cloud-Version verwendet weiterhin Supabase Auth, Postgres/RPCs und Storage ueber die bestehende `AppApi`-Abstraktion.
- Die Browser-Entwicklungsvariante und ihre lokale Fallback-API bleiben funktionsfaehig.
- Die bestehenden CI-Workflows und ihre Befehle bleiben erhalten. Insbesondere bleiben `pnpm run typecheck`, `pnpm test`, `pnpm run build` und die vorhandene Release-Matrix unveraendert aufrufbar.
- Es gibt derzeit keine produktiven Nutzer. Deshalb sind weder Feature-Flags noch ein paralleler Legacy-Modus oder eine gestaffelte Aktivierung erforderlich.

## Migrationsstrategie

Der Umbau erfolgt als Big Bang innerhalb eines Entwicklungszweigs. Technische Zwischen-Commits duerfen die Arbeit nachvollziehbar strukturieren, aber es wird nur eine vollstaendig migrierte und verifizierte Oberflaeche als Ergebnis ausgeliefert.

Die bestehende Daten- und Geschaeftslogik wird nicht neu geschrieben. Views behalten ihre API-Aufrufe, Stores, Router-Ziele und Ereignisablaeufe. Geaendert werden die Darstellungsschicht, wiederkehrende UI-Muster und das globale Styling ausserhalb der Pruefungsansicht.

## Technische Basis

Die Renderer-Konfiguration erhaelt die offizielle Nuxt-UI-Vite-Integration. Der Vue-Einstieg registriert den Nuxt-UI-Plugin und die Anwendung wird in `UApp` eingebettet. Das Renderer-HTML erhaelt die fuer Nuxt UI empfohlene isolierte Root-Klasse.

Die Styles importieren Tailwind CSS und Nuxt UI. Ein zentrales Theme bildet die bestehenden Markenfarben, Radien, Schriftgewichte und kompakten Abstaende ab. Hell- und Dunkelmodus werden an die bestehende Theme-Steuerung angebunden, sodass die gespeicherte Nutzerauswahl weiterhin gilt.

Nuxt UI bleibt eine reine Renderer-Abhaengigkeit. Main Process, Preload, Shared Schemas und Datenadapter erhalten dadurch keine neue Abhaengigkeit.

## Komponenten-Schnitt

Ausserhalb der Pruefungsansicht werden native oder selbst gestaltete Standard-Steuerelemente durch Nuxt UI ersetzt:

- App-Root und globale Overlay-Infrastruktur: `UApp`
- Primaere und mobile Navigation: `UNavigationMenu` und passende Nuxt-UI-Shell-Bausteine
- Breadcrumbs: `UBreadcrumb`
- Aktionen und Icon-Aktionen: `UButton`
- Texteingaben, Passwort, Suche und Textbereiche: `UInput` und `UTextarea`
- Auswahlfelder und Umschalter: `USelect`, `USwitch`, `UCheckbox` oder `URadioGroup`
- Feldbeschriftung und Validierung: `UForm`, `UFormField`
- Status und Metadaten: `UBadge`
- Seitennavigation: `UPagination`
- Ladezustaende: `USkeleton` und bei passenden Einzelaktionen der Loading-Zustand von `UButton`
- Kontextaktionen: `UDropdownMenu`
- Dialoge und Bestaetigungen: `UModal`
- Dauerhafte Hinweise und Fehler: `UAlert`
- Wiederholte Inhaltscontainer: `UCard`, sofern ein echter abgegrenzter Container vorliegt
- Leere Zustaende: `UEmpty`, sofern die Darstellung zum jeweiligen Arbeitsablauf passt

Die bestehenden Wrapper `AppBreadcrumb`, `AppPagination`, `ListSkeleton`, `AppBadge` und `ActionMenu` werden nach der Umstellung ihrer Aufrufer entfernt. Eigene Komponenten bleiben erlaubt, wenn sie fachliches Verhalten kapseln und nicht nur ein Nuxt-UI-Standardsteuerelement duplizieren.

## Visuelles System

Die neue Oberflaeche verwendet semantische Nuxt-UI-Farben fuer Primaeraktionen, neutrale Flaechen, Erfolg, Warnung und Fehler. Die aktuelle hellblaue Markenidentitaet bleibt erhalten und wird als vollstaendige Farbskala in das Theme uebertragen.

Allgemeine Seiten verwenden einen gemeinsamen Inhaltsrahmen, eine einheitliche Ueberschriftenhierarchie, konsistente horizontale Abstaende und identische Kontrollhoehen. Direkt nebeneinanderstehende Aktionen verwenden dieselbe Nuxt-UI-Groesse. Mobil bleiben die vier Hauptziele Home, Karteikarten, Pruefungen und Mehr erreichbar; Unterseiten bleiben ueber die vorhandenen Hub-Seiten und Breadcrumbs auffindbar.

Der Umbau soll wie Jura Wolpertinger aussehen, nicht wie ein unveraendertes Nuxt-UI-Beispiel. Anpassungen erfolgen bevorzugt ueber das globale Theme und Komponentenvarianten, nicht ueber verstreute Einzelfall-CSS-Regeln.

## Geschuetzte Pruefungsansicht

`ExamView.vue` und `ExamEditor.vue` werden waehrend der Migration nicht in Nuxt-UI-Komponenten umgebaut. Ihre DOM-Struktur, Klassen, Interaktionen und sichtbaren Texte bleiben bestehen. Das gilt auch fuer die in `ExamView.vue` enthaltenen Dialoge und Steuerelemente.

Die fuer diese Ansicht erforderlichen Styles werden in einen klar markierten Legacy-Bereich beziehungsweise eine eigene Stylesheet-Grenze ueberfuehrt, ohne ihre berechneten Werte zu veraendern. Falls das Einfuehren von Tailwind-Preflight die Pruefungsansicht beeinflusst, werden die bisherigen Werte an der geschuetzten Grenze explizit wiederhergestellt. Es werden keine optischen Verbesserungen am Editor oder seiner umgebenden Ansicht im Rahmen dieser Migration vorgenommen.

## Cloud und lokale Laufzeit

Die Laufzeitwahl bleibt in `api.ts` und den bestehenden Adaptern. Komponenten konsumieren weiterhin nur die gemeinsame `AppApi`; sie erkennen weder SQLite noch Supabase direkt.

Die Auth-Sperre der Cloud-Version wird mit Nuxt UI dargestellt, ohne ihre Session-Logik zu veraendern. Lokale Nutzerverwaltung, Cloud-Anmeldung, Lade-, Leer- und Fehlerzustaende muessen in beiden Laufzeiten dieselben fachlichen Aktionen anbieten. Netzwerkfehler in der Cloud bleiben wiederholbar; lokale SQLite-Fehler werden weiterhin sichtbar statt als leere Liste dargestellt.

## CSS-Bereinigung

Das bisherige globale Stylesheet wird nach der Komponentenportierung bereinigt. Allgemeine Button-, Input-, Select-, Modal-, Badge-, Breadcrumb-, Pagination- und Skeleton-Regeln werden entfernt, sobald keine Aufrufer mehr bestehen.

Erhalten bleiben:

- Marken- und Theme-Tokens, die Nuxt UI konfigurieren
- wenige echte Layout-Regeln fuer fachliche Ansichten
- Animationen der Karteikarten
- die vollstaendige geschuetzte Styling-Grenze der Pruefungsansicht
- Druck- und Exportregeln, soweit sie fuer bestehende Ausgabewege erforderlich sind

## Fehler- und Ladeverhalten

Initiales Laden von Listen und Detaildaten zeigt strukturtreue Skeletons. Einzelaktionen verwenden den eingebauten Loading-Zustand und verhindern doppelte Ausloesung. Fehler werden als persistente Alerts mit einer konkreten Wiederholen-Aktion dargestellt. Leere Zustaende werden erst gezeigt, nachdem der Ladevorgang erfolgreich abgeschlossen wurde.

Die Migration darf keine bestehenden asynchronen Ablaufe oder Pagination-Vertraege veraendern. Sie ersetzt nur deren Darstellung.

## Teststrategie

Vor der allgemeinen Portierung wird die geschuetzte Pruefungsansicht durch Regressionstests abgesichert. Die Tests pruefen ihre zentralen DOM-Klassen, Toolbar-Aktionen, Editor-Flaeche, Fokusmodus und Abgabeablauf. Playwright-Screenshots beziehungsweise feste Layout-Messungen vergleichen Normal- und Fokusmodus in Hell und Dunkel auf repraesentativen Viewports.

Fuer die migrierte Oberflaeche pruefen Renderer-Tests:

- `UApp` und Nuxt-UI-Plugin sind korrekt eingerichtet.
- Ausserhalb der geschuetzten Pruefungsansicht existieren keine selbst gestalteten Standard-Buttons, Formfelder, Breadcrumbs, Paginationen, Skeletons oder Modals mehr.
- Alle Routen behalten ihre Namen und Ziele.
- Loading-, Fehler-, Leer- und deaktivierte Zustaende bleiben erreichbar.
- Mobile Navigation und Breadcrumb-Hierarchie bleiben vollstaendig.

Die Abschlussverifikation umfasst:

- `pnpm run typecheck`
- `pnpm test`
- `pnpm run build`
- `pnpm run build:web:production` mit gueltiger Cloud-Konfiguration
- Electron-E2E-Smoke fuer lokale SQLite-Flows
- Browser-Smoke fuer die Supabase-Cloud-Flows
- visueller Check aller nicht parametrisierten Routen auf Desktop und Mobil, jeweils in Hell und Dunkel
- visueller Regression-Check der unveraenderten Pruefungsansicht

## Definition of Done

Die Migration ist abgeschlossen, wenn alle allgemeinen Ansichten Nuxt UI als Komponentenbasis verwenden, die alten UI-Hilfskomponenten entfernt sind, das globale CSS keine parallele allgemeine Komponentenbibliothek mehr darstellt und alle bestehenden CI-Befehle erfolgreich laufen.

Zusaetzlich muessen die lokale SQLite-App und die Supabase-Cloud-App dieselben bestehenden Fachablaufe weiterhin ausfuehren. Die komplette Pruefungsansicht muss funktional und visuell unveraendert sein. Es wird kein Zwischenstand ausgeliefert, in dem alte und neue allgemeine UI nebeneinander bestehen.
