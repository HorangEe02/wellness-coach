#!/usr/bin/env bash
# Start the coach server inside WSL (docs/DESIGN.md stage 6). The phone connects with: adb reverse tcp:8787 tcp:8787
#   bash tools/wsl/serve.sh            rules-only safety check
#   DECISION_BACKEND=d1 LLM_MODEL=wellness-lfm3 bash tools/wsl/serve.sh
# WSL runs in mirrored networking mode (%USERPROFILE%\.wslconfig), so localhost here is the PC's localhost:
# d1-2B (Docker, :8081) and Ollama (:11434) are reached without extra setup.
set -euo pipefail
export PATH="$HOME/.local/node/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/.local/node/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" # libatomic from install-node.sh
command -v node >/dev/null || { echo "node missing: bash tools/wsl/install-node.sh" >&2; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>23||(a===23&&b>=6)?0:1)' || { echo "need node >= 23.6 (runs .ts directly)" >&2; exit 1; }
cd "$(dirname "$0")/../.."
exec node packages/agent/src/server.ts
