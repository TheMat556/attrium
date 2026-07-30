#!/usr/bin/env bash
#
# Runs the Playwright visual suite inside the official Playwright container so
# committed baselines render identically on every machine and in CI. Any extra
# args are passed through to `playwright test` (e.g. --update-snapshots).
#
# Prerequisites: a WordPress instance reachable at $WP_BASE_URL (default the
# wp-env dev server on the host's port 8888). Uses --network host so the
# container can reach it.
#
# NOTE: --network host only works on Linux. On Docker Desktop (macOS/Windows)
# set WP_BASE_URL=http://host.docker.internal:8888 and drop --network host, or
# run the suite on a Linux host / in CI (which is Linux).
#
# The image tag MUST match the @playwright/test version in package.json;
# override with PLAYWRIGHT_IMAGE if you bump the dependency. This is checked
# below rather than left to a comment: a mismatched browser build renders text
# slightly differently, which shows up as an unexplainable diff on every
# baseline at once.
set -euo pipefail

IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.61.1-jammy}"
BASE_URL="${WP_BASE_URL:-http://localhost:8888}"

# --- Guard: image tag vs installed @playwright/test ---------------------------
# Only enforced for the default image; an explicit PLAYWRIGHT_IMAGE is trusted.
if [ -z "${PLAYWRIGHT_IMAGE:-}" ] && [ -r node_modules/@playwright/test/package.json ]; then
	PKG_VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
		node_modules/@playwright/test/package.json | head -1)"
	IMAGE_VERSION="${IMAGE#*:v}"
	IMAGE_VERSION="${IMAGE_VERSION%%-*}"
	if [ -n "$PKG_VERSION" ] && [ "$PKG_VERSION" != "$IMAGE_VERSION" ]; then
		echo "error: Playwright version mismatch." >&2
		echo "  @playwright/test installed: $PKG_VERSION" >&2
		echo "  docker image tag:           $IMAGE_VERSION ($IMAGE)" >&2
		echo "Update IMAGE in $0 to v${PKG_VERSION}-jammy (and regenerate" >&2
		echo "baselines if font rendering shifts), or set PLAYWRIGHT_IMAGE." >&2
		exit 1
	fi
fi

exec docker run --rm --init \
	--network host \
	--ipc=host \
	-v "$PWD":/work \
	-w /work \
	-e CI="${CI:-}" \
	-e WP_BASE_URL="$BASE_URL" \
	-e WP_ADMIN_USER="${WP_ADMIN_USER:-admin}" \
	-e WP_ADMIN_PASS="${WP_ADMIN_PASS:-password}" \
	"$IMAGE" \
	npx playwright test "$@"
