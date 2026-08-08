<script setup lang="ts">
import type { Risk } from '../../../shared/types'

defineProps<{ risk: Risk }>()
</script>

<template>
  <!--
    Risk is never conveyed by colour alone: the dot carries the hue, the label
    carries the meaning, so the control still works for colour-blind users and
    under VoiceOver.
  -->
  <span
    class="pill"
    :class="`risk-${risk}`"
  >
    <span class="pill-dot" />
    {{ $t(`risk.${risk}`) }}
  </span>
</template>
