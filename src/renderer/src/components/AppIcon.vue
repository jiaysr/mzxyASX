<script setup lang="ts">
type IconName =
  | 'engine'
  | 'overview'
  | 'tasks'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'plus'
  | 'home'

withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- 引擎：仪表盘 -->
    <template v-if="name === 'engine'">
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 12l3.6-3.6" />
      <path d="M12 3.8v1.6M20.2 12h-1.6M12 20.2v-1.6M3.8 12h1.6" />
    </template>

    <!-- 总览：四宫格 -->
    <template v-else-if="name === 'overview'">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </template>

    <!-- 任务：清单 -->
    <template v-else-if="name === 'tasks'">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.6" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </template>

    <!-- 设置：滑块 -->
    <template v-else-if="name === 'settings'">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.1" />
      <circle cx="8" cy="17" r="2.1" />
    </template>

    <!-- 亮色 -->
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4" />
    </template>

    <!-- 暗色 -->
    <template v-else-if="name === 'moon'">
      <path d="M20 14.4A8.4 8.4 0 1 1 9.6 4a6.9 6.9 0 0 0 10.4 10.4z" />
    </template>

    <!-- 加号 -->
    <template v-else-if="name === 'plus'">
      <path d="M12 5.5v13M5.5 12h13" />
    </template>

    <!-- 主页 -->
    <template v-else>
      <path d="M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.6v-5.4H9.6V20H5a1 1 0 0 1-1-1z" />
    </template>
  </svg>
</template>
