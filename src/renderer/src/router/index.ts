import { createRouter, createWebHashHistory } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import LoginView from '../views/LoginView.vue'
import StartupView from '../views/StartupView.vue'
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
    // 启动页在登录前就要能用：选目录、看日志、起服务
    { path: '/server', name: 'server', component: StartupView },
    { path: '/', name: 'main', component: AppLayout },
    { path: '/settings', name: 'settings', component: AppLayout },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

/**
 * 没连上服务就先去登录页。
 *
 * 这里绝对不能 await 自动登录：上次保存的地址连不上时，ping 会重试多次，
 * 最长能把首屏阻塞二十多秒（窗口已经显示、Vue 却没渲染，表现为白屏）。
 * 自动登录挪到登录页 onMounted 里后台执行，成功后自己跳主界面。
 */
router.beforeEach((to) => {
  const { loggedIn } = useSession()
  if (to.name === 'login' || to.name === 'server') return true
  if (loggedIn.value) return true
  return { name: 'login' }
})

export default router
