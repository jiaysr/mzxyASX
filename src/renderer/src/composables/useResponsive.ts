import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * 简单的响应式断点（原版用 responsive_builder 的 mobile/tablet/desktop）
 *
 *   >= 1400  超宽：配置栏 76 + 二级菜单 252
 *   >= 1100  宽屏：配置栏 72 + 二级菜单 232
 *   900-1100 中屏：收窄到 62 + 208
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
  const isUltra = computed(() => width.value >= 1400)

  /** 左侧配置栏（只有图标和短标签） */
  const railWidth = computed(() => (isUltra.value ? 76 : isWide.value ? 72 : 62))
  /** 二级菜单：任务名最长有「仙府九重天」这种，得留够 */
  const treeWidth = computed(() => (isUltra.value ? 252 : isWide.value ? 232 : 208))

  return { width, isNarrow, isWide, isUltra, railWidth, treeWidth }
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
