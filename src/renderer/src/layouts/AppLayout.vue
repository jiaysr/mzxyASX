<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NIcon, NLayout, NLayoutContent, NLayoutSider, NTag } from 'naive-ui'
import AppIcon from '../components/AppIcon.vue'
import ConfigRail from '../components/ConfigRail.vue'
import TreeMenu from '../components/TreeMenu.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { useScript } from '../composables/useScript'
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
const { currentConfig, currentMenu, isHome, ready, init } = useConfig()
const { switchTo, close } = useScript()

const isSettings = computed(() => route.name === 'settings')
const engineReady = computed(() => Boolean(status.value?.running))

/** 引擎起来后拉配置 / 菜单 / 词条 */
watch(
  () => status.value?.running,
  async (running) => {
    if (!running) return
    try {
      await init()
    } catch {
      /* 界面会显示空态，用户可切到引擎页排查 */
    }
  },
  { immediate: true }
)

/** 切换配置时重连 WebSocket（Home 配置没有脚本实例，不连） */
watch(
  [() => currentConfig.value, () => status.value?.running],
  ([name, running]) => {
    if (!running) {
      close()
      return
    }
    if (name && name !== 'Home') switchTo(name)
    else close()
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
</script>

<template>
  <n-layout position="absolute" has-sider>
    <n-layout-sider bordered :width="64" :native-scrollbar="false">
      <config-rail />
    </n-layout-sider>

    <n-layout-sider v-if="!isSettings" bordered :width="184" :native-scrollbar="false">
      <tree-menu v-if="ready" />
      <div v-else class="tree-placeholder">加载中…</div>
    </n-layout-sider>

    <n-layout>
      <header class="header">
        <div class="header-left">
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
  </n-layout>
</template>

<style scoped>
.header {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-bottom: 1px solid var(--n-border-color, #ebedf0);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.content {
  height: calc(100% - 50px);
  overflow: auto;
  padding: 16px 18px 20px;
}

.tree-placeholder {
  padding: 20px 16px;
  font-size: 12px;
  opacity: 0.4;
}
</style>
