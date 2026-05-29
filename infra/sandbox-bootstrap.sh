#!/usr/bin/env bash
# Sandbox bootstrap — installs the HTTP wrapper that the Express agents call
# into the sandbox's filesystem and starts it.
#
# Usage (inside sandbox, run via `aca sandbox exec`):
#   GH_TOKEN=ghp_... bash /tmp/sandbox-bootstrap.sh
#
# Idempotent: re-running is safe; an existing wrapper process is killed and restarted.
#
# NOTE: ACA Sandboxes do not run systemd, so we use a tiny self-respawning shell
# loop (`sandbox-wrapper-runner.sh`) launched via `setsid nohup` instead of a
# systemd unit. Auto-suspend mode=Memory preserves the running process across
# suspend/resume cycles.
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN must be set in the env}"

WRAPPER=/opt/sandbox_wrapper.py
RUNNER=/opt/sandbox-wrapper-runner.sh
ENVFILE=/etc/sandbox-wrapper.env
LOGFILE=/var/log/sandbox_wrapper.log

# Wrapper is uploaded to /opt/sandbox_wrapper.py by the deploy script *before*
# this runs (via `aca sandbox fs write`). If it's missing, bail.
test -f "$WRAPPER" || { echo "wrapper not present at $WRAPPER"; exit 1; }

# Token file (root-only).
cat > "$ENVFILE" <<EOF
GH_TOKEN=${GH_TOKEN}
COPILOT_GITHUB_TOKEN=${GH_TOKEN}
COPILOT_ALLOW_ALL=1
WRAPPER_PORT=8080
EOF
chmod 600 "$ENVFILE"

# Self-respawning runner — replaces systemd Restart=always.
cat > "$RUNNER" <<'EOF'
#!/usr/bin/env bash
set -a
. /etc/sandbox-wrapper.env
set +a
while true; do
  /usr/bin/python3 /opt/sandbox_wrapper.py
  echo "[runner] wrapper exited rc=$?, restarting in 2s" >&2
  sleep 2
done
EOF
chmod +x "$RUNNER"

# Stop any previous instance (idempotent re-run).
pkill -f "/opt/sandbox-wrapper-runner.sh" 2>/dev/null || true
pkill -f "/opt/sandbox_wrapper.py" 2>/dev/null || true
sleep 1

# Launch detached. setsid puts the process in its own session so it survives
# the parent `aca sandbox exec` shell terminating.
touch "$LOGFILE"
setsid nohup "$RUNNER" >> "$LOGFILE" 2>&1 < /dev/null &

# Verify it's listening.
for i in 1 2 3 4 5; do
  if ss -tln 2>/dev/null | grep -q ":8080 "; then
    echo "sandbox-wrapper ready on :8080"
    exit 0
  fi
  sleep 1
done
echo "ERROR: sandbox-wrapper did not bind :8080 within 5s" >&2
tail -50 "$LOGFILE" >&2 || true
exit 1
