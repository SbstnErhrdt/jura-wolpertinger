<template>
  <UBreadcrumb class="app-breadcrumb" aria-label="Pfad" :items="withHomeIcon(items)" />
</template>

<script setup lang="ts">
import { type AppBreadcrumbItem, withHomeIcon } from '../../ui/breadcrumbs'

export type BreadcrumbItem = AppBreadcrumbItem

defineProps<{
  items: BreadcrumbItem[]
}>()
</script>

<style scoped>
.app-breadcrumb {
  align-items: center;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0, 90, 132, 0.08);
  display: inline-flex;
  max-width: 100%;
  overflow-x: auto;
  padding: 4px;
  scrollbar-width: none;
}

.app-breadcrumb::-webkit-scrollbar {
  display: none;
}

@media (max-width: 720px) {
  .app-breadcrumb {
    max-width: calc(100vw - 32px);
  }
}

.app-breadcrumb :deep([data-slot='list']) {
  align-items: center;
  display: flex;
  gap: 2px;
  list-style: none;
  margin: 0;
  min-width: 0;
  padding: 0;
  white-space: nowrap;
}

.app-breadcrumb :deep([data-slot='item']) {
  flex: 0 0 auto;
}

.app-breadcrumb :deep([data-slot='link']),
.app-breadcrumb :deep([data-slot='linkLabel']) {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.app-breadcrumb :deep([data-slot='link']) {
  align-items: center;
  border-radius: 999px;
  color: var(--color-text);
  display: inline-flex;
  gap: 5px;
  min-height: 26px;
  padding: 0 9px;
  text-decoration: none;
  transition:
    background-color 140ms ease,
    color 140ms ease;
}

.app-breadcrumb :deep([data-slot='linkLabel']) {
  color: inherit;
}

.app-breadcrumb :deep(a[data-slot='link']:hover),
.app-breadcrumb :deep(a[data-slot='link']:focus-visible) {
  background: var(--wolpi-blue-tint);
  color: var(--color-primary-strong);
}

.app-breadcrumb :deep(a[data-slot='link']:focus-visible) {
  outline: 2px solid var(--wolpi-nav-blue);
  outline-offset: 2px;
}

.app-breadcrumb :deep([data-slot='link'][aria-current='page']) {
  background: var(--color-primary-strong);
  color: #fff;
}

.app-breadcrumb :deep([data-slot='linkLeadingIcon']),
.app-breadcrumb :deep([data-slot='separatorIcon']) {
  height: 14px;
  width: 14px;
}

.app-breadcrumb :deep([data-slot='separatorIcon']) {
  color: var(--color-text-muted);
  opacity: 0.62;
}

:root[data-theme='dark'] .app-breadcrumb {
  background: rgba(17, 27, 32, 0.78);
  border-color: #31424a;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
}

:root[data-theme='dark'] .app-breadcrumb :deep([data-slot='link']) {
  color: #b7c9d0;
}

:root[data-theme='dark'] .app-breadcrumb :deep(a[data-slot='link']:hover),
:root[data-theme='dark'] .app-breadcrumb :deep(a[data-slot='link']:focus-visible) {
  background: #173746;
  color: var(--wolpi-blue-tint);
  outline-color: var(--wolpi-blue-tint);
}

:root[data-theme='dark'] .app-breadcrumb :deep([data-slot='link'][aria-current='page']) {
  background: var(--wolpi-nav-blue);
  color: #fff;
}

:root[data-theme='dark'] .app-breadcrumb :deep([data-slot='separatorIcon']) {
  color: #8fa3ac;
}
</style>
