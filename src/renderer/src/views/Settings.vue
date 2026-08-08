<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSystemStore } from '../stores/system'
import { SUPPORTED, setLocale, type SupportedLocale } from '../i18n'

const system = useSystemStore()
const version = ref('')

onMounted(async () => {
  version.value = await window.api.system.version()
})

const locale = computed({
  get: () => system.config?.locale ?? '',
  set: (value: string) => {
    void system.updateConfig({ locale: value === '' ? null : value })
    setLocale((value === '' ? navigator.language.slice(0, 2) : value) as SupportedLocale)
  }
})

const threshold = computed({
  get: () => system.config?.warnThresholdPercent ?? 85,
  set: (value: number) => void system.updateConfig({ warnThresholdPercent: Number(value) })
})

const localeNames: Record<string, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
  fr: 'Français'
}
</script>

<template>
  <div>
    <h1 class="page-title">
      {{ $t('settings.title') }}
    </h1>

    <!-- Gated on config: binding a select before the value loads would flash
         the wrong selection and then overwrite it. -->
    <template v-if="system.config">
      <section class="card block">
        <label class="field">
          <span>{{ $t('settings.language') }}</span>
          <select v-model="locale">
            <option value="">{{ $t('settings.languageSystem') }}</option>
            <option
              v-for="code in SUPPORTED"
              :key="code"
              :value="code"
            >
              {{ localeNames[code] }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>{{ $t('settings.threshold') }}</span>
          <span class="range">
            <input
              v-model.number="threshold"
              type="range"
              min="50"
              max="95"
              step="5"
            >
            <span class="tabular">{{ threshold }}%</span>
          </span>
        </label>
        <p class="hint muted">
          {{ $t('settings.thresholdHint') }}
        </p>
      </section>

      <section class="card block">
        <h2>{{ $t('settings.about') }}</h2>
        <p class="muted">
          {{ $t('settings.version', { version }) }}
        </p>
        <p class="muted">
          {{ $t('settings.openSource') }}
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.block {
  padding: 14px 16px;
  margin-bottom: 12px;
}

.block h2 {
  font-size: 13px;
  font-weight: 650;
  margin: 0 0 4px;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0;
}

.range {
  display: flex;
  align-items: center;
  gap: 8px;
}

select,
input[type='range'] {
  accent-color: var(--accent);
}

.hint {
  font-size: 11.5px;
  margin: 2px 0 0;
}
</style>
