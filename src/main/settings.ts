import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * 引擎根目录的解析规则（不提供修改入口，目录永远跟着 exe 走）
 *
 *   - 打包后：<exe 所在目录>——整个文件夹拷走就能用，删掉即卸载
 *   - exe 目录不可写（装到 Program Files）：退回 %LOCALAPPDATA%\mzxy
 *   - 开发模式：%LOCALAPPDATA%\mzxy（别污染 node_modules）
 *
 * app-config.json 只为兼容早期手动指定过目录的用户保留读取，
 * 界面上已经没有修改入口；想重置就删掉这个文件。
 */
export interface AppConfig {
  /** 引擎 + 数据的根目录，默认就是 exe 所在目录（便携） */
  rootDir: string
}

/** 开发模式下的兜底目录 */
export const FALLBACK_DIR = join(process.env.LOCALAPPDATA || app.getPath('appData'), 'mzxy')

function configDir(): string {
  if (app.isPackaged) {
    try {
      return dirname(app.getPath('exe'))
    } catch {
      /* 拿不到就退回兜底 */
    }
  }
  return FALLBACK_DIR
}

function configFilePath(): string {
  return join(configDir(), 'app-config.json')
}

/** 目录能不能写：不能写就不能把引擎放这儿（Program Files 就是这种） */
export function isWritableDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true })
    const probe = join(dir, `.write-test-${Date.now()}`)
    writeFileSync(probe, '')
    rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}

/**
 * 默认根目录：优先「exe 所在目录」，实现绿色便携。
 * exe 目录不可写（装到 Program Files）时退回 %LOCALAPPDATA%。
 */
function defaultRoot(): string {
  if (app.isPackaged) {
    try {
      const exeDir = dirname(app.getPath('exe'))
      if (isWritableDir(exeDir)) return exeDir
    } catch {
      /* 忽略，走兜底 */
    }
  }
  return FALLBACK_DIR
}

let current: AppConfig = { rootDir: defaultRoot() }

export function loadConfig(): AppConfig {
  try {
    const file = configFilePath()
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf-8')) as Partial<AppConfig>
      if (data.rootDir && typeof data.rootDir === 'string') {
        current = { rootDir: data.rootDir }
        return current
      }
    }
  } catch (e) {
    console.warn('[config] 读取 app-config.json 失败，用默认目录', e)
  }
  current = { rootDir: defaultRoot() }
  return current
}

export function getConfig(): AppConfig {
  return current
}

