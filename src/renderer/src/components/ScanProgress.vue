<script setup lang="ts">
import { ref } from 'vue'
import { Check, Loader, ChevronRight } from 'lucide-vue-next'
import { useScanStore } from '../stores/scan'
import { bytes as formatBytes } from '../lib/format'

/**
 * Live scan feedback.
 *
 * A generic progress bar tells the user nothing except to wait. Naming each
 * module as it lands, with the bytes it found, means value shows up two seconds
 * in rather than forty — and the user learns what the app actually looks at.
 *
 * Once the scan finishes the list collapses to a single line. Ten rules of
 * mostly-zero results is exactly the wrong thing to leave occupying the screen
 * above something the user can act on.
 */
const scan = useScanStore()
const expanded = ref(false)
</script>

<template>
  <section
    class="progress card"
    aria-live="polite"
  >
    <header v-if="scan.scanning">
      <span>{{ $t('scan.inProgress') }}</span>
      <span class="found tabular">{{ $t('scan.found', { size: formatBytes(scan.bytesSoFar) }) }}</span>
    </header>

    <button
      v-else
      class="done-header"
      @click="expanded = !expanded"
    >
      <ChevronRight
        :size="13"
        class="chevron"
        :class="{ open: expanded }"
      />
      <span>{{ $t('scan.done', { seconds: (scan.durationMs / 1000).toFixed(1) }) }}</span>
      <span class="muted count">{{ $t('scan.modules', { count: scan.steps.length }) }}</span>
    </button>

    <div v-if="scan.scanning || expanded">
      <div
        v-for="step in scan.steps"
        :key="step.ruleId"
        class="step"
        :class="step.state"
      >
        <Check
          v-if="step.state === 'finished'"
          :size="13"
          class="icon done"
        />
        <Loader
          v-else
          :size="13"
          class="icon spin"
        />

        <span class="label">{{ $t(step.titleKey) }}</span>
        <span
          v-if="step.state === 'finished'"
          class="size tabular"
        >{{ formatBytes(step.bytes) }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.progress {
  padding: 13px 16px;
  margin-top: 18px;
}

header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 8px;
}

.done-header {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  font-size: 13px;
  text-align: left;
}

.chevron {
  transition: transform 140ms ease;
  flex-shrink: 0;
}

.chevron.open {
  transform: rotate(90deg);
}

.count {
  margin-left: auto;
  font-size: 11.5px;
}

/* White, not fuchsia: the accent is a fill in this palette, never text. */
.found {
  color: var(--label);
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 12.5px;
}

.step.finished .label {
  color: var(--label-secondary);
}

.icon {
  flex-shrink: 0;
}

.icon.done {
  color: var(--risk-none);
}

.size {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.spin {
  animation: spin 1s linear infinite;
  color: var(--label-tertiary);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
