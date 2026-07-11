import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from './views/DashboardView.vue'
import ExamView from './views/ExamView.vue'
import CorrectionView from './views/CorrectionView.vue'
import AboutView from './views/AboutView.vue'
import AnalyticsView from './views/AnalyticsView.vue'
import ExamsHubView from './views/ExamsHubView.vue'
import FlashcardsCollectionDetailView from './views/FlashcardsCollectionDetailView.vue'
import FlashcardsCollectionsView from './views/FlashcardsCollectionsView.vue'
import FlashcardsHubView from './views/FlashcardsHubView.vue'
import FlashcardsReviewView from './views/FlashcardsReviewView.vue'
import HelpView from './views/HelpView.vue'
import HomeView from './views/HomeView.vue'
import MoreHubView from './views/MoreHubView.vue'
import SettingsView from './views/SettingsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/flashcards', name: 'flashcards', component: FlashcardsHubView },
    { path: '/flashcards/review', name: 'flashcards-review', component: FlashcardsReviewView },
    { path: '/flashcards/collections', name: 'flashcards-collections', component: FlashcardsCollectionsView },
    { path: '/flashcards/collections/:id', name: 'flashcards-collection', component: FlashcardsCollectionDetailView },
    { path: '/exams', name: 'exams', component: ExamsHubView },
    { path: '/exams/library', name: 'dashboard', component: DashboardView },
    { path: '/exams/analytics', name: 'analytics', component: AnalyticsView },
    { path: '/exams/corrections/:id?', name: 'correction', component: CorrectionView },
    { path: '/exams/:id', name: 'exam', component: ExamView },
    { path: '/exams/:id/focus', name: 'exam-focus', component: ExamView, props: { focusMode: true } },
    { path: '/more', name: 'more', component: MoreHubView },
    { path: '/more/settings', name: 'settings', component: SettingsView },
    { path: '/more/about', name: 'about', component: AboutView },
    { path: '/more/help', name: 'help', component: HelpView },
    { path: '/analytics', redirect: { name: 'analytics' } },
    { path: '/settings', redirect: { name: 'settings' } },
    { path: '/about', redirect: { name: 'about' } },
    { path: '/help', redirect: { name: 'help' } },
    { path: '/exam/:id', redirect: (to) => ({ name: 'exam', params: { id: to.params.id } }) },
    { path: '/exam/:id/focus', redirect: (to) => ({ name: 'exam-focus', params: { id: to.params.id } }) },
    { path: '/corrections/:id?', redirect: (to) => ({ name: 'correction', params: { id: to.params.id } }) },
    { path: '/submission/:id/correct', redirect: (to) => ({ name: 'correction', params: { id: to.params.id } }) }
  ]
})
