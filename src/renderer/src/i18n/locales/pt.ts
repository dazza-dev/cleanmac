export default {
  app: { name: 'CleanMac' },

  nav: {
    overview: 'Resumo',
    cleanup: 'Limpeza',
    storage: 'Armazenamento',
    history: 'Histórico',
    settings: 'Definições'
  },

  overview: {
    title: 'Resumo',
    yourData: 'Os seus dados',
    systemVolumes: 'Volumes do sistema',
    free: 'Livre',
    pressure: 'Contentor a {percent}% de {total}',
    pressureHigh: 'acima de 85% o macOS começa a ficar lento',
    scan: 'Analisar o meu Mac',
    scanning: 'A analisar…',
    rescan: 'Analisar de novo',
    reclaimable: 'recuperáveis',
    nothingFound: 'Nada para limpar. O seu Mac já está arrumado.',
    lifetime: 'Já recuperou {total} com o CleanMac.'
  },

  scan: {
    found: '{size} encontrados',
    inProgress: 'A analisar…',
    done: 'Análise concluída em {seconds}s',
    viewResults: 'Rever resultados',
    modules: '{count} módulos'
  },

  cleanup: {
    title: 'Limpeza',
    subtitle: 'Cada caminho é mostrado antes de se tocar em algo.',
    empty: 'Execute uma análise para ver o que pode ser recuperado.',
    selected: '{count} selecionados · {size}',
    clean: 'Mover para o Lixo',
    selectAll: 'Selecionar tudo',
    deselectAll: 'Desselecionar tudo',
    files: '{count} ficheiros',
    modified: 'modificado {when}',
    reveal: 'Mostrar no Finder',
    shared: '{size} disto é partilhado com outros ficheiros e não será libertado',
    unreadable: 'Não foi possível ler {count} pastas',
    blocked: '{size} bloqueados',
    blockedHint: 'Encontrado, mas algo impede que seja removido agora.',
    regenerates: 'Será recriado quando necessário',
    commandPreview: 'Isto executa {command}',
    inspectOnly: 'Apenas informativo — o CleanMac nunca apaga isto'
  },

  risk: {
    none: 'Sem risco',
    low: 'Risco baixo',
    medium: 'Risco médio',
    high: 'Os seus dados'
  },

  guard: {
    tooRecent: 'Alterado há {detail} dias — não se toca',
    appRunning: 'A aplicação proprietária está aberta',
    appRunningNamed: '{detail} está aberto',
    notWritable: 'Sem permissão para modificar',
    missingSibling: 'Não há {detail}, não poderia ser reconstruído de forma reprodutível',
    dockerNotRunning: 'O Docker não está a correr — inicie-o para poder medir',
    noLockfile: 'Sem lockfile — não poderia ser reinstalado de forma reprodutível',
    projectActive: 'Projeto tocado há {detail} dias',
    recentlyUsed: 'Usado há {detail} dias — demasiado recente para dar como abandonado'
  },

  blocked: {
    title: 'Bloqueado por apps abertas',
    intro: 'Foram encontrados, mas não podem ser tocados enquanto a app estiver aberta.',
    items: '{count} itens',
    quit: 'Fechar o {app}',
    quitting: 'A fechar…',
    gracefulNote:
      'Pede-se que fechem normalmente, por isso se houver algo por guardar será perguntado primeiro.'
  },

  systemData: {
    title: "O que o macOS chama de “Dados do sistema”",
    explain: "Não é uma categoria, é uma subtração. O macOS rotula o que reconhece e joga todo o resto aqui, por isso a tela de Armazenamento mostra um número sem nada em que clicar. Parte disso nem é uma pasta: são volumes APFS separados dividindo o disco.",
    measure: "Medir",
    measuring: "Medindo…",
    outsideData: "{size} disso está fora do seu volume de dados. Nenhuma arrumação de pastas alcança isso.",
    reboot: "Reiniciar liberaria {size}",
    rebootWhy: "O swap só cresce entre reinicializações, e este Mac está ligado há {days} dias. Nada é apagado e não há nada a desfazer.",
    snapshots: "{count} snapshots locais do Time Machine. Ocupam espaço real e não aparecem em lugar nenhum do Finder.",
    swap: "swap em uso: {used} de {total} reservados",
    sleepImage: "imagem de hibernação: {size}",
    uptime: "{days} dias ligado sem reiniciar",
    rebootSafe: "Nada é apagado. O macOS libera os arquivos de swap ao iniciar e os recria quando necessário.",
    snapshotsWhy: "O Time Machine guarda cópias de hora em hora neste disco quando o disco de backup não está presente. Ocupam espaço real, não aparecem em lugar nenhum do Finder, e o macOS as conta aqui. Apague-as pelo Terminal:",
    more: "O Preboot contém o que o Mac precisa para iniciar e o Recovery o sistema de resgate — ambos são mostrados aqui e nenhum pode ser tocado. Se parecerem grandes demais, uma atualização do macOS deixou payloads para trás e a próxima costuma limpá-los.",
    note: {
      vm: "swap e imagem de hibernação",
      preboot: "payloads de instalação do macOS",
      recovery: "sistema de recuperação",
      system: "volume de sistema selado"
    }
  },

  storage: {
    root: {
      appSupport: 'dados da app',
      caches: 'cache',
      containers: 'contentor',
      groupContainers: 'contentor partilhado'
    },
    userData: 'Os seus dados — nunca apagados',
    title: 'Armazenamento',
    subtitle: 'Onde o seu espaço foi parar. Aqui não se apaga nada.',
    intro:
      'O macOS mete 14 GB de fotos e vídeos em «Outros» e não deixa ver lá dentro. Isto mede cada pasta de app acima de 100 MB e dá-lhe um nome.',
    measure: 'Analisar armazenamento',
    measuring: 'A medir…',
    remeasure: 'Medir de novo',
    summary: '{size} medidos em {seconds} s',
    unreadable:
      'Não foi possível ler {count} pastas sem Acesso Total ao Disco. Faltam nestes totais — e esperar por cada recusa é a maior parte do que torna esta medição lenta.',
    footnote:
      'Apenas informativo. Várias destas pastas são dados seus insubstituíveis, por isso o CleanMac nunca oferecerá apagá-las.'
  },

  fileType: {
    heading: 'Por tipo de ficheiro',
    analyze: 'Detalhar por tipo',
    analyzing: 'A ler ficheiros…',
    video: 'Vídeo',
    image: 'Fotos',
    audio: 'Notas de voz e áudio',
    thumbnail: 'Miniaturas (pré-visualizações regeneráveis)',
    database: 'Bases de dados',
    document: 'Documentos',
    archive: 'Arquivos',
    other: 'Outros'
  },

  large: {
    title: 'Ficheiros grandes sem uso',
    subtitle: 'Acima de {size}, sem alterações há {days} dias. Apenas informativo — são seus.',
    search: 'Procurar',
    searching: 'A percorrer a sua pasta…',
    summary: '{count} ficheiros · {size} · {scanned} verificados em {seconds} s',
    none: 'Nada acima do limite. A sua pasta pessoal está arrumada.'
  },

  a11y: {
    skipToContent: 'Saltar para o conteúdo',
    mainNav: 'Navegação principal'
  },

  duplicates: {
    title: 'Ficheiros idênticos',
    subtitle: 'Ficheiros acima de {size} com exatamente o mesmo conteúdo. Apenas informativo — qual cópia importa é consigo.',
    search: 'Procurar duplicados',
    searching: 'A comparar…',
    summary: '{groups} grupos · até {size} · {scanned} ficheiros vistos, {hashed} lidos, em {seconds} s',
    none: 'Não foram encontrados duplicados.',
    copies: '{count} cópias',
    each: 'cada',
    hardLinked: 'ligação fixa',
    upperBound:
      'Isto é um máximo, não uma promessa. O macOS partilha blocos entre ficheiros copiados em APFS e essa partilha é invisível para a app — apagar uma cópia pode libertar menos, ou nada.'
  },

  skip: {
    vanished: 'Já não existe',
    modifiedSinceScan: 'Mudou desde a análise',
    unknownRule: 'A regra já não está disponível',
    inspectOnly: 'Apenas inspeção',
    failed: 'Falhou'
  },

  confirm: {
    title: 'Mover {size} para o Lixo?',
    body: '{count} itens em {groups} categorias.',
    reassurance:
      'Tudo vai para o Lixo. Pode recuperar no Finder até o esvaziar.',
    cancel: 'Cancelar',
    confirm: 'Mover para o Lixo'
  },

  result: {
    title: 'Movidos {size} para o Lixo',
    trashed: '{count} itens movidos',
    skipped: '{count} ignorados',
    failed: '{count} falharam',
    whySkipped: 'Itens ignorados e porquê',
    emptyTrashPrompt: 'O espaço é libertado quando esvaziar o Lixo.',
    emptyTrash: 'Esvaziar Lixo ({size})',
    emptyTrashConfirm: 'Esvaziar o Lixo? Isto não pode ser desfeito.',
    undo: 'Desfazer',
    undone: 'Restaurados {count} itens',
    done: 'Concluído'
  },

  permission: {
    missing: 'Acesso Total ao Disco não concedido',
    detail: 'Algumas pastas não podem ser analisadas sem ele, e esperar por cada recusa também torna a análise mais lenta.',
    grant: 'Abrir Definições do Sistema',
    dismiss: 'Agora não',
    explain:
      'O macOS esconde as bibliotecas de outras apps atrás do Acesso Total ao Disco. Sem ele, o CleanMac não consegue ver Containers, Mail ou dados do Safari. Conceda-o nas Definições do Sistema e reabra a app.',
    restartNeeded: 'Reabra o CleanMac depois de conceder o acesso.'
  },

  history: {
    title: 'Histórico',
    subtitle: 'Todas as limpezas que esta app realizou.',
    empty: 'Ainda não há limpezas.',
    reclaimed: '{size} recuperados',
    items: '{count} itens',
    restore: 'Restaurar do Lixo',
    restored: 'Restaurados {restored}, não foi possível restaurar {failed}'
  },

  settings: {
    updateReady: 'A versão {version} está pronta — instala ao sair',
    title: 'Definições',
    language: 'Idioma',
    languageSystem: 'Sistema',
    threshold: 'Avisar-me quando o disco ultrapassar',
    thresholdHint: 'A barra de menus só mostra a percentagem a partir daqui.',
    about: 'Acerca de',
    version: 'Versão {version}',
    openSource: 'Código aberto — todas as regras são auditáveis.'
  },

  modules: {
    appLeftovers: {
      title: 'Restos de apps desinstaladas',
      description: 'Ficheiros de apps que já não estão neste Mac'
    },
    aiData: {
      title: 'Apps de IA',
      description: 'Imagens de VM, modelos e estado de workspace de editores'
    },
    browsers: {
      title: 'Navegadores',
      description: 'Apenas caches — nunca cookies, sessões ou histórico'
    },
    nodeModules: {
      title: 'node_modules',
      description: 'Dependências de projetos em que não tocou'
    },
    updaterResidue: {
      title: 'Restos de atualizações',
      description: 'Instaladores gastos dos auto-updaters'
    },
    devCaches: {
      title: 'Caches de desenvolvimento',
      description: 'Descargas de gestores de pacotes e ferramentas de build'
    },
    docker: {
      title: 'Docker',
      description: 'Imagens pendentes, contentores parados e cache de build'
    },
    system: {
      title: 'Sistema',
      description: 'Logs, estado guardado, Xcode e backups de dispositivos'
    }
  },

  rules: {
    appLeftovers: {
      title: 'Ficheiros de apps que removeu',
      explain:
        'Preferências, caches e contentores cujo bundle id nenhuma app instalada reclama. Deliberadamente tímido: se alguma app instalada partilha o prefixo do fabricante, nada dele é reportado — os fabricantes trazem helpers e daemons sem app própria.'
    },
    claudeVm: {
      title: 'Imagens de VM do Claude',
      explain:
        'Imagens de máquina virtual do sandbox de código — 6,7 GB nesta máquina, sem qualquer interface que admita que existem. São descarregadas de novo quando necessário, mas a descarga é grande.'
    },
    aiCaches: {
      title: 'Caches de apps de IA',
      explain: 'Caches de Electron comuns, iguais às de qualquer outra app. Refeitas ao abrir.'
    },
    huggingFace: {
      title: 'Cache do hub HuggingFace',
      explain: 'Modelos e datasets descarregados. Voltam a ser obtidos quando um script os pedir.'
    },
    localModels: {
      title: 'Modelos locais',
      explain:
        'O Ollama e o LM Studio mantêm um índice junto a blobs endereçados por conteúdo; apagar ficheiros por baixo deixa o índice a apontar para nada. Use `ollama rm <modelo>`.'
    },
    editorWorkspaces: {
      title: 'Workspaces órfãos de editores',
      explain:
        'Histórico de chat e índices de projetos que já não existem no disco. Os workspaces cuja pasta ainda existe não são tocados.'
    },
    chromeCache: {
      title: 'Cache do Chrome',
      explain: 'Recursos de páginas descarregados. O Chrome refá-los enquanto navega.'
    },
    chromeProfileCaches: {
      title: 'Caches de perfil do Chrome',
      explain:
        'Código compilado, shaders de GPU e caches de service worker por perfil. Cookies, sessões, histórico e favoritos nunca correspondem a estes padrões.'
    },
    safariCache: {
      title: 'Cache do Safari',
      explain: 'Recursos de páginas descarregados. Refeitos enquanto navega.'
    },
    firefoxCache: {
      title: 'Cache do Firefox',
      explain: 'Recursos de páginas descarregados. Refeitos enquanto navega.'
    },
    staleProfiles: {
      title: 'Perfis do Chrome sem uso',
      explain:
        'Um perfil guarda favoritos, palavras-passe e histórico. Decidir qual das suas identidades sobra não cabe a esta app, por isso apenas se informa.'
    },
    nodeModules: {
      title: 'Pastas de dependências',
      explain:
        'Refeitas com um install — mas só onde existe lockfile, para recriar a árvore exata. Projetos tocados há pouco, ou sem lockfile, são informados e deixados em paz.'
    },
    updaterResidue: {
      title: 'Instaladores de atualização expirados',
      explain:
        'O Squirrel.Mac descarrega o zip de cada atualização, instala-o e nunca o remove. Acumula-se uma cópia por atualização.'
    },
    packageCaches: {
      title: 'Caches de gestores de pacotes',
      explain:
        'Caches de descarga e compilação que qualquer toolchain reconstrói sozinha. Limpá-las custa um build lento, nunca dados.'
    },
    homebrew: {
      title: 'Descargas do Homebrew',
      explain:
        'O Homebrew sabe que descargas ainda suportam uma fórmula instalada, por isso usa-se o seu próprio comando de limpeza em vez de apagar a pasta.'
    },
    docker: {
      title: 'Imagens e cache de build do Docker',
      explain:
        'Apagar os ficheiros do Docker à mão corrompe-o, por isso corre-se `docker system prune`. Os volumes ficam intactos — costumam ter uma base de dados de desenvolvimento.'
    },
    logs: {
      title: 'Logs e relatórios de falha',
      explain: 'Saída de diagnóstico que nenhuma app limpa. Nada depende dela.'
    },
    savedState: {
      title: 'Estado de janelas guardado',
      explain:
        'Posições de janela restauradas ao abrir. Limpá-las custa uma disposição nova da próxima vez.'
    },
    derivedData: {
      title: 'DerivedData do Xcode',
      explain:
        'Intermediários de compilação, refeitos no build seguinte. Costuma ser a maior pasta num Mac que já abriu o Xcode.'
    },
    xcodeArchives: {
      title: 'Arquivos do Xcode',
      explain:
        'Builds de lançamento que arquivou. Muitas vezes a única cópia de um binário publicado, por isso apenas se informa.'
    },
    simulators: {
      title: 'Simuladores de iOS',
      explain:
        'Apagar um dispositivo à mão corrompe o índice do CoreSimulator. Apenas informativo até o CleanMac usar o `simctl` corretamente.'
    },
    iosBackups: {
      title: 'Backups de iPhone e iPad',
      explain:
        'As suas fotos, mensagens e dados de apps — muitas vezes a única cópia existente. Mostrados para saber onde está o espaço; daqui nunca são apagados.'
    }
  },

  error: { generic: 'Algo correu mal: {message}' }
}
