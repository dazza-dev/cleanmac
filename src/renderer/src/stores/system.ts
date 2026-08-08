import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  AppConfig,
  DiskStats,
  PermissionState,
  SystemDataReport
} from '../../../shared/types'

export const useSystemStore = defineStore('system', () => {
  const disk = ref<DiskStats | null>(null)
  const permissions = ref<PermissionState | null>(null)
  const config = ref<AppConfig | null>(null)
  const trashBytes = ref(0)
  const lifetimeReclaimed = ref(0)
  const error = ref<string | null>(null)

  // Loaded on demand rather than with the rest: it shells out to diskutil and
  // tmutil, and the Overview does not need it.
  const systemData = ref<SystemDataReport | null>(null)
  const loadingSystemData = ref(false)

  async function refreshSystemData(): Promise<void> {
    loadingSystemData.value = true
    try {
      systemData.value = await window.api.system.systemData()
    } finally {
      loadingSystemData.value = false
    }
  }

  async function refreshDisk(): Promise<void> {
    disk.value = await window.api.system.disk()
  }

  async function refreshTrash(): Promise<void> {
    trashBytes.value = await window.api.trash.size()
  }

  async function load(): Promise<void> {
    const [diskStats, permissionState, appConfig, total] = await Promise.all([
      window.api.system.disk(),
      window.api.system.permissions(),
      window.api.config.get(),
      window.api.history.total()
    ])

    disk.value = diskStats
    permissions.value = permissionState
    config.value = appConfig
    lifetimeReclaimed.value = total
  }

  async function updateConfig(patch: Partial<AppConfig>): Promise<void> {
    config.value = await window.api.config.set(patch)
  }

  return {
    disk,
    systemData,
    loadingSystemData,
    refreshSystemData,
    permissions,
    config,
    trashBytes,
    lifetimeReclaimed,
    error,
    load,
    refreshDisk,
    refreshTrash,
    updateConfig
  }
})
