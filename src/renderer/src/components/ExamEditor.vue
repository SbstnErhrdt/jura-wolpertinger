<template>
  <section class="editor-frame" :class="{ 'focus-editor': focusMode, 'toolbar-hidden': hideToolbar }">
    <div v-if="!hideToolbar" class="editor-toolbar" aria-label="Formatierung">
      <button title="Rückgängig" @click="editor.chain().focus().undo().run()">
        <Undo2 :size="19" />
      </button>
      <button title="Wiederholen" @click="editor.chain().focus().redo().run()">
        <Redo2 :size="19" />
      </button>
      <span class="toolbar-divider" />
      <button title="Ausschneiden" @click="clipboard('cut')">
        <Scissors :size="19" />
      </button>
      <button title="Kopieren" @click="clipboard('copy')">
        <Copy :size="19" />
      </button>
      <button title="Einfügen" @click="clipboard('paste')">
        <Clipboard :size="19" />
      </button>
      <span class="toolbar-divider" />
      <button :class="{ active: editor?.isActive('bold') }" title="Fett" @click="run('toggleBold')">
        <Bold :size="18" />
      </button>
      <button :class="{ active: editor?.isActive('italic') }" title="Kursiv" @click="run('toggleItalic')">
        <Italic :size="18" />
      </button>
      <button
        :class="{ active: editor?.isActive('underline') }"
        title="Unterstreichen"
        @click="run('toggleUnderline')"
      >
        <UnderlineIcon :size="18" />
      </button>
      <button
        :class="{ active: editor?.isActive('highlight') }"
        title="Hervorheben"
        @click="run('toggleHighlight')"
      >
        <Highlighter :size="17" />
      </button>
      <span class="toolbar-divider" />
      <select title="Schriftgröße" @change="setFontSize(($event.target as HTMLSelectElement).value)">
        <option value="11pt">11</option>
        <option value="12pt" selected>12</option>
        <option value="14pt">14</option>
      </select>
      <span class="toolbar-divider" />
      <button class="toolbar-combo-button" title="Ausrichtung" @click="setAlign('left')">
        <AlignLeft :size="20" />
        <span class="toolbar-caret" />
      </button>
      <span class="toolbar-divider" />
      <button title="Einzug vergrößern" @click="indent(1)"><Indent :size="20" /></button>
      <button title="Einzug verkleinern" @click="indent(-1)"><Outdent :size="20" /></button>
      <span class="toolbar-divider" />
      <button title="Drucken" @click="emit('pdf')">
        <Printer :size="21" />
      </button>
      <button class="disabled-tool" title="PDF-Vorschau" @click="emit('pdf')">
        <FileText :size="20" />
      </button>
      <span class="autosave-state">{{ saveState }}</span>
    </div>
    <EditorContent :editor="editor" class="editor-content" />
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Editor, EditorContent, type JSONContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'
import {
  AlignLeft,
  Bold,
  Clipboard,
  Copy,
  FileText,
  Highlighter,
  Indent,
  Italic,
  Outdent,
  Printer,
  Redo2,
  Scissors,
  Underline as UnderlineIcon,
  Undo2
} from 'lucide-vue-next'

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.fontSize ? { style: `font-size: ${String(attributes.fontSize)}` } : {}
          }
        }
      }
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize }).run()
    } as any
  }
})

const ParagraphIndent = Extension.create({
  name: 'paragraphIndent',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => Number(element.getAttribute('data-indent') ?? 0),
            renderHTML: (attributes: Record<string, unknown>) => {
              const indentValue = Number(attributes.indent ?? 0)
              return indentValue > 0
                ? { 'data-indent': indentValue, style: `margin-left: ${indentValue * 2}em` }
                : {}
            }
          }
        }
      }
    ]
  },
  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ editor }: any) => {
          const current = Number(editor.getAttributes('paragraph').indent ?? 0)
          return editor.commands.updateAttributes('paragraph', { indent: Math.min(current + 1, 6) })
        },
      decreaseIndent:
        () =>
        ({ editor }: any) => {
          const current = Number(editor.getAttributes('paragraph').indent ?? 0)
          return editor.commands.updateAttributes('paragraph', { indent: Math.max(current - 1, 0) })
        }
    } as any
  }
})

const ProtectedSpace = Extension.create({
  name: 'protectedSpace',
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-Space': () => this.editor.commands.insertContent('\u00A0')
    }
  }
})

const props = defineProps<{
  modelValue: Record<string, unknown>
  readonly?: boolean
  focusMode?: boolean
  hideToolbar?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [Record<string, unknown>]
  dirty: []
  save: [Record<string, unknown>]
  pdf: []
}>()

const saveState = ref('Entwurf gespeichert')
let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastInternalContent = JSON.stringify(props.modelValue)
let applyingExternalContent = false

const editor = new Editor({
  content: props.modelValue as JSONContent,
  editable: !props.readonly,
  extensions: [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    TextStyle,
    FontSize,
    ParagraphIndent,
    ProtectedSpace,
    TextAlign.configure({ types: ['paragraph'] })
  ],
  editorProps: {
    attributes: {
      class: 'exam-editor-surface',
      spellcheck: 'false',
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'off'
    }
  },
  onUpdate: ({ editor }) => {
    if (applyingExternalContent) return
    const json = editor.getJSON() as Record<string, unknown>
    lastInternalContent = JSON.stringify(json)
    emit('update:modelValue', json)
    queueSave(json)
  }
})

watch(
  () => props.modelValue,
  (nextContent) => {
    const next = JSON.stringify(nextContent)
    if (next === lastInternalContent) return
    const current = JSON.stringify(editor.getJSON())
    if (current !== next) {
      applyingExternalContent = true
      editor.commands.setContent(nextContent as JSONContent, false)
      applyingExternalContent = false
      lastInternalContent = next
    }
  },
  { deep: true }
)

watch(
  () => props.readonly,
  (readonly) => editor.setEditable(!readonly)
)

onBeforeUnmount(() => {
  flushSave()
  editor.destroy()
})

function run(command: 'toggleBold' | 'toggleItalic' | 'toggleUnderline' | 'toggleHighlight'): void {
  const chain = editor.chain().focus() as unknown as Record<string, () => { run: () => boolean }>
  chain[command]().run()
}

function setAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
  editor.chain().focus().setTextAlign(align).run()
}

function setFontSize(fontSize: string): void {
  ;(editor.chain().focus() as any).setFontSize(fontSize).run()
}

function indent(delta: number): void {
  const chain = editor.chain().focus() as any
  if (delta > 0) chain.increaseIndent().run()
  else chain.decreaseIndent().run()
}

function clipboard(command: 'cut' | 'copy' | 'paste'): void {
  editor.chain().focus().run()
  document.execCommand(command)
}

function queueSave(content: Record<string, unknown>): void {
  if (props.readonly) return
  saveState.value = 'Noch nicht gespeichert'
  emit('dirty')
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    emit('save', content)
    saveState.value = 'Entwurf gespeichert'
    saveTimer = null
  }, 1000)
}

function flushSave(): void {
  if (!saveTimer || props.readonly) return
  clearTimeout(saveTimer)
  saveTimer = null
  emit('save', editor.getJSON() as Record<string, unknown>)
}

</script>
