import { computed, ref } from 'vue'
import { darkTheme } from 'naive-ui'
import { darkOverrides, lightOverrides } from '../theme'

const STORAGE_KEY = 'mzxy.theme'
const isDark = ref(localStorage.getItem(STORAGE_KEY) === 'dark')

/** 亮/暗主题（模块级单例，持久化到 localStorage） */
export function useTheme() {
  const theme = computed(() => (isDark.value ? darkTheme : null))
  const themeOverrides = computed(() => (isDark.value ? darkOverrides : lightOverrides))

  function toggle(): void {
    isDark.value = !isDark.value
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  }

  return { isDark, theme, themeOverrides, toggle }
}
