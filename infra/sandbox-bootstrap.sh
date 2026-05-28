#!/usr/bin/env bash
# Sandbox bootstrap — installs the HTTP wrapper that the Express agents call
# into the sandbox's filesystem and starts it under systemd.
#
# Usage (inside sandbox, run via `aca sandbox exec`):
#   GH_TOKEN=ghp_... bash /tmp/sandbox-bootstrap.sh
#
# Idempotent: re-running is safe; the unit is reloaded and restarted.
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN must be set in the env}"

WRAPPER=/opt/sandbox_wrapper.py
UNIT=/etc/systemd/system/sandbox-wrapper.service
ENVFILE=/etc/sandbox-wrapper.env

# Wrapper is uploaded to /opt/sandbox_wrapper.py by the deploy script *before*
# this runs (via `aca sandbox fs write`). If it's missing, bail.
test -f "$WRAPPER" || { echo "wrapper not present at $WRAPPER"; exit 1; }

# Token file (root-only).
cat > "$ENVFILE" <<EOF
GH_TOKEN=${GH_TOKEN}
COPILOT_GITHUB_TOKEN=${GH_TOKEN}
COPILOT_ALLOW_ALL=1
EOF
chmod 600 "$ENVFILE"

# Systemd unit.
cat > "$UNIT" <<'EOF'
[Unit]
Description=VoiceConnect sandbox HTTP wrapper
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/sandbox_wrapper.py
Restart=always
RestartSec=2
Environment=WRAPPER_PORT=8080
EnvironmentFile=-/etc/sandbox-wrapper.env
StandardOutput=append:/var/log/sandbox_wrapper.log
StandardError=append:/var/log/sandbox_wrapper.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now sandbox-wrapper
sleep 1
systemctl is-active sandbox-wrapper
echo "sandbox-wrapper ready on :8080"
