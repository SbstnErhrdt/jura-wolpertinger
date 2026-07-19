<template>
  <section class="about-view">
    <header class="page-header about-header">
      <div>
        <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
        <p class="eyebrow">Über das Projekt</p>
        <h1>Wolpi und das Schreiben</h1>
      </div>
    </header>

    <section class="about-hero">
      <div class="about-hero-copy">
        <p class="about-kicker">Ein kleines Freizeitprojekt</p>
        <h2>Prüfungsnah schreiben, Karteikarten wiederholen und den eigenen Lernstand behalten.</h2>
        <p>
          Der Wolpertinger ist hier einfach Wolpi: die inoffizielle Begleitfigur dieser App. In
          der kleinen Geschichte hinter dem Projekt hilft er Jura-Studierenden in Bayern dabei,
          regelmäßig zu lernen, Karteikarten wiederzuholen und Prüfungen möglichst prüfungsnah zu
          schreiben.
        </p>
        <p>
          Die App ist kein offizielles Angebot, sondern ein privates Freizeitprojekt. Sie soll
          eine ruhige, einfache Umgebung bieten, in der man eigene Sammlungen aufbaut, kurze
          Lerneinheiten startet, Entwürfe schreibt, Abgaben korrigiert und den eigenen Stand
          nachvollziehbar nachhält.
        </p>
      </div>
      <div class="about-hero-art">
        <img :src="submissionImageUrl" alt="Wolpi freut sich über eine abgegebene Klausur" />
      </div>
    </section>

    <section class="about-grid">
      <UCard class="about-panel">
        <h3>Die Idee</h3>
        <p>
          Wolpi steht für eine einfache Idee: Lernen soll schnell starten und sich nicht nach
          Verwaltungsarbeit anfühlen. Karteikarten helfen bei kleinen Wiederholungen zwischendurch,
          Prüfungen trainieren den Ernstfall am Schreibtisch.
        </p>
      </UCard>

      <UCard class="about-panel">
        <h3>Was die App können soll</h3>
        <p>
          Karteikarten in Sammlungen organisieren, Schlagwörter vergeben, Wiederholungen bewerten,
          Kartenqualität prüfen, Prüfungen verwalten, Kommentare und Bewertungen festhalten und
          Fortschritt sichtbar machen. Alles klar, ruhig und ohne unnötigen Ballast.
        </p>
      </UCard>

      <UCard class="about-panel">
        <h3>Arbeitsbereich und Online-Sicherung</h3>
        <p>
          Die Desktop-App startet immer mit einem Arbeitsbereich auf dem Gerät. Wer möchte,
          kann diesen Arbeitsbereich später online sichern, alles abgleichen oder auf einem
          anderen Gerät weiterarbeiten. Lokale Daten werden dabei nicht ungefragt ersetzt.
        </p>
      </UCard>

      <UCard class="about-panel">
        <h3>Karteikarten</h3>
        <p>
          Karteikarten ergänzen das Klausurtraining um kurze Einheiten: Sammlungen öffnen,
          Vorder- und Rückseite wiederholen, den eigenen Stand bewerten und schwierige Karten
          gezielt früher wiedersehen. Wenn eine Karte unklar, zu lang oder fachlich fraglich ist,
          kann sie zur Überarbeitung markiert werden und pausiert dann in der Wiederholung.
        </p>
      </UCard>

      <UCard class="about-panel">
        <h3>Ton des Projekts</h3>
        <p>
          Kein großes Produktversprechen, keine offizielle Plattform. Nur ein sorgfältig gebautes
          Tool, das im Alltag helfen soll. Wenn Wolpi dabei ein wenig Motivation mitbringt, ist das
          genau die richtige Größenordnung.
        </p>
      </UCard>
    </section>
  </section>
</template>

<script setup lang="ts">
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'

const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Mehr', to: { name: 'more' } },
  { label: 'About' }
]

const submissionImageUrl = 'assets/submission.png'
</script>
