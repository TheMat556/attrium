# SCSS Module Registry for Incremental WP-Admin Reskinning — Implementation Plan

## Overview

This plan implements a **separate, parallel CSS-only reskinning system** for embedded wp-admin screens in Attrium. It is:
- **Purely CSS-based** (no DOM restructuring, no Vue mounts in light DOM)
- **Feature-flagged per component type** (not per screen)
- **Toggle-able without rebuild** (via `attrium_enabled_modules` filter)
- **Zero `!important`** (achieved via CSS load order + specificity matching)
- **Incremental** (only `buttons` module has real styles; rest are placeholders)

The existing Shadow-DOM app, slot projection, and Vue override registry are **not touched**.

---

## Architecture

### 1. PHP Module Registry

**File:** `admin/src/Modules/ModuleRegistry.php` (new)

A PSR-4 class that:
- Provides `get_enabled_modules()` as the single access point for module state
- Filters into `admin_body_class` to append `attrium-mod-{module}` classes for each enabled module
- Enqueues `admin-theme.css` with `['common', 'wp-admin']` dependencies (load-order guarantee)
- Is feature-flag ready — can swap the default array source to `get_option()` later without changing callers

**Key implementation details:**
- Constructor registers hooks on `admin_enqueue_scripts` and `admin_body_class`
- Enqueue uses `filemtime()` for versioning (dynamic cache-busting, no manifest lookup needed)
- Default module state: `buttons => true`, all others `false`
- Loads on **all** wp-admin screens (body classes do the real gating)

### 2. Bootstrap Change

**File:** `attrium.php` (edit, 1 line)

Add instantiation of the new registry class:
```php
new Attrium\Modules\ModuleRegistry();
```

This runs independently of the overlay `Attrium` class.

### 3. SCSS Structure

**Tree:**
```plaintext
scss/
  admin-theme.scss       ← entry point, compiles to app/dist/admin-theme.css
  _tokens.scss           ← CSS custom properties (design tokens)
  _mixins.scss           ← the @mixin module() gate
  modules/
    _buttons.scss        ← Step 1, real content
    _tables.scss         ← Step 2, placeholder
    _forms.scss          ← Step 3, placeholder
    _notices.scss        ← Step 4, placeholder
    _postbox.scss        ← Step 5, placeholder
    _menu.scss           ← Step 6, placeholder
```

#### Tokens (`_tokens.scss`)

CSS custom properties named `--attrium-*` (namespaced to avoid conflicts with WP/Vue):
- `--attrium-primary: oklch(0.205 0 0)` — reused from `src/style.css`
- `--attrium-primary-foreground: oklch(0.985 0 0)`
- `--attrium-secondary: oklch(0.97 0 0)`
- `--attrium-ring: oklch(0.708 0 0)`
- `--attrium-radius-md: 0.5rem`

Defined on `:root` so they inherit into light-DOM wp-admin content.

#### Mixins (`_mixins.scss`)

```scss
@mixin module($name) {
  body.attrium-mod-#{$name} & {
    @content;
  }
}
```

This mixin wraps every rule in the body class context. Example:
```scss
.button-primary {
  @include mixins.module('buttons') {
    background-color: var(--attrium-primary);
  }
}
```

Produces: `body.attrium-mod-buttons .button-primary { … }` with specificity (0,2,1), which beats WP's `.wp-core-ui .button-primary` (0,2,0) at equal or lower. Combined with load order, **no `!important` needed**.

#### Buttons Module (`modules/_buttons.scss`) — Step 1, Real Content

Targets:
- `.button`
- `.button-primary`
- `.button-secondary`
- `.button-large`
- `.button.action`

Each selector wrapped in `@include mixins.module('buttons')`. Applies:
- `border-radius: var(--attrium-radius-md)`
- `font-weight: 500`
- `transition: background-color 150ms, box-shadow 150ms`
- `border: 1px solid transparent`

Primary button: `background-color: var(--attrium-primary)`

Focus-visible state: `outline: 2px solid var(--attrium-ring); outline-offset: 2px`

#### Other Modules (Steps 2–6) — Placeholders

Each file contains:
```scss
@use '../mixins';

// TODO: Step N — [component description]
```

Structure is in place for future content.

#### Entry Point (`admin-theme.scss`)

```scss
@use 'tokens';
@use 'mixins';
@use 'modules/buttons';
@use 'modules/tables';
@use 'modules/forms';
@use 'modules/notices';
@use 'modules/postbox';
@use 'modules/menu';
```

### 4. Build Pipeline

**Changes to `package.json`:**

1. Add devDependency:
   ```json
   "sass": "^1.x"
   ```

2. Add npm script:
   ```json
   "build:css": "sass scss/admin-theme.scss app/dist/admin-theme.css --no-source-map"
   ```

3. Update the `build` script to chain in the CSS build:
   ```json
   "build": "vue-tsc -b && vite build && bun run build:css"
   ```

4. (Optional) Add watch script for development:
   ```json
   "watch:css": "sass --watch scss/admin-theme.scss:app/dist/admin-theme.css"
   ```

**Why dart-sass:**
- The existing Vite build uses `cssCodeSplit: false` (merges all CSS into one bundle), so it cannot cleanly emit a second standalone file
- dart-sass CLI is simple, respects the existing Bun/npm convention, and produces clean output
- No modifications to `vite.config.ts` needed

---

## What Is NOT Changed

- `src/views/overrides.ts` — override registry untouched
- `src/App.vue` — shadow DOM app untouched
- `src/main.ts` — slot projection untouched
- `vite.config.ts` — Vue/Tailwind build untouched
- The existing `admin/src/App/Attrium.php` — overlay class untouched

Only `package.json` and `attrium.php` are edited (plus new files created).

---

## Verification Checklist

- [ ] **Step 1:** Create `admin/src/Modules/ModuleRegistry.php` and register in `attrium.php`
- [ ] **Step 2:** Create SCSS tree (`scss/`, all module files)
- [ ] **Step 3:** Update `package.json` with sass + build scripts
- [ ] **Step 4:** Run `bun install` to pull sass
- [ ] **Step 5:** Run `bun run build` → verify `app/dist/admin-theme.css` is created
- [ ] **Step 6:** Grep `app/dist/admin-theme.css` for `!important` → must be zero matches
- [ ] **Step 7:** `cd admin && composer lint` → new PHP file passes WordPress-Extra
- [ ] **Step 8:** In wp-admin (Posts, etc.): inspect `<body>` → should have `attrium-mod-buttons` class
- [ ] **Step 9:** Verify stylesheet loads after WP core CSS (check `<head>` order in browser DevTools)
- [ ] **Step 10:** Test toggle: add filter to disable buttons module → body class disappears, buttons revert to stock (no rebuild)

---

## Key Design Decisions (Confirmed with User)

1. **dart-sass CLI + script** (not separate Vite config) — keeps the build simple, respects Bun convention
2. **Load on all admin screens** (not gated by `is_overlay_screen()`) — body classes do the real gating; harmless on non-overlay screens
3. **PSR-4 OOP class, not procedural includes** — matches the plugin's existing architecture; public contract (filter + body classes) is identical to spec
4. **Output to `app/dist/`** (not `dist/`) — matches the repo's real build directory

---

## Future Expansion (Not Included)

When you're ready to add the next module (e.g., tables):
1. Fill in `scss/modules/_tables.scss` with real rules
2. Change `'tables': false` to `'tables': true` in `ModuleRegistry.php`
3. Run `bun run build`

No other files need to change. The filter is the single feature-flag gate.
