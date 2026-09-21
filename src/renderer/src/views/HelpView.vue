<template>
  <section class="help-view">
    <header class="page-header">
      <div>
        <AppBreadcrumb :items="breadcrumbItems" />
        <p class="eyebrow">Hilfe</p>
        <h1>Fragen und Antworten</h1>
      </div>
      <div class="header-actions">
        <UButton @click="startTour">
          <Route :size="17" />
          Tour starten
        </UButton>
      </div>
    </header>

    <section class="help-hero">
      <div>
        <h2>Lernen, schreiben, optional online sichern</h2>
        <p>
          Jura Wolpertinger verbindet kurze Karteikarten-Einheiten mit prüfungsnahem Schreiben.
          Du kannst auf diesem Gerät starten und deinen Arbeitsbereich später online sichern,
          wenn du auch auf anderen Geräten weiterarbeiten möchtest.
        </p>
      </div>
    </section>

    <section class="help-grid">
      <UCard v-for="item in faq" :key="item.question" class="help-item">
        <h2>{{ item.question }}</h2>
        <p>{{ item.answer }}</p>
      </UCard>
    </section>
  </section>
</template>

<script setup lang="ts">
import { Route } from 'lucide-vue-next'
import AppBreadcrumb from '../components/ui/AppBreadcrumb.vue'
import type { AppBreadcrumbItem } from '../ui/breadcrumbs'

const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Mehr', to: { name: 'more' } },
  { label: 'Hilfe' }
]

const faq = [
  {
    question: 'Wo finde ich frühere Bewertungen und Originaldateien?',
    answer: 'Öffne die passende Prüfung und wähle eine Abgabe, um ihre Punkte, Gesamtrückmeldung und Randbemerkungen zu lesen. Hinterlegte Originalabgaben und Korrekturdateien findest du bei den Anhängen der Prüfung. In der Online-Version lädt ein Klick die Datei herunter. Dein aktueller Entwurf bleibt beim Übernehmen früherer Abgaben erhalten.'
  },
  {
    question: 'Gehen meine Klausuren verloren, wenn der Rechner abstürzt?',
    answer:
      'Nein. Die App speichert lokal und offline-ready. Autosaves, Abgaben und Bewertungen bleiben in der lokalen Datenbank erhalten.'
  },
  {
    question: 'Wie erstelle ich Karteikarten?',
    answer:
      'Öffne zuerst eine Sammlung. Dort kannst du neue Karteikarten anlegen, Vorderseite und Rückseite schreiben und passende Schlagwörter hinzufügen.'
  },
  {
    question: 'Welche Sammlung sollte ich als Nächstes lernen?',
    answer: 'Unter Als Nächstes lernen findest du einen begründeten Vorschlag aus allen deinen Sammlungen: zuerst fällige Wiederholungen, danach den zuletzt begonnenen offenen Durchgang und sonst eine Sammlung mit wenigen neuen Karten. Die Suche findet Sammlungsnamen und Rechtsgebiete über alle Seiten. Du kannst jederzeit eine andere Sammlung wählen.'
  },
  {
    question: 'Was zeigt der Fortschrittsbalken einer Sammlung?',
    answer: 'Der Balken zeigt den letzten Lernstand deiner aktuell lernbaren Karten: Rot steht für Nicht gewusst, Orange für Teilweise gewusst, Grün für Gewusst und der helle Rest für noch nicht bearbeitete Karten. Wegen ihrer Qualität pausierte Karten zählen nicht mit. Wiederholungen können auch bei vollständig bearbeiteten Sammlungen fällig sein.'
  },
  {
    question: 'Wie finde ich einen bestimmten Podcast?',
    answer: 'Die Suche in der Podcast-Übersicht findet Rechtsgebiete, Reihen, Ausgaben und einzelne Folgen. Auch Begriffe aus der Beschreibung und Schreibweisen ohne Akzente werden berücksichtigt. Mit Suche zurücksetzen siehst du wieder alle Reihen.'
  },
  {
    question: 'Was zeigt der Fortschrittsbalken eines Podcasts?',
    answer: 'Der Balken zeigt den Anteil der bereits gehörten Zeit an der gesamten Podcast-Reihe. Angefangene Folgen zählen deshalb anteilig. Als abgeschlossen gilt eine Folge erst, wenn sie vollständig beziehungsweise bis kurz vor das Ende gehört wurde.'
  },
  {
    question: 'Wie wiederhole ich Karteikarten?',
    answer:
      'Wähle unter Karteikarten eine Sammlung und starte den ersten Durchgang. Jede bewertete Karte zählt als bearbeitet, auch wenn du die Antwort nicht wusstest. Die nächsten offenen Karten folgen ohne feste Rundenlänge. Du kannst jederzeit pausieren und den gespeicherten Durchgang später fortsetzen. Empfohlene oder unsichere Karten lassen sich zusätzlich bewusst wiederholen.'
  },
  {
    question: 'Wann gratuliert Wolpi beim Lernen?',
    answer: 'Nach jeweils zehn bearbeiteten Karten eines Durchgangs zeigt Wolpi kurz ein Erfolgsbild. Jede Einschätzung zählt, auch Nicht gewusst. Du kannst sofort weiterlernen oder das Bild schließen. Pausen und Neuladen erhalten den Motivationszähler auf diesem Gerät. Rückgängigmachen korrigiert ihn, ohne dieselbe Gratulation erneut auszulösen. Am vollständigen Abschluss bleibt ein Wolpi-Bild in der Zusammenfassung stehen, auch bei kleinen Sammlungen.'
  },
  {
    question: 'Was bedeuten die Bewertungen bei Karteikarten?',
    answer:
      'Nicht gewusst, Teilweise gewusst und Gewusst beschreiben deine Antwort vor dem Aufdecken. Sie beeinflussen spätere Wiederholungsempfehlungen. Im aktuellen Durchgang erscheint jede Karte einmal. Einmal bearbeitet bedeutet deshalb nicht sicher beherrscht. Eine versehentliche Bewertung kannst du direkt rückgängig machen.'
  },
  {
    question: 'Was passiert mit zurückgestellten Karten?',
    answer: 'Für später zurückstellen speichert keine Bewertung. Die Karte bleibt offen, während zuerst die übrigen Karten kommen. Am Ende kannst du die zurückgestellten Karten bewusst bearbeiten. Auch nach einer Pause bleiben sie erhalten.'
  },
  {
    question: 'Was ist die Kartenqualität?',
    answer:
      'Die Kartenqualität bewertet die Karte selbst, nicht deine Antwort. Markiere unklare, zu lange, zu knappe oder fachlich fragliche Karten als Überarbeiten oder Problematisch. Solche Karten pausieren in der Wiederholung, bis du sie bearbeitest.'
  },
  {
    question: 'Wie bearbeite oder bewerte ich eine Karte?',
    answer:
      'Öffne die Sammlung. Bei jeder Karte findest du Bearbeiten und Qualität. Im Wiederholen erreichst du dieselben Aktionen über das Menü mit den drei Punkten.'
  },
  {
    question: 'Wie lösche ich Karteikarten?',
    answer:
      'Öffne die Sammlung, gehe bei der Karte auf das Aktionsmenü mit den drei Punkten und wähle Karteikarte löschen. Vor dem Löschen fragt die App nochmal nach.'
  },
  {
    question: 'Wie übernehme ich Karteikarten auf ein anderes Gerät?',
    answer:
      'Du kannst deine Karteikarten als Datei sichern und später wieder auswählen. Mit einer Online-Verbindung sollen dieselben Inhalte zusätzlich zwischen Geräten übertragen werden.'
  },
  {
    question: 'Was ist ein Arbeitsbereich?',
    answer:
      'Ein Arbeitsbereich enthält deine Karteikarten, Prüfungen, Bewertungen, Anhänge und Einstellungen. Du kannst lokal starten und später entscheiden, ob dieser Arbeitsbereich online gesichert werden soll.'
  },
  {
    question: 'Was passiert, wenn ich die Online-Sicherung einrichte?',
    answer:
      'Deine lokalen Daten bleiben auf dem Gerät. Nach der Anmeldung fragt die App, ob du alles abgleichen, diesen Arbeitsbereich online sichern oder online gesicherte Daten auf dieses Gerät holen möchtest.'
  },
  {
    question: 'Woran sehe ich, ob alles gesichert ist?',
    answer:
      'In den Einstellungen zeigt die Karte Online-Version den aktuellen Zustand: nur auf diesem Gerät, bereit zum ersten Abgleich oder online gesichert. Dort steht auch, wann zuletzt synchronisiert wurde.'
  },
  {
    question: 'Warum gibt es mehrere Nutzer?',
    answer:
      'So kannst du eigene Klausuren, Demo-Daten oder andere Arbeitsbereiche trennen, ohne Dateien manuell zu verschieben.'
  },
  {
    question: 'Wie funktioniert Nutzerwechsel?',
    answer:
      'Jeder lokale Nutzer hat einen getrennten Arbeitsbereich. Beim Wechsel werden Bibliothek, Bewertung und Auswertung für den aktiven Nutzer geladen.'
  },
  {
    question: 'Was passiert bei einer späteren Anmeldung?',
    answer:
      'Deine lokalen Daten sollen erhalten bleiben. Eine spätere Anmeldung soll vorhandene Klausuren und Karteikarten übernehmen, statt sie ungefragt zu ersetzen.'
  },
  {
    question: 'Wie öffne ich einen Prüfungsordner direkt?',
    answer:
      'Öffne den Ordner in der Bibliothek. Im Browser kannst du seine Adresse als Lesezeichen speichern und später denselben Ordner wieder öffnen. Die Auswahl bleibt beim Neuladen erhalten. Über den Pfad oberhalb einer Prüfung gelangst du zurück in ihren Ordner oder zur gesamten Bibliothek.'
  },
  {
    question: 'Warum sehe ich nicht alle Klausuren auf einmal?',
    answer:
      'Die Bibliothek zeigt zunächst 25 Klausuren pro Seite. Unter der Liste wechselst du zur nächsten Seite oder wählst bis zu 100 Einträge pro Seite. Prüfungen nennt die Gesamtzahl im ausgewählten Ordner. Abgegeben, Korrigiert und Schnitt beziehen sich auf die angezeigte Seite. In einer Bewertung führt Zur Prüfung zur zugehörigen Klausur.'
  },
  {
    question: 'Wie sollte ich Tags nutzen?',
    answer:
      'Nutze Schlagwörter für Rechtsgebiet, Prüfungsgebiet, Klausurtyp, Thema und typische Fehler. Tippe einen Teil des Begriffs und wähle einen Vorschlag, um das vollständige Schlagwort zu übernehmen. Einen eigenen Begriff bestätigst du mit Enter. Beispiele: zivilrecht, relationstechnik, strafurteil, verwaltungsrecht, fristen.'
  },
  {
    question: 'Was zeigt der Bewertungsverlauf?',
    answer:
      'Der Verlauf zeigt den Durchschnitt deiner Bewertungen pro Monat im gewählten Zeitraum und mit den ausgewählten Schlagwörtern. Die Zeitachse nennt jeden Monat samt Jahr. Monate ohne Bewertung bleiben leer. Bewege den Zeiger auf einen Punkt, wähle ihn mit der Tab-Taste oder tippe ihn an: Dann erscheinen der genaue Monatsdurchschnitt und die Anzahl der Bewertungen. Bei langen Zeiträumen kannst du das Diagramm seitlich verschieben.'
  },
  {
    question: 'Warum sind Schlagwörter für Auswertungen wichtig?',
    answer:
      'Nur mit konsistenten Schlagwörtern kann die Auswertung später zeigen, in welchen Rechtsgebieten, Aufgabentypen oder Fehlergruppen sich deine Punkte und Wiederholungen entwickeln.'
  },
  {
    question: 'Kann ich die Tour erneut ansehen?',
    answer:
      'Ja. Starte sie jederzeit über den Tour-Button in der linken Leiste oder über diese Hilfeseite.'
  },
  {
    question: 'Wie lösche ich Klausuren?',
    answer:
      'Klausuren werden zunächst archiviert. Du kannst sie per Rechtsklick oder Drag-and-drop in den Papierkorb verschieben und später wiederherstellen.'
  }
]

function startTour(): void {
  window.dispatchEvent(new CustomEvent('jura:start-tour'))
}
</script>
