import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * 简单的响应式断点（原版用 responsive_builder 的 mobile/tablet/desktop）
 *
 *   >= 1100  宽屏：三栏（配置栏 + 二级菜单 + 内容）
 *   900-1100 中屏：三栏，但左栏收窄
 *   < 900    窄屏：二级菜单收进抽屉，从顶栏按钮唤出
 */
const width = ref(window.innerWidth)

let bound = false

export function useResponsive() {
  if (!bound) {
    bound = true
    window.addEventListener('resize', () => {
      width.value = window.innerWidth
    })
  }

  const isNarrow = computed(() => width.value < 900)
  const isWide = computed(() => width.value >= 1100)
  /** 左栏宽度随屏幕收缩 */
  const railWidth = computed(() => (isWide.value ? 64 : 56))

  return { width, isNarrow, isWide, railWidth }
}

/** 只在组件内用一次时方便挂载监听 */
export function useWindowWidth() {
  const w = ref(window.innerWidth)
  const onResize = (): void => {
    w.value = window.innerWidth
  }
  onMounted(() => window.addEventListener('resize', onResize))
  onUnmounted(() => window.removeEventListener('resize', onResize))
  return w
}
