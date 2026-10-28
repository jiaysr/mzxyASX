import { useEngine } from '../composables/useEngine'
import { useSession } from '../composables/useSession'

/**
 * 引擎 HTTP 接口封装
 *
 * 地址来自会话（登录页填的，默认是本机动态端口）。
 * 所有参数走 query string（后端就是这么设计的）。
 */
function baseUrl(): string {
  const { address } = useSession()
  if (address.value) return `http://${address.value}`
  const port = useEngine().status.value?.port
  if (!port) throw new Error('脚本服务未连接')
  return `http://127.0.0.1:${port}`
}

function withQuery(path: string, params?: Record<string, unknown>): string {
  if (!params) return path
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    sp.append(k, String(v))
  }
  const qs = sp.toString()
  return qs ? `${path}?${qs}` : path
}

async function request<T>(
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
  path: string,
  params?: Record<string, unknown>,
  body?: unknown
): Promise<T> {
  const url = withQuery(baseUrl() + path, params)
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      /* 响应不是 JSON，用状态码 */
    }
    throw new Error(detail)
  }
  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

export const http = {
  get: <T>(path: string, params?: Record<string, unknown>) => request<T>('GET', path, params),
  put: <T>(path: string, params?: Record<string, unknown>) => request<T>('PUT', path, params),
  post: <T>(path: string, params?: Record<string, unknown>) => request<T>('POST', path, params),
  del: <T>(path: string, params?: Record<string, unknown>) => request<T>('DELETE', path, params),
  /** 带 JSON body 的写请求（引擎的 /battle/* 用 Body(...) 收参数） */
  postJson: <T>(path: string, body: unknown, params?: Record<string, unknown>) =>
    request<T>('POST', path, params, body),
  putJson: <T>(path: string, body: unknown, params?: Record<string, unknown>) =>
    request<T>('PUT', path, params, body)
}

/** 引擎返回的相对资源路径（如技能图标）拼成可直接访问的地址 */
export function assetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  try {
    return baseUrl() + (path.startsWith('/') ? path : `/${path}`)
  } catch {
    return ''
  }
}

/** 引擎返回的脚本菜单：{ 分组名: [任务名] } */
export type ScriptMenu = Record<string, string[]>

/** 单个参数的描述（引擎 /{config}/{task}/args 的返回元素） */
export interface ArgItem {
  name: string
  title: string
  description: string
  default: unknown
  value: unknown
  type: ArgType
  enumEnum?: string[]
}

export type ArgType =
  | 'string'
  | 'multi_line'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'time'
  | 'time_delta'
  | 'date_time'
  | 'battle_preset'

/** { 分组名: [参数...] } */
export type TaskArgs = Record<string, ArgItem[]>

// ---------------------------------------------------------------- 杂项接口

/** 提交记录：[sha, 作者, 时间, 信息] */
export type CommitTuple = (string | null)[]

export interface UpdateInfo {
  is_update: boolean
  branch: string
  current_commit: CommitTuple
  latest_commit: CommitTuple
  commit: CommitTuple[]
}

/** 引擎版本信息（无 git 仓库时提交字段为 null） */
export function getUpdateInfo(): Promise<UpdateInfo> {
  return http.get<UpdateInfo>('/home/update_info')
}

/** 拉取最新代码（仅在有 git 仓库的旧版引擎上有效） */
export function executeUpdate(): Promise<string> {
  return http.get<string>('/home/execute_update')
}

/** 推送测试 */
export function notifyTest(setting: string, title: string, content: string): Promise<boolean> {
  return http.post<boolean>('/home/notify_test', { setting, title, content })
}

/** 导出诊断包 */
export function exportDiagnostic(
  configName = ''
): Promise<{ success?: boolean; path?: string; [k: string]: unknown }> {
  return http.get('/home/export_diagnostic', { config_name: configName })
}

/** 立即运行：把下次运行时间设成现在，调度器下一轮就会跑到它 */
export function runTaskNow(config: string, task: string): Promise<boolean> {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const target =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  return http.put<boolean>(`/${config}/${task}/sync_next_run`, { target_dt: target })
}

// ---------------------------------------------------------------- 战斗配置

export interface BattleClass {
  id: string
  name: string
  description: string
  color: string
}

export interface BattleSkill {
  id: string
  class: string
  className: string
  name: string
  description: string
  icon: string
  cooldown: number
  default_priority: number
  /** 相对路径，如 /battle/icon/badao_1，用 assetUrl() 拼 */
  iconUrl: string
}

export interface BattlePreset {
  id: string
  name: string
  /** 完整顺序（含被禁用的技能，位置不丢） */
  order: string[]
  disabled: string[]
  /** 内建默认预设：不落盘、不可修改 */
  builtin: boolean
}

export interface BattleCommon {
  identify_threshold: number
  respect_cooldown: boolean
  cast_interval: number
}

export interface BattleSlot {
  index: number
  name: string
  [k: string]: unknown
}

/** 页面初始化一次拿全：技能目录 + 预设 + 通用设置 */
export interface BattleCatalog {
  config: string
  classes: BattleClass[]
  skills: BattleSkill[]
  presets: BattlePreset[]
  slots: BattleSlot[]
  common: BattleCommon
  defaults: { order: string[]; threshold: number; margin: number }
}

export interface BattleSlotMatch {
  slot: number
  slotName: string
  skill: string
  name: string
  className: string
  score: number
  second?: number
}

export interface BattlePlanEntry {
  slot: number
  slotName: string
  skill: string
  name: string
  className: string
  score: number
  priority: number
  recognized: boolean
}

export interface BattleIdentifyResult {
  ok: boolean
  message?: string
  preset?: { id: string; name: string }
  threshold?: number
  slots?: BattleSlotMatch[]
  plan?: BattlePlanEntry[]
  summary?: string
}

export interface BattlePresetOption {
  id: string
  name: string
  builtin: boolean
}

/** 写操作统一返回保存后的完整 catalog，前端直接覆盖本地状态 */
export const battleApi = {
  catalog: (config: string) => http.get<BattleCatalog>('/battle/catalog', { config }),
  presets: (config: string) =>
    http.get<{ presets: BattlePresetOption[] }>('/battle/presets', { config }),
  updatePreset: (config: string, body: { id: string; name?: string; order?: string[]; disabled?: string[] }) =>
    http.putJson<BattleCatalog>('/battle/preset', body, { config }),
  createPreset: (config: string, body: { name?: string; base?: string }) =>
    http.postJson<BattleCatalog>('/battle/preset', body, { config }),
  deletePreset: (config: string, id: string) =>
    http.del<BattleCatalog>(`/battle/preset/${encodeURIComponent(id)}`, { config }),
  resetPreset: (config: string, preset: string) =>
    http.put<BattleCatalog>('/battle/reset', { config, preset }),
  setCommon: (config: string, body: Partial<BattleCommon>) =>
    http.putJson<BattleCatalog>('/battle/common', body, { config }),
  identify: (config: string, preset: string) =>
    http.get<BattleIdentifyResult>('/battle/identify', { config, preset })
}
