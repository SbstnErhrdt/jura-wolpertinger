import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import { router } from './router'
import './styles/main.css'
import 'virtual:nuxt-icon-bundle/register'

createApp(App).use(createPinia()).use(router).use(ui).mount('#app')
