<script setup lang="ts">
import { computed, h } from 'vue'
import { NEmpty, NMenu, type MenuOption } from 'naive-ui'
import { useConfig } from '../composables/useConfig'
import { tr, trGroup } from '../i18n'

const { activeMenu, currentMenu, isHome, switchMenu } = useConfig()

/**
 * 二级菜单：Home 配置下是 Home/Updater/Tool，
 * 脚本配置下是 Overview + 各任务分组。空列表的分组自身就是一个页面。
 */
const options = computed<MenuOption[]>(() =>
  Object.entries(activeMenu.value).map(([group, items]) => {
    if (!items.length) {
      return { label: trGroup(group), key: group }
    }
    return {
      type: 'group',
      label: trGroup(group),
      // 分组 key 加前缀：分组名和任务名可能相同（Script 既是分组又是任务）
      key: `g:${group}`,
      children: items.map((item) => ({ label: () => h('span', tr(item)), key: item }))
    }
  })
)

const hasMenu = computed(() => options.value.length > 0)
</script>

<template>
  <div class="tree">
    <n-menu
      v-if="hasMenu"
      :value="currentMenu"
      :options="options"
      :indent="16"
      :root-indent="14"
      :default-expand-all="!isHome"
      @update:value="switchMenu"
    />
    <n-empty v-else description="暂无菜单" size="small" class="empty" />
  </div>
</template>

<style scoped>
.tree {
  height: 100%;
  padding: 10px 0;
  overflow-y: auto;
}

.empty {
  margin-top: 40px;
}
</style>
