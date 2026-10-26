import { reactive, ref } from 'vue'
import { api } from '../api'
import type { EngineInstallEvent, EngineStatus } from '../../../shared/types'

/**
 * 引擎状态与操作。
 *
 * 模块级单例：所有视图共享同一份状态，切页面不会重复轮询。
 */
const status = ref<EngineStatus | null>(null)
const rootDir = ref('')
const engineBytes = ref(0)
const working = ref(false)

const install = reactive({
  active: false,
  text: '',
  percent: 0,
  error: ''
})

let started = false

async function refresh(): Promise<void> {
  status.value = await api.engine.status()
}

async function refreshPaths(): Promise<void> {
  const p = await api.paths.get()
  rootDir.value = p.rootDir
  engineBytes.value = p.engineBytes
}

function handleEvent(e: EngineInstallEvent): void {
  switch (e.type) {
    case 'checking':
      install.active = true
      install.text = '检查引擎版本…'
      install.percent = 0
      install.error = ''
      break
    case 'uptodate':
      install.active = false
      install.text = '引擎已是最新'
      install.percent = 0
      break
    case 'plan': {
      const envMb = (e.envSize / 1024 / 1024).toFixed(0)
      const codeMb = (e.codeSize / 1024 / 1024).toFixed(1)
      install.active = true
      install.error = ''
      install.percent = 0
      install.text = e.needEnv
        ? `准备下载环境包 ${envMb} MB + 代码包 ${codeMb} MB`
        : `准备下载代码包 ${codeMb} MB`
      break
    }
    case 'download':
      install.active = true
      install.text = `下载${e.target === 'env' ? '环境' : '代码'} ${e.percent}%`
      install.percent = e.percent
      break
    case 'extract':
      install.text = `解压${e.target === 'env' ? '环境' : '代码'}包…`
      install.percent = 100
      break
    case 'done':
      install.active = false
      install.text = `引擎已就绪：${e.codeVersion}`
      install.percent = 100
      break
    case 'error':
      install.active = false
      install.error = e.message
      break
  }
}

export function useEngine() {
  if (!started) {
    started = true
    void refresh()
    void refreshPaths()
    window.setInterval(() => {
      void refresh()
    }, 3000)
    api.engine.onEvent(handleEvent)
  }

  async function start(): Promise<string> {
    working.value = true
    try {
      const r = await api.engine.start()
      return r.message
    } finally {
      working.value = false
      await refresh()
    }
  }

  async function stop(): Promise<string> {
    working.value = true
    try {
      const r = await api.engine.stop()
      return r.message
    } finally {
      working.value = false
      await refresh()
    }
  }

  async function installEngine(): Promise<string> {
    install.active = true
    install.text = '检查引擎版本…'
    install.percent = 0
    install.error = ''
    const r = await api.engine.install()
    if (!r.ok) {
      install.active = false
      install.error = r.message
    }
    await Promise.all([refresh(), refreshPaths()])
    return r.message
  }

  return {
    status,
    rootDir,
    engineBytes,
    working,
    install,
    refresh,
    refreshPaths,
    start,
    stop,
    installEngine
  }
}
