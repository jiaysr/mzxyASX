import { contextBridge, ipcRenderer } from 'electron'
import type { ActionResult, AppInfo, EngineStatus, UpdateEvent } from '../shared/types'

const api = {
  info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  engine: {
    status: (): Promise<EngineStatus> => ipcRenderer.invoke('engine:status'),
    start: (): Promise<ActionResult> => ipcRenderer.invoke('engine:start'),
    stop: (): Promise<ActionResult> => ipcRenderer.invoke('engine:stop')
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

  openPath: (which: 'engine' | 'data'): Promise<void> =>
    ipcRenderer.invoke('app:open-path', which)
}

contextBridge.exposeInMainWorld('api', api)

export type PreloadApi = typeof api
