import type { RouteLocationRaw } from 'vue-router'

export type AppBreadcrumbItem = {
  label: string
  to?: RouteLocationRaw
  icon?: string
  active?: boolean
}

export function withHomeIcon(items: AppBreadcrumbItem[]): AppBreadcrumbItem[] {
  return items.map((item, index) => ({
    ...item,
    ...(index === 0 ? { icon: 'i-lucide-house' } : {}),
    active: index === items.length - 1
  }))
}
