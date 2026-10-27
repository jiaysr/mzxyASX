<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useConfig } from '../composables/useConfig'

/**
 * 新建配置。
 *
 * 和原版一致：名字从引擎的 /config_new_name 预填，
 * 模板从 /config_all 选（默认 template），确认后 POST /config_copy。
 */
const show = defineModel<boolean>({ default: false })

const { configs, newConfigName, configTemplates, createConfig } = useConfig()

const name = ref('')
const template = ref('template')
const templates = ref<string[]>([])
const loading = ref(false)
const creating = ref(false)

const templateLabel = (value: string): string =>
  value === 'template' ? '默认模板' : value

const options = computed(() =>
  templates.value.map((item) => ({ value: item, label: templateLabel(item) }))
)

watch(show, async (open) => {
  if (!open) return
  name.value = ''
  template.value = 'template'
  loading.value = true
  try {
    const [suggested, all] = await Promise.all([newConfigName(), configTemplates()])
    name.value = suggested || ''
    templates.value = all.length ? all : ['template']
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '读取配置列表失败')
    templates.value = ['template']
  } finally {
    loading.value = false
  }
})

async function confirm(): Promise<void> {
  const target = name.value.trim()
  if (!target) {
    ElMessage.error('请填配置名称')
    return
  }
  if (configs.value.includes(target)) {
    ElMessage.error(`配置「${target}」已存在`)
    return
  }
  if (target === 'template') {
    ElMessage.error('template 是模板，不能用作配置名')
    return
  }

  creating.value = true
  try {
    await createConfig(target, template.value)
    ElMessage.success(`已创建 ${target}`)
    show.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '创建失败')
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="show"
    title="新建配置"
    width="420px"
    :close-on-click-modal="false"
    append-to-body
  >
    <el-form label-position="top" class="form">
      <el-form-item label="配置名称">
        <el-input
          v-model="name"
          :disabled="loading"
          maxlength="32"
          placeholder="例如 oas3"
          @keyup.enter="confirm"
        />
      </el-form-item>

      <el-form-item label="复制模板">
        <el-select v-model="template" :disabled="loading" class="full">
          <el-option
            v-for="item in options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <div class="hint">
          会复制模板里的全部任务参数，之后再单独调整；选「默认模板」得到一份干净配置。
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button size="small" :disabled="creating" @click="show = false">取消</el-button>
      <el-button size="small" type="primary" :loading="creating" @click="confirm">
        创建
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.full {
  width: 100%;
}

.hint {
  margin-top: 6px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
</style>
