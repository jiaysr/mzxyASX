<script setup lang="ts">
import { onMounted } from 'vue'
import AnnouncementDialog from './components/AnnouncementDialog.vue'
import CloseConfirmDialog from './components/CloseConfirmDialog.vue'
import { useAnnouncement } from './composables/useAnnouncement'
import { elementLocale } from './i18n'

const { maybeAutoShow } = useAnnouncement()

onMounted(() => {
  // 等首屏渲染完再弹，别和登录页/主界面抢焦点
  window.setTimeout(() => {
    void maybeAutoShow()
  }, 600)
})
</script>

<template>
  <el-config-provider :locale="elementLocale" class="root">
    <router-view />
    <!-- 全局弹层：登录页和主界面都要能弹 -->
    <close-confirm-dialog />
    <announcement-dialog />
  </el-config-provider>
</template>

<style>
.root {
  height: 100%;
}
</style>
