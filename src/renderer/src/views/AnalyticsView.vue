<template>
  <section class="analytics-view">
    <header class="page-header analytics-header">
      <div>
        <AppBreadcrumb :items="breadcrumbItems" />
        <p class="eyebrow">Leistung über die Zeit</p>
        <h1>Auswertung</h1>
      </div>
    </header>

    <section class="analytics-filters">
      <div class="analytics-filter-grid">
        <label class="analytics-field">
          Zeitraum von
          <UInput :value="filters.startDate" type="date" @input="setStartDate(($event.target as HTMLInputElement).value)" />
        </label>
        <label class="analytics-field">
          Zeitraum bis
          <UInput :value="filters.endDate" type="date" @input="setEndDate(($event.target as HTMLInputElement).value)" />
        </label>
        <div class="analytics-field analytics-tag-field">
          <span>Tags</span>
          <TagInput
            :model-value="filters.tags"
            :suggestions="availableTags"
            placeholder="Nach Tags filtern"
            @update:modelValue="setTags"
          />
        </div>
      </div>

      <div class="analytics-filter-actions">
        <div class="analytics-presets">
          <UButton
            v-for="preset in rangePresets"
            :key="preset.id"
            class="analytics-preset"
            :class="{ active: filters.preset === preset.id }"
            color="neutral"
            variant="outline"
            type="button"
            @click="applyPreset(preset.id)"
          >
            {{ preset.label }}
          </UButton>
        </div>
        <UButton color="neutral" variant="outline" type="button" @click="resetFilters">Filter zurücksetzen</UButton>
      </div>

      <p class="analytics-range-copy">
        Zeitraum:
        <strong>{{ rangeLabel }}</strong>
      </p>
    </section>

    <section class="analytics-metrics">
      <article class="metric">
        <span>Bewertungen</span>
        <strong>{{ filteredEntries.length }}</strong>
      </article>
      <article class="metric">
        <span>Durchschnitt</span>
        <strong>{{ averageScoreLabel }}</strong>
      </article>
      <article class="metric">
        <span>Beste Bewertung</span>
        <strong>{{ bestScoreLabel }}</strong>
      </article>
      <article class="metric">
        <span>Zuletzt bewertet</span>
        <strong>{{ latestScoreLabel }}</strong>
      </article>
    </section>

    <section class="analytics-chart-grid">
      <section class="analytics-panel analytics-chart-panel">
        <div class="panel-header">
          <div>
            <h2>Bewertungsverlauf</h2>
            <p class="analytics-panel-copy">Durchschnitt pro Monat. Monate ohne Bewertung bleiben als Lücke sichtbar.</p>
          </div>
        </div>

        <div v-if="chartMonths.length" ref="chartElement" class="analytics-chart" @pointerleave="leaveChart" @keydown.esc.stop.prevent="dismissTooltip">
          <div ref="chartScrollElement" class="analytics-chart-scroll" @scroll="updateTooltipPosition">
          <svg :viewBox="`0 0 ${lineChartWidth} 280`" :style="{ width: `${lineChartWidth}px` }" class="analytics-svg" aria-label="Monatlicher Bewertungsverlauf">
            <g v-for="tick in yTicks" :key="tick.value">
              <line
                class="analytics-grid-line"
                :x1="lineChartBounds.left"
                :x2="lineChartBounds.right"
                :y1="tick.y"
                :y2="tick.y"
              />
              <text class="analytics-axis-label" :x="lineChartBounds.left - 14" :y="tick.y + 4">
                {{ tick.value }}
              </text>
            </g>

            <path v-if="lineAreaPath" :d="lineAreaPath" class="analytics-area" />
            <path v-if="linePath" :d="linePath" class="analytics-line" />

            <g
              v-for="point in linePoints"
              :key="point.id"
              class="analytics-point-target"
              role="button"
              tabindex="0"
              :aria-label="point.tooltip"
              :aria-describedby="activePoint?.id === point.id ? 'analytics-score-tooltip' : undefined"
              @pointerenter="showPoint(point.id)"
              @focus="focusPoint(point.id, $event)"
              @blur="dismissTooltip"
              @click="showPoint(point.id)"
              @keydown.enter.prevent="showPoint(point.id)"
              @keydown.space.prevent="showPoint(point.id)"
            >
              <circle class="analytics-point-hit-area" :cx="point.x" :cy="point.y" r="14" />
              <circle class="analytics-point" :cx="point.x" :cy="point.y" r="4.5" />
            </g>

            <g v-for="label in lineXAxisLabels" :key="label.key">
              <text class="analytics-axis-label analytics-month-label" :x="label.x" :y="lineChartBounds.bottom + 22">
                {{ label.text }}
              </text>
            </g>
          </svg>
          </div>
          <div v-if="activePoint" id="analytics-score-tooltip" ref="tooltipElement" role="tooltip" class="analytics-chart-tooltip" :style="tooltipPosition">
            <span>{{ activePoint.month }}</span>
            <strong>{{ activePoint.score }} Punkte</strong>
            <span>{{ activePoint.count }} Bewertung{{ activePoint.count === 1 ? '' : 'en' }}</span>
          </div>
        </div>
        <p v-if="!filteredEntries.length" class="empty-state">Keine bewerteten Abgaben im gewählten Zeitraum.</p>
      </section>

      <section class="analytics-panel analytics-chart-panel">
        <div class="panel-header">
          <div>
            <h2>Monatsmittel</h2>
            <p class="analytics-panel-copy">Durchschnittliche Punkte pro Monat im aktuellen Filter.</p>
          </div>
        </div>

        <div v-if="monthlyBars.length" class="analytics-bars">
          <article v-for="bar in monthlyBars" :key="bar.key" class="analytics-bar-row">
            <div class="analytics-bar-meta">
              <strong>{{ bar.label }}</strong>
              <span>{{ formatScore(bar.average) }} · {{ bar.count }} Bewertung{{ bar.count === 1 ? '' : 'en' }}</span>
            </div>
            <div class="analytics-bar-track">
              <div class="analytics-bar-fill" :style="{ width: `${(bar.average / 18) * 100}%` }" />
            </div>
          </article>
        </div>
        <p v-else class="empty-state">Noch keine Monatswerte verfügbar.</p>
      </section>
    </section>

    <section class="analytics-panel analytics-learning-panel">
      <div class="panel-header">
        <div>
          <h2>Lernaufgaben</h2>
          <p class="analytics-panel-copy">
            Offene Aufgaben aus deiner Nachbereitung, damit wichtige Verbesserungen nicht im Kommentar verschwinden.
          </p>
        </div>
      </div>

      <div v-if="topLearningCategories.length" class="analytics-learning-summary" aria-label="Häufige Kategorien">
        <span v-for="[category, count] in topLearningCategories" :key="category" class="analytics-learning-category">
          {{ formatLearningCategory(category) }} · {{ count }}
        </span>
      </div>

      <p v-if="learningTasksError" class="analytics-learning-error">{{ learningTasksError }}</p>

      <div v-if="visibleLearningTasks.length" class="analytics-learning-list">
        <article v-for="task in visibleLearningTasks" :key="task.id" class="analytics-learning-task">
          <div class="analytics-learning-task-body">
            <div class="analytics-learning-task-meta">
              <span class="tag">{{ formatLearningCategory(task.category) }}</span>
              <span class="tag">{{ formatLearningPriority(task.priority) }}</span>
            </div>
            <h3>{{ task.title }}</h3>
            <p v-if="task.detail">{{ task.detail }}</p>
          </div>
          <UButton color="neutral" variant="outline" type="button" @click="() => void markTaskDone(task.id)">Erledigt</UButton>
        </article>
      </div>
      <p v-if="hiddenLearningTaskCount > 0" class="analytics-learning-more">
        {{ hiddenLearningTaskLabel }}
      </p>
      <p v-if="!visibleLearningTasks.length && !learningTasksError" class="empty-state">Keine offenen Lernaufgaben.</p>
    </section>

    <section class="analytics-panel analytics-table-panel">
      <div class="panel-header">
        <div>
          <h2>Letzte Bewertungen</h2>
          <p class="analytics-panel-copy">Die Tabelle reagiert direkt auf Zeitraum und Tag-Filter.</p>
        </div>
      </div>

      <div v-if="filteredEntries.length" class="analytics-table">
        <div class="analytics-table-head">
          <span>Datum</span>
          <span>Titel</span>
          <span>Tags</span>
          <span>Punkte</span>
        </div>
        <div v-for="entry in recentEntries" :key="entry.correctionId" class="analytics-table-row">
          <span>{{ formatDate(entry.correctedAt) }}</span>
          <strong>{{ entry.examTitle }}</strong>
          <div class="tag-list">
            <span v-for="tag in entry.examTags" :key="`${entry.correctionId}-${tag}`" class="tag">{{ tag }}</span>
          </div>
          <span class="score">{{ formatScore(entry.scorePoints) }}</span>
        </div>
      </div>
      <p v-else class="empty-state">Keine Daten für die aktuelle Auswahl.</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AnalyticsEntry } from '@shared/ipc'
import type { LearningTask } from '@shared/schemas'
import { api } from '../api'
import TagInput from '../components/TagInput.vue'
import AppBreadcrumb from '../components/ui/AppBreadcrumb.vue'
import type { AppBreadcrumbItem } from '../ui/breadcrumbs'

type RangePresetId = '3m' | '6m' | '12m'

type AnalyticsFilters = {
  startDate: string
  endDate: string
  tags: string[]
  preset: RangePresetId | null
}

type LinePoint = {
  id: string
  x: number
  y: number
  tooltip: string
  month: string
  score: string
  count: number
}

const FILTER_STORAGE_KEY = 'jura-wolpertinger-analytics-filters-v1'
const chartElement = ref<HTMLElement | null>(null)
const chartScrollElement = ref<HTMLElement | null>(null)
const tooltipElement = ref<HTMLElement | null>(null)
const chartViewportWidth = ref(760)
const activePointId = ref<string | null>(null)
const focusedPointId = ref<string | null>(null)
const tooltipPosition = ref({ left: '8px', top: '8px' })
const rangePresets: Array<{ id: RangePresetId; label: string; months: number }> = [
  { id: '3m', label: 'Letzte 3 Monate', months: 3 },
  { id: '6m', label: 'Letztes Halbjahr', months: 6 },
  { id: '12m', label: 'Letzte 12 Monate', months: 12 }
]

const entries = ref<AnalyticsEntry[]>([])
const learningTasks = ref<LearningTask[]>([])
const learningTasksError = ref('')
const filters = ref<AnalyticsFilters>(loadFilters())
const breadcrumbItems: AppBreadcrumbItem[] = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'Prüfungen', to: { name: 'exams' } },
  { label: 'Auswertung' }
]

onMounted(load)
onMounted(() => document.addEventListener('keydown', handleTooltipKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleTooltipKeydown))

watch(
  filters,
  (value) => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(value))
    dismissTooltip()
  },
  { deep: true }
)

const availableTags = computed(() =>
  [...new Set(entries.value.flatMap((entry) => [...entry.examTags, ...entry.correctionTags]))].sort((left, right) =>
    left.localeCompare(right, 'de-DE')
  )
)

const effectiveEndDate = computed(() => filters.value.endDate || todayInputValue())
const normalizedSelectedTags = computed(() =>
  filters.value.tags.map((tag) => tag.trim().toLocaleLowerCase('de-DE')).filter(Boolean)
)

const filteredEntries = computed(() =>
  entries.value.filter((entry) => {
    const correctedDate = entry.correctedAt.slice(0, 10)
    if (filters.value.startDate && correctedDate < filters.value.startDate) return false
    if (correctedDate > effectiveEndDate.value) return false

    if (!normalizedSelectedTags.value.length) return true
    const haystack = [...entry.examTags, ...entry.correctionTags].map((tag) =>
      tag.trim().toLocaleLowerCase('de-DE')
    )
    return normalizedSelectedTags.value.some((selectedTag) => haystack.includes(selectedTag))
  })
)

const averageScore = computed(() => {
  if (!filteredEntries.value.length) return null
  return (
    filteredEntries.value.reduce((sum, entry) => sum + entry.scorePoints, 0) /
    filteredEntries.value.length
  )
})

const bestScore = computed(() =>
  filteredEntries.value.length ? Math.max(...filteredEntries.value.map((entry) => entry.scorePoints)) : null
)

const latestEntry = computed(() =>
  [...filteredEntries.value].sort((left, right) => right.correctedAt.localeCompare(left.correctedAt))[0] ?? null
)

const recentEntries = computed(() =>
  [...filteredEntries.value].sort((left, right) => right.correctedAt.localeCompare(left.correctedAt)).slice(0, 8)
)

const openLearningTasks = computed(() => learningTasks.value.filter((task) => task.status !== 'done'))

const visibleLearningTasks = computed(() => openLearningTasks.value.slice(0, 8))

const hiddenLearningTaskCount = computed(() =>
  Math.max(0, openLearningTasks.value.length - visibleLearningTasks.value.length)
)

const hiddenLearningTaskLabel = computed(() =>
  hiddenLearningTaskCount.value === 1
    ? 'Eine weitere offene Lernaufgabe wird nicht angezeigt.'
    : `Weitere ${hiddenLearningTaskCount.value} offene Lernaufgaben werden nicht angezeigt.`
)

const topLearningCategories = computed(() => {
  const counts = new Map<LearningTask['category'], number>()
  for (const task of openLearningTasks.value) counts.set(task.category, (counts.get(task.category) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
})

const averageScoreLabel = computed(() => formatScore(averageScore.value))
const bestScoreLabel = computed(() => formatScore(bestScore.value))
const latestScoreLabel = computed(() =>
  latestEntry.value ? `${formatScore(latestEntry.value.scorePoints)} · ${formatDate(latestEntry.value.correctedAt)}` : '—'
)

const rangeLabel = computed(() => {
  const start = filters.value.startDate ? formatDateInput(filters.value.startDate) : 'Beginn'
  const end = formatDateInput(effectiveEndDate.value)
  return `${start} bis ${end}`
})

const yTicks = computed(() =>
  [0, 6, 12, 18].map((value) => ({
    value,
    y: scoreToY(value)
  }))
)

const chartMonths = computed(() => {
  const totals = new Map<string, { total: number; count: number }>()
  for (const entry of filteredEntries.value) {
    const key = entry.correctedAt.slice(0, 7)
    const month = totals.get(key) ?? { total: 0, count: 0 }
    month.total += entry.scorePoints
    month.count += 1
    totals.set(key, month)
  }
  const firstDate = filters.value.startDate || [...totals.keys()].sort()[0] || effectiveEndDate.value
  const firstMonth = monthIndex(firstDate)
  const lastMonth = monthIndex(effectiveEndDate.value)
  return Array.from({ length: Math.max(0, lastMonth - firstMonth + 1) }, (_, index) => {
    const absoluteMonth = firstMonth + index
    const key = `${Math.floor(absoluteMonth / 12)}-${String(absoluteMonth % 12 + 1).padStart(2, '0')}`
    const total = totals.get(key)
    return { key, average: total ? total.total / total.count : null, count: total?.count ?? 0 }
  })
})

const lineChartWidth = computed(() => Math.max(chartViewportWidth.value, chartMonths.value.length * 76 + 92))
const lineChartBounds = computed(() => ({ left: 56, right: lineChartWidth.value - 36, top: 20, bottom: 232 }))

const lineMonthPoints = computed(() => chartMonths.value.map((month, index): LinePoint | null => {
  if (month.average === null) return null
  const label = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date(`${month.key}-01T12:00:00`))
  const score = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(month.average)
  return {
    id: month.key,
    x: monthToX(index),
    y: scoreToY(month.average),
    month: label,
    score,
    count: month.count,
    tooltip: `${label} · ${score} Punkte · ${month.count} Bewertung${month.count === 1 ? '' : 'en'}`
  }
}))
const linePoints = computed(() => lineMonthPoints.value.filter((point): point is LinePoint => point !== null))
const lineSegments = computed(() => {
  const segments: LinePoint[][] = []
  let current: LinePoint[] = []
  for (const point of lineMonthPoints.value) {
    if (!point) {
      current = []
    } else {
      if (!current.length) segments.push(current)
      current.push(point)
    }
  }
  return segments
})
const linePath = computed(() => lineSegments.value.map(segment => segment.map((point, index) =>
  `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')).join(' '))
const lineAreaPath = computed(() => lineSegments.value.filter(segment => segment.length > 1).map(segment =>
  `${segment.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')} L ${segment.at(-1)!.x} ${lineChartBounds.value.bottom} L ${segment[0].x} ${lineChartBounds.value.bottom} Z`
).join(' '))
const lineXAxisLabels = computed(() => chartMonths.value.map((month, index) => ({
  key: month.key,
  x: monthToX(index),
  text: formatMonthLabel(month.key)
})))
const activePoint = computed(() => linePoints.value.find(point => point.id === activePointId.value) ?? null)

watch(chartElement, (element, _old, onCleanup) => {
  if (!element) return
  const observer = new ResizeObserver(() => {
    chartViewportWidth.value = element.clientWidth
    void nextTick(updateTooltipPosition)
  })
  observer.observe(element)
  onCleanup(() => observer.disconnect())
})
watch([activePoint, tooltipElement], () => { void nextTick(updateTooltipPosition) }, { flush: 'post' })

function monthIndex(date: string): number {
  const [year, month] = date.slice(0, 7).split('-').map(Number)
  return year * 12 + month - 1
}

function monthToX(index: number): number {
  const ratio = chartMonths.value.length === 1 ? 0.5 : index / (chartMonths.value.length - 1)
  return lineChartBounds.value.left + (lineChartBounds.value.right - lineChartBounds.value.left) * ratio
}

function showPoint(id: string): void {
  activePointId.value = id
}

function focusPoint(id: string, event: FocusEvent): void {
  focusedPointId.value = id
  ;(event.currentTarget as SVGElement).scrollIntoView({ block: 'nearest', inline: 'nearest' })
  showPoint(id)
}

function dismissTooltip(): void {
  activePointId.value = null
  focusedPointId.value = null
}

function handleTooltipKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') dismissTooltip()
}

function leaveChart(event: PointerEvent): void {
  if (event.pointerType !== 'touch') activePointId.value = focusedPointId.value
}

function updateTooltipPosition(): void {
  const chart = chartElement.value
  const tooltip = tooltipElement.value
  const point = activePoint.value
  if (!chart || !tooltip || !point) return
  const x = point.x - (chartScrollElement.value?.scrollLeft ?? 0)
  const top = point.y < 140 ? point.y + 18 : point.y - tooltip.offsetHeight - 18
  tooltipPosition.value = {
    left: `${Math.max(8, Math.min(x - tooltip.offsetWidth / 2, chart.clientWidth - tooltip.offsetWidth - 8))}px`,
    top: `${Math.max(8, Math.min(top, chart.clientHeight - tooltip.offsetHeight - 8))}px`
  }
}

const monthlyBars = computed(() => {
  const grouped = new Map<string, { total: number; count: number }>()

  for (const entry of filteredEntries.value) {
    const key = entry.correctedAt.slice(0, 7)
    const current = grouped.get(key) ?? { total: 0, count: 0 }
    current.total += entry.scorePoints
    current.count += 1
    grouped.set(key, current)
  }

  return [...grouped.entries()].map(([key, value]) => ({
    key,
    label: formatMonthLabel(key),
    average: value.total / value.count,
    count: value.count
  }))
})

async function load(): Promise<void> {
  const [entriesResult, tasksResult] = await Promise.allSettled([
    api.listAnalyticsEntries(),
    api.listLearningTasks()
  ])
  if (entriesResult.status === 'fulfilled') {
    entries.value = entriesResult.value
  } else {
    throw entriesResult.reason
  }

  if (tasksResult.status === 'fulfilled') {
    learningTasks.value = tasksResult.value
    learningTasksError.value = ''
  } else {
    learningTasks.value = []
    learningTasksError.value = 'Lernaufgaben konnten nicht geladen werden.'
  }
}

async function markTaskDone(taskId: string): Promise<void> {
  try {
    await api.updateLearningTaskStatus(taskId, 'done')
    learningTasks.value = await api.listLearningTasks()
    learningTasksError.value = ''
  } catch {
    learningTasksError.value = 'Lernaufgabe konnte nicht aktualisiert werden.'
  }
}

function setStartDate(value: string): void {
  filters.value = { ...filters.value, startDate: value, preset: null }
}

function setEndDate(value: string): void {
  filters.value = { ...filters.value, endDate: value, preset: null }
}

function setTags(tags: string[]): void {
  filters.value = { ...filters.value, tags: [...tags], preset: null }
}

function applyPreset(presetId: RangePresetId): void {
  const preset = rangePresets.find((candidate) => candidate.id === presetId)
  if (!preset) return
  filters.value = {
    ...filters.value,
    startDate: monthsAgoInputValue(preset.months),
    endDate: '',
    preset: preset.id
  }
}

function resetFilters(): void {
  filters.value = {
    startDate: '',
    endDate: '',
    tags: [],
    preset: null
  }
}

function loadFilters(): AnalyticsFilters {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (!raw) return { startDate: '', endDate: '', tags: [], preset: null }
    const parsed = JSON.parse(raw) as Partial<AnalyticsFilters>
    return {
      startDate: typeof parsed.startDate === 'string' ? parsed.startDate : '',
      endDate: typeof parsed.endDate === 'string' ? parsed.endDate : '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      preset: parsed.preset === '3m' || parsed.preset === '6m' || parsed.preset === '12m' ? parsed.preset : null
    }
  } catch {
    return { startDate: '', endDate: '', tags: [], preset: null }
  }
}

function todayInputValue(): string {
  return toDateInputValue(new Date())
}

function monthsAgoInputValue(months: number): string {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return toDateInputValue(date)
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function scoreToY(score: number): number {
  const usableHeight = lineChartBounds.value.bottom - lineChartBounds.value.top
  return lineChartBounds.value.bottom - (score / 18) * usableHeight
}

function formatScore(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1
  }).format(value)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium'
  }).format(new Date(value))
}

function formatDateInput(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium'
  }).format(new Date(`${value}T12:00:00`))
}

function formatMonthLabel(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${value}-01T12:00:00`))
}

function formatLearningCategory(category: LearningTask['category']): string {
  const labels: Record<LearningTask['category'], string> = {
    issue_spotting: 'Problemerkennung',
    law: 'Rechtliche Grundlagen',
    procedure: 'Verfahren',
    structure: 'Aufbau',
    argumentation: 'Argumentation',
    style: 'Stil',
    time_management: 'Zeitmanagement',
    other: 'Sonstiges'
  }
  return labels[category]
}

function formatLearningPriority(priority: LearningTask['priority']): string {
  const labels: Record<LearningTask['priority'], string> = {
    low: 'niedrige Priorität',
    medium: 'mittlere Priorität',
    high: 'hohe Priorität'
  }
  return labels[priority]
}
</script>

<style scoped>
.analytics-chart {
  position: relative;
}

.analytics-chart-scroll {
  overflow-x: auto;
}

.analytics-svg {
  height: 280px;
  max-width: none;
  pointer-events: auto;
}

.analytics-point-target {
  cursor: pointer;
  outline: none;
  pointer-events: all;
}

.analytics-point-hit-area {
  fill: transparent;
  pointer-events: all;
}

.analytics-point-target:focus-visible .analytics-point-hit-area {
  stroke: var(--color-text);
  stroke-width: 2;
}

.analytics-chart .analytics-line {
  fill: none;
}

:root[data-theme='dark'] .analytics-chart .analytics-line {
  fill: none;
}

.analytics-chart-tooltip {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 14%);
  color: var(--color-text);
  display: grid;
  font-size: 13px;
  gap: 3px;
  line-height: 1.4;
  max-width: calc(100% - 16px);
  padding: 10px 12px;
  pointer-events: none;
  position: absolute;
  width: 220px;
  z-index: 1;
}

.analytics-chart-tooltip strong {
  font-size: 17px;
}
</style>
