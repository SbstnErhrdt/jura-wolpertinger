<template>
  <div class="tag-input-control">
    <div
      class="tag-input"
      :class="{ focused: isFocused }"
      @click="focusInput"
    >
      <span
        v-for="tag in modelValue"
        :key="tag"
        class="tag-input-chip"
      >
        <span>{{ tag }}</span>
        <button
          type="button"
          class="tag-input-chip-remove"
          :aria-label="`Tag ${tag} entfernen`"
          @click.stop="removeTag(tag)"
        >
          ×
        </button>
      </span>
      <input
        ref="inputRef"
        v-model="draft"
        class="tag-input-field"
        :placeholder="modelValue.length ? '' : placeholder"
        @blur="onBlur"
        @focus="isFocused = true"
        @keydown="onKeydown"
        @paste="onPaste"
      />
    </div>
    <div v-if="filteredSuggestions.length" class="tag-input-suggestions">
      <button
        v-for="tag in filteredSuggestions"
        :key="tag"
        type="button"
        class="tag-input-suggestion"
        @click="addTag(tag)"
      >
        {{ tag }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    placeholder?: string
    suggestions?: string[]
    maxSuggestions?: number
  }>(),
  {
    placeholder: 'Tags hinzufügen',
    suggestions: () => [],
    maxSuggestions: 8
  }
)

const emit = defineEmits<{
  'update:modelValue': [string[]]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const draft = ref('')
const isFocused = ref(false)

const filteredSuggestions = computed(() => {
  const selected = new Set(props.modelValue.map(normalizeTag))
  const query = normalizeTag(draft.value).toLocaleLowerCase('de-DE')

  return uniqueTags(props.suggestions)
    .filter((tag) => !selected.has(normalizeTag(tag)))
    .filter((tag) => (query ? tag.toLocaleLowerCase('de-DE').includes(query) : true))
    .slice(0, props.maxSuggestions)
})

function focusInput(): void {
  inputRef.value?.focus()
}

function onBlur(): void {
  isFocused.value = false
  commitDraft()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Backspace' && !draft.value) {
    removeLastTag()
    return
  }

  if (['Enter', ',', ';', 'Tab'].includes(event.key) && draft.value.trim()) {
    event.preventDefault()
    commitDraft()
  }
}

function onPaste(event: ClipboardEvent): void {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!containsSeparator(text)) return

  event.preventDefault()
  addMany(parseTags(text))
}

function commitDraft(): void {
  if (!draft.value.trim()) return
  addMany(parseTags(draft.value))
  draft.value = ''
}

function addTag(tag: string): void {
  addMany([tag])
  draft.value = ''
  focusInput()
}

function addMany(tags: string[]): void {
  const next = uniqueTags([...props.modelValue, ...tags])
  if (next.length === props.modelValue.length) return
  emit('update:modelValue', next)
}

function removeTag(tag: string): void {
  const target = normalizeTag(tag)
  emit(
    'update:modelValue',
    props.modelValue.filter((candidate) => normalizeTag(candidate) !== target)
  )
}

function removeLastTag(): void {
  if (!props.modelValue.length) return
  emit('update:modelValue', props.modelValue.slice(0, -1))
}

function parseTags(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map(normalizeTag)
    .filter(Boolean)
}

function normalizeTag(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const tag of tags.map(normalizeTag).filter(Boolean)) {
    const key = tag.toLocaleLowerCase('de-DE')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }

  return result
}

function containsSeparator(value: string): boolean {
  return /[,\n;]/.test(value)
}
</script>
