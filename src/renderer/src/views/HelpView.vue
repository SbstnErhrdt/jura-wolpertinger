<template>
  <section class="help-view">
    <header class="page-header">
      <div>
        <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
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
        <h2>Lernen, schreiben, später übertragen</h2>
        <p>
          Jura Wolpertinger verbindet kurze Karteikarten-Einheiten mit prüfungsnahem Schreiben.
          Lokal kannst du ohne Online-Verbindung arbeiten; angemeldet kannst du deine Daten mit
          der Online-Version verbinden.
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
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'

const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Mehr', to: { name: 'more' } },
  { label: 'Hilfe' }
]

const faq = [
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
    question: 'Wie wiederhole ich Karteikarten?',
    answer:
      'Starte eine Wiederholung über Home, über den Bereich Karteikarten oder direkt aus einer Sammlung. Nach dem Aufdecken bewertest du selbst, wie gut du die Antwort konntest.'
  },
  {
    question: 'Was bedeuten die Bewertungen bei Karteikarten?',
    answer:
      'Nochmal, Schwer, Gut und Leicht zeigen deinen letzten Lernstand. Die App nutzt diese Rückmeldung, damit schwierige Karten früher wieder auftauchen.'
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
    question: 'Was passiert bei einer KI-Korrektur?',
    answer:
      'Die App sendet die ausgewählte Abgabe und passende Unterlagen wie Aufgabenstellung oder Musterlösung an den konfigurierten KI-Anbieter. Das Ergebnis ist ein Korrekturentwurf, den du prüfen, bearbeiten, übernehmen oder verwerfen kannst.'
  },
  {
    question: 'Wie sollte ich Tags nutzen?',
    answer:
      'Nutze Schlagwörter für Rechtsgebiet, Prüfungsgebiet, Klausurtyp, Thema und typische Fehler. Beispiele: zivilrecht, relationstechnik, strafurteil, verwaltungsrecht, fristen.'
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
