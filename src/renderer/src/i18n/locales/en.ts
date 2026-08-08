export default {
  app: { name: 'CleanMac' },

  nav: {
    overview: 'Overview',
    cleanup: 'Cleanup',
    storage: 'Storage',
    history: 'History',
    settings: 'Settings'
  },

  overview: {
    title: 'Overview',
    yourData: 'Your data',
    systemVolumes: 'System volumes',
    free: 'Free',
    pressure: 'Container {percent}% full of {total}',
    pressureHigh: 'past 85% macOS starts slowing down',
    scan: 'Scan my Mac',
    scanning: 'Scanning…',
    rescan: 'Scan again',
    reclaimable: 'reclaimable',
    nothingFound: 'Nothing to clean. Your Mac is already tidy.',
    lifetime: 'You have reclaimed {total} with CleanMac so far.'
  },

  scan: {
    found: '{size} found',
    inProgress: 'Analyzing…',
    done: 'Scan complete in {seconds}s',
    viewResults: 'Review results',
    modules: '{count} modules'
  },

  cleanup: {
    title: 'Cleanup',
    subtitle: 'Every path is shown before anything is touched.',
    empty: 'Run a scan to see what can be reclaimed.',
    selected: '{count} selected · {size}',
    clean: 'Move to Trash',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    files: '{count} files',
    modified: 'modified {when}',
    reveal: 'Show in Finder',
    shared: '{size} of this is shared with other files and will not be freed',
    unreadable: '{count} folders could not be read',
    blocked: '{size} blocked',
    blockedHint: 'Found, but something is preventing it from being removed right now.',
    regenerates: 'Will be re-created when needed',
    commandPreview: 'This runs {command}',
    inspectOnly: 'Reported only — CleanMac never deletes this'
  },

  risk: {
    none: 'No risk',
    low: 'Low risk',
    medium: 'Medium risk',
    high: 'Your data'
  },

  guard: {
    tooRecent: 'Changed {detail} days ago — left alone',
    appRunning: 'The owning app is running',
    appRunningNamed: '{detail} is running',
    notWritable: 'No permission to modify',
    missingSibling: 'No {detail} found, cannot be rebuilt reproducibly',
    dockerNotRunning: 'Docker is not running — start it to measure this',
    noLockfile: 'No lockfile — could not be reinstalled reproducibly',
    projectActive: 'Project touched {detail} days ago',
    recentlyUsed: 'Used {detail} days ago — too recent to call abandoned'
  },

  blocked: {
    title: 'Blocked by open apps',
    intro: 'These were found but cannot be touched while their app is running.',
    items: '{count} items',
    quit: 'Quit {app}',
    quitting: 'Quitting…',
    gracefulNote:
      'Apps are asked to quit normally, so anything unsaved will prompt you first.'
  },

  systemData: {
    title: "What macOS calls “System Data”",
    explain: "Not a category — a subtraction. macOS labels what it recognises and files everything else here, which is why the Storage screen shows a number and offers nothing to click. Part of it is not even a folder: these are separate APFS volumes sharing the disk.",
    measure: "Measure",
    measuring: "Measuring…",
    outsideData: "{size} of this is outside your data volume. No amount of tidying reaches it.",
    reboot: "Restarting would release {size}",
    rebootWhy: "Swap only grows between reboots — this Mac has been up for {days} days. Nothing is deleted and there is nothing to undo.",
    snapshots: "{count} local Time Machine snapshots. They occupy real space and appear nowhere in the Finder.",
    swap: "swap in use: {used} of {total} allocated",
    sleepImage: "hibernation image: {size}",
    uptime: "up for {days} days without a restart",
    rebootSafe: "Nothing is deleted. macOS releases the swap files on boot and rebuilds them as needed.",
    snapshotsWhy: "Time Machine keeps hourly copies on this disk when the backup drive is away. They occupy real space, appear nowhere in the Finder, and macOS counts them here. Delete them from Terminal:",
    more: "Preboot holds what the Mac needs in order to start and Recovery holds the rescue system — both are reported here and neither is safe to touch. If they look unusually large, a macOS upgrade left payloads behind and the next one normally clears them.",
    note: {
      vm: "swap and the hibernation image",
      preboot: "macOS installer payloads",
      recovery: "recovery system",
      system: "the sealed system volume"
    }
  },

  storage: {
    root: {
      appSupport: 'app data',
      caches: 'cache',
      containers: 'container',
      groupContainers: 'shared container'
    },
    userData: 'Your data — never deleted',
    title: 'Storage',
    subtitle: 'Where your space actually went. Nothing here is deleted.',
    intro:
      'macOS files a 14 GB media library under “Other” and offers no way to look inside. This measures every app directory over 100 MB and names it.',
    measure: 'Analyze storage',
    measuring: 'Measuring…',
    remeasure: 'Measure again',
    summary: '{size} measured in {seconds}s',
    unreadable:
      '{count} folders could not be read without Full Disk Access. They are missing from these totals — and waiting on each refusal is most of what makes this measurement slow.',
    footnote:
      'Reported only. Several of these are irreplaceable user data, so CleanMac will never offer to delete them.'
  },

  fileType: {
    heading: 'By file type',
    analyze: 'Break down by type',
    analyzing: 'Reading files…',
    video: 'Video',
    image: 'Photos',
    audio: 'Voice notes and audio',
    thumbnail: 'Thumbnails (regenerable previews)',
    database: 'Databases',
    document: 'Documents',
    archive: 'Archives',
    other: 'Other'
  },

  large: {
    title: 'Large, untouched files',
    subtitle: 'Over {size}, not modified in {days} days. Reported only — these are your files.',
    search: 'Find them',
    searching: 'Sweeping home…',
    summary: '{count} files · {size} · {scanned} scanned in {seconds}s',
    none: 'Nothing over the threshold. Your home directory is tidy.'
  },

  a11y: {
    skipToContent: 'Skip to content',
    mainNav: 'Main navigation'
  },

  duplicates: {
    title: 'Byte-identical files',
    subtitle: 'Files over {size} with exactly the same contents. Reported only — which copy matters is your call.',
    search: 'Find duplicates',
    searching: 'Comparing…',
    summary: '{groups} groups · up to {size} · {scanned} files seen, {hashed} read, in {seconds}s',
    none: 'No duplicates found.',
    copies: '{count} copies',
    each: 'each',
    hardLinked: 'hard linked',
    upperBound:
      'This is an upper bound. macOS shares blocks between files copied on APFS, and that sharing is invisible to the app — deleting a copy may free less, or nothing.'
  },

  skip: {
    vanished: 'No longer exists',
    modifiedSinceScan: 'Changed since the scan',
    unknownRule: 'Rule no longer available',
    inspectOnly: 'Inspection only',
    failed: 'Failed'
  },

  confirm: {
    title: 'Move {size} to the Trash?',
    body: '{count} items across {groups} categories.',
    reassurance:
      'Everything goes to the Trash. You can put it back from the Finder until you empty it.',
    cancel: 'Cancel',
    confirm: 'Move to Trash'
  },

  result: {
    title: 'Moved {size} to the Trash',
    trashed: '{count} items moved',
    skipped: '{count} skipped',
    failed: '{count} failed',
    whySkipped: 'Skipped items and why',
    emptyTrashPrompt: 'The space is freed once you empty the Trash.',
    emptyTrash: 'Empty Trash ({size})',
    emptyTrashConfirm: 'Empty the Trash? This cannot be undone.',
    undo: 'Undo',
    undone: 'Restored {count} items',
    done: 'Done'
  },

  permission: {
    missing: 'Full Disk Access not granted',
    detail: 'Some folders cannot be analyzed without it, and waiting on each refusal also makes scanning slower.',
    grant: 'Open System Settings',
    dismiss: 'Not now',
    explain:
      'macOS hides other apps’ libraries behind Full Disk Access. Without it CleanMac cannot see Containers, Mail or Safari data. Grant it in System Settings, then reopen the app.',
    restartNeeded: 'Reopen CleanMac after granting access.'
  },

  history: {
    title: 'History',
    subtitle: 'Every cleanup this app has performed.',
    empty: 'No cleanups yet.',
    reclaimed: '{size} reclaimed',
    items: '{count} items',
    restore: 'Restore from Trash',
    restored: 'Restored {restored}, could not restore {failed}'
  },

  settings: {
    updateReady: 'Version {version} is ready — it installs when you quit',
    title: 'Settings',
    language: 'Language',
    languageSystem: 'System',
    threshold: 'Warn me when the disk is above',
    thresholdHint: 'The menu bar shows the percentage only past this point.',
    about: 'About',
    version: 'Version {version}',
    openSource: 'Open source — every rule is auditable.'
  },

  modules: {
    appLeftovers: {
      title: 'Uninstalled app leftovers',
      description: 'Support files for apps no longer on this Mac'
    },
    aiData: {
      title: 'AI apps',
      description: 'VM images, model weights and editor workspace state'
    },
    browsers: {
      title: 'Browsers',
      description: 'Caches only — never cookies, logins or history'
    },
    nodeModules: {
      title: 'node_modules',
      description: 'Dependency folders for projects you have not touched'
    },
    updaterResidue: {
      title: 'Update leftovers',
      description: 'Spent installers from app auto-updaters'
    },
    devCaches: {
      title: 'Developer caches',
      description: 'Package manager and build tool downloads'
    },
    docker: {
      title: 'Docker',
      description: 'Dangling images, stopped containers and build cache'
    },
    system: {
      title: 'System',
      description: 'Logs, saved state, Xcode and device backups'
    }
  },

  rules: {
    appLeftovers: {
      title: 'Files from apps you removed',
      explain:
        'Preferences, caches and containers whose bundle id no installed app claims. Deliberately timid: if any installed app shares the vendor prefix, nothing of theirs is reported at all — vendors ship helpers and daemons with no app of their own.'
    },
    claudeVm: {
      title: 'Claude VM images',
      explain:
        'Virtual machine images for the code sandbox — 6.7 GB on this machine, with no interface anywhere that admits they exist. Re-downloaded on demand, but the download is large.'
    },
    aiCaches: {
      title: 'AI app caches',
      explain: 'Ordinary Electron caches, no different from any other app’s. Rebuilt on next launch.'
    },
    huggingFace: {
      title: 'HuggingFace hub cache',
      explain: 'Downloaded model and dataset files. Re-fetched when a script asks for them again.'
    },
    localModels: {
      title: 'Local model weights',
      explain:
        'Ollama and LM Studio keep an index beside content-addressed blobs; deleting files underneath it leaves the index pointing at nothing. Remove models with `ollama rm <model>` instead.'
    },
    editorWorkspaces: {
      title: 'Orphaned editor workspaces',
      explain:
        'Chat history and indexes for projects that no longer exist on disk. Workspaces whose folder is still present are left completely alone.'
    },
    chromeCache: {
      title: 'Chrome cache',
      explain: 'Downloaded page assets. Chrome rebuilds them as you browse.'
    },
    chromeProfileCaches: {
      title: 'Chrome profile caches',
      explain:
        'Compiled code, GPU shaders and service worker caches held per profile. Cookies, logins, history and bookmarks are never matched by these patterns.'
    },
    safariCache: {
      title: 'Safari cache',
      explain: 'Downloaded page assets. Rebuilt as you browse.'
    },
    firefoxCache: {
      title: 'Firefox cache',
      explain: 'Downloaded page assets. Rebuilt as you browse.'
    },
    staleProfiles: {
      title: 'Unused Chrome profiles',
      explain:
        'A profile holds bookmarks, saved passwords and history. Which of your browser identities is disposable is not this app’s call, so these are reported only.'
    },
    nodeModules: {
      title: 'Dependency folders',
      explain:
        'Rebuilt with one install — but only where a lockfile exists, so the exact tree can be recreated. Projects touched recently, or without a lockfile, are reported and left alone.'
    },
    updaterResidue: {
      title: 'Expired update installers',
      explain:
        'Squirrel.Mac downloads the zip for each update, installs it, and never removes it. One copy piles up per update.'
    },
    packageCaches: {
      title: 'Package manager caches',
      explain:
        'Download and build caches that every toolchain rebuilds on demand. Clearing them costs one slow build, never data.'
    },
    homebrew: {
      title: 'Homebrew downloads',
      explain:
        'Homebrew knows which downloads still back an installed formula, so its own cleanup command is used instead of deleting the folder.'
    },
    docker: {
      title: 'Docker images and build cache',
      explain:
        'Deleting Docker’s files by hand corrupts it, so this runs `docker system prune`. Volumes are left alone — they often hold a development database.'
    },
    logs: {
      title: 'Logs and crash reports',
      explain: 'Diagnostic output no app ever cleans up. Nothing depends on it.'
    },
    savedState: {
      title: 'Saved window state',
      explain:
        'Window positions restored on launch. Clearing them costs a fresh layout next time the app opens.'
    },
    derivedData: {
      title: 'Xcode DerivedData',
      explain:
        'Build intermediates, rebuilt on the next compile. Routinely the largest directory on a machine that has opened Xcode.'
    },
    xcodeArchives: {
      title: 'Xcode archives',
      explain:
        'Release builds you archived. Often the only copy of a shipped binary, so these are reported only.'
    },
    simulators: {
      title: 'iOS simulators',
      explain:
        'Removing a device by hand corrupts CoreSimulator’s index. Reported until CleanMac can drive `simctl` properly.'
    },
    iosBackups: {
      title: 'iPhone and iPad backups',
      explain:
        'Your photos, messages and app data — frequently the only copy in existence. Shown so you know where the space went; never deleted from here.'
    }
  },

  error: { generic: 'Something went wrong: {message}' }
}
