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

/** 应用偏好，主进程落盘到 data/prefs.json */
export interface AppPrefs {
  /** 引擎清单的 Release tag */
  engineChannel: 'dev-latest' | 'latest'
  /** 资源包下载加速前缀（空 = 直连） */
  downloadMirror: string
  /** 下载代理 */
  proxyType: 'none' | 'http' | 'socks5'
  proxyAddress: string
  /** 启动后自动检查应用更新 */
  autoCheckUpdate: boolean
  /** 界面整体缩放（字体、图标、间距一起等比缩放），1 = 100% */
  uiScale: number
}

/** 公告来源：界面更新 / 脚本更新 / 普通公告 */
export type AnnouncementKind = 'ui' | 'script' | 'notice'

/** 一条公告（来自 resources/announcements/*.md） */
export interface Announcement {
  id: string
  title: string
  content: string
  kind: AnnouncementKind
}

/** 选好的背景图：路径存起来，dataUrl 只放内存 */
export interface PickedImage {
  path: string
  dataUrl: string
}

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
  | { type: 'done'; codeVersion: string; envId: string; notes?: string }
  | { type: 'error'; message: string }

/** 引擎存放位置（只读） */
export interface AppPaths {
  rootDir: string
  engineBytes: number
}
