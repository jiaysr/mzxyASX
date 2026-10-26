<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NDatePicker,
  NEmpty,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpin,
  NSwitch,
  NTimePicker,
  useMessage
} from 'naive-ui'
import { http, type ArgItem, type TaskArgs } from '../api/http'
import { tr } from '../i18n'

const props = defineProps<{ config: string; task: string }>()

const message = useMessage()
const loading = ref(false)
const error = ref('')
const groups = ref<TaskArgs>({})

/** 普通字段的当前值（按 `分组.字段名` 存） */
const values = reactive<Record<string, unknown>>({})
/** time_delta 拆成 天/时/分/秒 四个输入 */
const deltas = reactive<Record<string, { d: number; h: number; m: number; s: number }>>({})
/** 正在保存的字段 */
const saving = ref('')
/** 展开的分组（受控：数据是异步到的，default-expanded-names 只在挂载时读一次） */
const expanded = ref<string[]>([])

function fieldKey(group: string, arg: ArgItem): string {
  return `${group}.${arg.name}`
}

const PAD = (n: number): string => String(n).padStart(2, '0')

function parseDelta(raw: unknown): { d: number; h: number; m: number; s: number } {
  const m = /^(\d+)\s+(\d{2}):(\d{2}):(\d{2})$/.exec(String(raw ?? ''))
  if (!m) return { d: 0, h: 0, m: 0, s: 0 }
  return { d: Number(m[1]), h: Number(m[2]), m: Number(m[3]), s: Number(m[4]) }
}

/**
 * 转成后端要的字符串。
 * 注意 time_delta：后端解析是 `int(value[1])` + `strptime(value[3:])`，
 * 只支持「一位天数 + 空格 + HH:MM:SS」，所以天数最多 9。
 */
function serialize(arg: ArgItem, key: string): string {
  switch (arg.type) {
    case 'boolean':
      return values[key] ? 'true' : 'false'
    case 'time_delta': {
      const v = deltas[key] ?? { d: 0, h: 0, m: 0, s: 0 }
      const day = Math.min(Math.max(v.d | 0, 0), 9)
      return `${day} ${PAD(v.h | 0)}:${PAD(v.m | 0)}:${PAD(v.s | 0)}`
    }
    case 'integer':
    case 'number':
      return String(values[key] ?? 0)
    default:
      return String(values[key] ?? '')
  }
}

async function save(group: string, arg: ArgItem): Promise<void> {
  const key = fieldKey(group, arg)
  saving.value = key
  try {
    await http.put(`/${props.config}/${props.task}/${group}/${arg.name}/value`, {
      types: arg.type,
      value: serialize(arg, key)
    })
    message.success(`${tr(arg.title)} 已保存`, { duration: 1200 })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = ''
  }
}

function initValues(data: TaskArgs): void {
  for (const k of Object.keys(values)) delete values[k]
  for (const k of Object.keys(deltas)) delete deltas[k]

  for (const [group, list] of Object.entries(data)) {
    for (const arg of list) {
      const key = fieldKey(group, arg)
      if (arg.type === 'time_delta') {
        deltas[key] = parseDelta(arg.value)
      } else {
        values[key] = arg.value
      }
    }
  }
}

async function load(): Promise<void> {
  if (!props.config || !props.task) return
  loading.value = true
  error.value = ''
  try {
    const data = await http.get<TaskArgs>(`/${props.config}/${props.task}/args`)
    groups.value = data
    initValues(data)
    expanded.value = Object.keys(data)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取参数失败'
    groups.value = {}
    expanded.value = []
    expanded.value = []
  } finally {
    loading.value = false
  }
}

watch(() => [props.config, props.task], load, { immediate: true })

const hasGroups = computed(() => Object.keys(groups.value).length > 0)
</script>

<template>
  <div class="args">
    <n-spin :show="loading">
      <n-alert v-if="error" type="error" :bordered="false" class="error">{{ error }}</n-alert>

      <n-empty v-else-if="!hasGroups && !loading" description="这个任务没有可配置的参数" />

      <n-collapse v-else v-model:expanded-names="expanded" arrow-placement="right">
        <n-collapse-item
          v-for="(list, group) in groups"
          :key="group"
          :name="group"
          :title="tr(group)"
        >
          <n-form label-placement="left" :label-width="168" size="small" require-mark-placement="right-hanging">
            <n-form-item
              v-for="arg in list"
              :key="arg.name"
              :label="tr(arg.title)"
              :show-feedback="false"
              class="field"
            >
              <div class="control">
                <!-- 布尔 -->
                <n-switch
                  v-if="arg.type === 'boolean'"
                  v-model:value="values[fieldKey(group, arg)] as boolean"
                  @update:value="save(group, arg)"
                />

                <!-- 整数 / 小数 -->
                <n-input-number
                  v-else-if="arg.type === 'integer'"
                  v-model:value="values[fieldKey(group, arg)] as number"
                  :precision="0"
                  :show-button="false"
                  style="width: 180px"
                  @change="save(group, arg)"
                />
                <n-input-number
                  v-else-if="arg.type === 'number'"
                  v-model:value="values[fieldKey(group, arg)] as number"
                  :step="0.1"
                  style="width: 180px"
                  @change="save(group, arg)"
                />

                <!-- 枚举 -->
                <n-select
                  v-else-if="arg.type === 'enum'"
                  v-model:value="values[fieldKey(group, arg)] as string"
                  :options="(arg.enumEnum ?? []).map((v) => ({ label: v, value: v }))"
                  style="width: 320px"
                  @update:value="save(group, arg)"
                />

                <!-- 多行文本 -->
                <n-input
                  v-else-if="arg.type === 'multi_line'"
                  v-model:value="values[fieldKey(group, arg)] as string"
                  type="textarea"
                  :autosize="{ minRows: 4, maxRows: 12 }"
                  class="mono"
                  @change="save(group, arg)"
                />

                <!-- 时间（HH:MM:SS） -->
                <n-time-picker
                  v-else-if="arg.type === 'time'"
                  v-model:formatted-value="values[fieldKey(group, arg)] as string"
                  format="HH:mm:ss"
                  value-format="HH:mm:ss"
                  :show-hour="true"
                  style="width: 180px"
                  @update:formatted-value="save(group, arg)"
                />

                <!-- 时间间隔（DD HH:MM:SS） -->
                <div v-else-if="arg.type === 'time_delta'" class="delta">
                  <n-input-number
                    v-model:value="deltas[fieldKey(group, arg)].d"
                    :min="0"
                    :max="9"
                    :show-button="false"
                    style="width: 72px"
                    @change="save(group, arg)"
                  />
                  <span class="unit">天</span>
                  <n-input-number
                    v-model:value="deltas[fieldKey(group, arg)].h"
                    :min="0"
                    :max="23"
                    :show-button="false"
                    style="width: 72px"
                    @change="save(group, arg)"
                  />
                  <span class="unit">时</span>
                  <n-input-number
                    v-model:value="deltas[fieldKey(group, arg)].m"
                    :min="0"
                    :max="59"
                    :show-button="false"
                    style="width: 72px"
                    @change="save(group, arg)"
                  />
                  <span class="unit">分</span>
                  <n-input-number
                    v-model:value="deltas[fieldKey(group, arg)].s"
                    :min="0"
                    :max="59"
                    :show-button="false"
                    style="width: 72px"
                    @change="save(group, arg)"
                  />
                  <span class="unit">秒</span>
                </div>

                <!-- 日期时间 -->
                <n-date-picker
                  v-else-if="arg.type === 'date_time'"
                  v-model:formatted-value="values[fieldKey(group, arg)] as string"
                  type="datetime"
                  format="yyyy-MM-dd HH:mm:ss"
                  value-format="yyyy-MM-dd HH:mm:ss"
                  style="width: 220px"
                  @update:formatted-value="save(group, arg)"
                />

                <!-- 单行文本 -->
                <n-input
                  v-else
                  v-model:value="values[fieldKey(group, arg)] as string"
                  style="width: 320px"
                  @change="save(group, arg)"
                />

                <span v-if="saving === fieldKey(group, arg)" class="saving">保存中…</span>
              </div>

              <div v-if="arg.description" class="desc">{{ tr(arg.description) }}</div>
            </n-form-item>
          </n-form>
        </n-collapse-item>
      </n-collapse>
    </n-spin>

    <div class="footer">
      <n-button size="small" quaternary @click="load">重新读取</n-button>
    </div>
  </div>
</template>

<style scoped>
.args {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.error {
  margin-bottom: 12px;
}

.field {
  margin-bottom: 14px;
}

.control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.desc {
  width: 100%;
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.6;
  opacity: 0.55;
}

.mono :deep(textarea) {
  font-family: 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
}

.delta {
  display: flex;
  align-items: center;
  gap: 4px;
}

.unit {
  font-size: 12px;
  opacity: 0.6;
  margin-right: 6px;
}

.saving {
  font-size: 11px;
  opacity: 0.5;
}

.footer {
  padding-top: 10px;
  display: flex;
  justify-content: flex-end;
}
</style>
