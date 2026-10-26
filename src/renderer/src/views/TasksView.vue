<script setup lang="ts">
import { computed, h, onMounted, watch } from 'vue'
import { NEmpty, NLayout, NLayoutContent, NLayoutSider, NMenu, NTag, type MenuOption } from 'naive-ui'
import ArgsForm from '../components/ArgsForm.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'
import { tr, trGroup } from '../i18n'

const { menu, currentConfig, currentTask, ready, init, selectTask } = useConfig()
const { status } = useEngine()

const engineReady = computed(() => Boolean(status.value?.running))

onMounted(async () => {
  if (engineReady.value) {
    try {
      await init()
    } catch {
      /* 初始化失败时界面会显示空态，用户可切到引擎页排查 */
    }
  }
})

// 引擎起来之后再拉数据
watch(engineReady, async (ok) => {
  if (ok && !ready.value) {
    try {
      await init()
    } catch {
      /* 同上 */
    }
  }
})

/** 只保留有任务的分组；Overview 这类空分组由左侧导航承载 */
const menuOptions = computed<MenuOption[]>(() =>
  Object.entries(menu.value)
    .filter(([, tasks]) => tasks.length > 0)
    .map(([group, tasks]) => ({
      type: 'group',
      label: trGroup(group),
      // 分组 key 加前缀：分组名和任务名可能相同（Script 既是分组又是任务）
      key: `g:${group}`,
      children: tasks.map((task) => ({
        label: () => h('span', tr(task)),
        key: task
      }))
    }))
)

const activeTask = computed(() => currentTask.value)
</script>

<template>
  <n-layout has-sider class="wrap" :native-scrollbar="true">
    <n-layout-sider :width="188" bordered :native-scrollbar="false">
      <n-menu
        v-if="menuOptions.length"
        :value="activeTask"
        :options="menuOptions"
        :indent="14"
        :root-indent="14"
        @update:value="selectTask"
      />
      <div v-else class="menu-empty">暂无任务</div>
    </n-layout-sider>

    <n-layout-content class="content">
      <template v-if="!engineReady">
        <n-empty description="引擎还没启动" size="large">
          <template #extra>
            <span class="hint">先到「引擎」页点启动，再回来配置任务</span>
          </template>
        </n-empty>
      </template>

      <template v-else-if="currentTask">
        <div class="head">
          <span class="title">{{ tr(currentTask) }}</span>
          <n-tag size="small" :bordered="false">{{ currentConfig }}</n-tag>
        </div>
        <args-form :config="currentConfig" :task="currentTask" />
      </template>

      <n-empty v-else description="选一个任务开始配置" />
    </n-layout-content>
  </n-layout>
</template>

<style scoped>
.wrap {
  height: 100%;
  border: 1px solid var(--n-border-color, #ebedf0);
  border-radius: 8px;
  overflow: hidden;
}

.menu-empty {
  padding: 16px;
  font-size: 12px;
  opacity: 0.5;
}

.content {
  padding: 16px 18px;
  height: 100%;
  overflow: auto;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.title {
  font-size: 14px;
  font-weight: 600;
}

.hint {
  font-size: 12px;
  opacity: 0.6;
}
</style>
