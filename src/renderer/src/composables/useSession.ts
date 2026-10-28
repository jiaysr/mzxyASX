import { computed, ref, watch } from 'vue'
import { useEngine } from './useEngine'

/**
 * 会话：脚本服务地址
 *
 * 默认连本机脚本服务（端口由脚本目录的 deploy.yaml 决定，启动后从日志读取），
 * 也可以在登录页手动填别的地址（比如手动起的服务，或局域网里的另一台机器）。
 */
const STORAGE_KEY = 'mzxy.address'

const address = ref(localStorage.getItem(STORAGE_KEY) ?? '')
const loggedIn = ref(false)

/** 去掉协议前缀和多余空格 */
export function normalizeAddress(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
}

/** 是不是本机地址（本机地址要跟着动态端口走） */
function isLocal(addr: string): boolean {
  return /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(addr)
}

async function ping(addr: string, timeout = 5000): Promise<boolean> {
  try {
    const res = await fetch(`http://${addr}/test`, { signal: AbortSignal.timeout(timeout) })
    if (!res.ok) return false
    const text = await res.text()
    return text.includes('success')
  } catch {
    return false
  }
}

export function useSession() {
  const { status } = useEngine()

  const localAddress = computed(() => {
    const port = status.value?.port
    return port ? `127.0.0.1:${port}` : ''
  })

  /**
   * 本机地址跟随引擎端口变化：
   *   - 引擎起来 -> 自动填当前端口（引擎重启会换端口）
   *   - 本应用拉起的引擎停了 -> 清掉过期的本机地址，避免用户拿着旧端口点连接
   *
   * 只有「刚才是我们拉起的引擎、现在停了」才清。手动起的服务、局域网里的
   * 另一台机器都不归主进程管，status.port 一直是空的，不能把地址一起清掉。
   */
  let lastLocal = ''

  watch(
    localAddress,
    (next) => {
      if (next) {
        if (!address.value || isLocal(address.value)) address.value = next
        lastLocal = next
        return
      }
      if (lastLocal && address.value === lastLocal) address.value = ''
      lastLocal = ''
    },
    { immediate: true }
  )

  async function login(target: string): Promise<{ ok: boolean; message: string }> {
    const addr = normalizeAddress(target)
    if (!addr) return { ok: false, message: '请输入地址，例如 127.0.0.1:22267' }
    if (!(await ping(addr))) {
      const hint = isLocal(addr) ? '（本机脚本服务可能没启动，先点下面的「启动脚本服务」）' : ''
      return { ok: false, message: `连不上 ${addr}${hint}` }
    }
    address.value = addr
    localStorage.setItem(STORAGE_KEY, addr)
    loggedIn.value = true
    return { ok: true, message: '连接成功' }
  }

  /** 用已保存的地址后台判断一次，连上就进主界面；不重试，避免启动拖沓。 */
  async function tryAutoLogin(): Promise<boolean> {
    if (!address.value) return false
    if (!(await ping(address.value, 2500))) return false
    loggedIn.value = true
    return true
  }

  function logout(): void {
    loggedIn.value = false
  }

  return { address, loggedIn, localAddress, login, tryAutoLogin, logout }
}
