<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, Download } from '@element-plus/icons-vue'
import {
  executeUpdate,
  getUpdateInfo,
  type CommitTuple,
  type UpdateInfo
} from '../api/http'
import { useAppUpdate } from '../composables/useAppUpdate'

const { info } = useAppUpdate()

const data = ref<UpdateInfo | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)

const version = computed(() => (info.value ? `v${info.value.version}` : '—'))
const hasUpdate = computed(() => Boolean(data.value?.is_update))

function short(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : '—'
}

function cell(row: CommitTuple | null | undefined, index: number): string {
  const value = row?.[index]
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function toRow(commit: CommitTuple | null | undefined, repo: string) {
  return {
    sha: short(commit?.[0]),
    author: cell(commit, 1),
    time: cell(commit, 2),
    message: cell(commit, 3),
    repo
  }
}

/** 旧版更新器的「本地 vs 远端」对比表 */
const diffRows = computed(() => {
  if (!data.value) return []
  return [
    toRow(data.value.current_commit, '本地仓库'),
    toRow(data.value.latest_commit, '远程仓库')
  ]
})

/** 旧版更新器的提交历史表 */
const historyRows = computed(() =>
  (data.value?.commit ?? []).map((commit) => toRow(commit, ''))
)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    data.value = await getUpdateInfo()
  } catch (e) {
    data.value = null
    error.value = e instanceof Error ? e.message : '读取脚本版本失败'
  } finally {
    loading.value = false
  }
}

/** 沿用旧版逻辑：直接调脚本的 /home/execute_update 做 git pull */
async function onUpdate(): Promise<void> {
  busy.value = true
  try {
    const text = await executeUpdate()
    ElMessage.info(text || '已执行')
    await load()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '更新失败')
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="updater">
    <el-alert v-if="error" type="error" :closable="false" show-icon>
      {{ error }}
    </el-alert>

    <template v-if="data">
      <el-card shadow="never" class="block">
        <div class="head">
          <div class="status">
            <el-icon v-if="hasUpdate" class="status-icon update">
              <Download />
            </el-icon>
            <el-icon v-else class="status-icon latest">
              <CircleCheck />
            </el-icon>
            <span class="status-text">
              {{ hasUpdate ? '发现 OAS 新版本' : 'OAS 已是最新版本' }}
            </span>
          </div>

          <div class="meta">
            <span>当前版本：{{ version }}</span>
            <span>当前分支：{{ data.branch || '—' }}</span>
            <el-button text type="primary" :loading="busy" @click="onUpdate">
              手动更新
            </el-button>
          </div>
        </div>

        <el-table :data="diffRows" size="small" border class="grid">
          <el-table-column label="SHA1" width="100">
            <template #default="{ row }">{{ row.sha }}</template>
          </el-table-column>
          <el-table-column label="作者" width="150">
            <template #default="{ row }">{{ row.author }}</template>
          </el-table-column>
          <el-table-column label="提交时间" width="190">
            <template #default="{ row }">{{ row.time }}</template>
          </el-table-column>
          <el-table-column label="提交信息" min-width="240">
            <template #default="{ row }">{{ row.message }}</template>
          </el-table-column>
          <el-table-column label="Repo" width="100">
            <template #default="{ row }">{{ row.repo }}</template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card shadow="never" class="block mt">
        <template #header>
          <span class="card-title">详细提交历史</span>
        </template>

        <el-table :data="historyRows" size="small" border class="grid">
          <el-table-column label="SHA1" width="100">
            <template #default="{ row }">{{ row.sha }}</template>
          </el-table-column>
          <el-table-column label="作者" width="150">
            <template #default="{ row }">{{ row.author }}</template>
          </el-table-column>
          <el-table-column label="提交时间" width="190">
            <template #default="{ row }">{{ row.time }}</template>
          </el-table-column>
          <el-table-column label="提交信息" min-width="240">
            <template #default="{ row }">{{ row.message }}</template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.updater {
  min-height: 160px;
  max-width: 1100px;
  margin: 0 auto;
}

.block {
  border-radius: 10px;
}

.mt {
  margin-top: 14px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 20px;
}

.status-icon.update {
  color: var(--el-color-primary);
}

.status-icon.latest {
  color: var(--el-color-success);
}

.status-text {
  font-size: 14px;
  font-weight: 600;
}

.meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}

.card-title {
  font-size: 13.5px;
  font-weight: 600;
}

.grid {
  font-size: 12.5px;
}
</style>
