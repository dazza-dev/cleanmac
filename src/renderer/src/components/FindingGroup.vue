<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight, FolderOpen, Info } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { RuleResult } from '../../../shared/types'
import { useScanStore } from '../stores/scan'
import { bytes as formatBytes, relativeTime } from '../lib/format'
import RiskPill from './RiskPill.vue'

/**
 * One rule's findings. Expanding reveals the absolute path of every single
 * item — that transparency is the product, not a debug affordance, so there is
 * no path in this app that deletes something the user could not have inspected.
 */
const props = defineProps<{ result: RuleResult }>()

const scan = useScanStore()
const { locale } = useI18n()
const expanded = ref(false)

const actionable = computed(() =>
  props.result.findings.filter((finding) => !finding.skipped && finding.action !== 'inspect')
)

const skipped = computed(() => props.result.findings.filter((finding) => finding.skipped))

/**
 * Space a rule found but cannot act on. Without this a group whose findings are
 * all blocked reads as a flat "0 B", which tells the user nothing about the
 * gigabytes sitting right there.
 */
const blockedBytes = computed(() =>
  skipped.value.reduce((sum, finding) => sum + Math.max(0, finding.bytes - finding.sharedBytes), 0)
)

const allSelected = computed(
  () =>
    actionable.value.length > 0 &&
    actionable.value.every((finding) => scan.isSelected(finding.id))
)

const someSelected = computed(() =>
  actionable.value.some((finding) => scan.isSelected(finding.id))
)

function toggleGroup(): void {
  const ids = actionable.value.map((finding) => finding.id)
  if (allSelected.value) {
    scan.setSelection(scan.selectedFindings.map((f) => f.id).filter((id) => !ids.includes(id)))
  } else {
    scan.setSelection([...new Set([...scan.selectedFindings.map((f) => f.id), ...ids])])
  }
}

function reveal(path: string): void {
  void window.api.system.revealInFinder(path)
}
</script>

<template>
  <section class="card group">
    <header class="group-head">
      <input
        type="checkbox"
        class="check"
        :checked="allSelected"
        :indeterminate="someSelected && !allSelected"
        :disabled="actionable.length === 0"
        :aria-label="$t(result.titleKey)"
        @change="toggleGroup"
      >

      <button
        class="group-title"
        @click="expanded = !expanded"
      >
        <ChevronRight
          :size="14"
          class="chevron"
          :class="{ open: expanded }"
        />
        <span>
          <span class="title">{{ $t(result.titleKey) }}</span>
          <span class="explain muted">{{ $t(result.explainKey) }}</span>
        </span>
      </button>

      <div class="group-meta">
        <RiskPill :risk="result.risk" />
        <span
          v-if="result.reclaimable > 0"
          class="size tabular"
        >{{ formatBytes(result.reclaimable) }}</span>
        <span
          v-else-if="blockedBytes > 0"
          class="size tabular blocked"
          :title="$t('cleanup.blockedHint')"
        >{{ $t('cleanup.blocked', { size: formatBytes(blockedBytes) }) }}</span>
        <span
          v-else
          class="size tabular muted"
        >—</span>
      </div>
    </header>

    <div
      v-if="expanded"
      class="items"
    >
      <div
        v-for="finding in result.findings"
        :key="finding.id"
        class="item"
      >
        <input
          v-if="!finding.skipped && finding.action !== 'inspect'"
          type="checkbox"
          class="check"
          :checked="scan.isSelected(finding.id)"
          :aria-label="finding.displayPath"
          @change="scan.toggle(finding.id)"
        >
        <span
          v-else
          class="check-spacer"
        />

        <div class="item-body">
          <div class="mono path">
            {{ finding.displayPath }}
          </div>

          <div class="item-meta muted">
            <span>{{ $t('cleanup.files', { count: finding.files }) }}</span>
            <span>·</span>
            <span>{{ $t('cleanup.modified', { when: relativeTime(finding.mtimeMs, locale) }) }}</span>

            <template v-if="finding.regenerates">
              <span>·</span>
              <span>{{ $t('cleanup.regenerates') }}</span>
            </template>

            <button
              class="btn-ghost reveal"
              @click="reveal(finding.path)"
            >
              <FolderOpen :size="12" />
              {{ $t('cleanup.reveal') }}
            </button>
          </div>

          <!--
            Blocks shared with other files would not come back on delete, so
            they are called out instead of being folded into the headline size.
          -->
          <p
            v-if="finding.sharedBytes > 0"
            class="note"
          >
            <Info :size="12" />
            {{ $t('cleanup.shared', { size: formatBytes(finding.sharedBytes) }) }}
          </p>

          <p
            v-if="finding.unreadable > 0"
            class="note"
          >
            <Info :size="12" />
            {{ $t('cleanup.unreadable', { count: finding.unreadable }) }}
          </p>

          <p
            v-if="finding.skipped"
            class="note skipped"
          >
            {{ $t(finding.skipped.reasonKey, { detail: finding.skipped.detail ?? '' }) }}
          </p>
        </div>

        <span class="size tabular">{{ formatBytes(finding.bytes) }}</span>
      </div>

      <p
        v-if="skipped.length > 0"
        class="footnote muted"
      >
        {{ $t('result.whySkipped') }} — {{ skipped.length }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.group {
  margin-bottom: 10px;
}

.group-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
}

.group-title {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0;
}

.chevron {
  margin-top: 3px;
  flex-shrink: 0;
  transition: transform 140ms ease;
}

.chevron.open {
  transform: rotate(90deg);
}

.title {
  display: block;
  font-weight: 600;
}

.explain {
  display: block;
  font-size: 12px;
  margin-top: 1px;
}

.group-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.size {
  font-weight: 600;
  font-size: 13px;
  min-width: 62px;
  text-align: right;
}

.size.blocked {
  color: var(--risk-medium);
  font-size: 12px;
  min-width: 92px;
}

.items {
  border-top: 1px solid var(--border);
}

.item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--border);
}

.item:last-of-type {
  border-bottom: 0;
}

.item-body {
  flex: 1;
  min-width: 0;
}

.path {
  word-break: break-all;
  user-select: text;
}

.item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  font-size: 11.5px;
  margin-top: 2px;
}

.reveal {
  font-size: 11.5px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.note {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--risk-medium);
  margin: 3px 0 0;
}

.note.skipped {
  color: var(--label-tertiary);
}

.check {
  margin-top: 2px;
  accent-color: var(--accent-bright);
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.check-spacer {
  width: 14px;
  flex-shrink: 0;
}

.footnote {
  padding: 8px 14px;
  font-size: 11.5px;
}
</style>
