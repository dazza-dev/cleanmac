export default {
  app: { name: 'CleanMac' },

  nav: {
    overview: 'Resumen',
    cleanup: 'Limpieza',
    storage: 'Almacenamiento',
    history: 'Historial',
    settings: 'Ajustes'
  },

  overview: {
    title: 'Resumen',
    yourData: 'Tus datos',
    systemVolumes: 'Volúmenes del sistema',
    free: 'Libre',
    pressure: 'Contenedor al {percent} % de {total}',
    pressureHigh: 'a partir del 85 % macOS empieza a ir lento',
    scan: 'Analizar mi Mac',
    scanning: 'Analizando…',
    rescan: 'Analizar de nuevo',
    reclaimable: 'recuperables',
    nothingFound: 'Nada que limpiar. Tu Mac ya está ordenado.',
    lifetime: 'Has recuperado {total} con CleanMac hasta ahora.'
  },

  scan: {
    found: '{size} encontrados',
    inProgress: 'Analizando…',
    done: 'Análisis completo en {seconds}s',
    viewResults: 'Revisar resultados',
    modules: '{count} módulos'
  },

  cleanup: {
    title: 'Limpieza',
    subtitle: 'Cada ruta se muestra antes de tocar nada.',
    empty: 'Ejecuta un análisis para ver qué se puede recuperar.',
    selected: '{count} seleccionados · {size}',
    clean: 'Mover a la Papelera',
    selectAll: 'Seleccionar todo',
    deselectAll: 'Deseleccionar todo',
    files: '{count} archivos',
    modified: 'modificado {when}',
    reveal: 'Mostrar en Finder',
    shared: '{size} de esto se comparte con otros archivos y no se liberará',
    unreadable: 'No se pudieron leer {count} carpetas',
    blocked: '{size} bloqueados',
    blockedHint: 'Encontrado, pero algo impide borrarlo ahora mismo.',
    regenerates: 'Se volverá a crear cuando haga falta',
    commandPreview: 'Esto ejecuta {command}',
    inspectOnly: 'Solo se informa — CleanMac nunca borra esto'
  },

  risk: {
    none: 'Sin riesgo',
    low: 'Riesgo bajo',
    medium: 'Riesgo medio',
    high: 'Tus datos'
  },

  guard: {
    tooRecent: 'Modificado hace {detail} días — no se toca',
    appRunning: 'La app propietaria está abierta',
    appRunningNamed: '{detail} está abierto',
    notWritable: 'Sin permiso para modificar',
    missingSibling: 'No hay {detail}, no se podría reconstruir de forma reproducible',
    dockerNotRunning: 'Docker no está corriendo — inícialo para poder medirlo',
    noLockfile: 'Sin lockfile — no se podría reinstalar de forma reproducible',
    projectActive: 'Proyecto tocado hace {detail} días',
    recentlyUsed: 'Usado hace {detail} días — demasiado reciente para darlo por abandonado'
  },

  blocked: {
    title: 'Bloqueado por apps abiertas',
    intro: 'Se han encontrado, pero no se pueden tocar mientras su app esté abierta.',
    items: '{count} elementos',
    quit: 'Cerrar {app}',
    quitting: 'Cerrando…',
    gracefulNote:
      'Se les pide que se cierren con normalidad, así que si hay algo sin guardar te preguntarán antes.'
  },

  systemData: {
    title: "Lo que macOS llama “Datos del sistema”",
    explain: "No es una categoría, es una resta. macOS etiqueta lo que reconoce y mete aquí todo lo demás, y por eso la pantalla de Almacenamiento enseña un número sin nada donde pulsar. Parte de esto ni siquiera es una carpeta: son volúmenes APFS aparte que comparten el disco.",
    measure: "Medir",
    measuring: "Midiendo…",
    outsideData: "{size} de esto está fuera de tu volumen de datos. No hay carpeta que ordenar que lo toque.",
    reboot: "Reiniciar liberaría {size}",
    rebootWhy: "El swap solo crece entre reinicios, y este Mac lleva {days} días encendido. No se borra nada y no hay nada que deshacer.",
    snapshots: "{count} instantáneas locales de Time Machine. Ocupan espacio real y no aparecen en ninguna parte del Finder.",
    swap: "swap en uso: {used} de {total} reservados",
    sleepImage: "imagen de hibernación: {size}",
    uptime: "{days} días encendido sin reiniciar",
    rebootSafe: "No se borra nada. macOS libera los archivos de swap al arrancar y los vuelve a crear cuando hacen falta.",
    snapshotsWhy: "Time Machine guarda copias horarias en este disco cuando el disco de respaldo no está. Ocupan espacio real, no aparecen en ninguna parte del Finder, y macOS las cuenta aquí. Se borran desde la Terminal:",
    more: "Preboot contiene lo que el Mac necesita para arrancar y Recovery el sistema de rescate — se muestran aquí y ninguno se puede tocar. Si se ven anormalmente grandes, una actualización de macOS dejó payloads atrás y la siguiente suele limpiarlos.",
    note: {
      vm: "swap e imagen de hibernación",
      preboot: "payloads de instalación de macOS",
      recovery: "sistema de recuperación",
      system: "volumen de sistema sellado"
    }
  },

  storage: {
    root: {
      appSupport: 'datos de la app',
      caches: 'caché',
      containers: 'contenedor',
      groupContainers: 'contenedor compartido'
    },
    userData: 'Tus datos — nunca se borran',
    title: 'Almacenamiento',
    subtitle: 'Dónde se fue tu espacio de verdad. Aquí no se borra nada.',
    intro:
      'macOS mete 14 GB de fotos y vídeos en «Otros» y no te deja mirar dentro. Esto mide cada carpeta de app por encima de 100 MB y le pone nombre.',
    measure: 'Analizar almacenamiento',
    measuring: 'Midiendo…',
    remeasure: 'Volver a medir',
    summary: '{size} medidos en {seconds} s',
    unreadable:
      'No se pudieron leer {count} carpetas sin Acceso Total al Disco. Faltan en estos totales — y esperar a cada denegación es la mayor parte de lo que hace lenta esta medición.',
    footnote:
      'Solo informativo. Varias de estas carpetas son datos tuyos irreemplazables, así que CleanMac nunca ofrecerá borrarlas.'
  },

  fileType: {
    heading: 'Por tipo de archivo',
    analyze: 'Desglosar por tipo',
    analyzing: 'Leyendo archivos…',
    video: 'Vídeo',
    image: 'Fotos',
    audio: 'Notas de voz y audio',
    thumbnail: 'Miniaturas (previsualizaciones regenerables)',
    database: 'Bases de datos',
    document: 'Documentos',
    archive: 'Archivos comprimidos',
    other: 'Otros'
  },

  large: {
    title: 'Archivos grandes sin tocar',
    subtitle: 'Más de {size}, sin modificar en {days} días. Solo informativo — son tuyos.',
    search: 'Buscarlos',
    searching: 'Recorriendo tu carpeta…',
    summary: '{count} archivos · {size} · {scanned} revisados en {seconds} s',
    none: 'Nada por encima del umbral. Tu carpeta personal está ordenada.'
  },

  a11y: {
    skipToContent: 'Saltar al contenido',
    mainNav: 'Navegación principal'
  },

  duplicates: {
    title: 'Archivos idénticos',
    subtitle: 'Archivos de más de {size} con exactamente el mismo contenido. Solo informativo — qué copia importa lo decides tú.',
    search: 'Buscar duplicados',
    searching: 'Comparando…',
    summary: '{groups} grupos · hasta {size} · {scanned} archivos vistos, {hashed} leídos, en {seconds} s',
    none: 'No se encontraron duplicados.',
    copies: '{count} copias',
    each: 'cada una',
    hardLinked: 'enlace duro',
    upperBound:
      'Esto es un máximo, no una promesa. macOS comparte bloques entre archivos copiados en APFS y ese reparto es invisible para la app — borrar una copia puede liberar menos, o nada.'
  },

  skip: {
    vanished: 'Ya no existe',
    modifiedSinceScan: 'Cambió desde el análisis',
    unknownRule: 'La regla ya no está disponible',
    inspectOnly: 'Solo inspección',
    failed: 'Falló'
  },

  confirm: {
    title: '¿Mover {size} a la Papelera?',
    body: '{count} elementos de {groups} categorías.',
    reassurance:
      'Todo va a la Papelera. Puedes recuperarlo desde el Finder hasta que la vacíes.',
    cancel: 'Cancelar',
    confirm: 'Mover a la Papelera'
  },

  result: {
    title: 'Se movieron {size} a la Papelera',
    trashed: '{count} elementos movidos',
    skipped: '{count} omitidos',
    failed: '{count} fallidos',
    whySkipped: 'Elementos omitidos y por qué',
    emptyTrashPrompt: 'El espacio se libera cuando vacíes la Papelera.',
    emptyTrash: 'Vaciar Papelera ({size})',
    emptyTrashConfirm: '¿Vaciar la Papelera? Esto no se puede deshacer.',
    undo: 'Deshacer',
    undone: 'Se restauraron {count} elementos',
    done: 'Hecho'
  },

  permission: {
    missing: 'Acceso Total al Disco no concedido',
    detail: 'Algunas carpetas no se pueden analizar sin él, y esperar a cada denegación además ralentiza el análisis.',
    grant: 'Abrir Ajustes del Sistema',
    dismiss: 'Ahora no',
    explain:
      'macOS esconde las bibliotecas de otras apps tras el Acceso Total al Disco. Sin él, CleanMac no puede ver Containers, Mail ni datos de Safari. Concédelo en Ajustes del Sistema y vuelve a abrir la app.',
    restartNeeded: 'Vuelve a abrir CleanMac después de conceder el acceso.'
  },

  history: {
    title: 'Historial',
    subtitle: 'Todas las limpiezas que ha hecho esta app.',
    empty: 'Todavía no hay limpiezas.',
    reclaimed: '{size} recuperados',
    items: '{count} elementos',
    restore: 'Restaurar desde la Papelera',
    restored: 'Se restauraron {restored}, no se pudieron restaurar {failed}'
  },

  settings: {
    updateReady: 'La versión {version} está lista — se instala al salir',
    title: 'Ajustes',
    language: 'Idioma',
    languageSystem: 'Sistema',
    threshold: 'Avisarme cuando el disco supere',
    thresholdHint: 'La barra de menús solo muestra el porcentaje a partir de aquí.',
    about: 'Acerca de',
    version: 'Versión {version}',
    openSource: 'Código abierto — cada regla es auditable.'
  },

  modules: {
    appLeftovers: {
      title: 'Restos de apps desinstaladas',
      description: 'Archivos de apps que ya no están en este Mac'
    },
    aiData: {
      title: 'Apps de IA',
      description: 'Imágenes de VM, modelos y estado de workspace de editores'
    },
    browsers: {
      title: 'Navegadores',
      description: 'Solo caches — nunca cookies, sesiones ni historial'
    },
    nodeModules: {
      title: 'node_modules',
      description: 'Dependencias de proyectos que no has tocado'
    },
    updaterResidue: {
      title: 'Restos de actualizaciones',
      description: 'Instaladores caducados de los auto-updaters'
    },
    devCaches: {
      title: 'Caches de desarrollo',
      description: 'Descargas de gestores de paquetes y herramientas de build'
    },
    docker: {
      title: 'Docker',
      description: 'Imágenes colgantes, contenedores parados y cache de build'
    },
    system: {
      title: 'Sistema',
      description: 'Logs, estado guardado, Xcode y backups de dispositivos'
    }
  },

  rules: {
    appLeftovers: {
      title: 'Archivos de apps que quitaste',
      explain:
        'Preferencias, caches y contenedores cuyo bundle id no reclama ninguna app instalada. Deliberadamente tímido: si alguna app instalada comparte el prefijo del fabricante, no se informa nada suyo — los fabricantes traen helpers y daemons sin app propia.'
    },
    claudeVm: {
      title: 'Imágenes de VM de Claude',
      explain:
        'Imágenes de máquina virtual del sandbox de código — 6.7 GB en este equipo, sin ninguna interfaz que admita que existen. Se vuelven a descargar cuando hacen falta, pero la descarga es grande.'
    },
    aiCaches: {
      title: 'Caches de apps de IA',
      explain: 'Caches de Electron corrientes, iguales a los de cualquier otra app. Se rehacen al abrirla.'
    },
    huggingFace: {
      title: 'Cache del hub de HuggingFace',
      explain: 'Modelos y datasets descargados. Se vuelven a bajar cuando un script los pide otra vez.'
    },
    localModels: {
      title: 'Modelos locales',
      explain:
        'Ollama y LM Studio mantienen un índice junto a blobs direccionados por contenido; borrar archivos por debajo deja el índice apuntando a nada. Usa `ollama rm <modelo>` en su lugar.'
    },
    editorWorkspaces: {
      title: 'Workspaces huérfanos de editores',
      explain:
        'Historial de chat e índices de proyectos que ya no existen en disco. Los workspaces cuya carpeta sigue ahí no se tocan en absoluto.'
    },
    chromeCache: {
      title: 'Cache de Chrome',
      explain: 'Recursos de páginas descargados. Chrome los rehace mientras navegas.'
    },
    chromeProfileCaches: {
      title: 'Caches de perfil de Chrome',
      explain:
        'Código compilado, shaders de GPU y caches de service worker por perfil. Cookies, sesiones, historial y marcadores no encajan con ninguno de estos patrones.'
    },
    safariCache: {
      title: 'Cache de Safari',
      explain: 'Recursos de páginas descargados. Se rehacen mientras navegas.'
    },
    firefoxCache: {
      title: 'Cache de Firefox',
      explain: 'Recursos de páginas descargados. Se rehacen mientras navegas.'
    },
    staleProfiles: {
      title: 'Perfiles de Chrome sin usar',
      explain:
        'Un perfil guarda marcadores, contraseñas e historial. Decidir cuál de tus identidades de navegador sobra no le toca a esta app, así que solo se informa.'
    },
    nodeModules: {
      title: 'Carpetas de dependencias',
      explain:
        'Se rehacen con un install — pero solo donde hay lockfile, para poder recrear el árbol exacto. Los proyectos tocados hace poco, o sin lockfile, se informan y no se tocan.'
    },
    updaterResidue: {
      title: 'Instaladores de actualización caducados',
      explain:
        'Squirrel.Mac descarga el zip de cada actualización, la instala y nunca lo borra. Se acumula una copia por actualización.'
    },
    packageCaches: {
      title: 'Caches de gestores de paquetes',
      explain:
        'Caches de descarga y compilación que cualquier toolchain reconstruye sola. Borrarlas cuesta un build lento, nunca datos.'
    },
    homebrew: {
      title: 'Descargas de Homebrew',
      explain:
        'Homebrew sabe qué descargas siguen respaldando una fórmula instalada, así que se usa su propio comando de limpieza en vez de borrar la carpeta.'
    },
    docker: {
      title: 'Imágenes y cache de build de Docker',
      explain:
        'Borrar los archivos de Docker a mano lo corrompe, así que se ejecuta `docker system prune`. Los volúmenes no se tocan: suelen contener una base de datos de desarrollo.'
    },
    logs: {
      title: 'Logs e informes de fallo',
      explain: 'Salida de diagnóstico que ninguna app limpia nunca. Nada depende de ella.'
    },
    savedState: {
      title: 'Estado de ventanas guardado',
      explain:
        'Posiciones de ventana que se restauran al abrir. Borrarlas cuesta una disposición nueva la próxima vez.'
    },
    derivedData: {
      title: 'DerivedData de Xcode',
      explain:
        'Intermedios de compilación que se rehacen al siguiente build. Suele ser el directorio más grande en un Mac que haya abierto Xcode.'
    },
    xcodeArchives: {
      title: 'Archivos de Xcode',
      explain:
        'Builds de release que archivaste. A menudo la única copia de un binario publicado, así que solo se informa.'
    },
    simulators: {
      title: 'Simuladores de iOS',
      explain:
        'Borrar un dispositivo a mano corrompe el índice de CoreSimulator. Solo se informa hasta que CleanMac use `simctl` correctamente.'
    },
    iosBackups: {
      title: 'Backups de iPhone y iPad',
      explain:
        'Tus fotos, mensajes y datos de apps — con frecuencia la única copia que existe. Se muestran para que sepas dónde está el espacio; desde aquí nunca se borran.'
    }
  },

  error: { generic: 'Algo ha fallado: {message}' }
}
