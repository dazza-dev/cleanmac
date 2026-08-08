import { createRouter, createWebHashHistory } from 'vue-router'
import Overview from '../views/Overview.vue'
import Cleanup from '../views/Cleanup.vue'
import Storage from '../views/Storage.vue'
import History from '../views/History.vue'
import Settings from '../views/Settings.vue'

export const router = createRouter({
  // Hash history: the app is loaded from file:// in production, where path
  // based routing has no server to resolve against.
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'overview', component: Overview },
    { path: '/cleanup', name: 'cleanup', component: Cleanup },
    { path: '/storage', name: 'storage', component: Storage },
    { path: '/history', name: 'history', component: History },
    { path: '/settings', name: 'settings', component: Settings }
  ]
})
