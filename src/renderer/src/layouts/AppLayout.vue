<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutSider,
  NTag
} from 'naive-ui'
import AppIcon from '../components/AppIcon.vue'
import ConfigRail from '../components/ConfigRail.vue'
import TreeMenu from '../components/TreeMenu.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { useResponsive } from '../composables/useResponsive'
import { connectAll } from '../composables/useScript'
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

const engineLabel = computed(() => {
  if (!status.value) return '读取中'
  if (!status.value.installed) return '未安装'
  return status.value.running ? '运行中' : '已停止'
})

const engineTagType = computed<'default' | 'success' | 'warning'>(() => {
  if (!status.value?.installed) return 'default'
  return status.value.running ? 'success' : 'warning'
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
    <n-layout-sider bordered :width="railWidth" :native-scrollbar="false">
      <config-rail />
    </n-layout-sider>

    <!-- 宽屏：二级菜单常驻；窄屏：收进抽屉 -->
    <n-layout-sider v-if="!isSettings && !isNarrow" bordered :width="184" :native-scrollbar="false">
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

      <n-layout-content class="content">
        <component :is="content" :key="`${currentConfig}-${currentMenu}-${isSettings}`" />
      </n-layout-content>
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
