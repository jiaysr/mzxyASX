import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getConfig, loadConfig } from './settings'
import { loadPrefs } from './prefs'
import { restorePortableKeep } from './portable-keep'

/**
 * 控制台自身的数据目录
 *
 *   <root>\data\      控制台偏好、引擎 pid
 *   <root>\profile\   Chromium 自己的缓存
 *
 * 脚本目录由用户单独选择，可以放在任何位置；放在 <root>\engine\ 时
 * 安装器钩子会顺带保护它。控制台不再在 <root> 下维护 code/env 版本。
 *
 * <root> 固定是 exe 所在目录（绿色便携：整个文件夹拷走就能用，删掉即卸载）；
 * exe 目录不可写时（Program Files）退回 %LOCALAPPDATA%\mzxy。
 */
export function setupPaths(): void {
  loadConfig()
  // 更新时安装器把这三个目录搬到了 rootDir 同级（build/installer-hooks.nsh），
  // 装完没搬回来就在这里补一刀；必须在建 profile、读 prefs 之前
  restorePortableKeep(getConfig().rootDir)
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
