import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { FALLBACK_DIR, getConfig, loadConfig } from './settings'

/**
 * 目录布局（三层物理隔离）
 *
 *   <root>\engine\env\<env_id>\toolkit\   Python 运行时 + site-packages（更新单元：env）
 *   <root>\engine\code\<ver>\             脚本代码 module/tasks/assets（更新单元：code）
 *   <root>\engine\state.json              当前指针 {code_version, env_id, current}
 *   <root>\data\                          用户配置与日志，永不覆盖
 *   <root>\profile\                       Chromium 自己的缓存（别和引擎混在一起）
 *
 * <root> 固定是 exe 所在目录（绿色便携：整个文件夹拷走就能用，删掉即卸载）；
 * exe 目录不可写时（Program Files）退回 %LOCALAPPDATA%\mzxy。
 * 为什么引擎不放在安装目录：装到 Program Files 时不可写，
 * 而且引擎要独立于 UI 更新，否则每次改界面都得重下几百 MB。
 */
export function setupPaths(): void {
  loadConfig()
  const profile = join(getConfig().rootDir, 'profile')
  mkdirSync(profile, { recursive: true })
  app.setPath('userData', profile)
}

export const paths = {
  /** 开发模式的兜底目录（打包后配置跟着 exe 走） */
  get bootstrap(): string {
    return FALLBACK_DIR
  },
  get root(): string {
    return getConfig().rootDir
  },
  get engine(): string {
    return join(this.root, 'engine')
  },
  get engineEnv(): string {
    return join(this.engine, 'env')
  },
  get engineCode(): string {
    return join(this.engine, 'code')
  },
  get engineState(): string {
    return join(this.engine, 'state.json')
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
