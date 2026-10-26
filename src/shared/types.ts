/** 主进程 / 预加载 / 渲染层共用的类型 */

export interface AppInfo {
  version: string
  packaged: boolean
  electron: string
  chrome: string
  node: string
  platform: string
}

export interface EngineStatus {
  installed: boolean
  running: boolean
  codeVersion: string | null
  envId: string | null
  channel: string | null
  pid: number | null
  port: number | null
  pythonPath: string | null
  codePath: string | null
  engineRoot: string
  message: string
}

export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'none'; version: string }
  | { type: 'progress'; percent: number; bytesPerSecond: number }
  | { type: 'ready'; version: string; busy: boolean }
  | { type: 'error'; message: string }

export interface ActionResult {
  ok: boolean
  message: string
  port?: number
}

/** 引擎安装 / 更新过程中推给界面的进度事件 */
export type EngineInstallEvent =
  | { type: 'checking' }
  | { type: 'uptodate'; codeVersion: string }
  | { type: 'plan'; needEnv: boolean; needCode: boolean; envSize: number; codeSize: number }
  | { type: 'download'; target: 'env' | 'code'; percent: number; received: number; total: number }
  | { type: 'extract'; target: 'env' | 'code'; percent: number }
  | { type: 'done'; codeVersion: string; envId: string }
  | { type: 'error'; message: string }

/** 引擎存放位置（只读） */
export interface AppPaths {
  rootDir: string
  engineBytes: number
}
