<template>
  <section class="mobile-hub-view">
    <header class="page-header">
      <div>
        <UBreadcrumb class="app-breadcrumb" :items="withHomeIcon(breadcrumbItems)" />
        <p class="eyebrow">Mehr</p>
        <h1>Mehr</h1>
        <p>Einstellungen, Hilfe und Projektinformationen an einem Ort.</p>
      </div>
    </header>

    <nav class="mobile-hub-grid" aria-label="Weitere Bereiche">
      <UPageCard class="mobile-hub-link" icon="i-lucide-settings" title="Einstellungen" description="Nutzer, Online-Version und KI-Verbindung verwalten." :to="{ name: 'settings' }" />
      <UPageCard class="mobile-hub-link" icon="i-lucide-circle-help" title="Hilfe" description="Antworten und Tour für die wichtigsten Abläufe." :to="{ name: 'help' }" />
      <UPageCard class="mobile-hub-link" icon="i-lucide-info" title="About" description="Hintergrund zum Projekt und zur App-Idee." :to="{ name: 'about' }" />
    </nav>
  </section>
</template>

<script setup lang="ts">
import { type AppBreadcrumbItem, withHomeIcon } from '../ui/breadcrumbs'

const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Mehr' }
]
</script>
