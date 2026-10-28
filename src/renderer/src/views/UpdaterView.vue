<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { executeUpdate, getUpdateInfo, type CommitTuple, type UpdateInfo } from '../api/http'
import { useEngine } from '../composables/useEngine'
import { tr } from '../i18n'

const { status, scriptDir, running } = useEngine()

const info = ref<UpdateInfo | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)

/** 脚本目录没有 .git 时提交字段是 null（首次启动 deploy.installer 会 git init） */
const hasGit = computed(() => Boolean(info.value?.current_commit?.[0]))

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  if (!running.value) {
    info.value = null
    loading.value = false
    return
  }
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

/** 引擎自己的更新：git pull（deploy.installer 在下次启动时还会补依赖） */
async function onPull(): Promise<void> {
  busy.value = true
  try {
    const text = await executeUpdate()
    ElMessage.info(text || '已拉取最新代码，重启脚本服务后生效')
    await load()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '更新失败')
  } finally {
    busy.value = false
  }
}

onMounted(load)

// 在更新页里启动/停止脚本服务后，自动刷新提交信息
watch(running, (value) => {
  if (value) void load()
  else info.value = null
})
</script>

<template>
  <div v-loading="loading" class="updater">
    <el-alert v-if="!running" type="info" :closable="false" show-icon>
      脚本服务未启动。先到「设置 → 脚本服务」或登录页启动它，才能读取 git 提交信息。
    </el-alert>

    <el-alert v-else-if="error" type="error" :closable="false" show-icon>{{ error }}</el-alert>

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
        <div class="note">拉取后需要重启脚本服务；下次启动也会执行 deploy.installer 补齐依赖。</div>
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

    <!-- 刚解压的完整包还没有 .git：首次启动会由 deploy.installer 初始化 -->
    <el-card v-else shadow="never" class="block">
      <template #header><span class="card-title">脚本版本</span></template>

      <el-descriptions :column="1" size="small" border>
        <el-descriptions-item label="脚本目录">
          {{ scriptDir || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="当前版本">
          {{ status?.commit ? `${status.branch ?? ''} @ ${status.commit}` : '尚未初始化 git' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-alert type="info" :closable="false" show-icon class="mt">
        当前脚本目录还没有 .git。第一次启动时会执行 deploy.installer，自动 git init
        并拉取远端分支；之后这个页面就能显示提交历史和手动更新。
      </el-alert>
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

.note {
  margin-top: 8px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.grid {
  font-size: 12.5px;
}
</style>
