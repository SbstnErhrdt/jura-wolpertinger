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
        <h2>Prüfungsnah üben, offline schreiben, mit der Oberfläche vertraut werden.</h2>
        <p>
          Der Wolpertinger ist hier einfach Wolpi: die inoffizielle Begleitfigur dieser App. In
          der kleinen Geschichte hinter dem Projekt hilft er Jura-Studierenden in Bayern dabei,
          Prüfungen möglichst prüfungsnah zu schreiben und sich früh an die Arbeitsweise der
          Oberfläche zu gewöhnen.
        </p>
        <p>
          Die App ist kein offizielles Angebot, sondern ein privates Freizeitprojekt. Sie soll
          eine ruhige, einfache Umgebung bieten, in der man Entwürfe offline schreiben, abgeben,
          korrigieren und den eigenen Stand lokal nachhalten kann.
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
          Wolpi steht für eine einfache Idee: Wenn die Oberfläche vertraut ist, bleibt im Ernstfall
          mehr Aufmerksamkeit für den Inhalt. Deshalb orientiert sich die App bewusst an einem
          prüfungsnahen Ablauf und soll Schreiben, automatisches Speichern und Abgeben nicht
          unnötig kompliziert machen.
        </p>
      </UCard>

      <UCard class="about-panel">
        <h3>Was die App können soll</h3>
        <p>
          Prüfungen verwalten, in Ordnern ablegen, lokal exportieren, Kommentare und Bewertungen
          festhalten und den eigenen Fortschritt sauber dokumentieren. Alles offline-ready, klar
          und ohne unnötigen Ballast.
        </p>
      </UCard>

      <UCard class="about-panel">
        <h3>Warum lokal</h3>
        <p>
          Die Arbeit soll auf dem eigenen Rechner bleiben. Entwürfe werden fortlaufend in lokale
          Revisionen geschrieben, sodass eine Klausur nach Stromausfall, leerem Akku oder
          App-Absturz nicht einfach verloren ist. Ein Server kann später kommen, aber der Kern
          soll auch allein zuverlässig funktionieren.
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
