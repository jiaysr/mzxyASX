<script setup lang="ts">
import type { BattleCommon } from '../../api/http'
import { tr } from '../../i18n'

const props = defineProps<{ common: BattleCommon | null }>()

const emit = defineEmits<{ change: [patch: Partial<BattleCommon>] }>()

function setThreshold(value: number | number[]): void {
  if (typeof value === 'number') emit('change', { identify_threshold: value })
}

function setCastInterval(value: number | number[]): void {
  if (typeof value === 'number') emit('change', { cast_interval: value })
}
</script>

<template>
  <section class="panel">
    <header class="panel-head">{{ tr('battle_settings') }}</header>

    <template v-if="props.common">
      <div class="row">
        <div class="row-label">
          <span>{{ tr('battle_similarity') }}</span>
          <b>{{ props.common.identify_threshold.toFixed(2) }}</b>
        </div>
        <el-slider
          :model-value="props.common.identify_threshold"
          :min="0.3"
          :max="0.99"
          :step="0.01"
          @update:model-value="setThreshold"
        />
        <p class="hint">{{ tr('battle_similarity_help') }}</p>
      </div>

      <div class="row inline">
        <div class="row-label">{{ tr('battle_respect_cooldown') }}</div>
        <el-switch
          :model-value="props.common.respect_cooldown"
          @update:model-value="emit('change', { respect_cooldown: Boolean($event) })"
        />
      </div>

      <div class="row">
        <div class="row-label">
          <span>{{ tr('battle_cast_interval') }}</span>
          <b>{{ props.common.cast_interval.toFixed(2) }}s</b>
        </div>
        <el-slider
          :model-value="props.common.cast_interval"
          :min="0"
          :max="3"
          :step="0.05"
          @update:model-value="setCastInterval"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
  padding: 12px 14px 6px;
}

.panel-head {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.row {
  padding: 6px 0 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.row:last-child {
  border-bottom: 0;
}

.row.inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.row-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
  color: var(--el-text-color-regular);
}

.row-label b {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-color-primary);
  font-variant-numeric: tabular-nums;
}

.hint {
  margin: 2px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}
</style>
