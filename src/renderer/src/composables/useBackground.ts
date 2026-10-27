import { computed, reactive } from 'vue'
import { api } from '../api'

export type BgStyle = 'flat' | 'gradient' | 'gradient-soft' | 'gradient-dark' | 'bubble'

/** 和原版 MFA（SukiUI 的 SukiBackgroundStyle）对齐的五种 */
export const BG_STYLES: { id: BgStyle; label: string; desc: string }[] = [
  { id: 'flat', label: '纯色', desc: '默认，最省性能' },
  { id: 'gradient', label: '渐变', desc: '主色柔光，偏左上' },
  { id: 'gradient-soft', label: '柔和渐变', desc: '更淡，适合长时间盯着看' },
  { id: 'gradient-dark', label: '浓渐变', desc: '颜色更重，暗色下更明显' },
  { id: 'bubble', label: '气泡', desc: '两团模糊光斑，可缓慢漂移' }
]

const KEY = 'mzxy.background'

interface BgState {
  style: BgStyle
  animation: boolean
  transition: boolean
  /** 背景图路径；图片内容不放 localStorage，重启时按路径读回 */
  imagePath: string
  imageOpacity: number
}

const DEFAULTS: BgState = {
  style: 'flat',
  animation: false,
  transition: true,
  imagePath: '',
  imageOpacity: 0.35
}

const IDS = BG_STYLES.map((s) => s.id)

function read(): BgState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<BgState>
    return {
      style: IDS.includes(raw.style as BgStyle) ? (raw.style as BgStyle) : DEFAULTS.style,
      animation: raw.animation === true,
      transition: raw.transition !== false,
      imagePath: typeof raw.imagePath === 'string' ? raw.imagePath : '',
      imageOpacity:
        typeof raw.imageOpacity === 'number'
          ? Math.min(1, Math.max(0.05, raw.imageOpacity))
          : DEFAULTS.imageOpacity
    }
  } catch {
    return { ...DEFAULTS }
  }
}

const state = reactive<BgState>(read())
/** data URL 只在内存里，避免把几 MB 的 base64 塞进 localStorage */
let imageUrl = ''

function apply(): void {
  const root = document.documentElement
  root.dataset.bg = state.style
  root.classList.toggle('bg-anim', state.animation)
  root.classList.toggle('bg-transition', state.transition)
  root.classList.toggle('bg-on', state.style !== 'flat' || Boolean(state.imagePath))
  root.style.setProperty('--mzxy-bg-image', imageUrl ? `url("${imageUrl}")` : 'none')
  root.style.setProperty('--mzxy-bg-opacity', String(state.imagePath ? state.imageOpacity : 0))
}

function save(): void {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      style: state.style,
      animation: state.animation,
      transition: state.transition,
      imagePath: state.imagePath,
      imageOpacity: state.imageOpacity
    })
  )
  apply()
}

const hasImage = computed(() => Boolean(state.imagePath))

/** 启动时按上次的路径把图片读回来（异步，读不到就当没设） */
async function restoreImage(): Promise<void> {
  if (!state.imagePath) return
  try {
    const url = await api.background.read(state.imagePath)
    if (url) {
      imageUrl = url
      apply()
    } else {
      // 文件被删了或格式不支持，静默清掉，别让界面一直空着
      state.imagePath = ''
      save()
    }
  } catch {
    /* 读不到就当没设 */
  }
}

apply()
void restoreImage()

export function useBackground() {
  function setStyle(id: BgStyle): void {
    if (!IDS.includes(id) || state.style === id) return
    state.style = id
    save()
  }

  function setAnimation(value: boolean): void {
    state.animation = value
    save()
  }

  function setTransition(value: boolean): void {
    state.transition = value
    save()
  }

  function setImageOpacity(value: number): void {
    state.imageOpacity = Math.min(1, Math.max(0.05, value))
    save()
  }

  /** 选一张图；成功返回 null */
  async function pickImage(): Promise<string | null> {
    try {
      const picked = await api.background.pick()
      if (!picked) return null
      state.imagePath = picked.path
      imageUrl = picked.dataUrl
      save()
      return null
    } catch (e) {
      return e instanceof Error ? e.message : '选择图片失败'
    }
  }

  function clearImage(): void {
    state.imagePath = ''
    imageUrl = ''
    save()
  }

  return { state, hasImage, setStyle, setAnimation, setTransition, setImageOpacity, pickImage, clearImage }
}
