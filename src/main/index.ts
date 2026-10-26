import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { setupPaths, paths } from './paths'
import { engine } from './engine'
import { installEngine, readState, manifestUrl } from './engine-updater'
import { cleanupOldVersions, dirSize, relocateRoot } from './relocate'
import { configFilePath } from './settings'
import { checkForUpdates, initUpdater, installNow } from './updater'

// 必须在 app ready 之前改 userData 路径
setupPaths()

// 默认关硬件加速：这类工具常跑在虚拟机/远程桌面里，GPU 进程崩溃会直接带崩应用；
// 而且用户同时在跑模拟器，少抢一点显存更稳。需要时用 MZXY_ENABLE_GPU=1 打开。
if (process.env.MZXY_ENABLE_GPU !== '1') {
  app.disableHardwareAcceleration()
}

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 880,
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

  // 外链一律交给系统浏览器，不在应用内开新窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
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
  ipcMain.handle('engine:manifest', () => ({ url: manifestUrl(), state: readState() }))
  ipcMain.handle('engine:start', () => engine.start())
  ipcMain.handle('engine:stop', () => {
    engine.stop()
    return { ok: true, message: '已停止引擎' }
  })

  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:install', () => installNow())

  ipcMain.handle('app:config', async () => ({
    rootDir: paths.root,
    bootstrap: paths.bootstrap,
    configFile: configFilePath(),
    engineBytes: await dirSize(paths.engine)
  }))

  // 换盘：选目录 -> 迁移 engine/data -> 写配置 -> 重启（Chromium profile 路径也变了）
  ipcMain.handle('app:choose-root', async () => {
    const picked = await dialog.showOpenDialog({
      title: '选择引擎与数据目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (picked.canceled || !picked.filePaths.length) {
      return { ok: false, message: '已取消' }
    }
    if (engine.isBusy()) {
      return { ok: false, message: '引擎正在运行，请先停止再迁移' }
    }
    const result = await relocateRoot(picked.filePaths[0])
    if (result.ok) {
      // 迁移完必须重启：userData(profile) 也跟着换了
      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 1200)
    }
    return result
  })

  ipcMain.handle('engine:cleanup', () => cleanupOldVersions())  // 内部已是异步

  ipcMain.handle('app:open-path', (_e, which: 'engine' | 'data' | 'root') => {
    const target = which === 'engine' ? paths.engine : which === 'data' ? paths.data : paths.root
    shell.openPath(target)
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

    // 支持/自动化用：MZXY_MOVE_ROOT=D://xxx 可无人值守地把引擎挪到别的盘
    const moveTo = (process.env.MZXY_MOVE_ROOT || '').trim()
    if (moveTo) {
      const moved = await relocateRoot(moveTo)
      console.log('[relocate]', moved.message)
      if (moved.ok && !moved.message.includes('没有变化')) {
        setTimeout(() => {
          app.relaunch()
          app.exit(0)
        }, 800)
        return
      }
    }

    createWindow()
    initUpdater(() => mainWindow, () => engine.isBusy())

    // 引擎自举：没装就装，代码有新版本就更新（env 只在 env_id 变化时下载）
    // 放在窗口出来之后，不阻塞启动；进度通过 engine:event 推给界面
    setTimeout(async () => {
      if (engine.isBusy()) return

      // 1. 后台清理旧版本：不 await，删上万个文件可能几十秒，不能挡住启动
      cleanupOldVersions()
        .then((cleaned) => {
          if (cleaned.freedBytes > 0) console.log('[engine] 清理旧版本：', cleaned.message)
        })
        .catch((e) => console.warn('[engine] 清理旧版本失败', e))

      // 2. 引擎已装就先拉起来，不等更新检查（断网也能用）
      if (process.env.MZXY_AUTOSTART_ENGINE === '1' && engine.status().installed) {
        const r = await engine.start()
        console.log('[engine] 自动启动:', r.message)
      }

      // 3. 更新检查放最后，失败只影响更新，不影响使用
      try {
        const r = await installEngine(() => mainWindow)
        console.log('[engine] 检查更新：', r.message)
      } catch (e) {
        console.error('[engine] 检查更新失败', e)
      }
    }, 3000)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // 退出前先停引擎，避免 python 子进程变成孤儿
  app.on('before-quit', () => engine.stop())
}
