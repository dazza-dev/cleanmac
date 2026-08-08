<script setup lang="ts">
import { onMounted, provide, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldAlert, X } from 'lucide-vue-next'
import { useSystemStore } from './stores/system'
import { useScanStore } from './stores/scan'
import { setLocale, detectLocale } from './i18n'
import Sidebar from './components/Sidebar.vue'

const router = useRouter()
const system = useSystemStore()
const scan = useScanStore()
const lastError = ref<string | null>(null)

/**
 * Bumped when the menu asks for a cleanup. A counter rather than a boolean so
 * repeated presses each register, and the Cleanup view can watch it without
 * needing to reset anything.
 */
const cleanRequested = ref(0)
provide('cleanRequested', cleanRequested)

const updateVersion = ref<string | null>(null)

/**
 * Opens a view on launch for UI iteration. The Storage and duplicates screens
 * are empty until measured, and measuring is a deliberate user action, so the
 * helper performs it too — otherwise the flag lands on a blank page.
 */
function applyDevRoute(route: string): void {
  // `?run=duplicates` skips the directory breakdown, so the duplicates card is
  // not buried under a screen of measured directories.
  if (route === '/storage?run=duplicates') {
    void router.push('/storage')
    void scan.findDuplicates()
    return
  }

  void router.push(route)

  if (route === '/storage') {
    void scan.measureStorage().then(() => {
      // Also drill into the biggest entry, so the per-type breakdown is visible
      // without a click.
      const biggest = scan.storage?.entries[0]
      if (!biggest) return
      void scan.measureTypes(biggest.path).then(() => {
        // Expanding the first card changes the layout height; without this the
        // pane can be left scrolled past what was just revealed.
        document.querySelector('#main')?.scrollTo({ top: 0 })
      })
    })
  }
}

onMounted(async () => {
  // Platform class is applied from a synchronously available value so the very
  // first paint is already styled correctly — no flicker.
  document.documentElement.classList.add(`platform-${window.api.platform}`)

  /*
   * Every IPC listener is registered before the first `await`.
   *
   * Awaiting first leaves a window several round-trips wide in which the main
   * process can emit and nobody is listening. A scan started from the tray at
   * launch lost its progress and completion events exactly that way.
   */
  scan.bindProgress()

  window.api.on.error((payload) => {
    lastError.value = payload.message
  })

  /*
   * The dev route is asked for, not waited for.
   *
   * It used to arrive on a `dev:navigate` push that the main process sent the
   * moment the window finished loading — before this component existed to hear
   * it. An IPC send with no listener is silently dropped, so CLEANMAC_DEV_ROUTE
   * did nothing at all and gave no hint why.
   */
  void window.api.system.devRoute().then((route) => {
    if (route) applyDevRoute(route)
  })

  // ⌘, and ⌘⌫ come from the application menu; the renderer just reacts.
  window.api.on.updateReady((version) => {
    updateVersion.value = version
  })

  window.api.on.menuCommand((command) => {
    if (command === 'settings') void router.push({ name: 'settings' })
    else cleanRequested.value += 1
  })

  await system.load()
  setLocale(detectLocale(system.config?.locale ?? null))

  // TCC can be granted while the app is running, but only takes effect after a
  // restart. Re-checking on focus is what surfaces that to the user.
  window.addEventListener('focus', () => void system.load())
})

function dismissPermission(): void {
  void system.updateConfig({ permissionPromptDismissed: true })
}

function openSettings(): void {
  void window.api.system.openFullDiskAccess()
}
</script>

<template>
  <div class="shell">
    <!-- Lets a keyboard user jump the sidebar instead of tabbing through it. -->
    <a
      href="#main"
      class="skip-link"
    >{{ $t('a11y.skipToContent') }}</a>

    <Sidebar />

    <main class="content">
      <div class="titlebar-drag" />

      <div
        id="main"
        class="content-scroll"
        tabindex="-1"
      >
        <RouterView />
      </div>

      <!--
        Never degrade the scan silently: if Full Disk Access is missing, say so
        and say what it costs. The prompt appears after the user has already
        seen results, so there is a reason to grant it.
      -->
      <div
        v-if="
          system.permissions &&
            !system.permissions.fullDiskAccess &&
            !system.config?.permissionPromptDismissed &&
            scan.hasScanned
        "
        class="banner"
      >
        <ShieldAlert :size="14" />
        <span>
          <strong>{{ $t('permission.missing') }}</strong> — {{ $t('permission.detail') }}
        </span>
        <button
          class="btn-ghost"
          @click="openSettings"
        >
          {{ $t('permission.grant') }}
        </button>
        <button
          class="btn-ghost icon"
          :aria-label="$t('permission.dismiss')"
          @click="dismissPermission"
        >
          <X :size="13" />
        </button>
      </div>

      <!-- Never installs behind the user's back; it waits for a quit. -->
      <div
        v-if="updateVersion"
        class="banner"
      >
        <span>{{ $t('settings.updateReady', { version: updateVersion }) }}</span>
        <button
          class="btn-ghost icon"
          :aria-label="$t('permission.dismiss')"
          @click="updateVersion = null"
        >
          <X :size="13" />
        </button>
      </div>

      <div
        v-if="lastError"
        class="banner banner-error"
        role="alert"
      >
        <span>{{ $t('error.generic', { message: lastError }) }}</span>
        <button
          class="btn-ghost icon"
          aria-label="dismiss"
          @click="lastError = null"
        >
          <X :size="13" />
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.banner .btn-ghost {
  margin-left: auto;
  white-space: nowrap;
}

.banner .btn-ghost.icon {
  margin-left: 0;
  display: inline-flex;
}
</style>
