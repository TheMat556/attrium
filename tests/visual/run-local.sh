#!/usr/bin/env bash
#
# One-command visual regression runner that copes with constrained environments
# (e.g. running as root, or `node` only reachable via nvm). On a normal dev
# machine you don't need this — `bun run test:visual` is enough. This script
# exists for setups where:
#   - `bun run build` needs `node` (vue-tsc), but node lives in root's nvm, AND
#   - `wp-env` refuses to run as root.
# It builds with node on PATH, then runs wp-env + Playwright as a non-root user.
#
# Usage:
#   bash tests/visual/run-local.sh                 # compare against baselines
#   bash tests/visual/run-local.sh --update-snapshots   # refresh baselines
# Any args are forwarded to `playwright test` via run-in-docker.sh.
set -euo pipefail

cd "$(dirname "$0")/../.."
PROJECT_DIR="$PWD"
PW_ARGS=("$@")

# --- Locate node (needed by vue-tsc during `bun run build`) ------------------
if ! command -v node >/dev/null 2>&1; then
	# Try the newest nvm-installed node under any home.
	NODE_BIN="$(ls -d /root/.nvm/versions/node/*/bin ~/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1 || true)"
	if [ -n "${NODE_BIN:-}" ]; then
		export PATH="$NODE_BIN:$PATH"
	fi
fi
command -v node >/dev/null 2>&1 || {
	echo "error: 'node' not found (required by vue-tsc in 'bun run build')." >&2
	exit 1
}

# --- Pick a non-root user for wp-env (it refuses to run as root) -------------
RUN_USER=""
if [ "$(id -u)" -eq 0 ]; then
	if id wpuser >/dev/null 2>&1; then
		RUN_USER="wpuser"
	else
		echo "note: running as root and no 'wpuser' exists; creating one for wp-env." >&2
		useradd -m -s /bin/bash wpuser
		usermod -aG docker wpuser 2>/dev/null || true
		RUN_USER="wpuser"
	fi
fi

# --- Build (as current user; node is on PATH) -------------------------------
echo "==> Building theme assets"
bun run build

# --- Run wp-env + Playwright ------------------------------------------------
run_suite() {
	echo y | bun run wp-env destroy 2>/dev/null || true
	bun run wp-env start
	# shellcheck disable=SC2064
	trap "bun run wp-env stop" EXIT
	WP_BASE_URL="${WP_BASE_URL:-http://localhost:8888}" \
		bash tests/visual/run-in-docker.sh "${PW_ARGS[@]}"
}

if [ -n "$RUN_USER" ]; then
	echo "==> Running WordPress + Playwright as '$RUN_USER'"
	# wp-env and Playwright output land under the project; hand it to RUN_USER
	# for the duration, then restore ownership.
	ORIG_OWNER="$(stat -c '%U:%G' "$PROJECT_DIR")"
	chown -R "$RUN_USER" "$PROJECT_DIR"
	# A function, not a string: an expanded-at-trap-time command would split a
	# $PROJECT_DIR containing whitespace into several chown arguments.
	restore_owner() { chown -R "$ORIG_OWNER" "$PROJECT_DIR"; }
	trap restore_owner EXIT
	# Args go through `bash -s -- "$@"` as real positional parameters. Flattening
	# them into one PW_ARGS string and re-splitting on whitespace would break any
	# argument that contains a space (e.g. --grep 'buttons dark').
	sudo -u "$RUN_USER" env \
		HOME="/home/$RUN_USER" \
		PATH="/usr/local/bin:/usr/bin:/bin" \
		WP_BASE_URL="${WP_BASE_URL:-http://localhost:8888}" \
		bash -ls -- "${PW_ARGS[@]}" <<-'EOF'
			set -e
			echo y | bun run wp-env destroy 2>/dev/null || true
			bun run wp-env start
			trap "bun run wp-env stop" EXIT
			bash tests/visual/run-in-docker.sh "$@"
		EOF
else
	run_suite
fi

echo "==> Done"
