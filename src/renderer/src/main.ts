import { createApp } from 'vue'
// 小米字体：可变字重 150-700，按 unicode-range 分块，浏览器只加载用到的字
import 'misans/lib/Normal/MiSansVF.min.css'
import './styles/global.css'
import App from './App.vue'
import router from './router'

createApp(App).use(router).mount('#app')
