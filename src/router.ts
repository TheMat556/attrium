import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{
			path: '/',
			name: 'dashboard',
			component: () => import('@/views/Dashboard.vue'),
		},
	],
})

export default router
