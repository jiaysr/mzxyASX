import { createRouter, createWebHashHistory } from 'vue-router'
import EngineView from '../views/EngineView.vue'
import OverviewView from '../views/OverviewView.vue'
import TasksView from '../views/TasksView.vue'
import SettingsView from '../views/SettingsView.vue'

/**
 * 打包后是 file:// 加载，必须用 hash 路由。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/engine' },
    {
      path: '/engine',
      name: 'engine',
      component: EngineView,
      meta: { title: '引擎', icon: 'engine' }
    },
    {
      path: '/overview',
      name: 'overview',
      component: OverviewView,
      meta: { title: '总览', icon: 'overview' }
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: TasksView,
      meta: { title: '任务', icon: 'tasks' }
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
      meta: { title: '设置', icon: 'settings' }
    }
  ]
})

export default router
