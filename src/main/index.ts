import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { setupPaths, paths } from './paths'
import { engine } from './engine'
import { installEngine } from './engine-updater'
import { dirSize } from './cleanup'
import { applyProxy, getPrefs, savePrefs } from './prefs'
import { pickBackground, readImage } from './background'
import { listAnnouncements } from './announcements'
import { checkForUpdates, initUpdater, installNow } from './updater'
import type { AppPrefs } from '../shared/types'

// 必须在 app ready 之前改 userData 路径
setupPaths()

// 默认关硬件加速：这类工具常跑在虚拟机/远程桌面里，GPU 进程崩溃会直接带崩应用；
// 而且用户同时在跑模拟器，少抢一点显存更稳。需要时用 MZXY_ENABLE_GPU=1 打开。
if (process.env.MZXY_ENABLE_GPU !== '1') {
  app.disableHardwareAcceleration()
}

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null
/** 用户确认过退出，避免二次弹窗 */
let allowClose = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 880,
    // 打包后任务栏图标取自 exe，开发模式下得手动指一下
    icon: app.isPackaged ? undefined : join(__dirname, '../../build/icon.png'),
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: '明珠轩辕',
    backgroundColor: '#f5f6f8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  /**
   * 关窗先问界面：引擎是不是本应用拉起的、有没有任务在跑。
   *
   * 主进程不直接判断「有没有脚本在跑」——那是渲染层的 WebSocket 状态，
   * 与其两边同步，不如让界面自己看，需要拦截时再弹窗。
   */
  mainWindow.on('close', (event) => {
    if (allowClose || !engine.isSpawnedByUs()) return
    event.preventDefault()
    mainWindow?.webContents.send('app:close-request')
  })

  /**
   * 界面缩放：用 Chromium 的 zoom factor，而不是放大 CSS 字号。
   *
   * zoom 会把 CSS 像素整体放大，字体、图标、间距一起等比变化，
   * 视口换算成更少的 CSS 像素，`height:100%` 依然贴合窗口，
   * 不会出现「字变大了但布局按原尺寸算」导致的溢出。
   */
  mainWindow.webContents.setZoomFactor(getPrefs().uiScale)

  // 外链一律交给系统浏览器，不在应用内开新窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  /**
   * markdown 里渲染出来的 `<a href>` 是普通链接，点了会让渲染进程直接跳走。
   * 站内路由走 hash 不会触发这里，其余一律交给系统浏览器。
   */
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url === mainWindow?.webContents.getURL()) return
    event.preventDefault()
    shell.openExternal(url)
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    packaged: app.isPackaged,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: `${process.platform}-${process.arch}`
  }))

  ipcMain.handle('engine:status', () => engine.status())
  ipcMain.handle('engine:install', () => installEngine(() => mainWindow))
  // 强制重装：忽略本地 state，按清单把 code / env 全部重下一遍
  ipcMain.handle('engine:reinstall', () => installEngine(() => mainWindow, true))
  ipcMain.handle('engine:start', () => engine.start())
  ipcMain.handle('engine:stop', () => {
    engine.stop()
    return { ok: true, message: '已停止引擎' }
  })

  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:install', () => installNow())

  ipcMain.handle('app:config', async () => ({
    rootDir: paths.root,
    engineBytes: await dirSize(paths.engine)
  }))

  // 应用偏好：更新源 / 代理 / 自动检查 / 界面缩放
  ipcMain.handle('prefs:get', () => getPrefs())
  ipcMain.handle('prefs:set', (_e, patch: Partial<AppPrefs>) => {
    const next = savePrefs(patch)
    if (patch.uiScale !== undefined && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.setZoomFactor(next.uiScale)
    }
    return next
  })

  // 界面设置里的背景图：选一张 + 按路径读回（重启后恢复用）
  ipcMain.handle('bg:pick', () => pickBackground(mainWindow))
  ipcMain.handle('bg:read', (_e, file: string) => readImage(file))

  // 公告：读打包进来的 markdown
  ipcMain.handle('announcements:list', () => listAnnouncements())

  // 关窗守卫：界面确认可以退出了
  ipcMain.handle('app:close-confirm', () => {
    allowClose = true
    mainWindow?.close()
  })
}

// 单实例：两份引擎同时抢模拟器会互相踢掉
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    registerIpc()
    // 上次崩溃/被强杀留下的引擎先收掉，再干别的
    void engine.killStale()
    // 代理要在任何网络请求之前设好（引擎清单是窗口出来后就去拉的）
    applyProxy()

    createWindow()
    initUpdater(() => mainWindow, () => engine.isBusy())

    // 引擎自举：没装就装，代码有新版本就更新（env 只在 env_id 变化时下载）
    // 放在窗口出来之后，不阻塞启动；进度通过 engine:event 推给界面
    // 不做任何自动动作：安装 / 启动 / 更新引擎都由界面手动触发。
    // （登录页有「安装引擎 / 启动引擎」，引擎页也有同样的按钮）

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // 退出前先停引擎，避免 python 子进程变成孤儿。
  // 这里同时放行 close 守卫：程序自己发起的退出不该再弹窗。
  app.on('before-quit', () => {
    allowClose = true
    engine.stop()
  })
}
