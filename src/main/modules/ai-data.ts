import { readFile, opendir } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import type { CleanupRule, ProviderContext, ProviderFinding } from '../rules/types'
import { minAge, notRunning, writable } from '../rules/guards'

/**
 * M3 — Data left behind by AI applications.
 *
 * The category no other cleaner covers, and the reason this project exists. A
 * single directory of virtual machine images for Claude's code sandbox holds
 * 6.7 GB on the reference machine — more than every developer cache combined —
 * with no interface anywhere that admits it is there.
 *
 * These apps are new enough that their storage habits are unsettled, so every
 * rule here errs toward reporting over deleting.
 */

const HOME = homedir()

/**
 * Virtual machine images for the code sandbox. Re-downloaded on demand, but the
 * download is measured in gigabytes, so this is never preselected.
 */
export const claudeVmBundles: CleanupRule = {
  id: 'ai.claude-vm-bundles',
  moduleId: 'ai-data',
  category: 'ai-data',
  titleKey: 'rules.claudeVm.title',
  explainKey: 'rules.claudeVm.explain',
  risk: 'medium',
  roots: ['~/Library/Application Support/Claude/vm_bundles'],
  depth: 1,
  match: { type: 'glob', patterns: ['*'] },
  guards: [minAge(7), notRunning('Claude'), writable()],
  action: 'trash',
  regenerates: true,
  minBytes: 50 * 1024 * 1024
}

/** Ordinary Electron caches, no different from any other app's. */
export const aiAppCaches: CleanupRule = {
  id: 'ai.app-caches',
  moduleId: 'ai-data',
  category: 'ai-data',
  titleKey: 'rules.aiCaches.title',
  explainKey: 'rules.aiCaches.explain',
  risk: 'low',
  roots: [
    '~/Library/Application Support/Claude',
    '~/Library/Application Support/Trae',
    '~/Library/Application Support/Cursor',
    '~/Library/Application Support/Code'
  ],
  depth: 1,
  match: {
    type: 'glob',
    patterns: ['Cache', 'Code Cache', 'GPUCache', 'DawnWebGPUCache', 'DawnGraphiteCache']
  },
  guards: [minAge(3), writable()],
  action: 'trash',
  regenerates: true,
  minBytes: 10 * 1024 * 1024
}

/** HuggingFace's hub cache is a download cache by design and says so. */
export const huggingFaceCache: CleanupRule = {
  id: 'ai.huggingface-cache',
  moduleId: 'ai-data',
  category: 'ai-data',
  titleKey: 'rules.huggingFace.title',
  explainKey: 'rules.huggingFace.explain',
  risk: 'medium',
  roots: ['~/.cache/huggingface'],
  depth: 1,
  match: { type: 'glob', patterns: ['hub', 'datasets'] },
  guards: [minAge(14), writable()],
  action: 'trash',
  regenerates: true,
  minBytes: 100 * 1024 * 1024
}

/**
 * Local model weights. Reported, never deleted from here.
 *
 * Ollama and LM Studio keep a manifest index alongside content-addressed blobs;
 * removing files underneath them leaves the index pointing at nothing. The
 * supported route is `ollama rm <model>`, which the explanation tells the user
 * about rather than the app guessing which models are wanted.
 */
export const localModels: CleanupRule = {
  id: 'ai.local-models',
  moduleId: 'ai-data',
  category: 'ai-data',
  titleKey: 'rules.localModels.title',
  explainKey: 'rules.localModels.explain',
  risk: 'medium',
  roots: ['~/.ollama', '~/.lmstudio', '~/Library/Application Support/LM Studio'],
  depth: 1,
  match: { type: 'glob', patterns: ['models'] },
  guards: [],
  action: 'inspect',
  regenerates: true,
  minBytes: 100 * 1024 * 1024
}

const EDITORS = [
  { name: 'Cursor', dir: 'Cursor' },
  { name: 'Visual Studio Code', dir: 'Code' },
  { name: 'Trae', dir: 'Trae' },
  { name: 'Windsurf', dir: 'Windsurf' }
]

/**
 * Per-workspace state for AI editors: chat history, indexes, embeddings.
 *
 * One directory is created per project ever opened and none are ever removed.
 * A workspace whose project folder no longer exists on disk is unambiguously
 * dead — that is what this looks for, rather than guessing from age. Workspaces
 * whose folder is still present are left completely alone.
 */
async function orphanedWorkspaces(context: ProviderContext): Promise<ProviderFinding[]> {
  const findings: ProviderFinding[] = []

  for (const editor of EDITORS) {
    const root = path.join(
      HOME,
      'Library/Application Support',
      editor.dir,
      'User/workspaceStorage'
    )

    let dir
    try {
      dir = await opendir(root)
    } catch {
      continue // editor not installed
    }

    for await (const entry of dir) {
      if (!entry.isDirectory()) continue

      const workspacePath = path.join(root, entry.name)
      const target = await workspaceFolder(path.join(workspacePath, 'workspace.json'))

      // No manifest means we cannot prove it is dead, so it stays.
      if (!target) continue

      try {
        await access(target, constants.F_OK)
        continue // the project still exists
      } catch {
        // The folder it belonged to is gone.
      }

      const report = await context.scanner.size(workspacePath)
      findings.push({
        path: workspacePath,
        bytes: report.bytes,
        files: report.files,
        mtimeMs: report.newestMtimeMs,
        label: `${editor.name} — ${path.basename(target)}`
      })
    }
  }

  return findings
}

/** Reads the project folder a workspace belongs to, if it declares one. */
async function workspaceFolder(manifest: string): Promise<string | null> {
  try {
    const raw = await readFile(manifest, 'utf8')
    const parsed = JSON.parse(raw) as { folder?: string }
    if (!parsed.folder?.startsWith('file://')) return null
    return decodeURIComponent(new URL(parsed.folder).pathname)
  } catch {
    return null
  }
}

export const editorWorkspaces: CleanupRule = {
  id: 'ai.editor-workspaces',
  moduleId: 'ai-data',
  category: 'ai-data',
  titleKey: 'rules.editorWorkspaces.title',
  explainKey: 'rules.editorWorkspaces.explain',
  risk: 'low',
  roots: [],
  depth: 0,
  match: { type: 'glob', patterns: [] },
  guards: [],
  action: 'trash',
  regenerates: false,
  provider: orphanedWorkspaces,
  minBytes: 1024 * 1024
}

export const rules: CleanupRule[] = [
  claudeVmBundles,
  aiAppCaches,
  huggingFaceCache,
  localModels,
  editorWorkspaces
]
