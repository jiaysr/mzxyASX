<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import SettingsAbout from './settings/SettingsAbout.vue'
import SettingsService from './settings/SettingsService.vue'
import SettingsUi from './settings/SettingsUi.vue'
import SettingsUpdate from './settings/SettingsUpdate.vue'

interface Section {
  id: string
  label: string
  component: Component
}

/**
 * 设置分类。
 *
 * 结构对齐原版 MFA：左边一列分类，右边是「分类名 + 折叠箭头」的卡片区。
 * 只保留本应用真的有的四类，不做空壳页面。
 */
const SECTIONS: Section[] = [
  { id: 'ui', label: '界面设置', component: SettingsUi },
  { id: 'update', label: '更新设置', component: SettingsUpdate },
  { id: 'service', label: '脚本服务', component: SettingsService },
  { id: 'about', label: '关于我们', component: SettingsAbout }
]

const current = ref(SECTIONS[0].id)
const collapsed = ref(false)

const activeSection = computed(
  () => SECTIONS.find((s) => s.id === current.value) ?? SECTIONS[0]
)

/** el-menu 的 select 回调，index 就是分类 id */
function onSelect(index: string): void {
  current.value = index
}

// 换分类时重新展开，避免上次折叠着切过来看到空白
watch(current, () => {
  collapsed.value = false
})
</script>

<template>
  <div class="settings">
    <nav class="nav">
      <el-menu class="nav-menu" :default-active="current" @select="onSelect">
        <el-menu-item v-for="section in SECTIONS" :key="section.id" :index="section.id">
          {{ section.label }}
        </el-menu-item>
      </el-menu>
    </nav>

    <section class="panel">
      <div class="panel-head" @click="collapsed = !collapsed">
        <span class="panel-title">{{ activeSection.label }}</span>
        <svg
          class="chevron"
          :class="{ down: collapsed }"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 15l6-6 6 6" />
        </svg>
      </div>

      <div v-show="!collapsed" class="panel-body">
        <component :is="activeSection.component" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  max-width: 1180px;
  margin: 0 auto;
}

/* ---------------- 左侧分类 ---------------- */
.nav {
  flex: 0 0 200px;
  width: 200px;
  padding-top: 12px;
  position: sticky;
  top: 0;
}

/* 和主界面的二级菜单用同一个组件，选中样式自然一致 */
.nav-menu {
  border-right: none;
  background: transparent;
}

.nav-menu :deep(.el-menu-item) {
  height: 36px;
  line-height: 36px;
  font-size: 13px;
  border-radius: 8px;
  margin: 1px 0;
  padding-left: 14px;
  color: var(--el-text-color-regular);
}

.nav-menu :deep(.el-menu-item:hover) {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.nav-menu :deep(.el-menu-item.is-active) {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

/* 选中项前面的小圆点；未选中时留出同样宽度，切分类文字不会左右跳 */
.nav-menu :deep(.el-menu-item::before) {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  margin-right: 8px;
  opacity: 0;
  transition: opacity 0.15s;
}

.nav-menu :deep(.el-menu-item.is-active::before) {
  opacity: 1;
}

/* ---------------- 右侧面板 ---------------- */
.panel {
  flex: 1;
  min-width: 0;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 4px 10px;
  border-bottom: 1px solid var(--el-border-color-light);
  cursor: pointer;
  user-select: none;
}

.panel-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.chevron {
  color: var(--el-text-color-secondary);
  transition: transform 0.2s;
}

.chevron.down {
  transform: rotate(180deg);
}

.panel-body {
  padding-bottom: 24px;
}

/* 极窄时分类占满一行（窗口最小 880，实际很少触发） */
@media (max-width: 820px) {
  .settings {
    flex-direction: column;
    gap: 8px;
  }

  .nav {
    flex: none;
    width: 100%;
    position: static;
    padding-top: 0;
  }
}
</style>
