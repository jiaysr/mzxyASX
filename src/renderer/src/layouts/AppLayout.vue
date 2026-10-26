<script setup lang="ts">
import { computed, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutSider,
  NMenu,
  NTag,
  type MenuOption
} from 'naive-ui'
import AppIcon from '../components/AppIcon.vue'
import { useAppUpdate } from '../composables/useAppUpdate'
import { useEngine } from '../composables/useEngine'
import { useTheme } from '../composables/useTheme'

const route = useRoute()
const router = useRouter()
const { isDark, toggle } = useTheme()
const { status } = useEngine()
const { info } = useAppUpdate()

const menus: MenuOption[] = [
  { label: '引擎', key: 'engine', icon: () => h(AppIcon, { name: 'engine' }) },
  { label: '总览', key: 'overview', icon: () => h(AppIcon, { name: 'overview' }) },
  { label: '任务', key: 'tasks', icon: () => h(AppIcon, { name: 'tasks' }) },
  { label: '设置', key: 'settings', icon: () => h(AppIcon, { name: 'settings' }) }
]

const active = computed(() => String(route.name ?? 'engine'))
const title = computed(() => (route.meta.title as string | undefined) ?? '')

const engineLabel = computed(() => {
  if (!status.value) return '读取中'
  if (!status.value.installed) return '未安装'
  return status.value.running ? '运行中' : '已停止'
})

const engineTagType = computed<'default' | 'success' | 'warning'>(() => {
  if (!status.value?.installed) return 'default'
  return status.value.running ? 'success' : 'warning'
})

function onMenu(key: string): void {
  void router.push({ name: key })
}
</script>

<template>
  <n-layout position="absolute" has-sider>
    <n-layout-sider bordered :width="212" :native-scrollbar="false">
      <div class="sider">
        <div class="brand">
          <div class="brand-mark">明</div>
          <div class="brand-text">
            <div class="brand-title">明珠轩辕</div>
            <div class="brand-sub">脚本控制台</div>
          </div>
        </div>

        <n-menu
          class="menu"
          :value="active"
          :options="menus"
          :indent="18"
          @update:value="onMenu"
        />

        <div class="sider-footer">v{{ info?.version ?? '—' }}</div>
      </div>
    </n-layout-sider>

    <n-layout>
      <n-layout-header bordered class="header">
        <div class="header-title">{{ title }}</div>
        <div class="header-right">
          <n-tag :type="engineTagType" size="small" round :bordered="false">
            {{ engineLabel }}
          </n-tag>
          <n-button quaternary circle size="small" @click="toggle">
            <template #icon>
              <n-icon>
                <app-icon :name="isDark ? 'sun' : 'moon'" />
              </n-icon>
            </template>
          </n-button>
        </div>
      </n-layout-header>

      <n-layout-content class="content">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<style scoped>
.sider {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 18px 14px;
}

.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2b6cf6, #5b8dff);
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  flex: 0 0 auto;
}

.brand-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}

.brand-sub {
  font-size: 11px;
  opacity: 0.55;
  line-height: 1.4;
}

.menu {
  flex: 1;
  padding-top: 4px;
}

.sider-footer {
  padding: 12px 18px;
  font-size: 11px;
  opacity: 0.45;
}

.header {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
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
  height: calc(100% - 52px);
  overflow: auto;
  padding: 18px 20px 22px;
}
</style>
