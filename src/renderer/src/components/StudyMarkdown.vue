<template><div class="markdown-block study-markdown" v-html="html" /></template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps<{ markdown: string }>()
// Imported decks are untrusted. Only text formatting and source links are allowed.
const html = computed(() => DOMPurify.sanitize(marked.parse(props.markdown, { async: false }), {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'mark', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub'],
  ALLOWED_ATTR: ['href', 'title', 'start'],
  ALLOW_DATA_ATTR: false
}))
</script>

<style scoped>
.study-markdown { white-space: normal; overflow-wrap: anywhere; line-height: 1.65; text-align: left; }
.study-markdown :deep(p) { margin: .75em 0; }
.study-markdown :deep(ul) { list-style: disc; padding-left: 1.5em; margin-block: .75em; }
.study-markdown :deep(ol) { list-style: decimal; padding-left: 1.5em; margin-block: .75em; }
.study-markdown :deep(li) { margin-block: .3em; }
.study-markdown :deep(a) { color: var(--ui-primary); text-decoration: underline; }
.study-markdown :deep(pre) { white-space: pre-wrap; background: var(--ui-bg-muted); padding: .75em; border-radius: .5em; }
.study-markdown :deep(blockquote) { border-left: 3px solid var(--ui-border); padding-left: 1em; }
.study-markdown :deep(:is(h1, h2, h3, h4, h5, h6)) { font-size: 1.1em; font-weight: 700; margin-block: 1em .5em; }
.study-markdown :deep(table) { display: block; overflow-x: auto; max-width: 100%; border-collapse: collapse; }
.study-markdown :deep(:is(th, td)) { padding: .5em; border: 1px solid var(--ui-border); }
</style>
