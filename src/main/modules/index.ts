import type { CleanupRule } from '../rules/types'
import { rules as updaterRules } from './updater-residue'
import { rules as devCacheRules } from './dev-caches'
import { rules as dockerRules } from './docker'
import { rules as systemRules } from './system'
import { rules as aiRules } from './ai-data'
import { rules as browserRules } from './browsers'
import { rules as nodeModulesRules } from './node-modules'
import { rules as appLeftoverRules } from './app-leftovers'

export interface CleanupModule {
  id: string
  titleKey: string
  descriptionKey: string
  /** Display order in the sidebar. */
  order: number
  rules: CleanupRule[]
}

export const modules: CleanupModule[] = [
  {
    id: 'updater-residue',
    titleKey: 'modules.updaterResidue.title',
    descriptionKey: 'modules.updaterResidue.description',
    order: 1,
    rules: updaterRules
  },
  {
    id: 'dev-caches',
    titleKey: 'modules.devCaches.title',
    descriptionKey: 'modules.devCaches.description',
    order: 2,
    rules: devCacheRules
  },
  {
    // The differentiator: nothing else on the market knows what vm_bundles is.
    id: 'ai-data',
    titleKey: 'modules.aiData.title',
    descriptionKey: 'modules.aiData.description',
    order: 3,
    rules: aiRules
  },
  {
    id: 'browsers',
    titleKey: 'modules.browsers.title',
    descriptionKey: 'modules.browsers.description',
    order: 4,
    rules: browserRules
  },
  {
    id: 'docker',
    titleKey: 'modules.docker.title',
    descriptionKey: 'modules.docker.description',
    order: 5,
    rules: dockerRules
  },
  {
    id: 'node-modules',
    titleKey: 'modules.nodeModules.title',
    descriptionKey: 'modules.nodeModules.description',
    order: 6,
    rules: nodeModulesRules
  },
  {
    // Last on purpose: the highest false-positive risk in the catalogue.
    id: 'app-leftovers',
    titleKey: 'modules.appLeftovers.title',
    descriptionKey: 'modules.appLeftovers.description',
    order: 7,
    rules: appLeftoverRules
  },
  {
    id: 'system',
    titleKey: 'modules.system.title',
    descriptionKey: 'modules.system.description',
    order: 8,
    rules: systemRules
  }
]

export const allRules: CleanupRule[] = modules.flatMap((module) => module.rules)

export function findRule(ruleId: string): CleanupRule | undefined {
  return allRules.find((rule) => rule.id === ruleId)
}

// Rule ids are used as stable keys in the undo log and in finding ids, so a
// duplicate would silently corrupt history. Caught at import time rather than
// in a test that someone might not run.
const seen = new Set<string>()
for (const rule of allRules) {
  if (seen.has(rule.id)) throw new Error(`Duplicate rule id: ${rule.id}`)
  seen.add(rule.id)
}
