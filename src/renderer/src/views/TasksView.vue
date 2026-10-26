<script setup lang="ts">
import { NCard, NEmpty, NText } from 'naive-ui'
</script>

<template>
  <n-card title="任务" :bordered="true" size="small">
    <n-empty description="还没接上" size="large">
      <template #extra>
        <n-text depth="3" style="font-size: 12px">
          这里会按「日常 / 每周 / 限时」分组列出所有任务，点进去改参数
        </n-text>
      </template>
    </n-empty>
  </n-card>
</template>
