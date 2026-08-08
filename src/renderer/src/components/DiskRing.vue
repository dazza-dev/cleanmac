<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { bytes as formatBytes } from '../lib/format'

/**
 * The signature element: a segmented ring showing what the container actually
 * holds.
 *
 * The segmentation is the honest part. `total - free` is not the user's data —
 * on the reference machine that overstates it by 34 GB of Preboot, Recovery,
 * sealed system volume and VM swap. Those get their own arc rather than being
 * quietly folded into "used".
 *
 * The animation earns its place too: watching the arc shrink after a cleanup is
 * the payoff for the whole flow, so it re-animates whenever the numbers change
 * instead of snapping.
 */
const props = withDefaults(
  defineProps<{
    yourData: number
    system: number
    free: number
    total: number
    reclaimable?: number
    size?: number
  }>(),
  { reclaimable: 0, size: 208 }
)

const STROKE = 16
const DURATION_MS = 850
const GAP = 0.004 // fraction of the circle left blank between arcs

const radius = computed(() => (props.size - STROKE) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const center = computed(() => props.size / 2)

const progress = ref(0)

const prefersReducedMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function animate(): void {
  if (prefersReducedMotion) {
    progress.value = 1
    return
  }

  const start = performance.now()
  const step = (now: number): void => {
    const t = Math.min(1, (now - start) / DURATION_MS)
    // The easing curve macOS uses for its own transitions.
    progress.value = 1 - Math.pow(1 - t, 3)
    if (t < 1) requestAnimationFrame(step)
  }

  progress.value = 0
  requestAnimationFrame(step)
}

onMounted(animate)
watch(() => [props.yourData, props.system, props.free, props.reclaimable], animate)

/**
 * Arcs laid end to end: reclaimable first (it is the part of "your data" the
 * app can hand back), then the rest of your data, then the other volumes.
 */
const segments = computed(() => {
  const total = props.total || 1
  const reclaimable = Math.min(props.reclaimable, props.yourData)
  const remaining = Math.max(0, props.yourData - reclaimable)

  const parts = [
    { key: 'reclaimable', fraction: reclaimable / total },
    { key: 'data', fraction: remaining / total },
    { key: 'system', fraction: props.system / total }
  ].filter((part) => part.fraction > 0)

  let offset = 0
  return parts.map((part) => {
    const length = part.fraction * progress.value * circumference.value
    const gap = parts.length > 1 ? GAP * circumference.value : 0
    const arc = {
      key: part.key,
      dasharray: `${Math.max(0, length - gap)} ${circumference.value}`,
      dashoffset: -offset
    }
    offset += length
    return arc
  })
})

const percent = computed(() =>
  Math.round(((props.yourData * progress.value) / (props.total || 1)) * 100)
)
</script>

<template>
  <div
    class="ring"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      aria-hidden="true"
    >
      <g :transform="`rotate(-90 ${center} ${center})`">
        <circle
          class="track"
          :cx="center"
          :cy="center"
          :r="radius"
          :stroke-width="STROKE"
          fill="none"
        />
        <circle
          v-for="segment in segments"
          :key="segment.key"
          :class="segment.key"
          :cx="center"
          :cy="center"
          :r="radius"
          :stroke-width="STROKE"
          :stroke-dasharray="segment.dasharray"
          :stroke-dashoffset="segment.dashoffset"
          stroke-linecap="butt"
          fill="none"
        />
      </g>
    </svg>

    <div class="ring-label">
      <div class="ring-value tabular">
        {{ formatBytes(yourData) }}
      </div>
      <div class="ring-total muted tabular">
        {{ percent }}%
      </div>
    </div>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  display: grid;
  place-items: center;
}

.ring svg {
  position: absolute;
  inset: 0;
}

.track {
  stroke: rgba(255, 255, 255, 0.08);
}

.data {
  stroke: #e6dbf5;
}

/* Not the user's, and not deletable, so it reads as clearly secondary — but
   still well clear of the empty track, which is a different meaning again. */
.system {
  stroke: rgba(230, 219, 245, 0.3);
}

/* The one arc the user can act on, so it gets the brand colour and a bloom. */
.reclaimable {
  stroke: var(--accent-bright);
  filter: drop-shadow(0 0 6px rgba(214, 58, 232, 0.65));
}

.ring-label {
  text-align: center;
  z-index: 1;
}

.ring-value {
  font-size: 25px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.ring-total {
  font-size: 13px;
  margin-top: 1px;
}
</style>
