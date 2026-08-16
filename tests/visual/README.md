# Visual regression tests

Screenshots each restyled wp-admin screen against a disposable WordPress and
pixel-diffs it against a committed baseline. Catches unintended visual changes
from SCSS/theme edits.

## How it fits together

```text
@wordpress/env  →  bun run build  →  Playwright (Docker image)  →  diff vs baseline
 disposable WP     builds theme CSS    renders + compares            fail on diff
 on :8888          (admin-theme.css)   in a fixed container
```

- **`.wp-env.json`** — spins up WordPress 6.7 + MySQL in Docker with this plugin
  active. Fresh install → deterministic default content (admin/password). It also
  maps `tests/visual/mu-plugins/` into `wp-content/mu-plugins`.
- **`mu-plugins/attrium-visual-determinism.php`** — test-only shims that make
  wp-admin byte-stable. Without it WordPress phones home to wp.org and renders
  live update state, so baselines would break whenever WordPress or a bundled
  theme ships a release — nothing to do with Attrium's CSS. It freezes the three
  update transients (killing the `.update-nag` banner on every screen, the 14
  "New version available" overlays on themes.php, and the admin-bar update
  counter that Attrium's own header scrapes), pins post dates, and declares
  `menus` support so nav-menus.php renders instead of 500ing.
- **Screenshots always render inside the pinned Playwright Docker image**
  (`tests/visual/run-in-docker.sh`). Font antialiasing differs between machines;
  the container guarantees the committed baselines match locally and in CI.
- **Baselines** live in `tests/visual/screens.spec.ts-snapshots/` and **are
  committed**. Everything else (`.auth/`, `test-results/`, `playwright-report/`)
  is gitignored.

### Two things that look wrong but are load-bearing

**Captures target `#attrium-host`, not the page.** `fullPage: true` does nothing
in this app: the host is `position: fixed; inset: 0; overflow-y: auto`, so the
*document* never scrolls and every `fullPage` shot came out exactly 1440×900.
Snapshotting the host alone isn't enough either — an element screenshot uses the
bounding box, which for a fixed element is always viewport-sized. So
`snapshotTarget()` grows the viewport to the host's `scrollHeight` first, then
captures it. Baselines are consequently different heights (themes.php is 2318px).

**`threshold` must stay small.** It's a per-pixel *color* budget, not an
antialiasing knob. At Playwright's default `0.2`, a deliberate regression shifting
`--attrium-border` from `oklch(0.922)` to `oklch(0.86)` passed on all 31 screens.
At `0.02` it fails on 16. Renderer jitter is absorbed by `maxDiffPixels: 200`
instead — a flat count, so sensitivity doesn't shrink as screens get taller.

If you change either, re-run the border mutation above and confirm the suite
still fails. A visual suite that can't fail is worse than none.

## Requirements

Docker must be installed and running (for both wp-env and the Playwright image).
Nothing else — deps come from `bun install`.

## Commands

```bash
bun run test:visual          # compare against baselines (what CI runs)
bun run test:visual:update   # regenerate baselines (run on a clean tree)
bun run test:visual:report   # open the last HTML report
```

Each wraps: `wp-env start` → `bun run build` → Playwright in Docker → `wp-env stop`.

### Constrained environments (running as root / node via nvm)

`bun run test:visual` assumes a normal dev setup: you're not root and `node` is
on your PATH. In sandboxes where you run **as root** (wp-env refuses root) or
`node` is only reachable through nvm (vue-tsc, and therefore `bun run build`,
needs it), use the helper instead:

```bash
bun run test:visual:local                    # compare
bun run test:visual:local -- --update-snapshots   # refresh baselines
```

`run-local.sh` finds node, builds as the current user, then runs wp-env +
Playwright as a non-root user (creating `wpuser` if needed) and restores file
ownership afterward. Args after `--` are forwarded to `playwright test`.

> **Caveat:** it `chown -R`s the whole project to that user and restores
> ownership from an `EXIT` trap. If the script is `SIGKILL`ed (or the machine
> dies) the trap never runs and the tree stays owned by `wpuser` — fix with
> `sudo chown -R "$USER" .`.

## Typical workflow

```bash
# 1. Baseline the current look (clean tree, no pending edits)
bun run test:visual:update
git add tests/visual/**/*-snapshots && git commit -m "test: visual baselines"

# 2. Make a CSS change, then check what moved
#    (edit scss/…)
bun run test:visual          # fails + writes red diff PNGs for anything changed

# 3. If the change was intended, refresh and commit the new baselines
bun run test:visual:update
```

## Adding a screen

Add one entry to `pages.ts` (`{ name, path }`), then
`bun run test:visual:update` to capture its baseline. No other file changes.

`stabilize()` asserts that the Attrium shell mounted and swallowed `#wpcontent`,
so a screen that errors or renders unstyled fails loudly instead of quietly
baselining a broken page. (This is not hypothetical: the Menus baseline used to
be a WordPress 500 error page, identical in light and dark, while the suite
reported success.) If a new screen can't satisfy that assertion — e.g. one where
`Attrium::is_overlay_screen()` disables the shell — it needs its own capture path
rather than loosening the check for everyone.

Known gaps are listed at the bottom of `pages.ts` (`_font-library.scss`,
`_options-connectors.scss`, and the two network-dependent install screens).

## Masking

`MASKS` in `screens.spec.ts` is **empty on purpose**. A mask paints an opaque
magenta box over the element, so it doesn't just ignore a region — it deletes it
from coverage. The previous list masked ~152k pixels of the themes.php card grid,
the `.subsubsub` filter bar that `_tabs.scss` styles, and Attrium's own header.

Prefer pinning the underlying value in
`mu-plugins/attrium-visual-determinism.php` over masking. If you must mask, mask
the smallest volatile child (not its container) and leave a comment explaining
why it can't be pinned.

## CI

`.github/workflows/visual.yml` runs the compare on every PR/push to `main` and
**fails the build** on any diff over threshold, uploading the report and diff
images as artifacts. Regenerate baselines locally and commit when a change is
intentional.
