<template>
  <FlashcardsCollectionsView />
  <UButton color="neutral" variant="ghost" :to="{ name: 'flashcards-statistics' }">Lernstatistik öffnen</UButton>
</template>

<script setup lang="ts">
import FlashcardsCollectionsView from './FlashcardsCollectionsView.vue'
</script>
