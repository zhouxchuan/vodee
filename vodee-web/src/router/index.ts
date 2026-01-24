import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            redirect: '/login',
        },
        {
            path: '/login',
            name: 'login',
            component: () => import('../views/LoginView.vue'),
        },
        {
            path: '/main',
            name: 'main',
            component: () => import('../views/MainView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/about',
            name: 'about',
            component: () => import('../views/AboutView.vue'),
        },
    ],
})

// 路由守卫
router.beforeEach((to, from, next) => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')

    if (to.meta.requiresAuth && !isLoggedIn) {
        next('/login')
    } else if (to.path === '/login' && isLoggedIn) {
        next('/main')
    } else {
        next()
    }
})

export default router
