<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { executeUpdate, getUpdateInfo, type CommitTuple, type UpdateInfo } from '../api/http'
import { useEngine } from '../composables/useEngine'
import { tr } from '../i18n'

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
    ElMessage.info(text || '已执行')
    await load()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '更新失败')
  } finally {
    busy.value = false
  }
}

/** 新版（发布包）：走内置引擎更新 */
async function onCheckEngine(): Promise<void> {
  busy.value = true
  try {
    const r = await installEngine()
    if (install.error) ElMessage.error(install.error)
    else ElMessage.success(r)
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="updater">
    <el-alert v-if="error" type="error" :closable="false" show-icon>{{ error }}</el-alert>

    <template v-else-if="hasGit && info">
      <el-card shadow="never" class="block">
        <template #header>
          <div class="head">
            <span class="card-title">脚本更新</span>
            <el-tag
              :type="info.is_update ? 'warning' : 'success'"
              size="small"
              effect="light"
              :closable="false"
            >
              {{ info.is_update ? tr('find_oas_new_version') : tr('oas_latest_version') }}
            </el-tag>
          </div>
        </template>

        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item :label="tr('current_branch')">
            {{ info.branch }}
          </el-descriptions-item>
          <el-descriptions-item label="SHA1">
            {{ short(info.current_commit?.[0]) }} → {{ short(info.latest_commit?.[0]) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-button size="small" type="primary" :loading="busy" class="mt" @click="onPull">
          {{ tr('execute_update') }}
        </el-button>
      </el-card>

      <el-card shadow="never" class="block mt">
        <template #header>
          <span class="card-title">{{ tr('detailed_submission_history') }}</span>
        </template>

        <el-table :data="info.commit" size="small" border class="grid">
          <el-table-column label="SHA1" width="100">
            <template #default="{ row }">{{ short(row?.[0]) }}</template>
          </el-table-column>
          <el-table-column :label="tr('author')" width="140">
            <template #default="{ row }">{{ cell(row, 1) }}</template>
          </el-table-column>
          <el-table-column :label="tr('submit_time')" width="170">
            <template #default="{ row }">{{ cell(row, 2) }}</template>
          </el-table-column>
          <el-table-column :label="tr('submit_info')" min-width="220">
            <template #default="{ row }">{{ cell(row, 3) }}</template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <!-- 发布包模式：没有 git 仓库，更新走内置通道 -->
    <el-card v-else shadow="never" class="block">
      <template #header><span class="card-title">脚本版本</span></template>

      <el-descriptions :column="1" size="small" border>
        <el-descriptions-item label="代码版本">
          <el-tag size="small" effect="plain" :closable="false">{{ engineVersion }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="运行环境">{{ engineEnv }}</el-descriptions-item>
        <el-descriptions-item label="通道">{{ engineChannel }}</el-descriptions-item>
        <el-descriptions-item label="更新方式">内置（从 Release 拉取，非 git）</el-descriptions-item>
      </el-descriptions>

      <el-alert type="info" :closable="false" show-icon class="mt">
        当前引擎是发布包，没有 .git 目录，所以不显示提交历史。
        点下面的按钮会比对 Release 清单，通常只更新几 MB 的代码包。
      </el-alert>

      <el-button size="small" type="primary" :loading="busy" class="mt" @click="onCheckEngine">
        检查引擎更新
      </el-button>
    </el-card>
  </div>
</template>

<style scoped>
.updater {
  min-height: 160px;
}

.block {
  border-radius: 10px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 13.5px;
  font-weight: 600;
}

.mt {
  margin-top: 14px;
}

.grid {
  font-size: 12.5px;
}
</style>
