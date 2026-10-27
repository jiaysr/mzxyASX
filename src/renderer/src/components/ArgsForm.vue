<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import TimeField from './TimeField.vue'
import { requestSchedule } from '../composables/useScript'
import { http, type ArgItem, type TaskArgs } from '../api/http'
import { tr, trArg, trDesc, trOr } from '../i18n'

const props = defineProps<{ config: string; task: string }>()

const loading = ref(false)
const error = ref('')
const groups = ref<TaskArgs>({})

/**
 * 普通字段的当前值（按 `分组.字段名` 存）。
 *
 * 用 any 是有意的：值的类型由引擎的 `type` 字段决定，
 * 静态类型在这里只会变成一堆 as 断言，反而更容易写错。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const values = reactive<Record<string, any>>({})
/**
 * time_delta 的原始值（`DD HH:MM:SS`）。
 *
 * 拆成天/时/分/秒是 TimeField 内部的事，这里保持后端格式原样存，
 * 免得来回转换丢精度。
 */
const deltaRaw = reactive<Record<string, string>>({})
/** 正在保存的字段 */
const saving = ref('')
/** 分组折叠状态：没记录的默认展开 */
const collapsedGroups = reactive<Record<string, boolean>>({})

function fieldKey(group: string, arg: ArgItem): string {
  return `${group}.${arg.name}`
}

/**
 * 转成后端要的字符串。
 *
 * time_delta 的后端解析是 `int(value[1])` + `strptime(value[3:], '%H:%M:%S')`，
 * 死认 `DD HH:MM:SS`（两位天数 + 空格 + 时分秒），天数只取 value[1]。
 * TimeField 已经按这个格式产出，这里直接用。
 */
function serialize(arg: ArgItem, key: string): string {
  switch (arg.type) {
    case 'boolean':
      return values[key] ? 'true' : 'false'
    case 'time_delta':
      return deltaRaw[key] ?? '00 00:00:00'
    case 'integer':
    case 'number':
      return String(values[key] ?? 0)
    default:
      return String(values[key] ?? '')
  }
}

/** TimeField 确认后先回写原始值，再走统一的保存 */
function onDeltaChange(group: string, arg: ArgItem, value: string): void {
  deltaRaw[fieldKey(group, arg)] = value
  void save(group, arg)
}

async function save(group: string, arg: ArgItem): Promise<void> {
  const key = fieldKey(group, arg)
  saving.value = key
  try {
    await http.put(`/${props.config}/${props.task}/${group}/${arg.name}/value`, {
      types: arg.type,
      value: serialize(arg, key)
    })
    // 引擎保存参数时不会主动推调度，改完（尤其是 enable）得自己拉一次
    requestSchedule(props.config)
    ElMessage.success({ message: `${labelOf(arg)} 已保存`, duration: 1200 })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = ''
  }
}

function initValues(data: TaskArgs): void {
  for (const k of Object.keys(values)) delete values[k]
  for (const k of Object.keys(deltaRaw)) delete deltaRaw[k]
  for (const k of Object.keys(collapsedGroups)) delete collapsedGroups[k]

  for (const [group, list] of Object.entries(data)) {
    for (const arg of list) {
      const key = fieldKey(group, arg)
      if (arg.type === 'time_delta') {
        deltaRaw[key] = String(arg.value ?? '00 00:00:00')
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
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取参数失败'
    groups.value = {}
  } finally {
    loading.value = false
  }
}

watch(() => [props.config, props.task], load, { immediate: true })

defineExpose({ reload: load })

/** 标签：词条缺失时把人话兜底出来，别显示 serial_help 这种键名 */
function labelOf(arg: ArgItem): string {
  return trArg(arg.name, arg.title)
}

function descOf(arg: ArgItem): string {
  return trDesc(arg.description)
}

/** 描述很长（比如模拟器 Serial 那一大段）就占满整行，别把右边的格子挤成空白 */
function isWideField(arg: ArgItem): boolean {
  const desc = descOf(arg)
  return arg.type === 'multi_line' || desc.includes('\n') || desc.length > 80
}

/** 枚举没给可选项时（引擎里是 Union 类型），降级成文本框，别渲染一个空下拉 */
function hasOptions(arg: ArgItem): boolean {
  return Array.isArray(arg.enumEnum) && arg.enumEnum.length > 0
}

function isCollapsed(group: string): boolean {
  return collapsedGroups[group] === true
}

function toggleGroup(group: string): void {
  collapsedGroups[group] = !isCollapsed(group)
}

const entries = computed(() => Object.entries(groups.value))
const hasGroups = computed(() => entries.value.length > 0)
</script>

<template>
  <div v-loading="loading" class="args">
    <el-alert v-if="error" type="error" :closable="false" show-icon class="error">
      {{ error }}
    </el-alert>

    <el-empty v-else-if="!hasGroups && !loading" description="这个任务没有可配置的参数" />

    <div v-else class="groups">
      <section v-for="[group, list] in entries" :key="group" class="group">
        <header class="group-head" @click="toggleGroup(group)">
          <span class="group-title">{{ trOr(group) }}</span>
          <span class="group-count">{{ list.length }}</span>
          <svg
            class="chevron"
            :class="{ collapsed: isCollapsed(group) }"
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 15l6-6 6 6" />
          </svg>
        </header>

        <div v-show="!isCollapsed(group)" class="group-body">
          <div
            v-for="arg in list"
            :key="arg.name"
            class="field"
            :class="{ wide: isWideField(arg) }"
          >
            <label class="field-label" :title="arg.name">{{ labelOf(arg) }}</label>

            <div class="field-main">
              <div class="control">
                <!-- 布尔 -->
                <el-switch
                  v-if="arg.type === 'boolean'"
                  v-model="values[fieldKey(group, arg)]"
                  @change="save(group, arg)"
                />

                <!-- 整数 / 小数 -->
                <el-input-number
                  v-else-if="arg.type === 'integer'"
                  v-model="values[fieldKey(group, arg)]"
                  :precision="0"
                  controls-position="right"
                  class="num is-left"
                  @change="save(group, arg)"
                />
                <el-input-number
                  v-else-if="arg.type === 'number'"
                  v-model="values[fieldKey(group, arg)]"
                  :step="0.1"
                  controls-position="right"
                  class="num is-left"
                  @change="save(group, arg)"
                />

                <!-- 枚举：引擎没给选项时降级为文本框 -->
                <el-select
                  v-else-if="arg.type === 'enum' && hasOptions(arg)"
                  v-model="values[fieldKey(group, arg)]"
                  class="sel"
                  @change="save(group, arg)"
                >
                  <!-- 选项值本身也可能是词条键（pip.com.xuanyuan.x7sy → 小七版） -->
                  <el-option
                    v-for="opt in arg.enumEnum"
                    :key="opt"
                    :label="tr(opt)"
                    :value="opt"
                  />
                </el-select>

                <!-- 多行文本 -->
                <el-input
                  v-else-if="arg.type === 'multi_line'"
                  v-model="values[fieldKey(group, arg)]"
                  type="textarea"
                  :autosize="{ minRows: 3, maxRows: 10 }"
                  class="mono area"
                  @change="save(group, arg)"
                />

                <!-- 时间（HH:MM:SS） -->
                <el-time-picker
                  v-else-if="arg.type === 'time'"
                  v-model="values[fieldKey(group, arg)]"
                  format="HH:mm:ss"
                  value-format="HH:mm:ss"
                  :clearable="false"
                  class="time"
                  style="width: 100%; max-width: 560px"
                  @change="save(group, arg)"
                />

                <!-- 时间间隔（DD HH:MM:SS）：自定义选择器，带确认/取消 -->
                <time-field
                  v-else-if="arg.type === 'time_delta'"
                  v-model="deltaRaw[fieldKey(group, arg)]"
                  duration
                  class="ctl-fill"
                  @change="onDeltaChange(group, arg, $event)"
                />

                <!-- 日期时间 -->
                <el-date-picker
                  v-else-if="arg.type === 'date_time'"
                  v-model="values[fieldKey(group, arg)]"
                  type="datetime"
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  :clearable="false"
                  class="datetime"
                  style="width: 100%; max-width: 560px"
                  @change="save(group, arg)"
                />

                <!-- 单行文本（含 enum 无选项的降级） -->
                <el-input
                  v-else
                  v-model="values[fieldKey(group, arg)]"
                  class="text"
                  @change="save(group, arg)"
                />

                <span v-if="saving === fieldKey(group, arg)" class="saving">保存中…</span>
              </div>

              <div v-if="descOf(arg)" class="field-desc">{{ descOf(arg) }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.args {
  min-height: 120px;
}

.error {
  margin-bottom: 12px;
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 每个参数组一张卡 */
.group {
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
  overflow: hidden;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.group-head:hover {
  background: var(--el-fill-color-lighter);
}

.group-title {
  font-size: 13.5px;
  font-weight: 600;
}

.group-count {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
  border-radius: 9px;
  padding: 1px 7px;
  font-variant-numeric: tabular-nums;
}

.chevron {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
  transition: transform 0.2s;
}

.chevron.collapsed {
  transform: rotate(180deg);
}

/*
 * 字段区用 auto-fill 网格：窗口越宽列数越多，不会像固定单列那样右边空一大片。
 * 440px 是「150 标签 + 14 间距 + 276 控件」的下限，再窄就挤了。
 */
.group-body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(440px, 1fr));
  column-gap: 32px;
  padding: 2px 20px 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* 一个字段：左边标签固定宽度，右边控件 + 说明 */
.field {
  display: flex;
  gap: 14px;
  padding: 11px 0;
  align-items: flex-start;
  min-width: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.field-label {
  flex: 0 0 150px;
  width: 150px;
  padding-top: 7px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--el-text-color-regular);
  word-break: break-word;
}

.field-main {
  flex: 1;
  min-width: 0;
}

.control {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* 描述里有换行（原版就是按行排的列表），必须保留换行 */
.field-desc {
  margin-top: 5px;
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 长描述字段独占一行 */
.field.wide {
  grid-column: 1 / -1;
}

/*
 * 控件宽度统一：除了开关，其余都填满所在的字段列（上限 560）。
 * 以前按类型给不同宽度（数字 160、时间 150、文本 480），
 * 同一列里右边缘参差不齐，看着很乱。
 */
.num,
.sel,
.text,
.time,
.datetime,
.ctl-fill {
  width: 100%;
  max-width: 560px;
}

/* 多行文本也一样宽，右边缘对齐 */
.area {
  width: 100%;
  max-width: 560px;
}

.unit {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-right: 4px;
}

.saving {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
