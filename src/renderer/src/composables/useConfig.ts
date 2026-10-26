import { computed, ref } from 'vue'
import { http, type ScriptMenu } from '../api/http'
import { setTranslate } from '../i18n'

/**
 * 脚本实例（配置）与菜单。
 *
 * 一个配置 = 一个账号/一套参数，引擎里就是 config/<名字>.json。
 */
const configs = ref<string[]>([])
const currentConfig = ref('')
const menu = ref<ScriptMenu>({})
const currentTask = ref('')
const ready = ref(false)

/** 拍平后的任务名列表（用于判断当前任务是否有效） */
const allTasks = computed(() => Object.values(menu.value).flat())

async function loadConfigs(): Promise<void> {
  const list = await http.get<string[]>('/config_list')
  configs.value = list
  if (!list.includes(currentConfig.value)) {
    currentConfig.value = list[0] ?? ''
  }
}

async function loadMenu(): Promise<void> {
  menu.value = await http.get<ScriptMenu>('/script_menu')
  if (!allTasks.value.includes(currentTask.value)) {
    currentTask.value = allTasks.value[0] ?? ''
  }
}

async function loadTranslate(): Promise<void> {
  try {
    const r = await http.get<Record<string, Record<string, string>>>('/home/additional_translate')
    setTranslate(r['zh-CN'] ?? {})
  } catch {
    /* 翻译拿不到不影响使用，键名会原样显示 */
  }
}

/** 首次进入：拉配置、菜单、词条 */
async function init(): Promise<void> {
  if (ready.value) return
  await Promise.all([loadConfigs(), loadMenu(), loadTranslate()])
  ready.value = true
}

async function refresh(): Promise<void> {
  ready.value = false
  await init()
}

async function createConfig(): Promise<string> {
  const name = await http.get<string>('/config_new_name')
  configs.value = await http.post<string[]>('/config_copy', { file: name, template: 'template' })
  currentConfig.value = name
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
}

function selectConfig(name: string): void {
  currentConfig.value = name
}

function selectTask(task: string): void {
  currentTask.value = task
}

export function useConfig() {
  return {
    configs,
    currentConfig,
    menu,
    currentTask,
    allTasks,
    ready,
    init,
    refresh,
    createConfig,
    renameConfig,
    deleteConfig,
    selectConfig,
    selectTask,
    loadConfigs
  }
}
