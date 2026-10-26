import { app } from 'electron'
import { spawn, ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { get as httpGet } from 'node:http'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from './paths'
import { readState } from './engine-updater'
import type { EngineStatus } from '../shared/types'

/**
 * 引擎进程管理。
 *
 * 这一版只做「目录约定 + 生命周期 + 健康检查」，
 * 真正的 Python 引擎包由脚本仓库的 CI 产出（code-<ver>.zip / env-<env_id>.zip），
 * 落地后这里的 start() 不需要改。
 */
class EngineManager {
  private child: ChildProcess | null = null
  private port: number | null = null

  isBusy(): boolean {
    return this.child !== null
  }

  private readState() {
    return readState()
  }

  private resolvePython(envId: string | undefined): string | null {
    if (!envId) return null
    // env 包里的结构是 toolkit/python.exe（整块运行时，含 Lib/site-packages）
    const candidates = [
      join(paths.engineEnv, envId, 'toolkit', 'python.exe'),
      join(paths.engineEnv, envId, 'toolkit', 'pythonw.exe')
    ]
    return candidates.find((p) => existsSync(p)) ?? null
  }

  private resolveCode(version: string | undefined): string | null {
    if (!version) return null
    const dir = join(paths.engineCode, version)
    return existsSync(dir) ? dir : null
  }

  status(): EngineStatus {
    const state = this.readState()
    const pythonPath = this.resolvePython(state?.env_id)
    const codePath = this.resolveCode(state?.current ?? state?.code_version)
    const installed = Boolean(pythonPath && codePath)

    let message = '引擎未安装'
    if (installed) message = this.child ? '运行中' : '已停止'

    return {
      installed,
      running: this.child !== null,
      codeVersion: state?.current ?? state?.code_version ?? null,
      envId: state?.env_id ?? null,
      channel: state?.channel ?? null,
      pid: this.child?.pid ?? null,
      port: this.port,
      pythonPath,
      codePath,
      engineRoot: paths.engine,
      message
    }
  }

  async start(): Promise<{ ok: boolean; message: string; port?: number }> {
    if (this.child) return { ok: false, message: '引擎已在运行' }

    const status = this.status()
    if (!status.installed || !status.pythonPath || !status.codePath) {
      return {
        ok: false,
        message: '引擎尚未安装，点「安装引擎」从 Release 拉取'
      }
    }

    const port = await pickFreePort()
    mkdirSync(paths.data, { recursive: true })

    const child = spawn(status.pythonPath, ['server.py', '-p', String(port)], {
      cwd: status.codePath,
      env: {
        ...process.env,
        MZXY_DATA_DIR: paths.data,
        // OCR 模型在 env 包里，代码目录里没有 bin/ocr_model
        MZXY_OCR_MODEL_DIR: join(paths.engineEnv, status.envId ?? '', 'bin', 'ocr_model'),
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    child.stdout?.on('data', (d) => console.log('[engine]', String(d).trimEnd()))
    child.stderr?.on('data', (d) => console.error('[engine]', String(d).trimEnd()))
    child.on('exit', (code) => {
      console.log(`[engine] 退出，code=${code}`)
      this.child = null
      this.port = null
    })

    this.child = child
    this.port = port

    const alive = await waitHealthy(port, 30_000)
    if (!alive) {
      this.stop()
      return { ok: false, message: '引擎启动超时（30 秒内 /test 未就绪）' }
    }
    return { ok: true, message: '引擎已启动', port }
  }

  stop(): void {
    const pid = this.child?.pid
    this.child = null
    this.port = null
    if (!pid) return
    try {
      // Windows 上必须杀进程树：python 会再拉 OCR 服务等子进程
      spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true })
    } catch {
      /* ignore */
    }
  }
}

function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => resolve(port))
    })
  })
}

async function waitHealthy(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await ping(port)) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

/**
 * 探活必须走 Node 的 http，不能用全局 fetch / net.fetch：
 * 后两者用 Chromium 网络栈，会跟随系统代理，用户开着 Clash 时
 * 对 127.0.0.1 的请求会被代理拦掉，导致引擎明明起来了却判超时。
 */
function ping(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpGet(
      { host: '127.0.0.1', port, path: '/test', timeout: 2000 },
      (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      }
    )
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

export const engine = new EngineManager()

// app 退出时确保子进程一起收掉（before-quit 里也会再调一次）
app.on('will-quit', () => engine.stop())
