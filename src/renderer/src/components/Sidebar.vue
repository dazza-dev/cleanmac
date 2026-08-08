<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Gauge, Sparkles, PieChart, Clock, Settings as SettingsIcon } from 'lucide-vue-next'
import { useScanStore } from '../stores/scan'
import { bytes as formatBytes } from '../lib/format'

const route = useRoute()
const router = useRouter()
const scan = useScanStore()

const items = computed(() => [
  { name: 'overview', labelKey: 'nav.overview', icon: Gauge, group: 'main' },
  {
    name: 'cleanup',
    labelKey: 'nav.cleanup',
    icon: Sparkles,
    group: 'main',
    count: scan.totalReclaimable > 0 ? formatBytes(scan.totalReclaimable) : ''
  },
  { name: 'storage', labelKey: 'nav.storage', icon: PieChart, group: 'main' },
  { name: 'history', labelKey: 'nav.history', icon: Clock, group: 'other' },
  { name: 'settings', labelKey: 'nav.settings', icon: SettingsIcon, group: 'other' }
])
</script>

<template>
  <nav
    class="sidebar"
    :aria-label="$t('a11y.mainNav')"
  >
    <!-- Keeps the traffic lights clear and gives the window a drag handle. -->
    <div class="titlebar-drag" />

    <div class="nav-group">
      <button
        v-for="item in items.filter((entry) => entry.group === 'main')"
        :key="item.name"
        class="nav-item"
        :class="{ active: route.name === item.name }"
        :aria-current="route.name === item.name ? 'page' : undefined"
        @click="router.push({ name: item.name })"
      >
        <component
          :is="item.icon"
          :size="15"
        />
        {{ $t(item.labelKey) }}
        <span
          v-if="item.count"
          class="nav-count tabular"
        >{{ item.count }}</span>
      </button>
    </div>

    <div class="nav-group">
      <button
        v-for="item in items.filter((entry) => entry.group === 'other')"
        :key="item.name"
        class="nav-item"
        :class="{ active: route.name === item.name }"
        :aria-current="route.name === item.name ? 'page' : undefined"
        @click="router.push({ name: item.name })"
      >
        <component
          :is="item.icon"
          :size="15"
        />
        {{ $t(item.labelKey) }}
      </button>
    </div>
  </nav>
</template>
