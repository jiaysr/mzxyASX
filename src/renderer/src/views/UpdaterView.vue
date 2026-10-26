<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NSpin,
  NTag,
  useMessage
} from 'naive-ui'
import { executeUpdate, getUpdateInfo, type CommitTuple, type UpdateInfo } from '../api/http'
import { useEngine } from '../composables/useEngine'
import { tr } from '../i18n'

const message = useMessage()
const { status, installEngine, install } = useEngine()

const info = ref<UpdateInfo | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)

/** 引擎包里没有 .git，提交字段会是 null —— 这时走内置更新通道 */
const hasGit = computed(() => Boolean(info.value?.current_commit?.[0]))

const engineVersion = computed(() => status.value?.codeVersion ?? '—')
const engineEnv = computed(() => status.value?.envId ?? '—')
const engineChannel = computed(() => status.value?.channel ?? '—')

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    info.value = await getUpdateInfo()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取版本信息失败'
  } finally {
    loading.value = false
  }
}

function short(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : '—'
}

function cell(row: CommitTuple, i: number): string {
  return row?.[i] ? String(row[i]) : '—'
}

/** 老版（带 git 的引擎）：拉取最新代码 */
async function onPull(): Promise<void> {
  busy.value = true
  try {
    const text = await executeUpdate()
    message.info(text || '已执行')
    await load()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '更新失败')
  } finally {
    busy.value = false
  }
}

/** 新版（发布包）：走内置引擎更新 */
async function onCheckEngine(): Promise<void> {
  busy.value = true
  try {
    const r = await installEngine()
    if (install.error) message.error(install.error)
    else message.success(r)
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <n-spin :show="loading">
    <n-alert v-if="error" type="error" :bordered="false">{{ error }}</n-alert>

    <template v-else-if="hasGit && info">
      <n-card size="small" :bordered="true" title="脚本更新">
        <template #header-extra>
          <n-tag :type="info.is_update ? 'warning' : 'success'" size="small" :bordered="false">
            {{ info.is_update ? tr('find_oas_new_version') : tr('oas_latest_version') }}
          </n-tag>
        </template>

        <n-descriptions :column="2" size="small" label-placement="left">
          <n-descriptions-item :label="tr('current_branch')">
            {{ info.branch }}
          </n-descriptions-item>
          <n-descriptions-item label="SHA1">
            {{ short(info.current_commit?.[0]) }} → {{ short(info.latest_commit?.[0]) }}
          </n-descriptions-item>
        </n-descriptions>

        <n-button size="small" type="primary" :disabled="busy" class="mt" @click="onPull">
          {{ tr('execute_update') }}
        </n-button>
      </n-card>

      <n-card size="small" :bordered="true" :title="tr('detailed_submission_history')" class="mt">
        <table class="grid">
          <thead>
            <tr>
              <th>SHA1</th>
              <th>{{ tr('author') }}</th>
              <th>{{ tr('submit_time') }}</th>
              <th>{{ tr('submit_info') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in info.commit" :key="i">
              <td>{{ short(row?.[0]) }}</td>
              <td>{{ cell(row, 1) }}</td>
              <td>{{ cell(row, 2) }}</td>
              <td>{{ cell(row, 3) }}</td>
            </tr>
          </tbody>
        </table>
      </n-card>
    </template>

    <!-- 发布包模式：没有 git 仓库，更新走内置通道 -->
    <n-card v-else size="small" :bordered="true" title="脚本版本">
      <n-descriptions :column="1" size="small" label-placement="left" label-style="width: 92px">
        <n-descriptions-item label="代码版本">
          <n-tag size="small" :bordered="false">{{ engineVersion }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="运行环境">{{ engineEnv }}</n-descriptions-item>
        <n-descriptions-item label="通道">{{ engineChannel }}</n-descriptions-item>
        <n-descriptions-item label="更新方式">内置（从 Release 拉取，非 git）</n-descriptions-item>
      </n-descriptions>

      <n-alert type="info" :bordered="false" class="mt">
        当前引擎是发布包，没有 .git 目录，所以不显示提交历史。
        点下面的按钮会比对 Release 清单，通常只更新几 MB 的代码包。
      </n-alert>

      <n-button size="small" type="primary" :disabled="busy" class="mt" @click="onCheckEngine">
        检查引擎更新
      </n-button>
    </n-card>
  </n-spin>
</template>

<style scoped>
.mt {
  margin-top: 14px;
}

.grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.grid th,
.grid td {
  border: 1px solid rgba(128, 128, 128, 0.2);
  padding: 7px 10px;
  text-align: left;
}

.grid th {
  font-weight: 600;
  opacity: 0.75;
}

.grid td {
  opacity: 0.85;
}
</style>
