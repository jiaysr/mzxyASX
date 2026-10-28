import { computed, ref } from 'vue'
import { http, type ScriptMenu } from '../api/http'
import { builtinZhDict, setTranslate } from '../i18n'

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

/**
 * 把内置中文词条传给引擎（引擎存成 module/config/i18n/zh-CN.json）。
 *
 * 引擎发推送通知时只有这些词条可用，不传就会直接显示英文键名。
 * 老版本引擎没有这个接口，404 忽略即可，所以不 await 也不报错。
 */
async function uploadBuiltinDict(): Promise<void> {
  try {
    await http.putJson('/home/chinese_translate', builtinZhDict())
  } catch {
    /* 老引擎 / 网络问题：不影响界面 */
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
      // 词条上传不阻塞首屏：引擎侧只用于推送通知翻译
      void uploadBuiltinDict()
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

/** 引擎按现有配置编号生成的下一个名字（oas3 这种） */
async function newConfigName(): Promise<string> {
  return http.get<string>('/config_new_name')
}

/** 可作为模板的配置：引擎返回全部 json 名，template 排在最前 */
async function configTemplates(): Promise<string[]> {
  return http.get<string[]>('/config_all')
}

/**
 * 用指定名字从模板复制出一份新配置。
 *
 * 引擎的 copy() 在目标已存在时只打日志、静默返回，
 * 所以重名必须在这里挡掉，否则界面会显示「创建成功」但其实什么都没发生。
 */
async function createConfig(name: string, template: string): Promise<void> {
  const target = name.trim()
  if (!target) throw new Error('请填配置名称')
  if (configs.value.includes(target)) throw new Error(`配置「${target}」已存在`)
  if (target === 'template') throw new Error('template 是模板，不能用作配置名')

  const list = await http.post<string[]>('/config_copy', { file: target, template })
  configs.value = [HOME, ...list]
  currentConfig.value = target
  currentMenu.value = 'Overview'
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
    newConfigName,
    configTemplates,
    createConfig,
    renameConfig,
    deleteConfig,
    loadConfigs
  }
}
