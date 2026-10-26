import { computed, ref } from 'vue'
import { useEngine } from './useEngine'

/** 调度器数据：{ running: {name,next_run}, pending: [...], waiting: [...] } */
export interface ScheduleItem {
  name: string
  next_run: string
}

export interface Schedule {
  running: Partial<ScheduleItem>
  pending: ScheduleItem[]
  waiting: ScheduleItem[]
}

/** 引擎侧脚本状态，与 ScriptState 枚举一致 */
export const ScriptState = {
  INACTIVE: 0,
  RUNNING: 1,
  WARNING: 2,
  UPDATING: 3
} as const

const LOG_LIMIT = 500

const connected = ref(false)
const state = ref<number>(ScriptState.INACTIVE)
const schedule = ref<Schedule>({ running: {}, pending: [], waiting: [] })
const logs = ref<string[]>([])

let socket: WebSocket | null = null
let reconnectTimer: number | null = null
let currentName = ''
let manualClose = false

function pushLog(line: string): void {
  const arr = logs.value
  arr.push(line)
  // 只保留最近若干条，避免长时间运行内存膨胀
  if (arr.length > LOG_LIMIT) arr.splice(0, arr.length - LOG_LIMIT)
}

function handleMessage(raw: unknown): void {
  if (typeof raw !== 'string') return
  if (!raw.startsWith('{')) {
    pushLog(raw)
    return
  }
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    if (typeof data.state === 'number') {
      state.value = data.state
      return
    }
    if (data.schedule) {
      schedule.value = data.schedule as Schedule
    }
  } catch {
    pushLog(raw)
  }
}

function scheduleReconnect(): void {
  if (manualClose || !currentName) return
  if (reconnectTimer) return
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connect(currentName)
  }, 2000)
}

function connect(name: string): void {
  close(false)
  currentName = name
  manualClose = false

  const { status } = useEngine()
  const port = status.value?.port
  if (!port) {
    scheduleReconnect()
    return
  }

  try {
    socket = new WebSocket(`ws://127.0.0.1:${port}/ws/${name}`)
  } catch {
    scheduleReconnect()
    return
  }

  socket.onopen = () => {
    connected.value = true
  }
  socket.onmessage = (ev) => handleMessage(ev.data)
  socket.onclose = () => {
    connected.value = false
    socket = null
    scheduleReconnect()
  }
  socket.onerror = () => {
    connected.value = false
  }
}

function close(stopReconnect = true): void {
  if (stopReconnect) manualClose = true
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (socket) {
    socket.onclose = null
    socket.close()
    socket = null
  }
  connected.value = false
}

function send(text: string): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(text)
  }
}

/** 切换配置时重连 */
function switchTo(name: string): void {
  if (name === currentName && connected.value) return
  logs.value = []
  state.value = ScriptState.INACTIVE
  schedule.value = { running: {}, pending: [], waiting: [] }
  connect(name)
}

function start(): void {
  send('start')
  send('get_state')
}

function stop(): void {
  send('stop')
}

function clearLogs(): void {
  logs.value = []
}

const running = computed(() => state.value === ScriptState.RUNNING)

export function useScript() {
  return {
    connected,
    state,
    schedule,
    logs,
    running,
    connect,
    close,
    switchTo,
    start,
    stop,
    clearLogs
  }
}
