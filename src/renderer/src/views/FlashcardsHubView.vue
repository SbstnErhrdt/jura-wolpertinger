<template>
  <section class="mobile-hub-view">
    <header class="page-header">
      <div>
        <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
        <p class="eyebrow">Karteikarten</p>
        <h1>Karteikarten</h1>
        <p>Wähle, ob du direkt wiederholen oder deine Sammlungen verwalten möchtest.</p>
      </div>
    </header>

    <nav class="mobile-hub-grid" aria-label="Karteikartenbereiche">
      <UPageCard class="mobile-hub-link" icon="i-lucide-layers" title="Wiederholen" description="Fällige Karten schnell durcharbeiten." :to="{ name: 'flashcards-review' }" />
      <UPageCard class="mobile-hub-link" icon="i-lucide-folder-kanban" title="Sammlungen" description="Karten erstellen, suchen, importieren und organisieren." :to="{ name: 'flashcards-collections' }" />
    </nav>
  </section>
</template>

<script setup lang="ts">
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'

const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Karteikarten' }
]
</script>
