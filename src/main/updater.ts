import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateEvent } from '../shared/types'

let target: BrowserWindow | null = null
let isBusy: () => boolean = () => false
let downloaded = false

function send(event: UpdateEvent): void {
  if (target && !target.isDestroyed()) {
    target.webContents.send('update:event', event)
  }
}

/**
 * 初始化 UI 层自更新。
 *
 * 与引擎更新互不影响：引擎在 userData 下，NSIS 只动安装目录。
 * electron-updater 只在打包后生效，dev 模式下直接跳过（否则会抛错）。
 */
export function initUpdater(getWindow: () => BrowserWindow | null, busyCheck: () => boolean): void {
  target = getWindow()
  isBusy = busyCheck

  if (!app.isPackaged) {
    console.log('[updater] 开发模式，跳过自动更新初始化')
    return
  }

  autoUpdater.autoDownload = true
  // 用户不点「重启更新」时，退出应用也会装上
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => send({ type: 'checking' }))
  autoUpdater.on('update-available', (info) => send({ type: 'available', version: info.version }))
  autoUpdater.on('update-not-available', (info) => send({ type: 'none', version: info.version }))
  autoUpdater.on('download-progress', (p) =>
    send({
      type: 'progress',
      percent: Math.round(p.percent),
      bytesPerSecond: p.bytesPerSecond
    })
  )
  autoUpdater.on('update-downloaded', (info) => {
    downloaded = true
    // 引擎在跑任务时不能自动装：quitAndInstall 会强杀脚本
    send({ type: 'ready', version: info.version, busy: isBusy() })
  })
  autoUpdater.on('error', (err) => send({ type: 'error', message: err?.message ?? String(err) }))

  // 不阻塞启动，5 秒后再查
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => send({ type: 'error', message: String(e) }))
  }, 5000)
}

export function checkForUpdates(): { ok: boolean; message: string } {
  if (!app.isPackaged) {
    return { ok: false, message: '开发模式下不检查更新（需打包后运行）' }
  }
  autoUpdater.checkForUpdates().catch((e) => send({ type: 'error', message: String(e) }))
  return { ok: true, message: '正在检查更新' }
}

export function installNow(): { ok: boolean; message: string } {
  if (!app.isPackaged) return { ok: false, message: '开发模式下不安装更新' }
  if (!downloaded) return { ok: false, message: '更新尚未下载完成' }
  if (isBusy()) return { ok: false, message: '引擎正在运行任务，请先停止引擎' }
  // 第二个参数 true = 静默安装
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return { ok: true, message: '正在重启并安装更新' }
}
