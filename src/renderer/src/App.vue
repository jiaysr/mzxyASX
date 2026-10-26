<script setup lang="ts">
import { NConfigProvider, NDialogProvider, NMessageProvider, NNotificationProvider, zhCN, dateZhCN } from 'naive-ui'
import AppLayout from './layouts/AppLayout.vue'
import { useTheme } from './composables/useTheme'

const { theme, themeOverrides } = useTheme()
</script>

<template>
  <n-config-provider
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
    class="root"
  >
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <app-layout />
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
.root {
  height: 100%;
}
</style>
