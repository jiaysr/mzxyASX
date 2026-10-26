import { contextBridge, ipcRenderer } from 'electron'
import type {
  ActionResult,
  AppInfo,
  AppPaths,
  EngineInstallEvent,
  EngineStatus,
  UpdateEvent
} from '../shared/types'

const api = {
  info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  engine: {
    status: (): Promise<EngineStatus> => ipcRenderer.invoke('engine:status'),
    start: (): Promise<ActionResult> => ipcRenderer.invoke('engine:start'),
    stop: (): Promise<ActionResult> => ipcRenderer.invoke('engine:stop'),
    install: (): Promise<ActionResult> => ipcRenderer.invoke('engine:install'),
    cleanup: (): Promise<ActionResult> => ipcRenderer.invoke('engine:cleanup'),
    manifest: (): Promise<{ url: string; state: unknown }> => ipcRenderer.invoke('engine:manifest'),
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

  openPath: (which: 'engine' | 'data' | 'root'): Promise<void> =>
    ipcRenderer.invoke('app:open-path', which)
}

contextBridge.exposeInMainWorld('api', api)

export type PreloadApi = typeof api
