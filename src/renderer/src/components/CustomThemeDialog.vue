<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useTheme } from '../composables/useTheme'

const show = defineModel<boolean>({ default: false })
const emit = defineEmits<{ created: [name: string] }>()

const { themes, addCustomTheme } = useTheme()

/** 和原版一致：打开时自动挑一个还没用过的预设，省得用户从零调色 */
const PRESETS = [
  { name: 'Pink', primary: '#FF1493' },
  { name: 'Purple', primary: '#7C3AED' },
  { name: 'Ocean', primary: '#0284C7' },
  { name: 'Mint', primary: '#059669' },
  { name: 'Sunset', primary: '#EA580C' },
  { name: 'Amber', primary: '#D97706' },
  { name: 'Coral', primary: '#F97316' },
  { name: 'Lavender', primary: '#8B5CF6' },
  { name: 'Slate', primary: '#475569' },
  { name: 'Forest', primary: '#166534' }
]

const name = ref('')
const primary = ref('#FF1493')

function pickPreset(): { name: string; primary: string } {
  const used = new Set(themes.value.map((t) => t.name.toLowerCase()))
  const free = PRESETS.find((p) => !used.has(p.name.toLowerCase()))
  if (free) return free
  const base = PRESETS[0]
  let suffix = 2
  while (used.has(`${base.name} ${suffix}`.toLowerCase())) suffix += 1
  return { ...base, name: `${base.name} ${suffix}` }
}

watch(show, (open) => {
  if (!open) return
  const preset = pickPreset()
  name.value = preset.name
  primary.value = preset.primary
})

function onConfirm(): void {
  const error = addCustomTheme({ name: name.value, primary: primary.value })
  if (error) {
    ElMessage.error(error)
    return
  }
  ElMessage.success(`已创建主题「${name.value.trim()}」`)
  emit('created', name.value.trim())
  show.value = false
}
</script>

<template>
  <el-dialog v-model="show" title="创建自定义主题" width="440px" append-to-body>
    <div class="preview">
      <span class="dot" :style="{ background: primary }" />
      <span class="preview-name">{{ name || '未命名' }}</span>
    </div>

    <el-form label-position="left" label-width="86px" class="form">
      <el-form-item label="主题名称">
        <el-input v-model="name" maxlength="24" placeholder="例如 Pink" />
      </el-form-item>
      <el-form-item label="主色">
        <el-color-picker v-model="primary" />
        <code class="hex">{{ primary }}</code>
      </el-form-item>
    </el-form>

    <p class="hint">主色会派生出按钮、选中态、边框等一整套色阶，亮色和暗色各算一遍。</p>

    <template #footer>
      <el-button size="small" @click="show = false">取消</el-button>
      <el-button size="small" type="primary" @click="onConfirm">添加</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 2px 16px;
}

.dot {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex: none;
}

.preview-name {
  font-size: 13px;
  font-weight: 600;
  margin-left: 6px;
}

.form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.hex {
  margin-left: 10px;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.hint {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
</style>
