import { createRouter, createWebHashHistory } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import LoginView from '../views/LoginView.vue'
import { useSession } from '../composables/useSession'

/**
 * 打包后是 file:// 加载，必须用 hash 路由。
 *
 * 只有两个顶层路由：主界面（配置栏 + 二级菜单 + 内容区）和设置。
 * 具体页面由 AppLayout 根据「当前配置 + 当前二级菜单」决定，不走路由。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', name: 'main', component: AppLayout },
    { path: '/settings', name: 'settings', component: AppLayout },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

/** 没连上服务就先去登录页 */
router.beforeEach(async (to) => {
  const { loggedIn, tryAutoLogin } = useSession()
  if (to.name === 'login') return true
  if (loggedIn.value) return true
  if (await tryAutoLogin()) return true
  return { name: 'login' }
})

export default router
