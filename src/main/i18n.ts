/**
 * Translations for the main process only — tray menu and native dialogs. The
 * renderer has its own, much larger, vue-i18n catalogue.
 */

export type Locale = 'en' | 'es' | 'pt' | 'fr'

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'pt', 'fr']

type MainStrings = {
  preferences: string
  scanMenu: string
  editMenu: string
  windowMenu: string
  helpMenu: string
  cleanSelected: string
  sourceCode: string
  show: string
  scan: string
  quit: string
  diskUsed: string
  confirmTrashTitle: string
  confirmTrashDetail: string
  cancel: string
  moveToTrash: string
  emptyTrashTitle: string
  emptyTrashDetail: string
  emptyTrash: string
}

const catalogue: Record<Locale, MainStrings> = {
  en: {
    preferences: 'Settings…',
    scanMenu: 'Scan',
    editMenu: 'Edit',
    windowMenu: 'Window',
    helpMenu: 'Help',
    cleanSelected: 'Move Selected to Trash',
    sourceCode: 'Source Code',
    show: 'Open CleanMac',
    scan: 'Scan now',
    quit: 'Quit',
    diskUsed: 'disk used',
    confirmTrashTitle: 'Move {size} to the Trash?',
    confirmTrashDetail:
      '{count} items. Everything goes to the Trash — you can put it back from the Finder until you empty it.',
    cancel: 'Cancel',
    moveToTrash: 'Move to Trash',
    emptyTrashTitle: 'Empty the Trash?',
    emptyTrashDetail: 'This is the step that actually frees the space. It cannot be undone.',
    emptyTrash: 'Empty Trash'
  },
  es: {
    preferences: 'Ajustes…',
    scanMenu: 'Analizar',
    editMenu: 'Edición',
    windowMenu: 'Ventana',
    helpMenu: 'Ayuda',
    cleanSelected: 'Mover selección a la Papelera',
    sourceCode: 'Código fuente',
    show: 'Abrir CleanMac',
    scan: 'Analizar ahora',
    quit: 'Salir',
    diskUsed: 'de disco usado',
    confirmTrashTitle: '¿Mover {size} a la Papelera?',
    confirmTrashDetail:
      '{count} elementos. Todo va a la Papelera: puedes recuperarlo desde el Finder hasta que la vacíes.',
    cancel: 'Cancelar',
    moveToTrash: 'Mover a la Papelera',
    emptyTrashTitle: '¿Vaciar la Papelera?',
    emptyTrashDetail: 'Este es el paso que libera el espacio de verdad. No se puede deshacer.',
    emptyTrash: 'Vaciar Papelera'
  },
  pt: {
    preferences: 'Definições…',
    scanMenu: 'Analisar',
    editMenu: 'Editar',
    windowMenu: 'Janela',
    helpMenu: 'Ajuda',
    cleanSelected: 'Mover seleção para o Lixo',
    sourceCode: 'Código-fonte',
    show: 'Abrir o CleanMac',
    scan: 'Analisar agora',
    quit: 'Sair',
    diskUsed: 'de disco usado',
    confirmTrashTitle: 'Mover {size} para o Lixo?',
    confirmTrashDetail:
      '{count} itens. Tudo vai para o Lixo — pode recuperar no Finder até esvaziá-lo.',
    cancel: 'Cancelar',
    moveToTrash: 'Mover para o Lixo',
    emptyTrashTitle: 'Esvaziar o Lixo?',
    emptyTrashDetail: 'Este é o passo que liberta o espaço de facto. Não pode ser desfeito.',
    emptyTrash: 'Esvaziar Lixo'
  },
  fr: {
    preferences: 'Réglages…',
    scanMenu: 'Analyser',
    editMenu: 'Édition',
    windowMenu: 'Fenêtre',
    helpMenu: 'Aide',
    cleanSelected: 'Mettre la sélection à la Corbeille',
    sourceCode: 'Code source',
    show: 'Ouvrir CleanMac',
    scan: 'Analyser maintenant',
    quit: 'Quitter',
    diskUsed: 'de disque utilisé',
    confirmTrashTitle: 'Déplacer {size} vers la Corbeille ?',
    confirmTrashDetail:
      '{count} éléments. Tout va à la Corbeille — vous pouvez les remettre depuis le Finder tant qu’elle n’est pas vidée.',
    cancel: 'Annuler',
    moveToTrash: 'Mettre à la Corbeille',
    emptyTrashTitle: 'Vider la Corbeille ?',
    emptyTrashDetail:
      'C’est l’étape qui libère réellement l’espace. Elle est irréversible.',
    emptyTrash: 'Vider la Corbeille'
  }
}

let current: Locale = 'en'

export function resolveLocale(preferred: string | null, systemLocale: string): Locale {
  const candidate = (preferred ?? systemLocale).slice(0, 2).toLowerCase()
  return SUPPORTED_LOCALES.includes(candidate as Locale) ? (candidate as Locale) : 'en'
}

export function setLocale(locale: Locale): void {
  current = locale
}

export function getLocale(): Locale {
  return current
}

export function t(key: keyof MainStrings, params: Record<string, string> = {}): string {
  const template = catalogue[current][key]
  return template.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? `{${name}}`)
}
