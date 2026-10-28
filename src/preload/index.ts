import { contextBridge, ipcRenderer } from 'electron'
import type {
  ActionResult,
  Announcement,
  AppInfo,
  AppPaths,
  DeployFile,
  EngineLogEvent,
  EngineStatus,
  PickedImage,
  UpdateEvent,
  AppPrefs
} from '../shared/types'

const api = {
  info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  engine: {
    /** force=true 跳过目录缓存，用于启动前检查未提交改动 */
    status: (force?: boolean): Promise<EngineStatus> => ipcRenderer.invoke('engine:status', force),
    /** update=false 时跳过 deploy.installer；allowDirty 只由确认过提示的界面传 */
    start: (opts?: { update?: boolean; allowDirty?: boolean }): Promise<ActionResult> =>
      ipcRenderer.invoke('engine:start', opts),
    stop: (): Promise<ActionResult> => ipcRenderer.invoke('engine:stop'),
    /** 选择脚本目录；返回选择后的最新状态 */
    pickDir: (): Promise<{ canceled: boolean; status: EngineStatus }> =>
      ipcRenderer.invoke('engine:pick-dir'),
    openDir: (): Promise<ActionResult> => ipcRenderer.invoke('engine:open-dir'),
    openDeploy: (): Promise<ActionResult> => ipcRenderer.invoke('engine:open-deploy'),
    readDeploy: (): Promise<DeployFile> => ipcRenderer.invoke('engine:read-deploy'),
    saveDeploy: (content: string): Promise<ActionResult> =>
      ipcRenderer.invoke('engine:save-deploy', content),
    /** 订阅 deploy.installer / server.py 的日志 */
    onLog: (cb: (event: EngineLogEvent) => void): (() => void) => {
      const listener = (_e: unknown, payload: EngineLogEvent): void => cb(payload)
      ipcRenderer.on('engine:log', listener)
      return () => {
        ipcRenderer.removeListener('engine:log', listener)
      }
    }
  },

  update: {
    check: (): Promise<ActionResult> => ipcRenderer.invoke('update:check'),
    install: (): Promise<ActionResult> => ipcRenderer.invoke('update:install'),
    /** 订阅更新事件，返回取消订阅函数 */
    onEvent: (cb: (event: UpdateEvent) => void): (() => void) => {
      const listener = (_e: unknown, payload: UpdateEvent): void => cb(payload)
      ipcRenderer.on('update:event', listener)
      return () => {
        ipcRenderer.removeListener('update:event', listener)
      }
    }
  },

  /** 控制台数据目录与脚本目录 */
  paths: {
    get: (): Promise<AppPaths> => ipcRenderer.invoke('app:config')
  },

  /** 更新偏好：代理 / 自动检查 / 启动前更新脚本 */
  prefs: {
    get: (): Promise<AppPrefs> => ipcRenderer.invoke('prefs:get'),
    set: (patch: Partial<AppPrefs>): Promise<AppPrefs> =>
      ipcRenderer.invoke('prefs:set', patch)
  },

  /** 公告：随应用打包的 markdown 列表 */
  announcements: {
    list: (): Promise<Announcement[]> => ipcRenderer.invoke('announcements:list')
  },

  /** 关窗守卫：主进程拦下关闭时通知界面弹窗，确认后再放行 */
  close: {
    onRequest: (cb: () => void): (() => void) => {
      const handler = (): void => cb()
      ipcRenderer.on('app:close-request', handler)
      return () => ipcRenderer.removeListener('app:close-request', handler)
    },
    confirm: (): Promise<void> => ipcRenderer.invoke('app:close-confirm')
  },

  /** 背景图：选一张，或按上次的路径读回来 */
  background: {
    pick: (): Promise<PickedImage | null> => ipcRenderer.invoke('bg:pick'),
    read: (path: string): Promise<string | null> => ipcRenderer.invoke('bg:read', path)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type PreloadApi = typeof api
