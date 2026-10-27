<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportDiagnostic, notifyTest } from '../api/http'
import { tr } from '../i18n'

// ---------------- 推送测试 ----------------
const setting = ref('provider:')
const title = ref('Title')
const content = ref('Content')
const testing = ref(false)

async function onTest(): Promise<void> {
  testing.value = true
  try {
    const ok = await notifyTest(setting.value, title.value, content.value)
    if (ok) ElMessage.success(tr('notify_test_success'))
    else ElMessage.error(tr('notify_test_failed'))
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : tr('notify_test_failed'))
  } finally {
    testing.value = false
  }
}

// ---------------- 诊断导出 ----------------
const exporting = ref(false)
const result = ref('')

async function onExport(): Promise<void> {
  exporting.value = true
  result.value = ''
  try {
    const res = await exportDiagnostic()
    const path = res?.success ? String(res.path ?? '') : ''
    result.value = path ? `${tr('export_diagnostic_done')}${path}` : tr('export_diagnostic_failed')
    if (path) ElMessage.success(tr('export_diagnostic_done'))
  } catch (e) {
    result.value = tr('export_diagnostic_failed')
    ElMessage.error(e instanceof Error ? e.message : tr('export_diagnostic_failed'))
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="tool">
    <el-card shadow="never" class="card">
      <template #header><span class="card-title">{{ tr('notify_test') }}</span></template>

      <el-form label-position="top" size="default">
        <el-form-item :label="tr('notify_test_config')">
          <el-input
            v-model="setting"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 10 }"
            class="mono"
          />
        </el-form-item>
        <div class="hint">{{ tr('notify_test_help') }}</div>

        <el-form-item :label="tr('notify_test_title')">
          <el-input v-model="title" />
        </el-form-item>
        <el-form-item :label="tr('notify_test_content')">
          <el-input v-model="content" />
        </el-form-item>

        <el-button size="small" type="primary" :loading="testing" @click="onTest">
          {{ tr('notify_test_send') }}
        </el-button>
      </el-form>
    </el-card>

    <el-card shadow="never" class="card">
      <template #header><span class="card-title">{{ tr('export_diagnostic') }}</span></template>

      <div class="hint">{{ tr('export_diagnostic_help') }}</div>
      <el-button size="small" :loading="exporting" @click="onExport">
        {{ tr('export_diagnostic_button') }}
      </el-button>

      <el-alert v-if="result" type="info" :closable="false" class="mt selectable">
        {{ result }}
      </el-alert>
    </el-card>
  </div>
</template>

<style scoped>
.tool {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-start;
}

.card {
  width: 380px;
  border-radius: 10px;
}

.card-title {
  font-size: 13.5px;
  font-weight: 600;
}

.hint {
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}

.mt {
  margin-top: 12px;
}
</style>
