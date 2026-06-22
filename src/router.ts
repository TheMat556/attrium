import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{
			path: '/',
			name: 'dashboard',
			component: () => import('@/views/Dashboard.vue'),
		},
		{
			path: '/wp-page',
			name: 'wp-page',
			component: () => import('@/views/WpPage.vue'),
		},
	],
})

export default router
