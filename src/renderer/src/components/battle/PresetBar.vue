<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { BattlePreset } from '../../api/http'
import { tr } from '../../i18n'

const props = defineProps<{
  presets: BattlePreset[]
  modelValue: string
  builtin: boolean
  saving: boolean
  saved: boolean
  saveError: string
  enabledCount: number
  total: number
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string]
  create: [name: string, base: string]
  rename: [name: string]
  delete: []
  reset: []
}>()

const createOpen = ref(false)
const createName = ref('')
const createBase = ref('default')
const renameOpen = ref(false)
const renameName = ref('')

const current = computed(() => props.presets.find((item) => item.id === props.modelValue))
const canEdit = computed(() => !props.builtin && Boolean(current.value))

function openCreate(): void {
  createName.value = ''
  createBase.value = current.value?.id ?? 'default'
  createOpen.value = true
}

function confirmCreate(): void {
  emit('create', createName.value.trim(), createBase.value)
  createOpen.value = false
}

function openRename(): void {
  renameName.value = current.value?.name ?? ''
  renameOpen.value = true
}

function confirmRename(): void {
  const name = renameName.value.trim()
  if (!name) {
    ElMessage.warning(tr('battle_preset_name'))
    return
  }
  emit('rename', name)
  renameOpen.value = false
}

async function confirmDelete(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除预设「${current.value?.name ?? ''}」后无法恢复，确定继续吗？`,
      tr('battle_preset_delete'),
      { type: 'warning', confirmButtonText: tr('battle_preset_delete'), cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  emit('delete')
}
</script>

<template>
  <div class="preset-bar">
    <el-select
      :model-value="modelValue"
      class="picker"
      :disabled="presets.length === 0"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <el-option v-for="item in presets" :key="item.id" :label="item.name" :value="item.id">
        <span class="option-name">{{ item.name }}</span>
        <el-tag v-if="item.builtin" size="small" type="info" effect="plain">
          {{ tr('battle_preset_builtin') }}
        </el-tag>
      </el-option>
    </el-select>

    <el-tooltip v-if="builtin" :content="tr('battle_preset_builtin_hint')" placement="bottom">
      <el-tag size="small" type="warning" effect="plain">{{ tr('battle_edit_locked') }}</el-tag>
    </el-tooltip>

    <el-button size="small" @click="openCreate">{{ tr('battle_preset_new') }}</el-button>
    <el-button size="small" :disabled="!canEdit" @click="openRename">
      {{ tr('battle_preset_rename') }}
    </el-button>
    <el-button size="small" :disabled="!canEdit" @click="confirmDelete">
      {{ tr('battle_preset_delete') }}
    </el-button>
    <el-button size="small" :disabled="!canEdit" text @click="emit('reset')">
      {{ tr('battle_reset_default') }}
    </el-button>

    <span class="spacer" />

    <span v-if="saveError" class="status bad" :title="saveError">保存失败</span>
    <span v-else-if="saving" class="status">保存中…</span>
    <span v-else-if="saved" class="status good">已保存</span>
    <span class="count">
      {{ tr('battle_enabled_count') }} <b>{{ enabledCount }}</b> / {{ total }}
    </span>

    <el-dialog v-model="createOpen" :title="tr('battle_preset_new')" width="360px">
      <el-form label-width="72px">
        <el-form-item :label="tr('battle_preset_name')">
          <el-input
            v-model="createName"
            maxlength="24"
            :placeholder="tr('battle_preset_name_hint')"
            @keyup.enter="confirmCreate"
          />
        </el-form-item>
        <el-form-item :label="tr('battle_preset_base')">
          <el-select v-model="createBase" class="full">
            <el-option v-for="item in presets" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" @click="confirmCreate">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="renameOpen" :title="tr('battle_preset_rename')" width="360px">
      <el-input v-model="renameName" maxlength="24" @keyup.enter="confirmRename" />
      <template #footer>
        <el-button @click="renameOpen = false">取消</el-button>
        <el-button type="primary" @click="confirmRename">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.preset-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
  flex-wrap: wrap;
}

.picker {
  width: 200px;
}

.option-name {
  margin-right: 8px;
}

.spacer {
  flex: 1;
}

.status {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.status.good {
  color: var(--el-color-success);
}

.status.bad {
  color: var(--el-color-danger);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.count {
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.count b {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.full {
  width: 100%;
}
</style>
