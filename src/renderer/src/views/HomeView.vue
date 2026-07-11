<template>
  <section class="home-view">
    <div class="home-hero">
      <div>
        <p class="eyebrow">Heute</p>
        <h1>Bereit für deine nächste Einheit?</h1>
        <p>
          Kleine, echte Lerneinheiten zählen: Karteikarten wiederholen oder eine Prüfung schreiben.
        </p>
        <div class="home-actions">
          <UButton class="primary-action" size="lg" :to="{ name: 'flashcards-review' }">
            Karteikarten wiederholen
          </UButton>
          <UButton color="neutral" variant="outline" size="lg" :to="{ name: 'dashboard' }">
            Prüfung schreiben
          </UButton>
        </div>
      </div>
      <img :src="helloUrl" alt="" />
    </div>

    <div class="home-metrics">
      <UCard>
        <span>{{ dashboard?.streakDays ?? 0 }}</span>
        <strong>Tage Streak</strong>
        <small>{{ dashboard?.freeDaysRemainingThisWeek ?? 2 }} freie Tage diese Woche übrig</small>
      </UCard>
      <UCard>
        <span>{{ dashboard?.dueCount ?? 0 }}</span>
        <strong>Karten fällig</strong>
        <small>{{ dashboard?.totalCards ?? 0 }} Karten insgesamt</small>
      </UCard>
      <UCard>
        <span>{{ dashboard?.collectionCount ?? 0 }}</span>
        <strong>Sammlungen</strong>
        <small>{{ dashboard?.learnedToday ? 'Heute gelernt' : 'Heute noch offen' }}</small>
      </UCard>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { LearningDashboard } from '@shared/schemas'
import { api } from '../api'

const dashboard = ref<LearningDashboard | null>(null)
const helloUrl = 'assets/hello.png'

onMounted(async () => {
  dashboard.value = await api.getLearningDashboard()
})
</script>
