import { contextBridge, ipcRenderer } from 'electron'
import type {
  ActionResult,
  Announcement,
  AppInfo,
  AppPaths,
  EngineInstallEvent,
  EngineStatus,
  PickedImage,
  UpdateEvent,
  AppPrefs
} from '../shared/types'

const api = {
  info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  engine: {
    status: (): Promise<EngineStatus> => ipcRenderer.invoke('engine:status'),
    start: (): Promise<ActionResult> => ipcRenderer.invoke('engine:start'),
    stop: (): Promise<ActionResult> => ipcRenderer.invoke('engine:stop'),
    install: (): Promise<ActionResult> => ipcRenderer.invoke('engine:install'),
    reinstall: (): Promise<ActionResult> => ipcRenderer.invoke('engine:reinstall'),
    /** 订阅引擎安装进度，返回取消订阅函数 */
    onEvent: (cb: (event: EngineInstallEvent) => void): (() => void) => {
      const listener = (_e: unknown, payload: EngineInstallEvent): void => cb(payload)
      ipcRenderer.on('engine:event', listener)
      return () => {
        ipcRenderer.removeListener('engine:event', listener)
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

  /** 引擎存放位置（只读，固定跟着 exe 走） */
  paths: {
    get: (): Promise<AppPaths> => ipcRenderer.invoke('app:config')
  },

  /** 更新偏好：渠道 / 镜像 / 代理 / 自动检查 */
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
