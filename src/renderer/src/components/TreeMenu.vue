<script setup lang="ts">
import { computed } from 'vue'
import { useConfig } from '../composables/useConfig'
import { trMenuLabel } from '../i18n'

const { activeMenu, currentMenu, switchMenu } = useConfig()

interface Group {
  /** el-menu 的 index；加前缀是因为分组名和任务名可能相同（Script 既是分组又是任务） */
  index: string
  label: string
  items: string[]
}

/**
 * 二级菜单：Home 配置下是 Home/Updater/Tool，
 * 脚本配置下是 Overview + 各任务分组。空列表的分组自身就是一个页面。
 */
const groups = computed<Group[]>(() =>
  Object.entries(activeMenu.value).map(([name, items]) => ({
    index: items.length ? `g:${name}` : name,
    label: trMenuLabel(name),
    items
  }))
)

/** 有子项的分组默认全展开，和原版一致 */
const openeds = computed(() =>
  groups.value.filter((g) => g.items.length > 0).map((g) => g.index)
)

const hasMenu = computed(() => groups.value.length > 0)
</script>

<template>
  <!--
    根节点的 class 不能叫 tree：父组件 AppLayout 里 aside 也叫 .tree，
    而 Vue 会把父级的 scoped 标记加到子组件根元素上，两边样式会互相串
    （aside 的 overflow:hidden 会把这里的滚动条干掉）。
  -->
  <div class="tree-scroll">
    <!--
      key 跟着 openeds 变：el-menu 的 default-openeds 只在初始化时读一次，
      而菜单数据是异步到的，不重挂载就会一直显示折叠状态。
    -->
    <el-menu
      v-if="hasMenu"
      :key="openeds.join('|')"
      :default-active="currentMenu"
      :default-openeds="openeds"
      :unique-opened="false"
      class="menu"
      @select="switchMenu"
    >
      <template v-for="group in groups" :key="group.index">
        <!-- 空分组：这一项本身就是页面 -->
        <el-menu-item v-if="!group.items.length" :index="group.index">
          {{ group.label }}
        </el-menu-item>

        <el-sub-menu v-else :index="group.index">
          <template #title>{{ group.label }}</template>
          <el-menu-item v-for="item in group.items" :key="item" :index="item">
            {{ trMenuLabel(item) }}
          </el-menu-item>
        </el-sub-menu>
      </template>
    </el-menu>

    <el-empty v-else description="暂无菜单" :image-size="60" />
  </div>
</template>

<style scoped>
.tree-scroll {
  height: 100%;
  padding: 10px 8px 14px;
  overflow-y: auto;
  /* 任务多的时候（战斗任务 8 项 + 日常 4 项）这一列一定会超出一屏 */
  overscroll-behavior: contain;
}

.menu {
  border-right: none;
}

.menu :deep(.el-menu-item),
.menu :deep(.el-sub-menu__title) {
  height: 38px;
  line-height: 38px;
  font-size: 13.5px;
  border-radius: 8px;
  margin: 1px 0;
}

.menu :deep(.el-menu-item) {
  padding-left: 34px !important;
}

.menu :deep(.el-sub-menu__title) {
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.menu :deep(.el-menu-item.is-active) {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

/* 根级空分组（Overview / Home 这类）当作普通条目，缩进对齐子项 */
.menu > :deep(.el-menu-item) {
  padding-left: 16px !important;
}
</style>
