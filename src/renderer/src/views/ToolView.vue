<script setup lang="ts">
import { ref } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NFormItem,
  NInput,
  NSpin,
  useMessage
} from 'naive-ui'
import { exportDiagnostic, notifyTest } from '../api/http'
import { tr } from '../i18n'

const message = useMessage()

// ---------------- 推送测试 ----------------
const setting = ref('provider:')
const title = ref('Title')
const content = ref('Content')
const testing = ref(false)

async function onTest(): Promise<void> {
  testing.value = true
  try {
    const ok = await notifyTest(setting.value, title.value, content.value)
    if (ok) message.success(tr('notify_test_success'))
    else message.error(tr('notify_test_failed'))
  } catch (e) {
    message.error(e instanceof Error ? e.message : tr('notify_test_failed'))
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
    if (path) message.success(tr('export_diagnostic_done'))
  } catch (e) {
    result.value = tr('export_diagnostic_failed')
    message.error(e instanceof Error ? e.message : tr('export_diagnostic_failed'))
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="tool">
    <n-card size="small" :bordered="true" :title="tr('notify_test')" class="card">
      <n-form label-placement="top" size="small">
        <n-form-item :label="tr('notify_test_config')">
          <n-input
            v-model:value="setting"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 10 }"
            class="mono"
          />
        </n-form-item>
        <div class="hint">{{ tr('notify_test_help') }}</div>

        <n-form-item :label="tr('notify_test_title')">
          <n-input v-model:value="title" />
        </n-form-item>
        <n-form-item :label="tr('notify_test_content')">
          <n-input v-model:value="content" />
        </n-form-item>

        <n-button size="small" type="primary" :disabled="testing" @click="onTest">
          {{ tr('notify_test_send') }}
        </n-button>
      </n-form>
    </n-card>

    <n-card size="small" :bordered="true" :title="tr('export_diagnostic')" class="card">
      <div class="hint">{{ tr('export_diagnostic_help') }}</div>
      <n-button size="small" :disabled="exporting" class="mt" @click="onExport">
        {{ tr('export_diagnostic_button') }}
      </n-button>
      <n-spin v-if="exporting" :size="14" class="mt spin" />
      <n-alert v-if="result" :bordered="false" type="info" class="mt selectable">
        {{ result }}
      </n-alert>
    </n-card>
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
}

.hint {
  font-size: 11.5px;
  line-height: 1.6;
  opacity: 0.55;
  margin-bottom: 10px;
}

.mono :deep(textarea) {
  font-family: 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
}

.mt {
  margin-top: 12px;
}

.spin {
  margin-left: 8px;
}
</style>
