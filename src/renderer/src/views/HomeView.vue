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
          <RouterLink class="primary-action" :to="{ name: 'flashcards-review' }">
            Karteikarten wiederholen
          </RouterLink>
          <RouterLink class="secondary" :to="{ name: 'dashboard' }">
            Prüfung schreiben
          </RouterLink>
        </div>
      </div>
      <img :src="helloUrl" alt="" />
    </div>

    <div class="home-metrics">
      <article>
        <span>{{ dashboard?.streakDays ?? 0 }}</span>
        <strong>Tage Streak</strong>
        <small>{{ dashboard?.freeDaysRemainingThisWeek ?? 2 }} freie Tage diese Woche übrig</small>
      </article>
      <article>
        <span>{{ dashboard?.dueCount ?? 0 }}</span>
        <strong>Karten fällig</strong>
        <small>{{ dashboard?.totalCards ?? 0 }} Karten insgesamt</small>
      </article>
      <article>
        <span>{{ dashboard?.collectionCount ?? 0 }}</span>
        <strong>Sammlungen</strong>
        <small>{{ dashboard?.learnedToday ? 'Heute gelernt' : 'Heute noch offen' }}</small>
      </article>
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
