<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NIcon,
  NLayout,
  NLayoutSider,
  NTag
} from 'naive-ui'
import AppIcon from '../components/AppIcon.vue'
import ConfigRail from '../components/ConfigRail.vue'
import TreeMenu from '../components/TreeMenu.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { useResponsive } from '../composables/useResponsive'
import { ScriptState, connectAll, getStore } from '../composables/useScript'
import { useSession } from '../composables/useSession'
import { useTheme } from '../composables/useTheme'
import { tr } from '../i18n'
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
const { isNarrow, railWidth } = useResponsive()
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

const title = computed(() => (isSettings.value ? '设置' : tr(currentMenu.value)))

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

const engineTagType = computed<'default' | 'success' | 'warning' | 'info'>(() => {
  if (!status.value?.installed || !status.value.running) return 'default'
  if (scriptState.value === null) return 'success'
  switch (scriptState.value) {
    case ScriptState.RUNNING:
      return 'success'
    case ScriptState.WARNING:
      return 'warning'
    case ScriptState.UPDATING:
      return 'info'
    default:
      return 'default'
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
  <n-layout position="absolute" has-sider>
    <n-layout-sider bordered :width="railWidth">
      <config-rail />
    </n-layout-sider>

    <!-- 宽屏：二级菜单常驻；窄屏：收进抽屉 -->
    <n-layout-sider v-if="!isSettings && !isNarrow" bordered :width="184">
      <tree-menu v-if="ready" />
      <div v-else class="tree-placeholder">加载中…</div>
    </n-layout-sider>

    <n-layout>
      <header class="header">
        <div class="header-left">
          <n-button v-if="isNarrow && !isSettings" size="small" quaternary @click="drawerOpen = true">
            ☰
          </n-button>
          <n-button v-if="isSettings" size="small" quaternary @click="backHome">← 返回</n-button>
          <span class="header-title">{{ title }}</span>
        </div>
        <div class="header-right">
          <n-tag :type="engineTagType" size="small" round :bordered="false">{{ engineLabel }}</n-tag>
          <n-button quaternary circle size="small" @click="toggle">
            <template #icon>
              <n-icon>
                <app-icon :name="isDark ? 'sun' : 'moon'" />
              </n-icon>
            </template>
          </n-button>
        </div>
      </header>

      <!-- 用普通 div：NLayoutContent 会再套一层滚动容器，和这里的 overflow 叠成两层滚动条 -->
      <div class="content">
        <component :is="content" :key="`${currentConfig}-${currentMenu}-${isSettings}`" />
      </div>
    </n-layout>

    <n-drawer v-model:show="drawerOpen" :width="220" placement="left">
      <n-drawer-content :title="currentConfig" :native-scrollbar="false">
        <div @click="onPickMenu">
          <tree-menu v-if="ready" />
        </div>
      </n-drawer-content>
    </n-drawer>
  </n-layout>
</template>

<style scoped>
.header {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--n-border-color, #ebedf0);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
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
  gap: 8px;
  flex: 0 0 auto;
}

.content {
  height: calc(100% - 50px);
  overflow: auto;
  padding: 16px 18px 20px;
}

/* 总览是「撑满一屏」的页面：外层不滚动，避免和内部日志滚动条打架 */
.content:has(> .overview) {
  overflow: hidden;
}

/* 总览是「撑满一屏」的页面：外层不滚动，避免和内部日志滚动条打架 */
.content:has(> .overview) {
  overflow: hidden;
}

.tree-placeholder {
  padding: 20px 16px;
  font-size: 12.5px;
  opacity: 0.4;
}

/* 窄屏时内容区留白收一点 */
@media (max-width: 900px) {
  .content {
    padding: 12px 12px 16px;
  }
}
</style>
