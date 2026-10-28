<script setup lang="ts">
import { computed } from 'vue'
import type { BattleIdentifyResult } from '../../api/http'
import { tr } from '../../i18n'

const props = defineProps<{
  result: BattleIdentifyResult | null
  loading: boolean
  /** 脚本正在跑：识别会抢设备，后端会拒绝 */
  running: boolean
}>()

const emit = defineEmits<{ identify: [] }>()

const slots = computed(() => props.result?.slots ?? [])
const plan = computed(() => props.result?.plan ?? [])
const threshold = computed(() => props.result?.threshold ?? 0)

function scoreText(score: number): string {
  return `${Math.round(score * 100)}%`
}
</script>

<template>
  <section class="panel">
    <header class="panel-head">
      <span>{{ tr('battle_identify_result') }}</span>
      <el-tooltip v-if="props.running" content="脚本正在运行，先停止再识别" placement="bottom">
        <span>
          <el-button size="small" disabled>{{ tr('battle_identify') }}</el-button>
        </span>
      </el-tooltip>
      <el-button v-else size="small" :loading="props.loading" @click="emit('identify')">
        {{ tr('battle_identify') }}
      </el-button>
    </header>

    <p v-if="!props.result" class="placeholder">{{ tr('battle_identify_empty') }}</p>

    <el-alert
      v-else-if="!props.result.ok"
      type="error"
      :closable="false"
      show-icon
      :title="tr('battle_identify_failed')"
    >
      {{ props.result.message }}
    </el-alert>

    <template v-else>
      <div class="slots">
        <div v-for="slot in slots" :key="slot.slot" class="slot">
          <span class="slot-name">{{ slot.slotName }}</span>
          <span class="slot-skill" :class="{ weak: slot.score < threshold }">
            {{ slot.name || tr('battle_unknown_skill') }}
          </span>
          <span class="slot-score" :class="{ weak: slot.score < threshold }">
            {{ scoreText(slot.score) }}
          </span>
        </div>
      </div>

      <div class="plan-head">{{ tr('battle_plan_preview') }}</div>
      <ol v-if="plan.length" class="plan">
        <li v-for="(entry, i) in plan" :key="`${entry.slot}-${i}`">
          <span class="order">{{ i + 1 }}</span>
          <span class="p-name">{{ entry.name || entry.skill }}</span>
          <span class="p-slot">{{ entry.slotName }}</span>
        </li>
      </ol>
      <p v-else class="placeholder">{{ tr('battle_identify_empty') }}</p>

      <p v-if="props.result.summary" class="summary">{{ props.result.summary }}</p>
    </template>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
  padding: 12px 14px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
}

.placeholder {
  margin: 12px 0 4px;
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--el-text-color-placeholder);
}

.slots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 6px;
  margin-top: 10px;
}

.slot {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.slot-name {
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
}

.slot-skill {
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-score {
  font-size: 10.5px;
  color: var(--el-color-success);
  font-variant-numeric: tabular-nums;
}

.slot-skill.weak,
.slot-score.weak {
  color: var(--el-text-color-placeholder);
}

.plan-head {
  margin-top: 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.plan {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plan li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.order {
  flex: 0 0 18px;
  height: 18px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  text-align: center;
  line-height: 18px;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.p-name {
  font-weight: 500;
}

.p-slot {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

.summary {
  margin: 10px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  word-break: break-word;
}
</style>
