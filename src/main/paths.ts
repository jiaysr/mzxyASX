import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getConfig, loadConfig } from './settings'
import { loadPrefs } from './prefs'

/**
 * 控制台自身的数据目录（固定 %LOCALAPPDATA%\mzxy）
 *
 *   <root>\data\      控制台偏好、引擎 pid
 *   <root>\profile\   Chromium 自己的缓存
 *
 * 脚本目录由用户单独选择，必须放在控制台安装目录之外；
 * UI 更新/重装只动安装目录，不会碰这里，也不会搬脚本目录。
 */
export function setupPaths(): void {
  loadConfig()
  const profile = join(getConfig().rootDir, 'profile')
  mkdirSync(profile, { recursive: true })
  app.setPath('userData', profile)
  // 依赖 rootDir 的 data 目录，必须放在 loadConfig 之后
  loadPrefs()
}

export const paths = {
  get root(): string {
    return getConfig().rootDir
  },
  get data(): string {
    return join(this.root, 'data')
  },
  get config(): string {
    return join(this.data, 'config')
  },
  get log(): string {
    return join(this.data, 'log')
  }
}
