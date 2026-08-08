<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '../stores/system'
import { useScanStore } from '../stores/scan'
import { bytes as formatBytes } from '../lib/format'
import DiskRing from '../components/DiskRing.vue'
import ScanProgress from '../components/ScanProgress.vue'
import BlockedApps from '../components/BlockedApps.vue'

const router = useRouter()
const system = useSystemStore()
const scan = useScanStore()

const disk = computed(() => system.disk)

/** Past this the container starts costing performance, not just space. */
const PRESSURE_PERCENT = 85

async function startScan(): Promise<void> {
  await scan.run()
  await system.refreshDisk()
}

/** After quitting an app its findings become actionable, so re-scan. */
async function onAppQuit(): Promise<void> {
  await startScan()
}
</script>

<template>
  <div class="overview">
    <h1 class="page-title">
      {{ $t('overview.title') }}
    </h1>

    <!-- Gated on the loaded value: rendering a ring at 0% before stats arrive
         would animate from a number that was never true. -->
    <template v-if="disk">
      <div class="hero">
        <DiskRing
          :your-data="disk.yourData"
          :system="disk.system"
          :free="disk.free"
          :total="disk.total"
          :reclaimable="scan.totalReclaimable"
        />

        <dl class="legend">
          <div class="item">
            <span
              class="swatch"
              :class="{ accent: scan.totalReclaimable > 0 }"
            />
            <dt>{{ $t('overview.yourData') }}</dt>
            <dd class="tabular">
              {{ formatBytes(disk.yourData) }}
            </dd>
          </div>

          <!-- Named explicitly. Folding these 34 GB into "used" is the
               overstatement this whole screen exists to correct. -->
          <div class="item">
            <span class="swatch system" />
            <dt>{{ $t('overview.systemVolumes') }}</dt>
            <dd class="tabular muted">
              {{ formatBytes(disk.system) }}
            </dd>
          </div>

          <div class="item">
            <span class="swatch free" />
            <dt>{{ $t('overview.free') }}</dt>
            <dd class="tabular">
              {{ formatBytes(disk.free) }}
            </dd>
          </div>

          <div
            v-if="scan.totalReclaimable > 0"
            class="item accent-row"
          >
            <span class="swatch accent" />
            <dt>{{ $t('overview.reclaimable') }}</dt>
            <dd class="tabular">
              {{ formatBytes(scan.totalReclaimable) }}
            </dd>
          </div>
        </dl>
      </div>

      <p
        class="pressure"
        :class="{ high: disk.usedPercent >= PRESSURE_PERCENT }"
      >
        {{ $t('overview.pressure', {
          percent: Math.round(disk.usedPercent),
          total: formatBytes(disk.total)
        }) }}
        <span
          v-if="disk.usedPercent >= PRESSURE_PERCENT"
          class="muted"
        >— {{ $t('overview.pressureHigh') }}</span>
      </p>

      <div class="actions">
        <button
          class="btn btn-primary btn-lg"
          :disabled="scan.scanning"
          @click="startScan"
        >
          {{ scan.scanning ? $t('overview.scanning') : scan.hasScanned ? $t('overview.rescan') : $t('overview.scan') }}
        </button>

        <button
          v-if="scan.totalReclaimable > 0 && !scan.scanning"
          class="btn btn-lg"
          @click="router.push({ name: 'cleanup' })"
        >
          {{ $t('scan.viewResults') }}
        </button>
      </div>

      <!--
        Blocked apps come first: it is the one thing on this screen the user can
        act on immediately, and burying it under ten rows of mostly-zero scan
        results is how 1.6 GB stays invisible.
      -->
      <BlockedApps
        v-if="!scan.scanning"
        class="blocked-wrap"
        :apps="scan.blockedApps"
        @quit="onAppQuit"
      />

      <ScanProgress v-if="scan.scanning || scan.steps.length > 0" />

      <p
        v-if="!scan.scanning && scan.hasScanned && scan.totalReclaimable === 0 && scan.blockedApps.length === 0"
        class="note muted"
      >
        {{ $t('overview.nothingFound') }}
      </p>

      <p
        v-if="system.lifetimeReclaimed > 0"
        class="note muted"
      >
        {{ $t('overview.lifetime', { total: formatBytes(system.lifetimeReclaimed) }) }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.overview {
  padding-top: 4px;
}

.hero {
  display: flex;
  align-items: center;
  gap: 40px;
  margin: 20px 0 14px;
}

.legend {
  margin: 0;
  display: grid;
  gap: 9px;
}

.item {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: #e6dbf5;
  flex-shrink: 0;
}

.swatch.system {
  background: rgba(230, 219, 245, 0.3);
}

.swatch.free {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--border);
}

.swatch.accent {
  background: var(--accent-bright);
}

.legend dt {
  font-size: 12.5px;
  min-width: 116px;
}

.legend dd {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

/*
 * The reclaimable figure stays white. Fuchsia text on this gradient measures
 * under 2:1 — unreadable — and the accent already appears beside it as the
 * legend swatch and in the ring, which is where a fill can carry colour safely.
 */
.accent-row dd {
  color: var(--label);
}

.pressure {
  font-size: 12px;
  color: var(--label-secondary);
  margin: 0 0 18px;
}

.pressure.high {
  color: var(--risk-medium);
}

.actions {
  display: flex;
  gap: 10px;
}

.blocked-wrap {
  margin-top: 18px;
}

.note {
  margin-top: 16px;
  font-size: 12px;
}
</style>
