<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RunRecord } from '../../../shared/types'
import { bytes as formatBytes, dateTime } from '../lib/format'

const { locale } = useI18n()
const runs = ref<RunRecord[]>([])
const restoring = ref<number | null>(null)
const outcome = ref<{ restored: number; failed: number } | null>(null)

// Loaded on every mount rather than cached: a cleanup performed from another
// view must show up here without an app restart.
onMounted(async () => {
  runs.value = await window.api.history.runs()
})

/**
 * Puts a run's items back from the Trash. Best-effort by design: macOS renames
 * on collision and does not tell us where an item landed, so anything it cannot
 * find is reported rather than guessed at.
 */
async function restore(runId: number): Promise<void> {
  restoring.value = runId
  try {
    outcome.value = await window.api.history.restore(runId)
    runs.value = await window.api.history.runs()
  } finally {
    restoring.value = null
  }
}
</script>

<template>
  <div>
    <h1 class="page-title">
      {{ $t('history.title') }}
    </h1>
    <p class="page-subtitle">
      {{ $t('history.subtitle') }}
    </p>

    <p
      v-if="runs.length === 0"
      class="muted"
    >
      {{ $t('history.empty') }}
    </p>

    <p
      v-if="outcome"
      class="muted outcome"
    >
      {{ $t('history.restored', { restored: outcome.restored, failed: outcome.failed }) }}
    </p>

    <section
      v-for="run in runs"
      :key="run.id"
      class="card row"
    >
      <div>
        <div class="when">
          {{ dateTime(run.startedAt, locale) }}
        </div>
        <div class="muted meta">
          {{ $t('history.items', { count: run.itemCount }) }}
        </div>
      </div>
      <span class="size tabular">{{ $t('history.reclaimed', { size: formatBytes(run.bytesReclaimed) }) }}</span>
      <button
        class="btn"
        :disabled="restoring !== null"
        @click="restore(run.id)"
      >
        {{ restoring === run.id ? $t('storage.measuring') : $t('history.restore') }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
}

.when {
  font-weight: 600;
}

.meta {
  font-size: 12px;
}

.size {
  font-weight: 600;
  margin-left: auto;
}

.outcome {
  font-size: 12px;
  margin: 0 0 10px;
}
</style>
