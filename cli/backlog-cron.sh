#!/usr/bin/env bash
# Keep your onchain portfolio current. Point cron at this.
# Example crontab (daily at 9am):
#   0 9 * * *  /path/to/backlog/cli/backlog-cron.sh >> "$HOME/.backlog/sync.log" 2>&1
#
# Reads config (BACKLOG_ADDRESS, BACKLOG_PRIVATE_KEY, ANTHROPIC_API_KEY) from ~/.backlog/env.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f "$HOME/.backlog/env" ]; then set -a; . "$HOME/.backlog/env"; set +a; fi
exec node cli/sync.mjs "$@"
