import { computed, ref } from 'vue'
import { http, type ScriptMenu } from '../api/http'
import { setTranslate } from '../i18n'

/**
 * 脚本实例（配置）与二级菜单。
 *
 * 对应原 Flutter 版的 NavCtrl：
 *   - 左侧栏：['Home', 'oas1', 'oas2', ...]
 *   - Home 配置下用 home_menu（Home / Updater / Tool）
 *   - 脚本配置下用 script_menu（Overview + 各任务分组）
 */
const HOME = 'Home'

const configs = ref<string[]>([HOME])
const currentConfig = ref(HOME)
const homeMenu = ref<ScriptMenu>({})
const scriptMenu = ref<ScriptMenu>({})
/** 当前二级菜单项（页面名） */
const currentMenu = ref(HOME)
const ready = ref(false)

const isHome = computed(() => currentConfig.value === HOME)

/** 当前生效的菜单数据 */
const activeMenu = computed<ScriptMenu>(() => (isHome.value ? homeMenu.value : scriptMenu.value))

/** 拍平后的任务名（用于校验 currentMenu 是否有效） */
const allTasks = computed(() => Object.values(scriptMenu.value).flat())

async function loadConfigs(): Promise<void> {
  const list = await http.get<string[]>('/config_list')
  const next = [HOME, ...list]
  configs.value = next
  if (!next.includes(currentConfig.value)) {
    currentConfig.value = next[0] ?? HOME
  }
}

async function loadMenus(): Promise<void> {
  const [home, script] = await Promise.all([
    http.get<ScriptMenu>('/home/home_menu'),
    http.get<ScriptMenu>('/script_menu')
  ])
  homeMenu.value = home
  scriptMenu.value = script
  validateMenu()
}

async function loadTranslate(): Promise<void> {
  try {
    const r = await http.get<Record<string, Record<string, string>>>('/home/additional_translate')
    setTranslate(r['zh-CN'] ?? {})
  } catch {
    /* 翻译拿不到不影响使用，键名会原样显示 */
  }
}

/** 当前菜单项不在可用列表里时，退回到该配置的默认页 */
function validateMenu(): void {
  if (isHome.value) {
    const valid = Object.keys(homeMenu.value)
    if (!valid.includes(currentMenu.value)) currentMenu.value = valid[0] ?? HOME
    return
  }
  if (currentMenu.value === 'Overview' || allTasks.value.includes(currentMenu.value)) return
  currentMenu.value = 'Overview'
}

/**
 * 首次进入：拉配置、菜单、词条。
 *
 * 引擎刚启动时端口可能还没就绪，这里带几次重试，
 * 否则初始化失败一次就再也不会重跑了（watcher 只在状态变化时触发）。
 */
async function init(retry = 4): Promise<void> {
  if (ready.value) return
  let lastError: unknown
  for (let i = 0; i < retry; i++) {
    try {
      await Promise.all([loadConfigs(), loadMenus(), loadTranslate()])
      ready.value = true
      return
    } catch (e) {
      lastError = e
      await new Promise((r) => setTimeout(r, 700))
    }
  }
  throw lastError
}

async function refresh(): Promise<void> {
  ready.value = false
  await init()
}

/** 切换配置（左侧栏） */
function switchConfig(name: string): void {
  if (name === currentConfig.value) return
  currentConfig.value = name
  currentMenu.value = name === HOME ? Object.keys(homeMenu.value)[0] ?? HOME : 'Overview'
}

/** 切换二级菜单项 */
function switchMenu(name: string): void {
  currentMenu.value = name
}

async function createConfig(): Promise<string> {
  const name = await http.get<string>('/config_new_name')
  const list = await http.post<string[]>('/config_copy', { file: name, template: 'template' })
  configs.value = [HOME, ...list]
  currentConfig.value = name
  currentMenu.value = 'Overview'
  return name
}

async function renameConfig(oldName: string, newName: string): Promise<void> {
  await http.put('/config', { old_name: oldName, new_name: newName })
  await loadConfigs()
  currentConfig.value = newName
}

async function deleteConfig(name: string): Promise<void> {
  await http.del('/config', { name })
  await loadConfigs()
  if (currentConfig.value === name) {
    currentConfig.value = HOME
    currentMenu.value = HOME
  }
}

export function useConfig() {
  return {
    HOME,
    configs,
    currentConfig,
    currentMenu,
    homeMenu,
    scriptMenu,
    activeMenu,
    allTasks,
    isHome,
    ready,
    init,
    refresh,
    switchConfig,
    switchMenu,
    createConfig,
    renameConfig,
    deleteConfig,
    loadConfigs
  }
}
