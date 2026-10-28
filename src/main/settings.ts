import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * 控制台数据固定放在 %LOCALAPPDATA%\mzxy，和安装目录、脚本目录分开：
 *
 *   - UI 更新/重装只动安装目录，不会碰控制台配置和缓存
 *   - 脚本目录由用户另选，但必须放在控制台安装目录之外
 *
 * app-config.json 只记录用户选择的脚本目录。0.3.x 旧版放在 exe 旁边的
 * app-config.json 会在首次启动时迁移 scriptDir 过来。
 */
export interface AppConfig {
  /** 固定为 %LOCALAPPDATA%\mzxy */
  rootDir: string
  /** 用户选择的脚本目录（含 toolkit / module / deploy） */
  scriptDir: string
}

export const DATA_DIR = join(process.env.LOCALAPPDATA || app.getPath('appData'), 'mzxy')

function configFilePath(): string {
  return join(DATA_DIR, 'app-config.json')
}

function readScriptDir(file: string): string {
  try {
    if (!existsSync(file)) return ''
    const data = JSON.parse(readFileSync(file, 'utf-8')) as Partial<AppConfig>
    return typeof data.scriptDir === 'string' ? data.scriptDir.trim() : ''
  } catch {
    return ''
  }
}

let current: AppConfig = { rootDir: DATA_DIR, scriptDir: '' }

export function loadConfig(): AppConfig {
  const file = configFilePath()
  let scriptDir = readScriptDir(file)

  // 兼容 0.3.1 及更早：app-config.json 在 exe 旁边，只迁移脚本目录
  if (!scriptDir && !existsSync(file) && app.isPackaged) {
    try {
      scriptDir = readScriptDir(join(dirname(app.getPath('exe')), 'app-config.json'))
    } catch {
      /* 拿不到 exe 路径就忽略 */
    }
  }

  current = { rootDir: DATA_DIR, scriptDir }
  if (scriptDir && !existsSync(file)) saveConfig(current)
  return current
}

export function saveConfig(next: AppConfig): AppConfig {
  current = { rootDir: DATA_DIR, scriptDir: next.scriptDir.trim() }
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(configFilePath(), JSON.stringify(current, null, 2), 'utf-8')
  } catch (e) {
    console.warn('[config] 写入 app-config.json 失败', e)
  }
  return current
}

export function getConfig(): AppConfig {
  return current
}
