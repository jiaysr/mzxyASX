<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppIcon from './AppIcon.vue'
import ConfigCreateDialog from './ConfigCreateDialog.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'

const route = useRoute()
const router = useRouter()
const { configs, currentConfig, HOME, switchConfig, renameConfig, deleteConfig } = useConfig()
const { status } = useEngine()

const engineReady = computed(() => Boolean(status.value?.running))
/** 设置是独立路由：这时齿轮高亮，上面的配置项都不算「当前页」 */
const isSettings = computed(() => route.name === 'settings')

const showCreate = ref(false)
const showRename = ref(false)
const renameTarget = ref('')
const renameValue = ref('')

function onSelect(name: string): void {
  switchConfig(name)
  // 设置页是独立路由，点配置栏应该回到主界面
  if (router.currentRoute.value.name === 'settings') void router.push({ name: 'main' })
}

/** 右键菜单（Home 是固定项，不提供重命名/删除） */
async function onCommand(command: string, name: string): Promise<void> {
  if (command === 'rename') {
    renameTarget.value = name
    renameValue.value = name
    showRename.value = true
    return
  }

  try {
    await ElMessageBox.confirm(`确定删除「${name}」吗？该账号的参数会一起删掉。`, '删除配置', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return // 用户取消
  }

  try {
    await deleteConfig(name)
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

async function onRenameConfirm(): Promise<void> {
  const next = renameValue.value.trim()
  const from = renameTarget.value
  if (!next || next === from) {
    showRename.value = false
    return
  }
  try {
    await renameConfig(from, next)
    showRename.value = false
    ElMessage.success('已重命名')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '重命名失败')
  }
}

function onCreate(): void {
  showCreate.value = true
}
</script>

<template>
  <div class="rail">
    <div class="items">
      <el-dropdown
        v-for="name in configs"
        :key="name"
        trigger="contextmenu"
        :disabled="name === HOME"
        placement="bottom-start"
        @command="(cmd: string) => onCommand(cmd, name)"
      >
        <button
          class="item"
          :class="{ active: name === currentConfig && !isSettings }"
          :title="name === HOME ? '主页' : name"
          @click="onSelect(name)"
        >
          <app-icon :name="name === HOME ? 'home' : 'engine'" :size="19" />
          <span class="label">{{ name === HOME ? '主页' : name }}</span>
        </button>

        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="rename">重命名</el-dropdown-item>
            <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div class="bottom">
      <!-- 和上面的配置项用同一套按钮尺寸，图标中心线才对得齐 -->
      <button
        class="item icon-only"
        :disabled="!engineReady"
        title="新建配置"
        @click="onCreate"
      >
        <app-icon name="plus" :size="18" />
      </button>
      <button
        class="item icon-only"
        :class="{ active: isSettings }"
        title="设置"
        @click="router.push('/settings')"
      >
        <app-icon name="settings" :size="18" />
      </button>
    </div>

    <el-dialog v-model="showRename" title="重命名配置" width="340px" append-to-body>
      <el-input
        v-model="renameValue"
        placeholder="新的配置名"
        @keyup.enter="onRenameConfirm"
      />
      <template #footer>
        <el-button size="small" @click="showRename = false">取消</el-button>
        <el-button size="small" type="primary" @click="onRenameConfirm">确定</el-button>
      </template>
    </el-dialog>
    <config-create-dialog v-model="showCreate" />
  </div>
</template>

<style scoped>
.rail {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px 6px;
}

.items {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  overflow-x: hidden;
}

.items :deep(.el-dropdown) {
  width: 100%;
}

.item {
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 8px 2px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  color: var(--el-text-color-regular);
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}

.item:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.item.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.label {
  font-size: 10px;
  max-width: 52px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 只有图标的按钮：和上面的配置项同宽同轴，只是矮一点 */
.item.icon-only {
  height: 34px;
  padding: 0;
  justify-content: center;
}

.item.icon-only:disabled {
  opacity: 0.32;
  cursor: not-allowed;
}

.item.icon-only:disabled:hover {
  background: transparent;
  color: var(--el-text-color-regular);
}

.bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-top: 6px;
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 6px;
}
</style>
