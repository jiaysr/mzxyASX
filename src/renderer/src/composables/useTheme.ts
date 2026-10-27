import { computed, ref } from 'vue'
import { parseHex, primaryRamp } from '../utils/color'

/** 一套配色：只用一个主色，按钮/选中态/图标都由它派生 */
export interface ColorTheme {
  id: string
  name: string
  primary: string
  /** 内置配色不能删 */
  builtin?: boolean
}

const MODE_KEY = 'mzxy.theme'
const THEME_KEY = 'mzxy.colorTheme'
const CUSTOM_KEY = 'mzxy.customThemes'

/** 和原版 MFA（SukiUI）一致的四套内置配色 */
export const BUILTIN_THEMES: ColorTheme[] = [
  { id: 'orange', name: 'Orange', primary: '#d48806', builtin: true },
  { id: 'red', name: 'Red', primary: '#D03A2F', builtin: true },
  { id: 'green', name: 'Green', primary: '#537834', builtin: true },
  { id: 'blue', name: 'Blue', primary: '#0A59F7', builtin: true }
]

const DEFAULT_ID = 'blue'

function readCustom(): ColorTheme[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw
      .filter(
        (t): t is ColorTheme =>
          !!t &&
          typeof (t as ColorTheme).id === 'string' &&
          typeof (t as ColorTheme).name === 'string' &&
          !!parseHex((t as ColorTheme).primary ?? '')
      )
      // 只取用得上的三个字段，老数据里多余的键自然丢掉
      .map((t) => ({ id: t.id, name: t.name, primary: t.primary }))
  } catch {
    return []
  }
}

const isDark = ref(localStorage.getItem(MODE_KEY) === 'dark')
const customThemes = ref<ColorTheme[]>(readCustom())
const activeId = ref(localStorage.getItem(THEME_KEY) ?? DEFAULT_ID)

const themes = computed<ColorTheme[]>(() => [...BUILTIN_THEMES, ...customThemes.value])

const activeTheme = computed<ColorTheme>(
  () => themes.value.find((t) => t.id === activeId.value) ?? BUILTIN_THEMES[3]
)

/**
 * 把当前主题写进 CSS 变量。
 *
 * 用行内样式而不是 stylesheet：`html.dark` 的选择器比 `:root` 权重高，
 * 只有行内样式能同时盖住亮色和暗色两套变量。
 */
function apply(): void {
  const root = document.documentElement
  root.classList.toggle('dark', isDark.value)

  const theme = activeTheme.value
  for (const [name, value] of Object.entries(primaryRamp(theme.primary, isDark.value))) {
    root.style.setProperty(name, value)
  }
}

// 模块加载即生效，避免首屏闪一下默认蓝
apply()

export function useTheme() {
  const mode = computed<'light' | 'dark'>(() => (isDark.value ? 'dark' : 'light'))

  function setMode(next: 'light' | 'dark'): void {
    if (isDark.value === (next === 'dark')) return
    isDark.value = next === 'dark'
    localStorage.setItem(MODE_KEY, isDark.value ? 'dark' : 'light')
    apply()
  }

  function toggle(): void {
    setMode(isDark.value ? 'light' : 'dark')
  }

  function setTheme(id: string): void {
    if (!themes.value.some((t) => t.id === id)) return
    activeId.value = id
    localStorage.setItem(THEME_KEY, id)
    apply()
  }

  /** 新建自定义主题：成功返回 null，失败返回错误文案 */
  function addCustomTheme(input: { name: string; primary: string }): string | null {
    const name = input.name.trim()
    if (!name) return '请填主题名称'
    if (themes.value.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return `主题「${name}」已存在`
    }
    if (!parseHex(input.primary)) return '颜色格式不对'

    const theme: ColorTheme = {
      id: `custom_${Date.now().toString(36)}`,
      name,
      primary: input.primary
    }
    customThemes.value = [...customThemes.value, theme]
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customThemes.value))
    setTheme(theme.id)
    return null
  }

  function removeCustomTheme(id: string): void {
    const target = customThemes.value.find((t) => t.id === id)
    if (!target || target.builtin) return
    customThemes.value = customThemes.value.filter((t) => t.id !== id)
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customThemes.value))
    // 删掉正在用的主题就退回默认蓝
    if (activeId.value === id) setTheme(DEFAULT_ID)
  }

  return {
    isDark,
    mode,
    setMode,
    toggle,
    themes,
    activeId,
    activeTheme,
    setTheme,
    addCustomTheme,
    removeCustomTheme
  }
}
