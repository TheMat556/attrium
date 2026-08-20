import { expect, test } from '@playwright/test'
import { HOST, stabilize } from './support/theme'

/**
 * Sidebar collapse/interaction regression.
 *
 * These are functional assertions, not screenshots: they guard the behavior of
 * the collapsible sidebar shell (src/components/AppSidebar.vue + NavMain.vue),
 * which a static full-page capture cannot exercise.
 *
 * - An item with children, clicked from the collapsed (icon) rail, must expand
 *   the sidebar AND open that item's submenu — before the fix in NavMain.vue it
 *   only toggled an invisible state.
 * - A top-level item without children must keep navigating directly.
 */
test.describe('sidebar collapse', () => {
	test('clicking a collapsed item with children expands the sidebar and opens its submenu', async ({
		page,
	}) => {
		await page.goto('/wp-admin/plugins.php', { waitUntil: 'domcontentloaded' })
		await stabilize(page)

		const sidebar = page.locator(`${HOST} [data-slot="sidebar"]`)
		const trigger = page.locator('[data-slot="sidebar-trigger"]')

		// The Posts item has a submenu in the standard wp-env menu. Scope it by
		// text: the top-level <li> is the only `menu-item` whose text contains
		// "Posts" (its collapsed submenu text is part of the same <li>).
		const postsItem = page.locator(`${HOST} [data-sidebar="menu-item"]`, {
			hasText: 'Posts',
		})
		// The `submenu-open` toggle class lives on the animation wrapper that
		// wraps the <ul> (see src/components/NavMain.vue).
		const postsWrapper = postsItem.locator('.submenu-wrapper')
		const allPostsLink = postsItem.getByText('All Posts', { exact: true })

		// The sidebar starts expanded; Posts' submenu is closed. (The item text
		// is not asserted hidden here — a closed submenu is overflow-clipped,
		// not display:none, so Playwright still reports it "visible".)
		await expect(sidebar).toHaveAttribute('data-state', 'expanded')
		await expect(postsWrapper).not.toHaveClass(/submenu-open/)

		// Collapse the sidebar.
		await trigger.click()
		await expect(sidebar).toHaveAttribute('data-state', 'collapsed')
		await expect(allPostsLink).toBeHidden()

		// Click the collapsed Posts item: the sidebar must expand and the
		// submenu must open, so the item text becomes visible.
		await postsItem.getByRole('button', { name: 'Posts', exact: true }).click()
		await expect(sidebar).toHaveAttribute('data-state', 'expanded')
		await expect(postsWrapper).toHaveClass(/submenu-open/)
		await expect(allPostsLink).toBeVisible()
	})

	test('clicking a collapsed item without children navigates directly', async ({
		page,
	}) => {
		await page.goto('/wp-admin/plugins.php', { waitUntil: 'domcontentloaded' })
		await stabilize(page)

		// Collapse the sidebar.
		await page.locator('[data-slot="sidebar-trigger"]').click()
		await expect(page.locator(`${HOST} [data-slot="sidebar"]`)).toHaveAttribute(
			'data-state',
			'collapsed',
		)

		// Comments has no submenu in the standard wp-env menu — clicking it must
		// navigate, not expand. (Dashboard/Posts/etc. all carry a submenu, so
		// they render as buttons, not links.)
		const commentsLink = page
			.locator(HOST)
			.getByRole('link', { name: 'Comments', exact: true })
		await commentsLink.click()

		await page.waitForURL(/edit-comments\.php$/)
	})
})
