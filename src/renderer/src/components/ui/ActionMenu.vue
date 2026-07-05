<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="action-menu-trigger" :aria-label="label">
      <MoreHorizontal :size="18" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="action-menu-content" align="end" :side-offset="8">
        <DropdownMenuItem
          v-for="item in items"
          :key="item.label"
          class="action-menu-item"
          :class="item.tone === 'danger' ? 'action-menu-item-danger' : ''"
          @select="item.action"
        >
          <component :is="item.icon" v-if="item.icon" :size="16" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { MoreHorizontal } from 'lucide-vue-next'

export type ActionMenuItem = {
  label: string
  icon?: Component
  tone?: 'default' | 'danger'
  action: () => void
}

withDefaults(
  defineProps<{
    label?: string
    items: ActionMenuItem[]
  }>(),
  {
    label: 'Aktionen'
  }
)
</script>
