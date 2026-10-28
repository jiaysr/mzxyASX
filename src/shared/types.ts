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
  /** 用户选择的脚本目录 */
  scriptDir: string
  /** 目录里是否有 toolkit/python、toolkit/Git、deploy/installer.py */
  valid: boolean
  /** 缺失的必需项（给人看的名字） */
  missing: string[]
  running: boolean
  /** 正在执行 deploy.installer */
  busy: boolean
  port: number | null
  pid: number | null
  branch: string | null
  commit: string | null
  /** git 工作区有未提交改动：deploy.installer 会 reset --hard */
  dirty: boolean
  /** 检测到旧版发布包引擎（engine/state.json） */
  legacyPack: boolean
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
  /** 控制台更新/网络请求使用的代理 */
  proxyType: 'none' | 'http' | 'socks5'
  proxyAddress: string
  /** 启动后自动检查应用更新 */
  autoCheckUpdate: boolean
  /** 启动脚本服务前先执行 deploy.installer（git pull + 依赖） */
  updateOnStart: boolean
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

/** config/deploy.yaml 的读取结果 */
export interface DeployFile {
  ok: boolean
  content: string
  message: string
}

/** deploy.installer / server.py 的实时日志 */
export interface EngineLogEvent {
  stream: 'installer' | 'server'
  line: string
}

/** 控制台自身数据目录与脚本目录 */
export interface AppPaths {
  rootDir: string
  scriptDir: string
}
