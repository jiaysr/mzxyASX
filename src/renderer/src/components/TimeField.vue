<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

/**
 * 时间选择器：点开弹层 → 填数字 → 确认/取消。
 *
 * 两种形态：
 *   普通时间  HH:mm:ss
 *   时长      DD HH:MM:SS（`duration`，后端按 `int(value[1])` + `value[3:]` 解析，
 *             天数只认一位，所以上限 9 天）
 *
 * 取消直接丢弃草稿，不会像 el-time-picker 那样一滚就生效。
 */
const props = withDefaults(
  defineProps<{ modelValue?: string; duration?: boolean }>(),
  { duration: false }
)
const emit = defineEmits<{ 'update:modelValue': [string]; change: [string] }>()

const open = ref(false)

interface Part {
  key: 'd' | 'h' | 'm' | 's'
  unit: string
  max: number
}

const parts = computed<Part[]>(() => {
  const time: Part[] = [
    { key: 'h', unit: '时', max: 23 },
    { key: 'm', unit: '分', max: 59 },
    { key: 's', unit: '秒', max: 59 }
  ]
  return props.duration ? [{ key: 'd', unit: '天', max: 9 }, ...time] : time
})

/** 面板里的草稿值，数字形态（步进按钮要的是数字），输出时再补零 */
const draft = ref<Record<string, number>>({ d: 0, h: 0, m: 0, s: 0 })

const pad = (n: number): string => String(Math.max(0, n | 0)).padStart(2, '0')

function parse(value: string | undefined): Record<string, number> {
  const raw = (value ?? '').trim()
  const dur = /^(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(raw)
  if (dur) {
    return { d: Number(dur[1]), h: Number(dur[2]), m: Number(dur[3]), s: Number(dur[4]) }
  }
  const time = /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(raw)
  if (time) return { d: 0, h: Number(time[1]), m: Number(time[2]), s: Number(time[3]) }
  return { d: 0, h: 0, m: 0, s: 0 }
}

const display = computed(() => {
  const v = parse(props.modelValue)
  const hms = `${pad(v.h)}:${pad(v.m)}:${pad(v.s)}`
  return props.duration ? `${v.d} 天 ${hms}` : hms
})

// 每次打开都从当前值重新起稿，取消后不会残留上次的改动
watch(open, (isOpen) => {
  if (isOpen) draft.value = parse(props.modelValue)
})

function confirm(): void {
  const d = draft.value
  const hms = `${pad(d.h ?? 0)}:${pad(d.m ?? 0)}:${pad(d.s ?? 0)}`
  const value = props.duration ? `${pad(d.d ?? 0)} ${hms}` : hms
  emit('update:modelValue', value)
  emit('change', value)
  open.value = false
}

function cancel(): void {
  open.value = false
}
</script>

<template>
  <el-popover
    v-model:visible="open"
    trigger="click"
    placement="bottom-start"
    :width="duration ? 452 : 348"
    popper-class="time-field-pop"
  >
    <template #reference>
      <button type="button" class="trigger">
        <app-icon name="clock" :size="14" />
        <span class="value">{{ display }}</span>
      </button>
    </template>

    <div class="panel">
      <div class="cols">
        <div v-for="part in parts" :key="part.key" class="col">
          <el-input-number
            v-model="draft[part.key]"
            :min="0"
            :max="part.max"
            controls-position="right"
            class="num"
            @keyup.enter="confirm"
          />
          <span class="unit">{{ part.unit }}</span>
        </div>
      </div>

      <div class="footer">
        <el-button size="small" @click="cancel">取消</el-button>
        <el-button size="small" type="primary" @click="confirm">确认</el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
/* 外观对齐 el-input，混在表单里看不出是自定义控件 */
.trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 32px;
  padding: 0 11px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  font-family: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: border-color 0.15s;
}

.trigger:hover {
  border-color: var(--el-color-primary-light-5);
}

.trigger:focus-visible {
  outline: none;
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.value {
  flex: 1;
  text-align: left;
}

.cols {
  display: flex;
  align-items: center;
  gap: 12px;
}

.col {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.num {
  width: 100%;
}

.unit {
  flex: none;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
</style>
