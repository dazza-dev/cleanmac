<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Modal confirmation. Deliberately plain: the point is that the user reads it,
 * so there is no illustration, no countdown and no styling that draws the eye
 * to the confirm button over the cancel one.
 */
defineProps<{
  title: string
  body?: string
  note?: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = ref<HTMLDivElement | null>(null)

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  dialog.value?.focus()
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    class="overlay"
    @click.self="emit('cancel')"
  >
    <div
      ref="dialog"
      class="dialog"
      role="alertdialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
    >
      <h2>{{ title }}</h2>
      <p
        v-if="body"
        class="body"
      >
        {{ body }}
      </p>
      <p
        v-if="note"
        class="note muted"
      >
        {{ note }}
      </p>

      <div class="actions">
        <button
          class="btn"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          class="btn"
          :class="danger ? 'btn-danger' : 'btn-primary'"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  display: grid;
  place-items: center;
  z-index: 100;
}

.dialog {
  width: 380px;
  padding: 22px 24px 18px;
  border-radius: var(--radius-lg);
  background: var(--surface-solid);
  border: 1px solid var(--border);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
  text-align: center;
  outline: none;
}

h2 {
  font-size: 15px;
  font-weight: 650;
  margin: 0 0 8px;
}

.body {
  margin: 0 0 8px;
}

.note {
  font-size: 12px;
  margin: 0 0 18px;
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.actions .btn {
  min-width: 108px;
}
</style>
