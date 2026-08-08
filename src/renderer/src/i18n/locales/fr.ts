export default {
  app: { name: 'CleanMac' },

  nav: {
    overview: 'Aperçu',
    cleanup: 'Nettoyage',
    storage: 'Stockage',
    history: 'Historique',
    settings: 'Réglages'
  },

  overview: {
    title: 'Aperçu',
    yourData: 'Vos données',
    systemVolumes: 'Volumes système',
    free: 'Libre',
    pressure: 'Conteneur rempli à {percent}% sur {total}',
    pressureHigh: 'au-delà de 85%, macOS commence à ralentir',
    scan: 'Analyser mon Mac',
    scanning: 'Analyse…',
    rescan: 'Analyser à nouveau',
    reclaimable: 'récupérables',
    nothingFound: 'Rien à nettoyer. Votre Mac est déjà en ordre.',
    lifetime: 'Vous avez récupéré {total} avec CleanMac jusqu’ici.'
  },

  scan: {
    found: '{size} trouvés',
    inProgress: 'Analyse…',
    done: 'Analyse terminée en {seconds}s',
    viewResults: 'Voir les résultats',
    modules: '{count} modules'
  },

  cleanup: {
    title: 'Nettoyage',
    subtitle: 'Chaque chemin est affiché avant toute action.',
    empty: 'Lancez une analyse pour voir ce qui peut être récupéré.',
    selected: '{count} sélectionnés · {size}',
    clean: 'Mettre à la Corbeille',
    selectAll: 'Tout sélectionner',
    deselectAll: 'Tout désélectionner',
    files: '{count} fichiers',
    modified: 'modifié {when}',
    reveal: 'Afficher dans le Finder',
    shared: '{size} de ceci est partagé avec d’autres fichiers et ne sera pas libéré',
    unreadable: '{count} dossiers n’ont pas pu être lus',
    blocked: '{size} bloqués',
    blockedHint: 'Trouvé, mais quelque chose empêche sa suppression pour l’instant.',
    regenerates: 'Sera recréé au besoin',
    commandPreview: 'Ceci exécute {command}',
    inspectOnly: 'Signalé uniquement — CleanMac ne supprime jamais ceci'
  },

  risk: {
    none: 'Aucun risque',
    low: 'Risque faible',
    medium: 'Risque moyen',
    high: 'Vos données'
  },

  guard: {
    tooRecent: 'Modifié il y a {detail} jours — laissé tel quel',
    appRunning: 'L’application propriétaire est ouverte',
    appRunningNamed: '{detail} est ouvert',
    notWritable: 'Pas la permission de modifier',
    missingSibling: 'Aucun {detail} trouvé, reconstruction non reproductible',
    dockerNotRunning: 'Docker n’est pas lancé — démarrez-le pour mesurer',
    noLockfile: 'Aucun lockfile — réinstallation non reproductible',
    projectActive: 'Projet modifié il y a {detail} jours',
    recentlyUsed: 'Utilisé il y a {detail} jours — trop récent pour être abandonné'
  },

  blocked: {
    title: 'Bloqué par des apps ouvertes',
    intro: 'Trouvés, mais intouchables tant que leur application est ouverte.',
    items: '{count} éléments',
    quit: 'Quitter {app}',
    quitting: 'Fermeture…',
    gracefulNote:
      'Les apps sont invitées à quitter normalement : tout travail non enregistré vous sera signalé.'
  },

  systemData: {
    title: "Ce que macOS appelle « Données système »",
    explain: "Ce n'est pas une catégorie, c'est une soustraction. macOS étiquette ce qu'il reconnaît et range tout le reste ici, d'où un écran de Stockage qui affiche un chiffre sans rien à cliquer. Une partie n'est même pas un dossier : ce sont des volumes APFS distincts qui partagent le disque.",
    measure: "Mesurer",
    measuring: "Mesure…",
    outsideData: "{size} se trouve hors de votre volume de données. Aucun rangement de dossiers ne peut y toucher.",
    reboot: "Redémarrer libérerait {size}",
    rebootWhy: "Le swap ne fait que croître entre les redémarrages, et ce Mac est allumé depuis {days} jours. Rien n'est supprimé et il n'y a rien à annuler.",
    snapshots: "{count} instantanés locaux Time Machine. Ils occupent un espace réel et n'apparaissent nulle part dans le Finder.",
    swap: "swap utilisé : {used} sur {total} alloués",
    sleepImage: "image d'hibernation : {size}",
    uptime: "{days} jours allumé sans redémarrage",
    rebootSafe: "Rien n'est supprimé. macOS libère les fichiers de swap au démarrage et les recrée au besoin.",
    snapshotsWhy: "Time Machine conserve des copies horaires sur ce disque quand le disque de sauvegarde est absent. Elles occupent un espace réel, n'apparaissent nulle part dans le Finder, et macOS les compte ici. Supprimez-les depuis le Terminal :",
    more: "Preboot contient ce dont le Mac a besoin pour démarrer et Recovery le système de secours — les deux sont affichés ici et aucun ne doit être touché. S'ils paraissent anormalement gros, une mise à jour de macOS a laissé des charges derrière elle et la suivante les nettoie en général.",
    note: {
      vm: "swap et image d'hibernation",
      preboot: "charges d'installation de macOS",
      recovery: "système de récupération",
      system: "volume système scellé"
    }
  },

  storage: {
    root: {
      appSupport: 'données de l’app',
      caches: 'cache',
      containers: 'conteneur',
      groupContainers: 'conteneur partagé'
    },
    userData: 'Vos données — jamais supprimées',
    title: 'Stockage',
    subtitle: 'Où votre espace est réellement passé. Rien n’est supprimé ici.',
    intro:
      'macOS range 14 Go de photos et vidéos dans « Autre » sans permettre d’y regarder. Ceci mesure chaque dossier d’app au-delà de 100 Mo et le nomme.',
    measure: 'Analyser le stockage',
    measuring: 'Mesure…',
    remeasure: 'Mesurer à nouveau',
    summary: '{size} mesurés en {seconds} s',
    unreadable:
      '{count} dossiers illisibles sans Accès complet au disque. Absents de ces totaux — et attendre chaque refus est l’essentiel de ce qui ralentit cette mesure.',
    footnote:
      'Signalé uniquement. Plusieurs de ces dossiers sont des données irremplaçables ; CleanMac ne proposera jamais de les supprimer.'
  },

  fileType: {
    heading: 'Par type de fichier',
    analyze: 'Détailler par type',
    analyzing: 'Lecture des fichiers…',
    video: 'Vidéo',
    image: 'Photos',
    audio: 'Notes vocales et audio',
    thumbnail: 'Miniatures (aperçus régénérables)',
    database: 'Bases de données',
    document: 'Documents',
    archive: 'Archives',
    other: 'Autres'
  },

  large: {
    title: 'Gros fichiers inutilisés',
    subtitle: 'Au-delà de {size}, non modifiés depuis {days} jours. Signalés seulement — ce sont les vôtres.',
    search: 'Les trouver',
    searching: 'Parcours du dossier personnel…',
    summary: '{count} fichiers · {size} · {scanned} examinés en {seconds} s',
    none: 'Rien au-dessus du seuil. Votre dossier personnel est en ordre.'
  },

  a11y: {
    skipToContent: 'Aller au contenu',
    mainNav: 'Navigation principale'
  },

  duplicates: {
    title: 'Fichiers identiques',
    subtitle: 'Fichiers de plus de {size} au contenu strictement identique. Signalés seulement — quelle copie compte, c’est à vous.',
    search: 'Chercher les doublons',
    searching: 'Comparaison…',
    summary: '{groups} groupes · jusqu’à {size} · {scanned} fichiers vus, {hashed} lus, en {seconds} s',
    none: 'Aucun doublon trouvé.',
    copies: '{count} copies',
    each: 'chacune',
    hardLinked: 'lien physique',
    upperBound:
      'C’est un maximum, pas une promesse. macOS partage des blocs entre fichiers copiés sur APFS, et ce partage est invisible pour l’app — supprimer une copie peut libérer moins, voire rien.'
  },

  skip: {
    vanished: 'N’existe plus',
    modifiedSinceScan: 'Modifié depuis l’analyse',
    unknownRule: 'Règle indisponible',
    inspectOnly: 'Inspection seule',
    failed: 'Échec'
  },

  confirm: {
    title: 'Déplacer {size} vers la Corbeille ?',
    body: '{count} éléments dans {groups} catégories.',
    reassurance:
      'Tout va à la Corbeille. Vous pouvez les remettre depuis le Finder tant qu’elle n’est pas vidée.',
    cancel: 'Annuler',
    confirm: 'Mettre à la Corbeille'
  },

  result: {
    title: '{size} déplacés vers la Corbeille',
    trashed: '{count} éléments déplacés',
    skipped: '{count} ignorés',
    failed: '{count} en échec',
    whySkipped: 'Éléments ignorés et pourquoi',
    emptyTrashPrompt: 'L’espace est libéré une fois la Corbeille vidée.',
    emptyTrash: 'Vider la Corbeille ({size})',
    emptyTrashConfirm: 'Vider la Corbeille ? Action irréversible.',
    undo: 'Annuler',
    undone: '{count} éléments restaurés',
    done: 'Terminé'
  },

  permission: {
    missing: 'Accès complet au disque non accordé',
    detail: 'Certains dossiers ne peuvent pas être analysés sans lui, et attendre chaque refus ralentit aussi l’analyse.',
    grant: 'Ouvrir les Réglages Système',
    dismiss: 'Pas maintenant',
    explain:
      'macOS masque les bibliothèques des autres apps derrière l’Accès complet au disque. Sans lui, CleanMac ne voit ni Containers, ni Mail, ni les données Safari. Accordez-le dans les Réglages Système, puis rouvrez l’app.',
    restartNeeded: 'Rouvrez CleanMac après avoir accordé l’accès.'
  },

  history: {
    title: 'Historique',
    subtitle: 'Tous les nettoyages effectués par cette app.',
    empty: 'Aucun nettoyage pour l’instant.',
    reclaimed: '{size} récupérés',
    items: '{count} éléments',
    restore: 'Restaurer depuis la Corbeille',
    restored: '{restored} restaurés, {failed} non restaurés'
  },

  settings: {
    updateReady: 'La version {version} est prête — elle s’installe en quittant',
    title: 'Réglages',
    language: 'Langue',
    languageSystem: 'Système',
    threshold: 'M’avertir quand le disque dépasse',
    thresholdHint: 'La barre des menus n’affiche le pourcentage qu’au-delà.',
    about: 'À propos',
    version: 'Version {version}',
    openSource: 'Open source — chaque règle est auditable.'
  },

  modules: {
    appLeftovers: {
      title: 'Restes d’apps désinstallées',
      description: 'Fichiers d’apps qui ne sont plus sur ce Mac'
    },
    aiData: {
      title: 'Apps d’IA',
      description: 'Images de VM, modèles et état des espaces de travail'
    },
    browsers: {
      title: 'Navigateurs',
      description: 'Caches uniquement — jamais cookies, sessions ni historique'
    },
    nodeModules: {
      title: 'node_modules',
      description: 'Dépendances de projets auxquels vous n’avez pas touché'
    },
    updaterResidue: {
      title: 'Restes de mises à jour',
      description: 'Installateurs périmés des auto-updaters'
    },
    devCaches: {
      title: 'Caches de développement',
      description: 'Téléchargements des gestionnaires de paquets et outils de build'
    },
    docker: {
      title: 'Docker',
      description: 'Images orphelines, conteneurs arrêtés et cache de build'
    },
    system: {
      title: 'Système',
      description: 'Journaux, état enregistré, Xcode et sauvegardes d’appareils'
    }
  },

  rules: {
    appLeftovers: {
      title: 'Fichiers d’apps supprimées',
      explain:
        'Préférences, caches et conteneurs dont l’identifiant n’est revendiqué par aucune app installée. Volontairement timide : si une app installée partage le préfixe éditeur, rien de cet éditeur n’est signalé — ils livrent des helpers et démons sans app propre.'
    },
    claudeVm: {
      title: 'Images de VM de Claude',
      explain:
        'Images de machine virtuelle du bac à sable de code — 6,7 Go sur cette machine, sans aucune interface qui admette leur existence. Retéléchargées au besoin, mais le téléchargement est lourd.'
    },
    aiCaches: {
      title: 'Caches des apps d’IA',
      explain: 'Caches Electron ordinaires, comme ceux de n’importe quelle app. Reconstruits au lancement.'
    },
    huggingFace: {
      title: 'Cache du hub HuggingFace',
      explain: 'Modèles et jeux de données téléchargés. Récupérés à nouveau si un script les redemande.'
    },
    localModels: {
      title: 'Modèles locaux',
      explain:
        'Ollama et LM Studio tiennent un index à côté de blobs adressés par contenu ; supprimer des fichiers en dessous laisse l’index pointer dans le vide. Utilisez `ollama rm <modèle>`.'
    },
    editorWorkspaces: {
      title: 'Espaces de travail orphelins',
      explain:
        'Historique de conversation et index de projets qui n’existent plus sur le disque. Ceux dont le dossier existe encore ne sont pas touchés.'
    },
    chromeCache: {
      title: 'Cache de Chrome',
      explain: 'Ressources de pages téléchargées. Chrome les reconstruit au fil de la navigation.'
    },
    chromeProfileCaches: {
      title: 'Caches de profil Chrome',
      explain:
        'Code compilé, shaders GPU et caches de service worker par profil. Cookies, sessions, historique et favoris ne correspondent jamais à ces motifs.'
    },
    safariCache: {
      title: 'Cache de Safari',
      explain: 'Ressources de pages téléchargées. Reconstruites au fil de la navigation.'
    },
    firefoxCache: {
      title: 'Cache de Firefox',
      explain: 'Ressources de pages téléchargées. Reconstruites au fil de la navigation.'
    },
    staleProfiles: {
      title: 'Profils Chrome inutilisés',
      explain:
        'Un profil contient favoris, mots de passe et historique. Décider laquelle de vos identités est jetable n’appartient pas à cette app : signalés uniquement.'
    },
    nodeModules: {
      title: 'Dossiers de dépendances',
      explain:
        'Reconstruits par un install — mais seulement là où un lockfile existe, pour recréer l’arbre exact. Les projets récents ou sans lockfile sont signalés et laissés tels quels.'
    },
    updaterResidue: {
      title: 'Installateurs de mise à jour périmés',
      explain:
        'Squirrel.Mac télécharge le zip de chaque mise à jour, l’installe et ne le supprime jamais. Une copie s’accumule par mise à jour.'
    },
    packageCaches: {
      title: 'Caches des gestionnaires de paquets',
      explain:
        'Caches de téléchargement et de build que toute chaîne d’outils reconstruit d’elle-même. Les vider coûte un build lent, jamais des données.'
    },
    homebrew: {
      title: 'Téléchargements Homebrew',
      explain:
        'Homebrew sait quels téléchargements soutiennent encore une formule installée ; sa propre commande de nettoyage est donc utilisée plutôt qu’une suppression du dossier.'
    },
    docker: {
      title: 'Images et cache de build Docker',
      explain:
        'Supprimer les fichiers de Docker à la main le corrompt ; on lance donc `docker system prune`. Les volumes sont épargnés : ils contiennent souvent une base de développement.'
    },
    logs: {
      title: 'Journaux et rapports d’incident',
      explain: 'Sortie de diagnostic qu’aucune app ne nettoie. Rien n’en dépend.'
    },
    savedState: {
      title: 'État des fenêtres enregistré',
      explain:
        'Positions de fenêtres restaurées au lancement. Les effacer coûte une nouvelle disposition la prochaine fois.'
    },
    derivedData: {
      title: 'DerivedData de Xcode',
      explain:
        'Intermédiaires de compilation, reconstruits au build suivant. Souvent le plus gros dossier d’un Mac ayant ouvert Xcode.'
    },
    xcodeArchives: {
      title: 'Archives Xcode',
      explain:
        'Builds de publication archivés. Souvent l’unique copie d’un binaire livré : signalés uniquement.'
    },
    simulators: {
      title: 'Simulateurs iOS',
      explain:
        'Supprimer un appareil à la main corrompt l’index de CoreSimulator. Signalé jusqu’à ce que CleanMac pilote `simctl` correctement.'
    },
    iosBackups: {
      title: 'Sauvegardes iPhone et iPad',
      explain:
        'Vos photos, messages et données d’apps — souvent l’unique copie existante. Affichées pour situer l’espace ; jamais supprimées d’ici.'
    }
  },

  error: { generic: 'Une erreur est survenue : {message}' }
}
