import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from './views/DashboardView.vue'
import ExamView from './views/ExamView.vue'
import CorrectionView from './views/CorrectionView.vue'
import AboutView from './views/AboutView.vue'
import AnalyticsView from './views/AnalyticsView.vue'
import FlashcardsCollectionDetailView from './views/FlashcardsCollectionDetailView.vue'
import FlashcardsCollectionsView from './views/FlashcardsCollectionsView.vue'
import FlashcardsReviewView from './views/FlashcardsReviewView.vue'
import HelpView from './views/HelpView.vue'
import HomeView from './views/HomeView.vue'
import SettingsView from './views/SettingsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/flashcards/review', name: 'flashcards-review', component: FlashcardsReviewView },
    { path: '/flashcards/collections', name: 'flashcards-collections', component: FlashcardsCollectionsView },
    { path: '/flashcards/collections/:id', name: 'flashcards-collection', component: FlashcardsCollectionDetailView },
    { path: '/exams', name: 'dashboard', component: DashboardView },
    { path: '/analytics', name: 'analytics', component: AnalyticsView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/about', name: 'about', component: AboutView },
    { path: '/help', name: 'help', component: HelpView },
    { path: '/exam/:id', name: 'exam', component: ExamView },
    { path: '/exam/:id/focus', name: 'exam-focus', component: ExamView, props: { focusMode: true } },
    { path: '/corrections/:id?', name: 'correction', component: CorrectionView },
    { path: '/submission/:id/correct', redirect: (to) => ({ name: 'correction', params: { id: to.params.id } }) }
  ]
})
