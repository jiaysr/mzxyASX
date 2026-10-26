<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NDropdown, NIcon, NTooltip, useDialog, useMessage } from 'naive-ui'
import AppIcon from './AppIcon.vue'
import { useConfig } from '../composables/useConfig'
import { useEngine } from '../composables/useEngine'

const router = useRouter()
const dialog = useDialog()
const message = useMessage()
const { configs, currentConfig, HOME, switchConfig, createConfig, renameConfig, deleteConfig } =
  useConfig()
const { status } = useEngine()

const engineReady = computed(() => Boolean(status.value?.running))

/** 右键菜单 */
const menuShow = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuTarget = ref('')

const itemOptions = [
  { label: '重命名', key: 'rename' },
  { label: '删除', key: 'delete' }
]

const showRename = ref(false)
const renameValue = ref('')

function onSelect(name: string): void {
  switchConfig(name)
  // 设置页是独立路由，点配置栏应该回到主界面
  if (router.currentRoute.value.name === 'settings') void router.push({ name: 'main' })
}

function onContextMenu(e: MouseEvent, name: string): void {
  if (name === HOME) return
  e.preventDefault()
  menuTarget.value = name
  menuX.value = e.clientX
  menuY.value = e.clientY
  menuShow.value = true
}

async function onMenuSelect(key: string): Promise<void> {
  menuShow.value = false
  const name = menuTarget.value
  if (!name) return

  if (key === 'rename') {
    renameValue.value = name
    showRename.value = true
    return
  }
  dialog.warning({
    title: '删除配置',
    content: `确定删除「${name}」吗？该账号的参数会一起删掉。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteConfig(name)
        message.success('已删除')
      } catch (e) {
        message.error(e instanceof Error ? e.message : '删除失败')
      }
    }
  })
}

async function onRenameConfirm(): Promise<void> {
  const next = renameValue.value.trim()
  showRename.value = false
  if (!next || next === menuTarget.value) return
  try {
    await renameConfig(menuTarget.value, next)
    message.success('已重命名')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '重命名失败')
  }
}

async function onCreate(): Promise<void> {
  try {
    const name = await createConfig()
    message.success(`已创建 ${name}`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '创建失败')
  }
}
</script>

<template>
  <div class="rail">
    <div class="items">
      <n-tooltip v-for="name in configs" :key="name" placement="right" :delay="400">
        <template #trigger>
          <button
            class="item"
            :class="{ active: name === currentConfig }"
            @click="onSelect(name)"
            @contextmenu="onContextMenu($event, name)"
          >
            <n-icon :size="20">
              <app-icon :name="name === HOME ? 'overview' : 'engine'" />
            </n-icon>
            <span class="label">{{ name === HOME ? '主页' : name }}</span>
          </button>
        </template>
        {{ name }}
      </n-tooltip>
    </div>

    <div class="bottom">
      <n-button
        quaternary
        circle
        size="small"
        :disabled="!engineReady"
        title="新建配置"
        @click="onCreate"
      >
        <template #icon>
          <n-icon><app-icon name="plus" /></n-icon>
        </template>
      </n-button>
      <n-button quaternary circle size="small" title="设置" @click="router.push('/settings')">
        <template #icon>
          <n-icon><app-icon name="settings" /></n-icon>
        </template>
      </n-button>
    </div>

    <n-dropdown
      v-model:show="menuShow"
      trigger="manual"
      placement="bottom-start"
      :x="menuX"
      :y="menuY"
      :options="itemOptions"
      @select="onMenuSelect"
    />

    <n-modal v-model:show="showRename" preset="card" title="重命名配置" style="width: 340px">
      <n-input v-model:value="renameValue" placeholder="新的配置名" @keyup.enter="onRenameConfirm" />
      <template #footer>
        <div class="modal-footer">
          <n-button size="small" @click="showRename = false">取消</n-button>
          <n-button size="small" type="primary" @click="onRenameConfirm">确定</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.rail {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 10px 6px;
}

.items {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.item {
  border: none;
  background: transparent;
  border-radius: 10px;
  padding: 8px 2px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  color: inherit;
  opacity: 0.62;
  transition: background 0.15s, opacity 0.15s;
}

.item:hover {
  opacity: 0.9;
  background: rgba(128, 128, 128, 0.1);
}

.item.active {
  opacity: 1;
  color: #2b6cf6;
  background: rgba(43, 108, 246, 0.1);
}

.label {
  font-size: 10px;
  max-width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 8px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
