import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 应用级配置（很小，固定放在 %LOCALAPPDATA%\mzxy\app-config.json）
 *
 * 它记的是「引擎根目录」在哪，所以自己不能跟着引擎一起搬。
 */
export interface AppConfig {
  /** 引擎 + 数据的根目录，默认 %LOCALAPPDATA%\mzxy */
  rootDir: string
}

/** 固定的引导目录，永远在 C 盘，只放这个配置文件 */
export const BOOTSTRAP_DIR = join(process.env.LOCALAPPDATA || app.getPath('appData'), 'mzxy')
const CONFIG_FILE = join(BOOTSTRAP_DIR, 'app-config.json')

let current: AppConfig = { rootDir: BOOTSTRAP_DIR }

export function loadConfig(): AppConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Partial<AppConfig>
      if (data.rootDir && typeof data.rootDir === 'string') {
        current = { rootDir: data.rootDir }
      }
    }
  } catch (e) {
    console.warn('[config] 读取 app-config.json 失败，用默认目录', e)
  }
  return current
}

export function getConfig(): AppConfig {
  return current
}

export function saveConfig(next: AppConfig): void {
  mkdirSync(BOOTSTRAP_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8')
  current = next
}

export function configFilePath(): string {
  return CONFIG_FILE
}
