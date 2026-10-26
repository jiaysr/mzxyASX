import { useCallback, useEffect, useState } from 'react'
import type {
  AppInfo,
  EngineInstallEvent,
  EngineStatus,
  UpdateEvent
} from '../../shared/types'

interface UpdateState {
  checking: boolean
  available: string | null
  percent: number
  speed: number
  ready: { version: string; busy: boolean } | null
  error: string | null
}

interface EngineInstallState {
  active: boolean
  text: string
  percent: number
  error: string | null
}

const INITIAL_UPDATE: UpdateState = {
  checking: false,
  available: null,
  percent: 0,
  speed: 0,
  ready: null,
  error: null
}

const INITIAL_ENGINE_INSTALL: EngineInstallState = {
  active: false,
  text: '',
  percent: 0,
  error: null
}

export default function App(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [engine, setEngine] = useState<EngineStatus | null>(null)
  const [working, setWorking] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [update, setUpdate] = useState<UpdateState>(INITIAL_UPDATE)
  const [installing, setInstalling] = useState<EngineInstallState>(INITIAL_ENGINE_INSTALL)

  const refreshEngine = useCallback(async () => {
    setEngine(await window.api.engine.status())
  }, [])

  useEffect(() => {
    window.api.info().then(setInfo)
    refreshEngine()

    const timer = window.setInterval(refreshEngine, 3000)

    const offUpdate = window.api.update.onEvent((e: UpdateEvent) => {
      setUpdate((prev) => {
        switch (e.type) {
          case 'checking':
            return { ...prev, checking: true, error: null }
          case 'available':
            return { ...prev, checking: false, available: e.version, percent: 0 }
          case 'none':
            return { ...prev, checking: false, available: null, ready: null, error: null }
          case 'progress':
            return { ...prev, percent: e.percent, speed: e.bytesPerSecond }
          case 'ready':
            return {
              ...prev,
              checking: false,
              percent: 100,
              ready: { version: e.version, busy: e.busy }
            }
          case 'error':
            return { ...prev, checking: false, error: e.message }
          default:
            return prev
        }
      })
    })

    const offEngine = window.api.engine.onEvent((e: EngineInstallEvent) => {
      setInstalling((prev) => {
        switch (e.type) {
          case 'checking':
            return { active: true, text: '检查引擎版本…', percent: 0, error: null }
          case 'uptodate':
            return { active: false, text: '引擎已是最新', percent: 0, error: null }
          case 'plan': {
            const envMb = (e.envSize / 1024 / 1024).toFixed(0)
            const codeMb = (e.codeSize / 1024 / 1024).toFixed(1)
            return {
              active: true,
              text: e.needEnv
                ? `准备下载环境包 ${envMb} MB + 代码包 ${codeMb} MB`
                : `准备下载代码包 ${codeMb} MB`,
              percent: 0,
              error: null
            }
          }
          case 'download':
            return {
              ...prev,
              active: true,
              text: `下载${e.target === 'env' ? '环境' : '代码'} ${e.percent}%`,
              percent: e.percent
            }
          case 'extract':
            return {
              ...prev,
              active: true,
              text: `解压${e.target === 'env' ? '环境' : '代码'}包…`,
              percent: 100
            }
          case 'done':
            return {
              active: false,
              text: `引擎已就绪：${e.codeVersion}`,
              percent: 100,
              error: null
            }
          case 'error':
            return { active: false, text: '', percent: 0, error: e.message }
          default:
            return prev
        }
      })
    })

    return () => {
      window.clearInterval(timer)
      offUpdate()
      offEngine()
    }
  }, [refreshEngine])

  const flash = (msg: string): void => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3000)
  }

  const onStart = async (): Promise<void> => {
    setWorking(true)
    const r = await window.api.engine.start()
    setWorking(false)
    flash(r.message)
    refreshEngine()
  }

  const onStop = async (): Promise<void> => {
    setWorking(true)
    const r = await window.api.engine.stop()
    setWorking(false)
    flash(r.message)
    refreshEngine()
  }

  const onInstallEngine = async (): Promise<void> => {
    setInstalling({ active: true, text: '检查引擎版本…', percent: 0, error: null })
    const r = await window.api.engine.install()
    if (!r.ok) {
      setInstalling({ active: false, text: '', percent: 0, error: r.message })
    } else {
      setInstalling((prev) => ({ ...prev, active: false }))
      flash(r.message)
    }
    refreshEngine()
  }

  const onCheckUpdate = async (): Promise<void> => {
    const r = await window.api.update.check()
    flash(r.message)
  }

  const onInstall = async (): Promise<void> => {
    const r = await window.api.update.install()
    flash(r.message)
  }

  const statusTone = !engine?.installed ? 'idle' : engine.running ? 'ok' : 'warn'
  const engineBusy = installing.active

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>明珠轩辕</h1>
          <p className="subtitle">脚本控制台</p>
        </div>
        <div className="version">v{info?.version ?? '—'}</div>
      </header>

      <main className="grid">
        <section className="card">
          <div className="card-head">
            <h2>引擎</h2>
            <span className={`dot ${statusTone}`} />
            <span className="card-state">
              {engineBusy ? '处理中…' : (engine?.message ?? '读取中…')}
            </span>
          </div>

          <dl className="rows">
            <div>
              <dt>代码版本</dt>
              <dd>{engine?.codeVersion ?? '—'}</dd>
            </div>
            <div>
              <dt>运行环境</dt>
              <dd>{engine?.envId ?? '—'}</dd>
            </div>
            <div>
              <dt>端口</dt>
              <dd>{engine?.port ?? '—'}</dd>
            </div>
            <div>
              <dt>目录</dt>
              <dd>
                <button className="link" onClick={() => window.api.openPath('engine')}>
                  打开
                </button>
              </dd>
            </div>
          </dl>

          {engineBusy && (
            <div className="progress">
              <div className="bar">
                <span style={{ width: `${installing.percent}%` }} />
              </div>
              <span className="progress-text">{installing.text}</span>
            </div>
          )}

          {!engineBusy && installing.text && !installing.error && (
            <div className="banner ok">{installing.text}</div>
          )}

          {installing.error && <div className="banner error">{installing.error}</div>}

          <div className="actions">
            <button
              className="btn primary"
              disabled={working || engineBusy || !engine?.installed || engine?.running}
              onClick={onStart}
            >
              启动
            </button>
            <button
              className="btn"
              disabled={working || engineBusy || !engine?.running}
              onClick={onStop}
            >
              停止
            </button>
            <button
              className="btn"
              disabled={engineBusy || engine?.running}
              onClick={onInstallEngine}
            >
              {engine?.installed ? '更新引擎' : '安装引擎'}
            </button>
            <button className="btn ghost" onClick={() => window.api.openPath('data')}>
              数据目录
            </button>
          </div>

          {!engine?.installed && !engineBusy && !installing.error && (
            <p className="hint">
              首次使用需要下载引擎（代码约 8MB + 运行环境约 235MB），从脚本仓库的 Release 拉取。
              引擎在跑任务时不能更新，请先停止。
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>应用更新</h2>
            {update.checking && <span className="card-state">检查中…</span>}
            {update.available && !update.ready && (
              <span className="card-state">发现 {update.available}</span>
            )}
            {update.ready && <span className="card-state ok-text">已下载</span>}
          </div>

          <dl className="rows">
            <div>
              <dt>当前版本</dt>
              <dd>v{info?.version ?? '—'}</dd>
            </div>
            <div>
              <dt>运行方式</dt>
              <dd>{info?.packaged ? '已安装' : '开发模式'}</dd>
            </div>
            <div>
              <dt>环境</dt>
              <dd>
                Electron {info?.electron ?? '—'} · Node {info?.node ?? '—'}
              </dd>
            </div>
          </dl>

          {update.available !== null && !update.ready && (
            <div className="progress">
              <div className="bar">
                <span style={{ width: `${update.percent}%` }} />
              </div>
              <span className="progress-text">
                {update.percent}% · {formatSpeed(update.speed)}
              </span>
            </div>
          )}

          {update.ready && (
            <div className={`banner ${update.ready.busy ? 'warn' : 'ok'}`}>
              {update.ready.busy
                ? `v${update.ready.version} 已下载，但引擎正在运行任务，请先停止引擎再重启更新。`
                : `v${update.ready.version} 已就绪，重启后生效。`}
            </div>
          )}

          {update.error && <div className="banner error">{update.error}</div>}

          <div className="actions">
            <button className="btn" disabled={update.checking} onClick={onCheckUpdate}>
              检查更新
            </button>
            <button className="btn primary" disabled={!update.ready} onClick={onInstall}>
              重启并更新
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>更新分三层：应用（本窗口）· 代码（code 包）· 依赖（env 包）</span>
        <span>{info?.platform}</span>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function formatSpeed(bytesPerSecond: number): string {
  if (!bytesPerSecond) return '—'
  const mb = bytesPerSecond / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(1)} MB/s` : `${Math.round(bytesPerSecond / 1024)} KB/s`
}
