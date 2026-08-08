<script setup lang="ts">
import { ref } from 'vue'
import { AppWindow } from 'lucide-vue-next'
import type { BlockedApp } from '../../../shared/types'
import { bytes as formatBytes } from '../lib/format'

/**
 * "Close Trae to reclaim 1.07 GB."
 *
 * v0.1 found 1.6 GB on the reference machine that no rule could touch purely
 * because two apps were open. The guards were right to refuse, but a silently
 * smaller total is exactly the opacity this project exists to fight — so the
 * blocked space gets named, attributed, and made actionable.
 */
defineProps<{ apps: BlockedApp[] }>()
const emit = defineEmits<{ quit: [name: string] }>()

const pending = ref<string | null>(null)

async function quit(name: string): Promise<void> {
  pending.value = name
  try {
    // Resolves false when the app is still up — usually a save dialog is
    // waiting, which is a good reason not to press harder.
    const quitted = await window.api.apps.quit(name)
    if (quitted) emit('quit', name)
  } finally {
    pending.value = null
  }
}
</script>

<template>
  <section
    v-if="apps.length > 0"
    class="card blocked"
  >
    <header>
      <AppWindow :size="15" />
      <span>{{ $t('blocked.title') }}</span>
    </header>

    <p class="muted intro">
      {{ $t('blocked.intro') }}
    </p>

    <div
      v-for="app in apps"
      :key="app.name"
      class="row"
    >
      <span class="name">{{ app.name }}</span>
      <span class="muted count">{{ $t('blocked.items', { count: app.findingIds.length }) }}</span>
      <span class="size tabular">{{ formatBytes(app.bytes) }}</span>
      <button
        class="btn"
        :disabled="pending !== null"
        @click="quit(app.name)"
      >
        {{ pending === app.name ? $t('blocked.quitting') : $t('blocked.quit', { app: app.name }) }}
      </button>
    </div>

    <p class="muted note">
      {{ $t('blocked.gracefulNote') }}
    </p>
  </section>
</template>

<style scoped>
.blocked {
  padding: 14px 16px;
  margin-bottom: 12px;
}

header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
}

.intro {
  font-size: 12px;
  margin: 3px 0 10px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-top: 1px solid var(--border);
}

.name {
  font-weight: 600;
  min-width: 110px;
}

.count {
  font-size: 11.5px;
}

.size {
  margin-left: auto;
  font-weight: 600;
}

.note {
  font-size: 11.5px;
  margin: 10px 0 0;
}
</style>
