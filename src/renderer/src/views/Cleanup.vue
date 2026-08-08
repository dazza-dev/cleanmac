<script setup lang="ts">
import { computed, inject, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScanStore } from '../stores/scan'
import { useSystemStore } from '../stores/system'
import { bytes as formatBytes } from '../lib/format'
import FindingGroup from '../components/FindingGroup.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import type { ExecutionReport } from '../../../shared/types'

const { t } = useI18n()
const scan = useScanStore()
const system = useSystemStore()

const confirming = ref(false)
const emptyingTrash = ref(false)
const report = ref<ExecutionReport | null>(null)
const busy = ref(false)

// ⌘⌫ from the application menu. Opens the same confirmation as the button —
// a keyboard shortcut must never be a shortcut past the confirmation.
const cleanRequested = inject<Ref<number>>('cleanRequested')
watch(
  () => cleanRequested?.value,
  () => {
    if (scan.selectedFindings.length > 0 && !busy.value) confirming.value = true
  }
)

const groups = computed(() =>
  scan.results.filter((result) => result.findings.length > 0).sort((a, b) => b.reclaimable - a.reclaimable)
)

async function confirmCleanup(): Promise<void> {
  confirming.value = false
  busy.value = true
  try {
    report.value = await scan.execute()
    await Promise.all([system.refreshDisk(), system.refreshTrash()])
  } finally {
    busy.value = false
  }
}

async function confirmEmptyTrash(): Promise<void> {
  emptyingTrash.value = false
  busy.value = true
  try {
    await window.api.trash.empty()
    await Promise.all([system.refreshDisk(), system.refreshTrash()])
  } finally {
    busy.value = false
  }
}

async function undo(): Promise<void> {
  if (!report.value) return
  busy.value = true
  try {
    await window.api.history.restore(report.value.runId)
    report.value = null
    await scan.run()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="page-title">
      {{ $t('cleanup.title') }}
    </h1>
    <p class="page-subtitle">
      {{ $t('cleanup.subtitle') }}
    </p>

    <!-- Result panel from the last execution, including what was skipped.
         Hiding skips would make the report a lie by omission. -->
    <section
      v-if="report"
      class="card result"
    >
      <h2>{{ $t('result.title', { size: formatBytes(report.bytesReclaimed) }) }}</h2>

      <p class="muted">
        {{ $t('result.trashed', { count: report.trashed.length }) }}
        <template v-if="report.skipped.length">
          · {{ $t('result.skipped', { count: report.skipped.length }) }}
        </template>
        <template v-if="report.failed.length">
          · {{ $t('result.failed', { count: report.failed.length }) }}
        </template>
      </p>

      <ul
        v-if="report.skipped.length || report.failed.length"
        class="skips"
      >
        <li
          v-for="item in [...report.skipped, ...report.failed]"
          :key="item.path"
        >
          <span class="mono">{{ item.displayPath }}</span>
          <span class="muted">
            — {{ item.reasonKey ? $t(item.reasonKey, { detail: item.detail ?? '' }) : item.detail }}
          </span>
        </li>
      </ul>

      <p class="muted trash-note">
        {{ $t('result.emptyTrashPrompt') }}
      </p>

      <div class="result-actions">
        <button
          class="btn"
          :disabled="busy"
          @click="undo"
        >
          {{ $t('result.undo') }}
        </button>
        <button
          class="btn btn-danger"
          :disabled="busy || system.trashBytes === 0"
          @click="emptyingTrash = true"
        >
          {{ $t('result.emptyTrash', { size: formatBytes(system.trashBytes) }) }}
        </button>
        <button
          class="btn btn-ghost"
          @click="report = null"
        >
          {{ $t('result.done') }}
        </button>
      </div>
    </section>

    <p
      v-if="groups.length === 0 && !report"
      class="muted"
    >
      {{ $t('cleanup.empty') }}
    </p>

    <template v-else-if="groups.length > 0">
      <div class="toolbar">
        <button
          class="btn-ghost"
          @click="scan.selectAll()"
        >
          {{ $t('cleanup.selectAll') }}
        </button>
        <button
          class="btn-ghost"
          @click="scan.deselectAll()"
        >
          {{ $t('cleanup.deselectAll') }}
        </button>
      </div>

      <FindingGroup
        v-for="group in groups"
        :key="group.ruleId"
        :result="group"
      />
    </template>

    <footer
      v-if="scan.selectedFindings.length > 0"
      class="bar"
    >
      <span class="tabular">
        {{
          $t('cleanup.selected', {
            count: scan.selectedFindings.length,
            size: formatBytes(scan.selectedBytes)
          })
        }}
      </span>
      <button
        class="btn btn-primary"
        :disabled="busy"
        @click="confirming = true"
      >
        {{ $t('cleanup.clean') }}
      </button>
    </footer>

    <ConfirmDialog
      v-if="confirming"
      :title="t('confirm.title', { size: formatBytes(scan.selectedBytes) })"
      :body="
        t('confirm.body', {
          count: scan.selectedFindings.length,
          groups: new Set(scan.selectedFindings.map((finding) => finding.ruleId)).size
        })
      "
      :note="t('confirm.reassurance')"
      :confirm-label="t('confirm.confirm')"
      :cancel-label="t('confirm.cancel')"
      @confirm="confirmCleanup"
      @cancel="confirming = false"
    />

    <!-- Emptying the Trash is its own decision. Chaining it to the cleanup
         would remove the last point of rescue without asking. -->
    <ConfirmDialog
      v-if="emptyingTrash"
      danger
      :title="t('result.emptyTrashConfirm')"
      :confirm-label="t('result.emptyTrash', { size: formatBytes(system.trashBytes) })"
      :cancel-label="t('confirm.cancel')"
      @confirm="confirmEmptyTrash"
      @cancel="emptyingTrash = false"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
}

.bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 14px;
  padding: 11px 16px;
  border-radius: var(--radius-lg);
  background: var(--surface-solid);
  border: 1px solid var(--border);
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.14);
  font-weight: 600;
}

.result {
  padding: 16px 18px;
  margin-bottom: 16px;
}

.result h2 {
  font-size: 15px;
  font-weight: 650;
  margin: 0 0 4px;
}

.skips {
  margin: 10px 0 0;
  padding-left: 16px;
  font-size: 11.5px;
}

.skips li {
  margin-bottom: 3px;
}

.trash-note {
  margin: 12px 0 0;
  font-size: 12px;
}

.result-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
