import { computed, ref } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import { OASX_MENU, OASX_ZH } from './oasx'

/**
 * 词条与语言
 *
 * 查找顺序（先命中先用）：
 *   1. 引擎运行时下发的 `assets/i18n/zh-CN.json`（346 条，最新）
 *   2. 原 Flutter 版 OASX 的 `i18n_cn.dart`（1010 条，字段描述最全）
 *   3. 本文件里的 LOCAL 兜底（少量界面文案）
 *   4. 人话兜底：`screenshot_method` → `Screenshot Method`
 *
 * 英文：直接用键名（引擎的键本来就是英文）。
 */
const LOCALE_KEY = 'mzxy.locale'

/**
 * 本地兜底：只留引擎和 OASX 都没有的几条（更新的参数组、界面自造文案）。
 * 其余全部走 oasx.ts，别在这儿重复维护。
 */
const LOCAL: Record<string, string> = {
  // 比 OASX 新的参数组
  login_config: '登录设置',
  login_x7_config: '小七登录',
  login_official_config: '官方登录',
  // 引擎 title 是 Title Case，OASX 只有 snake_case 的，补两条
  Enable: '启用',
  Priority: '优先级',
  // 界面自造
  scheduler_enable_help: '关闭后该任务不会被自动调度',
  next_run_rule_help: '手动指定下次运行时间',
  copy_log: '复制',
  auto_scroll: '自动滚动',
  collapse: '折叠',
  no_config: '没有可配置项'
}

const dict = ref<Record<string, string>>({})
const locale = ref<'zh-CN' | 'en-US'>(
  (localStorage.getItem(LOCALE_KEY) as 'zh-CN' | 'en-US' | null) ?? 'zh-CN'
)

/** 用引擎返回的词条覆盖本地兜底 */
export function setTranslate(map: Record<string, string>): void {
  dict.value = map
}

/**
 * 随应用打包的中文词条（OASX 全量 + 本地兜底）。
 *
 * 旧版每次启动会整份 PUT 给引擎，引擎存成 module/config/i18n/zh-CN.json，
 * 推送通知等「引擎侧要翻译但只有 UI 知道词条」的场景会用到。
 */
export function builtinZhDict(): Record<string, string> {
  return { ...OASX_ZH, ...LOCAL }
}

/**
 * 键的几种常见写法：`WorldBoss` / `worldboss` / `world_boss` / `daily_task`。
 *
 * 引擎下发的任务名是 CamelCase 或带空格的 `Daily Task`，
 * 词条键却是 snake_case，不做这一步永远查不到。
 */
function variants(key: string): string[] {
  const out = [key]
  const add = (v: string): void => {
    if (v && !out.includes(v)) out.push(v)
  }
  add(key.toLowerCase())
  add(key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase())
  add(key.replace(/[\s-]+/g, '_').toLowerCase())
  return out
}

/** 三层查表，返回 undefined 表示真的没有 */
function lookup(key: string): string | undefined {
  for (const k of variants(key)) {
    const hit = dict.value[k] ?? OASX_ZH[k] ?? LOCAL[k]
    if (hit) return hit
  }
  return undefined
}

/** 取词条：查不到原样返回键名 */
export function tr(key: string | undefined | null): string {
  if (!key) return ''
  if (locale.value === 'en-US') return key
  return lookup(key) ?? key
}

/**
 * 把 `screenshot_method` 这种键转成人话：`Screenshot Method`。
 */
export function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** 查词条，查不到就给人话兜底（参数组名走这个） */
export function trOr(key: string | undefined | null): string {
  if (!key) return ''
  if (locale.value === 'en-US') return humanize(key)
  return lookup(key) ?? humanize(key)
}

/**
 * 参数标签。
 *
 * 两种键都要试：参数名是 snake_case（`advance_time`），
 * 引擎给的 title 有时是 Title Case（`Enable`）。都查不到才兜人话。
 */
export function trArg(name: string, title?: string | null): string {
  if (locale.value === 'en-US') return humanize(name)
  return lookup(name) ?? (title ? lookup(title) : undefined) ?? humanize(name)
}

/**
 * 参数描述。
 *
 * 引擎给的 description 有两种：多数是词条键（`serial_help`），
 * 但新写的任务（比如 WarChariot）直接塞了中文句子。
 * 所以查不到词条时，只要不像键名就原样显示，别把说明文案吞掉。
 */
export function trDesc(key: string | undefined | null): string {
  if (!key) return ''
  const hit = lookup(key)
  if (hit) return hit
  // 纯 ASCII 的短标识符基本就是没翻译的键，宁可留空也别显示 serial_help
  return /^[\w.-]+$/.test(key) ? '' : key
}

/**
 * 菜单标签。
 *
 * 原版菜单用短标签（「脚本」「重启」），配置页标题才用长标签（「脚本设置」），
 * 所以菜单单独查 `OASX_MENU` 这张表。
 */
export function trMenuLabel(key: string | undefined | null): string {
  if (!key) return ''
  if (locale.value === 'zh-CN') {
    for (const k of variants(key)) {
      if (OASX_MENU[k]) return OASX_MENU[k]
    }
  }
  return trOr(key)
}

/** 菜单分组名 */
export function trGroup(key: string): string {
  return trMenuLabel(key)
}

/**
 * 页头标题：分组名和任务名都可能出现，先按任务词条查，再退回菜单短标签。
 */
export function trMenu(key: string): string {
  if (locale.value === 'en-US') return key
  return lookup(key) ?? trMenuLabel(key)
}

/** Element Plus 自带的语言包（日期选择器、空状态文案等） */
export const elementLocale = computed(() => (locale.value === 'en-US' ? en : zhCn))

export function useLocale() {
  function setLocale(next: 'zh-CN' | 'en-US'): void {
    locale.value = next
    localStorage.setItem(LOCALE_KEY, next)
  }
  return { locale, setLocale, elementLocale }
}
