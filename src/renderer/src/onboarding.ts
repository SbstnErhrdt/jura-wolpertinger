import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

export function startOnboardingTour(onDone?: () => void): void {
  const tour = driver({
    allowClose: true,
    animate: true,
    showButtons: ['next', 'previous', 'close'],
    showProgress: true,
    nextBtnText: 'Weiter',
    prevBtnText: 'Zurück',
    doneBtnText: 'Fertig',
    progressText: '{{current}} von {{total}}',
    onDestroyed: onDone,
    steps: [
      {
        element: '.brand',
        popover: {
          title: 'Dein lokaler Arbeitsbereich',
          description:
            'Alles bleibt auf deinem Rechner gespeichert. Deine Klausuren, Ordner und Bewertungen sind deinem Nutzer zugeordnet.'
        }
      },
      {
        element: '.sidebar-user',
        popover: {
          title: 'Nutzer wechseln',
          description:
            'Hier wechselst du zwischen deinem Arbeitsbereich und dem Demo-Bereich. Beim Wechsel bleibt alles erhalten.'
        }
      },
      {
        element: '.dashboard .header-actions',
        popover: {
          title: 'Importieren',
          description:
            'Importierte Klausuren landen immer im aktuell ausgewählten Arbeitsbereich.'
        }
      },
      {
        element: '.work-grid',
        popover: {
          title: 'Bibliothek strukturieren',
          description:
            'Ordner helfen bei der Ablage. Ziehen in den Papierkorb archiviert, löscht aber nicht sofort unwiederbringlich.'
        }
      },
      {
        element: '.exam-list',
        popover: {
          title: 'Klausuren bearbeiten',
          description:
            'Rechtsklick auf eine Klausur öffnet Aktionen wie Anzeigen, Bearbeiten, Umbenennen, Löschen, Download und Export.'
        }
      },
      {
        popover: {
          title: 'Tagging für Auswertungen',
          description:
            'Tags sind wichtig: Nutze Rechtsgebiet, Prüfungsgebiet, Klausurtyp und Schwächen wie Fristen, Tenorierung oder Beweiswürdigung.'
        }
      },
      {
        element: '.nav a[href="#/corrections"]',
        popover: {
          title: 'Bewertung',
          description:
            'Abgaben erscheinen links in der Bewertung. Rechts bleibt der Arbeitsbereich scrollbar und Inline-Kommentare bleiben am Text verankert.'
        }
      },
      {
        element: '.nav a[href="#/analytics"]',
        popover: {
          title: 'Auswertung',
          description:
            'Je konsequenter du taggst, desto besser werden Trends nach Rechtsgebiet, Thema und Korrekturhinweisen sichtbar.'
        }
      },
      {
        element: '.nav a[href="#/help"]',
        popover: {
          title: 'Hilfe und Tour',
          description:
            'Die wichtigsten Fragen findest du auf der Hilfeseite. Dort kannst du diese Tour jederzeit erneut starten.'
        }
      }
    ]
  })

  tour.drive()
}
