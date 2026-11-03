#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mode=both
workspace=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --mode) [ "$#" -ge 2 ] || { echo '--mode needs a value' >&2; exit 1; }; mode="$2"; shift 2 ;;
    --workspace) [ "$#" -ge 2 ] || { echo '--workspace needs a path' >&2; exit 1; }; workspace="$2"; shift 2 ;;
    --help|-h) echo 'Usage: bash scripts/setup.sh [--mode cloud|local|both] [--workspace /path/to/ComfyUI]'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done
case "$mode" in cloud|local|both) ;; *) echo 'Mode must be cloud, local, or both.' >&2; exit 1 ;; esac
case "$(uname -s)" in Linux|Darwin) ;; *) echo 'Use scripts/setup.ps1 on Windows.' >&2; exit 1 ;; esac
command -v node >/dev/null || { echo 'Install Node.js 22.14+ from https://nodejs.org first.' >&2; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<14)) process.exit(1)' || { echo 'Node.js 22.14+ is required.' >&2; exit 1; }
if [ -n "$workspace" ] && { [ "$mode" = cloud ] || [ ! -f "$workspace/main.py" ]; }; then
  echo '--workspace needs an existing ComfyUI directory containing main.py, with local/both mode.' >&2; exit 1
fi
command -v curl >/dev/null || { echo 'Install curl first.' >&2; exit 1; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
if command -v opencode >/dev/null; then
  export MAGIC_SPACE_OPENCODE="$(command -v opencode)"
elif [ -x "$HOME/.opencode/bin/opencode" ]; then
  export MAGIC_SPACE_OPENCODE="$HOME/.opencode/bin/opencode"
else
  curl -fsSL https://opencode.ai/v2/install -o "$tmp/opencode.sh"
  bash "$tmp/opencode.sh"
  export MAGIC_SPACE_OPENCODE="$HOME/.opencode/bin/opencode"
fi
"$MAGIC_SPACE_OPENCODE" --version
if [ "$mode" != cloud ]; then
  if command -v uv >/dev/null; then
    export MAGIC_SPACE_UV="$(command -v uv)"
  else
    mkdir -p .magic-space/bin
    export MAGIC_SPACE_UV="$PWD/.magic-space/bin/uv"
    if [ ! -x "$MAGIC_SPACE_UV" ]; then
      curl -fsSL https://astral.sh/uv/install.sh -o "$tmp/uv.sh"
      UV_UNMANAGED_INSTALL="$PWD/.magic-space/bin" sh "$tmp/uv.sh"
    fi
  fi
fi
node scripts/configure.mjs "$mode" "$workspace"
