import { useEngine } from '../composables/useEngine'

/**
 * 引擎 HTTP 接口封装
 *
 * 端口由主进程动态分配，所以每次请求都从引擎状态里取，
 * 不能用写死的地址。所有参数走 query string（后端就是这么设计的）。
 */
function baseUrl(): string {
  const { status } = useEngine()
  const port = status.value?.port
  if (!port) throw new Error('引擎未启动')
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
  params?: Record<string, unknown>
): Promise<T> {
  const url = withQuery(baseUrl() + path, params)
  const res = await fetch(url, { method })
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
  del: <T>(path: string, params?: Record<string, unknown>) => request<T>('DELETE', path, params)
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
