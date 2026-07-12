import { computed, ref } from 'vue'

type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'jura-wolpertinger-theme'

const theme = ref<ThemeMode>(readInitialTheme())
const isDark = computed(() => theme.value === 'dark')

export function useTheme() {
  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
    applyTheme
  }
}

function setTheme(nextTheme: ThemeMode): void {
  theme.value = nextTheme
  applyTheme()
}

function toggleTheme(): void {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}

function applyTheme(): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme.value
  document.documentElement.style.colorScheme = theme.value
  document.documentElement.classList.toggle('dark', theme.value === 'dark')
  document.documentElement.classList.toggle('light', theme.value === 'light')
  localStorage.setItem(STORAGE_KEY, theme.value)
}

function readInitialTheme(): ThemeMode {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  }
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}
