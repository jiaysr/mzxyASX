import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { setupPaths, paths } from './paths'
import { engine } from './engine'
import { installEngine } from './engine-updater'
import { dirSize } from './cleanup'
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
/** 用户确认过退出，避免二次弹窗 */
let allowClose = false

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

  // 关闭前二次确认：脚本在跑任务时提示更明确
  mainWindow.on('close', (event) => {
    if (allowClose || !mainWindow) return
    event.preventDefault()
    const busy = engine.isBusy()
    void dialog
      .showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['取消', '退出'],
        defaultId: 0,
        cancelId: 0,
        title: '退出',
        message: '确定要退出吗？',
        detail: busy
          ? '脚本正在运行，退出会中断当前任务，本地脚本服务也会一起停止。'
          : '退出后本地脚本服务会一并停止。'
      })
      .then(({ response }) => {
        if (response === 1) {
          allowClose = true
          mainWindow?.close()
        }
      })
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

  // 退出前先停引擎，避免 python 子进程变成孤儿
  app.on('before-quit', () => engine.stop())
}
