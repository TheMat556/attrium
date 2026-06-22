# Plan: Iframe-based 3rd Party Plugin Pages for Attrium

## Goal

Allow Attrium to show default WordPress admin pages (including 3rd party plugins) in the content area via an iframe, while keeping the Attrium sidebar and header in the Shadow DOM. This is the fallback for any page Attrium doesn't natively override yet.

## Architecture

```
User clicks sidebar menu item
  │
  ├── Is it a known Attrium route (dashboard, etc.)?
  │     └── Yes → Vue Router → Native View (inside Shadow DOM)
  │
  └── No (any WP admin page from 3rd party plugins or WP core)
        └── Vue Router → /wp-page/:path → PluginIframe.vue
              └── Same-origin iframe loads the WP admin URL
                    └── WP page renders normally inside iframe
```

## Component States (PluginIframe.vue)

- **Loading**: Skeleton/pulsing blocks while iframe loads
- **Loaded**: Full iframe with auto-height via `ResizeObserver`
- **Error**: Error card + "Open in new tab" fallback button

## Files to Create

| File | Description |
|------|-------------|
| `src/components/PluginIframe.vue` | Iframe wrapper component with loading/loaded/error states |
| `src/views/WpPage.vue` | Route view that renders PluginIframe for WP admin pages |
| `src/composables/useIframeNavigation.ts` | Navigation helpers and route matching |

## Files to Modify

| File | Changes |
|------|---------|
| `src/router.ts` | Add catch-all `/wp-page/:path` route |
| `src/components/NavMain.vue` | Route all menu clicks through Vue instead of `<a href>` |
| `src/components/AppSidebar.vue` | Wire footer nav items through iframe system |
| `admin/src/App/Attrium.php` | Add current page URL to data attributes |
