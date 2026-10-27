import type {
  Announcement,
  AppInfo,
  AppPaths,
  EngineInstallEvent,
  EngineStatus,
  UpdateEvent,
  AppPrefs
} from '../../../shared/types'

/**
 * 预加载层暴露的桥接对象（window.api）。
 * 渲染层只通过这里访问主进程，方便以后替换实现。
 */
export const api = window.api

export type { Announcement, AppInfo, AppPaths, EngineInstallEvent, EngineStatus, UpdateEvent, AppPrefs }
