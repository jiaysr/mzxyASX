import { createRouter, createWebHashHistory } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'

/**
 * 打包后是 file:// 加载，必须用 hash 路由。
 *
 * 只有两个顶层路由：主界面（配置栏 + 二级菜单 + 内容区）和设置。
 * 具体页面由 AppLayout 根据「当前配置 + 当前二级菜单」决定，不走路由。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'main', component: AppLayout },
    { path: '/settings', name: 'settings', component: AppLayout },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

export default router
