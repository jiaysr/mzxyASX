import { app, session } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { paths } from './paths'
import type { AppPrefs } from '../shared/types'

/**
 * 界面里「更新设置」那一页的偏好。
 *
 * 存在 `<root>\data\prefs.json`，和用户配置放一起，
 * 更新引擎/更新界面都不会覆盖它。
 */
const DEFAULTS: AppPrefs = {
  proxyType: 'none',
  proxyAddress: '',
  autoCheckUpdate: true,
  updateOnStart: true,
  uiScale: 1
}

/** 界面缩放的安全区间：再小看不清，再大布局会散 */
export const MIN_UI_SCALE = 0.8
export const MAX_UI_SCALE = 1.5

let current: AppPrefs = { ...DEFAULTS }

function file(): string {
  return join(paths.data, 'prefs.json')
}

/** 只认已知取值，坏数据一律回默认，避免手改文件把更新通道搞挂 */
function normalize(raw: Partial<AppPrefs>): AppPrefs {
  const proxyType =
    raw.proxyType === 'http' || raw.proxyType === 'socks5' ? raw.proxyType : 'none'
  const scale = typeof raw.uiScale === 'number' && Number.isFinite(raw.uiScale) ? raw.uiScale : 1
  return {
    proxyType,
    proxyAddress: typeof raw.proxyAddress === 'string' ? raw.proxyAddress.trim() : '',
    autoCheckUpdate: raw.autoCheckUpdate !== false,
    updateOnStart: raw.updateOnStart !== false,
    uiScale: Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, Math.round(scale * 100) / 100))
  }
}

export function loadPrefs(): AppPrefs {
  try {
    if (existsSync(file())) {
      current = normalize(JSON.parse(readFileSync(file(), 'utf-8')) as Partial<AppPrefs>)
      return current
    }
  } catch (e) {
    console.warn('[prefs] 读取失败，用默认值', e)
  }
  current = { ...DEFAULTS }
  return current
}

export function getPrefs(): AppPrefs {
  return current
}

export function savePrefs(patch: Partial<AppPrefs>): AppPrefs {
  current = normalize({ ...current, ...patch })
  try {
    mkdirSync(dirname(file()), { recursive: true })
    writeFileSync(file(), JSON.stringify(current, null, 2), 'utf-8')
  } catch (e) {
    console.warn('[prefs] 写入失败', e)
  }
  applyProxy()
  return current
}

/** 组装成 Chromium 的 proxyRules；空串表示直连 */
export function proxyRules(): string {
  const { proxyType, proxyAddress } = current
  if (proxyType === 'none' || !proxyAddress) return 'direct://'
  const scheme = proxyType === 'socks5' ? 'socks5' : 'http'
  // 用户可能只填了 IP:Port，也可能带了协议头，两种都收
  const addr = /^[a-z0-9]+:\/\//i.test(proxyAddress)
    ? proxyAddress
    : `${scheme}://${proxyAddress}`
  return addr
}

/**
 * 应用代理设置。
 *
 * 控制台的更新检查、公告/README 拉取走 Chromium 网络栈，这里设的代理
 * 会直接影响它们能不能连上。脚本的 git/pip 走系统网络，不受这里影响。
 */
export function applyProxy(): void {
  if (!app.isReady()) return
  const rules = proxyRules()
  session.defaultSession
    .setProxy(rules === 'direct://' ? { mode: 'direct' } : { proxyRules: rules })
    .catch((e) => console.warn('[prefs] 设置代理失败', e))
}
