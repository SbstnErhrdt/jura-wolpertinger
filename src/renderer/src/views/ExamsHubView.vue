<template>
  <section class="mobile-hub-view">
    <header class="page-header">
      <div>
        <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
        <p class="eyebrow">Prüfungen</p>
        <h1>Prüfungen</h1>
        <p>Öffne deine Bibliothek, bewerte abgegebene Klausuren oder prüfe deine Entwicklung.</p>
      </div>
    </header>

    <nav class="mobile-hub-grid" aria-label="Prüfungsbereiche">
      <UPageCard class="mobile-hub-link" icon="i-lucide-library-big" title="Bibliothek" description="Klausuren schreiben, ordnen und öffnen." :to="{ name: 'dashboard' }" />
      <UPageCard class="mobile-hub-link" icon="i-lucide-clipboard-check" title="Bewertung" description="Abgaben korrigieren und Feedback pflegen." :to="{ name: 'correction' }" />
      <UPageCard class="mobile-hub-link" icon="i-lucide-chart-no-axes-combined" title="Auswertung" description="Punkte, Verlauf und Lernaufgaben ansehen." :to="{ name: 'analytics' }" />
    </nav>
  </section>
</template>

<script setup lang="ts">
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'

const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Prüfungen' }
]
</script>
