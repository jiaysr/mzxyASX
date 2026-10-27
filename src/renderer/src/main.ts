import { createApp } from 'vue'
import ElementPlus from 'element-plus'
// 组件样式 → 暗色变量 → 本地覆盖，顺序不能换
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/element.css'
// 小米字体：可变字重 150-700，按 unicode-range 分块，浏览器只加载用到的字
import 'misans/lib/Normal/MiSansVF.min.css'
import './styles/global.css'
import './styles/background.css'
// 背景设置在模块初始化时就读 localStorage 并写到 <html>，放这里保证首屏就生效
import './composables/useBackground'
import App from './App.vue'
import router from './router'

createApp(App).use(router).use(ElementPlus).mount('#app')
