<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderOpen, ShieldAlert, PieChart, HardDrive } from 'lucide-vue-next'
import { useScanStore } from '../stores/scan'
import { useSystemStore } from '../stores/system'
import { bytes as formatBytes, relativeTime } from '../lib/format'

/**
 * Where the space actually went.
 *
 * This is the screen macOS refuses to give you: Settings → Storage files a
 * 14 GB WhatsApp media library under "Other" and offers no way to look inside.
 * Here every directory over 100 MB is named and sized.
 *
 * Nothing on this page is selectable. Much of what it surfaces is irreplaceable
 * user data, and the value is in seeing it — not in a button.
 */
const { locale } = useI18n()
const scan = useScanStore()
const system = useSystemStore()

const breakdown = computed(() => scan.storage)

const largest = computed(() => breakdown.value?.entries[0]?.bytes ?? 1)

function reveal(path: string): void {
  void window.api.system.revealInFinder(path)
}

const systemData = computed(() => system.systemData)

/** Volumes other than Data — the part of "System Data" that is not a folder. */
const hiddenVolumes = computed(
  () => systemData.value?.volumes.filter((volume) => volume.role !== 'Data') ?? []
)

const uptimeDays = computed(() =>
  Math.floor((systemData.value?.uptimeSeconds ?? 0) / 86400)
)

/**
 * A restart is worth suggesting only when it would actually return something.
 * On a machine rebooted this morning the VM volume is empty and the advice
 * would be noise.
 */
const rebootWorthIt = computed(() => (systemData.value?.rebootWouldFree ?? 0) > 1024 ** 3)

/**
 * Loaded on arrival rather than behind a button. This costs a `diskutil` call
 * and two smaller ones — about a second — where the directory breakdown below
 * walks the entire disk. Making someone press a second button for the cheap
 * half of the page, after they already pressed one for the expensive half, is
 * how the largest number on the screen ends up never being looked at.
 */
onMounted(() => {
  if (!system.systemData) void system.refreshSystemData()
})
</script>

<template>
  <div>
    <h1 class="page-title">
      {{ $t('storage.title') }}
    </h1>
    <p class="page-subtitle">
      {{ $t('storage.subtitle') }}
    </p>

    <!--
      Deliberately above the directory breakdown. On the reference Mac mini this
      section accounted for 34 GB that no directory listing could ever show,
      because it is not in a directory.
    -->
    <section class="sysdata">
      <header class="sysdata-head">
        <HardDrive
          :size="16"
          aria-hidden="true"
        />
        <h2>{{ $t('systemData.title') }}</h2>
        <span
          v-if="system.loadingSystemData"
          class="muted"
        >{{ $t('systemData.measuring') }}</span>
      </header>

      <p class="muted sysdata-intro">
        {{ $t('systemData.explain') }}
      </p>

      <template v-if="systemData">
        <ul class="volumes">
          <li
            v-for="volume in hiddenVolumes"
            :key="volume.role"
          >
            <span class="vol-role">{{ volume.role }}</span>
            <span class="vol-note muted">{{ volume.noteKey ? $t(volume.noteKey) : '' }}</span>
            <span class="vol-size">{{ formatBytes(volume.bytes) }}</span>
          </li>
        </ul>

        <p class="sysdata-total">
          {{ $t('systemData.outsideData', { size: formatBytes(systemData.outsideData) }) }}
        </p>

        <!--
          The reasoning, not just the recommendation. Someone told "restart to
          free 34 GB" with no explanation has been asked to take it on faith,
          which is the thing this application exists to refuse.
        -->
        <div
          v-if="rebootWorthIt"
          class="reboot"
        >
          <strong>{{ $t('systemData.reboot', { size: formatBytes(systemData.rebootWouldFree) }) }}</strong>
          <p>{{ $t('systemData.rebootWhy', { days: uptimeDays }) }}</p>
          <ul class="evidence">
            <li v-if="systemData.swapTotal">
              {{ $t('systemData.swap', {
                used: formatBytes(systemData.swapUsed),
                total: formatBytes(systemData.swapTotal)
              }) }}
            </li>
            <li v-if="systemData.sleepImageBytes">
              {{ $t('systemData.sleepImage', {
                size: formatBytes(systemData.sleepImageBytes)
              }) }}
            </li>
            <li>{{ $t('systemData.uptime', { days: uptimeDays }) }}</li>
          </ul>
          <p class="muted safe">
            {{ $t('systemData.rebootSafe') }}
          </p>
        </div>

        <div
          v-if="systemData.snapshots.length"
          class="snapshots"
        >
          <strong>{{ $t('systemData.snapshots', { count: systemData.snapshots.length }) }}</strong>
          <p class="muted">
            {{ $t('systemData.snapshotsWhy') }}
          </p>
          <code>tmutil deletelocalsnapshots {{ systemData.snapshots[0]?.split('.').pop() }}</code>
        </div>

        <p class="muted sysdata-more">
          {{ $t('systemData.more') }}
        </p>
      </template>
    </section>

    <div
      v-if="!breakdown"
      class="empty"
    >
      <p class="muted">
        {{ $t('storage.intro') }}
      </p>
      <button
        class="btn btn-primary"
        :disabled="scan.measuringStorage"
        @click="scan.measureStorage()"
      >
        {{ scan.measuringStorage ? $t('storage.measuring') : $t('storage.measure') }}
      </button>
    </div>

    <template v-else>
      <div class="toolbar">
        <span class="muted">
          {{ $t('storage.summary', {
            size: formatBytes(breakdown.measuredBytes),
            seconds: (breakdown.durationMs / 1000).toFixed(1)
          }) }}
        </span>
        <button
          class="btn"
          :disabled="scan.measuringStorage"
          @click="scan.measureStorage()"
        >
          {{ scan.measuringStorage ? $t('storage.measuring') : $t('storage.remeasure') }}
        </button>
      </div>

      <!--
        Blind spots are stated, never swallowed. A breakdown that silently
        omitted a few hundred unreadable folders would be the same lie by
        omission this app exists to undo.
      -->
      <p
        v-if="breakdown.unreadable > 0 && !system.permissions?.fullDiskAccess"
        class="warn"
      >
        <ShieldAlert :size="13" />
        {{ $t('storage.unreadable', { count: breakdown.unreadable }) }}
      </p>

      <section
        v-for="entry in breakdown.entries"
        :key="entry.path"
        class="card row"
      >
        <div class="head">
          <span class="label">
            {{ entry.label }}
            <!-- Only when another entry shares the name; a qualifier on every
                 row would be noise. -->
            <span
              v-if="entry.needsQualifier"
              class="qualifier muted"
            >· {{ $t(`storage.root.${entry.rootKind}`) }}</span>
          </span>
          <span
            v-if="entry.userData"
            class="pill risk-high"
          >
            <span class="pill-dot" />
            {{ $t('storage.userData') }}
          </span>
          <span class="size tabular">{{ formatBytes(entry.bytes) }}</span>
        </div>

        <div class="bar">
          <div
            class="fill"
            :style="{ width: `${Math.max(1, (entry.bytes / largest) * 100)}%` }"
          />
        </div>

        <div class="meta muted">
          <span class="mono">{{ entry.displayPath }}</span>
          <span>·</span>
          <span>{{ $t('cleanup.files', { count: entry.files }) }}</span>
          <button
            class="btn-ghost"
            @click="reveal(entry.path)"
          >
            <FolderOpen :size="12" />
            {{ $t('cleanup.reveal') }}
          </button>
          <button
            v-if="!scan.types[entry.path]"
            class="btn-ghost"
            :disabled="scan.typingPath !== null"
            @click="scan.measureTypes(entry.path)"
          >
            <PieChart :size="12" />
            {{ scan.typingPath === entry.path ? $t('fileType.analyzing') : $t('fileType.analyze') }}
          </button>
        </div>

        <!--
          The drill-down that turns "14 GB" into something a person can act on:
          how much is video, how much is photos, and how much is thumbnails the
          app would happily regenerate.
        -->
        <div
          v-if="scan.types[entry.path]"
          class="types"
        >
          <div class="types-head muted">
            {{ $t('fileType.heading') }}
          </div>
          <div
            v-for="type in scan.types[entry.path]!.entries"
            :key="type.key"
            class="type-row"
          >
            <span class="type-label">{{ $t(`fileType.${type.key}`) }}</span>
            <span class="type-bar">
              <span
                class="type-fill"
                :style="{
                  width: `${Math.max(1, (type.bytes / scan.types[entry.path]!.totalBytes) * 100)}%`
                }"
              />
            </span>
            <span class="muted type-files">{{ $t('cleanup.files', { count: type.files }) }}</span>
            <span class="tabular type-size">{{ formatBytes(type.bytes) }}</span>
          </div>
        </div>
      </section>

      <p class="muted footnote">
        {{ $t('storage.footnote') }}
      </p>
    </template>

    <!--
      M10. A sweep of the whole home directory, so it is its own explicit
      action. Everything it finds is by construction the user's own file —
      an installer, a video export, a database dump — so it is a finder, not
      a cleaner, and has no checkboxes at all.
    -->
    <section class="card large">
      <div class="large-head">
        <div>
          <strong>{{ $t('large.title') }}</strong>
          <p class="muted hint">
            {{ $t('large.subtitle', { size: '100 MB', days: 90 }) }}
          </p>
        </div>
        <button
          class="btn"
          :disabled="scan.findingLarge"
          @click="scan.findLargeFiles()"
        >
          {{ scan.findingLarge ? $t('large.searching') : $t('large.search') }}
        </button>
      </div>

      <template v-if="scan.largeFiles">
        <p class="muted hint">
          {{ $t('large.summary', {
            count: scan.largeFiles.totalFound,
            size: formatBytes(scan.largeFiles.totalBytes),
            scanned: scan.largeFiles.scanned,
            seconds: (scan.largeFiles.durationMs / 1000).toFixed(1)
          }) }}
        </p>

        <p
          v-if="scan.largeFiles.files.length === 0"
          class="muted hint"
        >
          {{ $t('large.none') }}
        </p>

        <div
          v-for="file in scan.largeFiles.files"
          :key="file.path"
          class="large-row"
        >
          <span class="mono large-path">{{ file.displayPath }}</span>
          <span class="muted large-when">{{ relativeTime(file.mtimeMs, locale) }}</span>
          <span class="tabular large-size">{{ formatBytes(file.bytes) }}</span>
          <button
            class="btn-ghost"
            @click="reveal(file.path)"
          >
            <FolderOpen :size="12" />
          </button>
        </div>
      </template>
    </section>
    <!--
      M11. Reported, never deletable: which copy matters is not a question this
      app can answer, and the figure is an upper bound because APFS clones are
      invisible to stat.
    -->
    <section class="card large">
      <div class="large-head">
        <div>
          <strong>{{ $t('duplicates.title') }}</strong>
          <p class="muted hint">
            {{ $t('duplicates.subtitle', { size: '1 MB' }) }}
          </p>
        </div>
        <button
          class="btn"
          :disabled="scan.findingDuplicates"
          @click="scan.findDuplicates()"
        >
          {{ scan.findingDuplicates ? $t('duplicates.searching') : $t('duplicates.search') }}
        </button>
      </div>

      <template v-if="scan.duplicates">
        <p class="muted hint">
          {{ $t('duplicates.summary', {
            groups: scan.duplicates.totalGroups,
            size: formatBytes(scan.duplicates.totalReclaimable),
            scanned: scan.duplicates.scanned,
            hashed: scan.duplicates.hashed,
            seconds: (scan.duplicates.durationMs / 1000).toFixed(1)
          }) }}
        </p>

        <p
          v-if="scan.duplicates.totalGroups > 0"
          class="warn"
        >
          <ShieldAlert :size="13" />
          {{ $t('duplicates.upperBound') }}
        </p>

        <p
          v-else
          class="muted hint"
        >
          {{ $t('duplicates.none') }}
        </p>

        <div
          v-for="(group, index) in scan.duplicates.groups"
          :key="index"
          class="dup"
        >
          <div class="dup-head">
            <span class="tabular">{{ $t('duplicates.copies', { count: group.distinctCopies }) }}</span>
            <span class="muted">· {{ formatBytes(group.bytes) }} {{ $t('duplicates.each') }}</span>
            <span
              v-if="group.hardLinked"
              class="pill risk-low"
            >
              <span class="pill-dot" />
              {{ $t('duplicates.hardLinked') }}
            </span>
            <span class="tabular dup-size">{{ formatBytes(group.reclaimable) }}</span>
          </div>
          <div
            v-for="file in group.files"
            :key="file.path"
            class="dup-row"
          >
            <span class="mono dup-path">{{ file.displayPath }}</span>
            <button
              class="btn-ghost"
              @click="reveal(file.path)"
            >
              <FolderOpen :size="12" />
            </button>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.empty {
  display: grid;
  gap: 12px;
  justify-items: start;
  max-width: 460px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 12px;
}

.warn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--risk-medium);
  margin: 0 0 12px;
}

.row {
  padding: 11px 14px;
  margin-bottom: 8px;
}

.head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.label {
  font-weight: 600;
  margin-right: auto;
}

.qualifier {
  font-weight: 400;
  font-size: 12px;
}

.size {
  font-weight: 600;
}

.bar {
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
  margin: 7px 0 6px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--accent-bright);
  border-radius: 2px;
}

.meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11.5px;
}

.footnote {
  font-size: 11.5px;
  margin-top: 14px;
}

.types {
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--border);
}

.types-head {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 5px;
}

.type-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 2px 0;
  font-size: 12px;
}

.type-label {
  min-width: 190px;
}

.type-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.type-fill {
  display: block;
  height: 100%;
  background: var(--accent-bright);
}

.type-files {
  font-size: 11px;
  min-width: 76px;
  text-align: right;
}

.type-size {
  min-width: 62px;
  text-align: right;
  font-weight: 600;
}

.large {
  padding: 13px 16px;
  margin-top: 18px;
}

.large-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.hint {
  font-size: 11.5px;
  margin: 3px 0 0;
}

.large-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  border-top: 1px solid var(--border);
  font-size: 11.5px;
}

.large-path {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  user-select: text;
}

.large-when {
  white-space: nowrap;
}

.large-size {
  font-weight: 600;
  min-width: 62px;
  text-align: right;
}

.dup {
  border-top: 1px solid var(--border);
  padding: 8px 0 4px;
}

.dup-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 3px;
}

.dup-size {
  margin-left: auto;
}

.dup-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  padding: 1px 0;
}

.dup-path {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  user-select: text;
  color: var(--label-secondary);
}

.sysdata {
  margin: 0 0 28px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
}

.sysdata-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sysdata-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  flex: 1;
}

.sysdata-intro {
  margin: 8px 0 14px;
  font-size: 13px;
  line-height: 1.5;
}

.volumes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.volumes li {
  display: grid;
  grid-template-columns: 84px 1fr auto;
  gap: 12px;
  align-items: baseline;
  font-size: 13px;
}

.vol-role {
  font-weight: 600;
}

.vol-note {
  font-size: 12px;
}

.vol-size {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.sysdata-total {
  margin: 14px 0 0;
  font-size: 13px;
  font-weight: 600;
}

.reboot {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
}

.reboot strong {
  font-size: 13px;
}

.reboot p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.reboot p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.evidence {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: grid;
  gap: 3px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.evidence li::before {
  content: '·';
  margin-right: 6px;
  opacity: 0.6;
}

.safe {
  margin-top: 10px;
}

.snapshots {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
}

.snapshots strong {
  font-size: 13px;
}

.snapshots p {
  margin: 4px 0 8px;
  font-size: 12px;
  line-height: 1.5;
}

.snapshots code {
  display: block;
  padding: 7px 10px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.28);
  font-size: 12px;
  user-select: all;
}

.sysdata-more {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.5;
}
</style>