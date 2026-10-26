<script setup lang="ts">
import { NCard, NEmpty, NText } from 'naive-ui'
</script>

<template>
  <n-card title="总览" :bordered="true" size="small">
    <n-empty description="还没接上" size="large">
      <template #extra>
        <n-text depth="3" style="font-size: 12px">
          这里会显示调度器状态、当前任务、待执行队列和实时日志
        </n-text>
      </template>
    </n-empty>
  </n-card>
</template>
