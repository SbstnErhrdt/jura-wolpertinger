import type { RouteLocationRaw } from 'vue-router'

export type AppBreadcrumbItem = {
  label: string
  to?: RouteLocationRaw
  icon?: string
}

export function withHomeIcon(items: AppBreadcrumbItem[]): AppBreadcrumbItem[] {
  return items.map((item, index) => (index === 0 ? { ...item, icon: 'i-lucide-house' } : item))
}
