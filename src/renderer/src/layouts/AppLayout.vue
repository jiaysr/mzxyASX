<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import ConfigRail from '../components/ConfigRail.vue'
import TreeMenu from '../components/TreeMenu.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { useResponsive } from '../composables/useResponsive'
import { ScriptState, connectAll, getStore } from '../composables/useScript'
import { useSession } from '../composables/useSession'
import { useTheme } from '../composables/useTheme'
import { tr, trMenu } from '../i18n'
import ArgsView from '../views/ArgsView.vue'
import HomeView from '../views/HomeView.vue'
import OverviewView from '../views/OverviewView.vue'
import SettingsView from '../views/SettingsView.vue'
import ToolView from '../views/ToolView.vue'
import UpdaterView from '../views/UpdaterView.vue'

const route = useRoute()
const router = useRouter()
const { isDark, toggle } = useTheme()
const { status } = useEngine()
const { address } = useSession()
const { isNarrow, railWidth, treeWidth } = useResponsive()
const { configs, currentConfig, currentMenu, isHome, ready, init } = useConfig()

const isSettings = computed(() => route.name === 'settings')
const engineReady = computed(() => Boolean(status.value?.running))
const drawerOpen = ref(false)

/** 会话就绪后拉配置 / 菜单 / 词条 */
watch(
  address,
  async (addr) => {
    if (!addr) return
    try {
      await init()
    } catch {
      /* 界面会显示空态 */
    }
  },
  { immediate: true }
)

/** 多配置并行：所有脚本配置都连上 WebSocket（Home 是固定页，不连） */
watch(
  [configs, address],
  ([list, addr]) => {
    if (!addr) return
    connectAll(list.filter((name) => name !== 'Home'))
  },
  { immediate: true }
)

/** 内容区：Home 配置下是三个固定页，脚本配置下是 Overview 或任务参数 */
const content = computed(() => {
  if (isSettings.value) return SettingsView
  if (isHome.value) {
    switch (currentMenu.value) {
      case 'Updater':
        return UpdaterView
      case 'Tool':
        return ToolView
      default:
        return HomeView
    }
  }
  return currentMenu.value === 'Overview' ? OverviewView : ArgsView
})

/** 总览要「撑满一屏」，外层不能再滚，否则和内部日志滚动条打架 */
const contentFill = computed(
  () => !isSettings.value && !isHome.value && currentMenu.value === 'Overview'
)

/** Home 配置下是「分组名」，脚本配置下是「任务名」，两套词条由 trMenu 统一兜底 */
const title = computed(() => (isSettings.value ? '设置' : trMenu(currentMenu.value)))

/**
 * 顶栏状态：优先反映「当前配置的脚本状态」。
 *
 * 之前这里取的是引擎进程状态，脚本崩了但引擎还在，就会一直显示运行中——
 * 脚本状态来自 WebSocket 推送的 state（0 未运行 / 1 运行中 / 2 异常 / 3 更新中）。
 */
const scriptState = computed(() => (isHome.value ? null : getStore(currentConfig.value).state))

const engineLabel = computed(() => {
  if (!status.value) return '读取中'
  if (!status.value.installed) return '引擎未安装'
  if (!status.value.running) return '引擎未启动'
  if (scriptState.value === null) return '引擎运行中'
  switch (scriptState.value) {
    case ScriptState.RUNNING:
      return '运行中'
    case ScriptState.WARNING:
      return '异常'
    case ScriptState.UPDATING:
      return '更新中'
    default:
      return '已停止'
  }
})

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

const engineTagType = computed<TagType>(() => {
  if (!status.value?.installed || !status.value.running) return 'info'
  if (scriptState.value === null) return 'success'
  switch (scriptState.value) {
    case ScriptState.RUNNING:
      return 'success'
    case ScriptState.WARNING:
      return 'warning'
    case ScriptState.UPDATING:
      return 'primary'
    default:
      return 'info'
  }
})

function backHome(): void {
  void router.push({ name: 'main' })
}

function onPickMenu(): void {
  drawerOpen.value = false
}
</script>

<template>
  <div class="layout">
    <aside class="rail" :style="{ width: `${railWidth}px` }">
      <config-rail />
    </aside>

    <!-- 宽屏：二级菜单常驻；窄屏：收进抽屉 -->
    <aside v-if="!isSettings && !isNarrow" class="tree" :style="{ flex: `0 0 ${treeWidth}px`, width: `${treeWidth}px` }">
      <tree-menu v-if="ready" />
      <div v-else class="tree-placeholder">加载中…</div>
    </aside>

    <main class="main">
      <header class="header">
        <div class="header-left">
          <el-tooltip
            v-if="isNarrow && !isSettings"
            content="菜单"
            placement="bottom"
            :show-after="300"
          >
            <el-button text circle size="small" @click="drawerOpen = true">
              <app-icon name="menu" :size="17" />
            </el-button>
          </el-tooltip>

          <!-- 图标返回键：和右侧的主题切换同一个尺寸，左右对称 -->
          <el-tooltip v-if="isSettings" content="返回" placement="bottom" :show-after="300">
            <el-button text circle size="small" class="back" @click="backHome">
              <app-icon name="back" :size="17" />
            </el-button>
          </el-tooltip>

          <span class="header-title">{{ title }}</span>
        </div>
        <div class="header-right">
          <el-tag :type="engineTagType" size="small" round effect="light" :closable="false">
            {{ engineLabel }}
          </el-tag>
          <el-button text circle :title="tr('change_theme')" @click="toggle">
            <app-icon :name="isDark ? 'sun' : 'moon'" :size="16" />
          </el-button>
        </div>
      </header>

      <div class="content" :class="{ fill: contentFill }">
        <component :is="content" :key="`${currentConfig}-${currentMenu}-${isSettings}`" />
      </div>
    </main>

    <el-drawer v-model="drawerOpen" direction="ltr" :size="`${treeWidth + 16}px`" :title="currentConfig">
      <div @click="onPickMenu">
        <tree-menu v-if="ready" />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.layout {
  height: 100%;
  display: flex;
  overflow: hidden;
}

.rail {
  flex: 0 0 auto;
  height: 100%;
  background: var(--el-fill-color-light);
  border-right: 1px solid var(--el-border-color-light);
  overflow: hidden;
}

.tree {
  flex: 0 0 232px;
  height: 100%;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
  overflow: hidden;
}

.main {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
}

.header {
  flex: 0 0 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 16px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* 返回键比主题按钮略靠左一点，视觉上贴住标题 */
.back {
  margin-left: -4px;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 20px;
}

/* 总览这类「撑满一屏」的页面：外层不滚动，避免和内部日志滚动条打架 */
.content.fill {
  overflow: hidden;
  padding: 14px 16px;
}

.tree-placeholder {
  padding: 20px 16px;
  font-size: 12.5px;
  color: var(--el-text-color-placeholder);
}

/* 窄屏时内容区留白收一点 */
@media (max-width: 900px) {
  .content {
    padding: 12px 12px 16px;
  }
}
</style>
