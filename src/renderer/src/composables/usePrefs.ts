import { reactive } from 'vue'
import { api } from '../api'
import type { AppPrefs } from '../../../shared/types'

/**
 * 「更新设置」的偏好（模块级单例）。
 *
 * 真正生效的地方在主进程：代理设到 Chromium、自动检查控制启动后要不要查更新、
 * updateOnStart 控制启动脚本服务前是否执行 deploy.installer。
 */
const prefs = reactive<AppPrefs>({
  proxyType: 'none',
  proxyAddress: '',
  autoCheckUpdate: true,
  updateOnStart: true,
  uiScale: 1
})

let loaded = false

export function usePrefs() {
  async function load(): Promise<void> {
    if (loaded) return
    loaded = true
    try {
      Object.assign(prefs, await api.prefs.get())
    } catch (e) {
      console.warn('[prefs] 读取失败，用默认值', e)
    }
  }

  /** 保存并立刻落盘；成功返回 null */
  async function save(patch: Partial<AppPrefs>): Promise<string | null> {
    try {
      Object.assign(prefs, await api.prefs.set(patch))
      return null
    } catch (e) {
      return e instanceof Error ? e.message : '保存失败'
    }
  }

  return { prefs, load, save }
}
