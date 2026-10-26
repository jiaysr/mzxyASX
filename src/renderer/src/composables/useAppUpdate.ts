import { reactive, ref } from 'vue'
import { api } from '../api'
import type { AppInfo, UpdateEvent } from '../../../shared/types'

/** 应用自身的信息与自更新状态（模块级单例） */
const info = ref<AppInfo | null>(null)

const update = reactive({
  checking: false,
  available: '',
  percent: 0,
  speed: 0,
  ready: null as { version: string; busy: boolean } | null,
  error: ''
})

let started = false

function handleEvent(e: UpdateEvent): void {
  switch (e.type) {
    case 'checking':
      update.checking = true
      update.error = ''
      break
    case 'available':
      update.checking = false
      update.available = e.version
      update.percent = 0
      break
    case 'none':
      update.checking = false
      update.available = ''
      update.ready = null
      update.error = ''
      break
    case 'progress':
      update.percent = e.percent
      update.speed = e.bytesPerSecond
      break
    case 'ready':
      update.checking = false
      update.percent = 100
      update.ready = { version: e.version, busy: e.busy }
      break
    case 'error':
      update.checking = false
      update.error = e.message
      break
  }
}

export function useAppUpdate() {
  if (!started) {
    started = true
    void api.info().then((v) => {
      info.value = v
    })
    api.update.onEvent(handleEvent)
  }

  async function check(): Promise<string> {
    const r = await api.update.check()
    return r.message
  }

  async function install(): Promise<string> {
    const r = await api.update.install()
    return r.message
  }

  return { info, update, check, install }
}
