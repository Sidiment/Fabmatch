#!/usr/bin/env bash
# Fabmatch quick start. Checks Node, installs packages when needed, and starts the site.
#
#   ./start.sh            Development: API + Vite with live reload, opens the browser
#   ./start.sh serve      Build the site and serve it with the API from one server
#   ./start.sh --help
#
# Ports can be changed:  WEB_PORT=5174 API_PORT=3005 ./start.sh
# Skip opening the browser:  ./start.sh --no-open

set -euo pipefail

cd "$(dirname "$0")"

MIN_NODE_MAJOR=20
MIN_NODE_MINOR=11
API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-5173}"
MODE="dev"
OPEN_BROWSER=1
BROWSER_WAIT_SECONDS=30

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
fail() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    dev) MODE="dev" ;;
    serve) MODE="serve" ;;
    --no-open) OPEN_BROWSER=0 ;;
    -h|--help) usage ;;
    *) fail "Unknown option \"$arg\". Run ./start.sh --help for the options." ;;
  esac
done

check_node() {
  command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} or newer from https://nodejs.org"
  command -v npm >/dev/null 2>&1 || fail "npm is not installed. It comes with Node.js: https://nodejs.org"
  local version major minor
  version="$(node -p 'process.versions.node')"
  major="${version%%.*}"
  minor="$(echo "$version" | cut -d. -f2)"
  if (( major < MIN_NODE_MAJOR || (major == MIN_NODE_MAJOR && minor < MIN_NODE_MINOR) )); then
    fail "Node ${version} is too old. Install Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} or newer."
  fi
  info "Node ${version}"
}

# Installs when node_modules is missing or package-lock.json changed since the last install.
install_packages() {
  local marker="node_modules/.package-lock.json"
  if [[ ! -f "$marker" || "package-lock.json" -nt "$marker" ]]; then
    info "Installing packages (first run or package-lock.json changed)…"
    npm install --no-audit --no-fund
  else
    info "Packages up to date"
  fi
}

check_port_free() {
  local port="$1" name="$2" env_name="$3"
  local pid
  pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
  if [[ -n "$pid" ]]; then
    local cmd
    cmd="$(ps -p "$pid" -o comm= 2>/dev/null || echo unknown)"
    fail "Port ${port} (${name}) is already in use by ${cmd} (PID ${pid}). Stop it, or pick another port: ${env_name}=$((port + 1)) ./start.sh"
  fi
}

# Opens the browser once the site answers, in the background so it never blocks the server.
open_when_ready() {
  local url="$1"
  (( OPEN_BROWSER )) || return 0
  command -v open >/dev/null 2>&1 || command -v xdg-open >/dev/null 2>&1 || return 0
  (
    for _ in $(seq $((BROWSER_WAIT_SECONDS * 2))); do
      if curl -s -o /dev/null "$url"; then
        if command -v open >/dev/null 2>&1; then open "$url"; else xdg-open "$url" >/dev/null 2>&1; fi
        exit 0
      fi
      sleep 0.5
    done
  ) &
}

bold "Fabmatch quick start (${MODE})"
check_node
install_packages
check_port_free "$API_PORT" "API" "API_PORT"

export PORT="$API_PORT"
export API_URL="http://localhost:${API_PORT}"

if [[ "$MODE" == "serve" ]]; then
  info "Building the site…"
  npm run build --silent
  URL="http://localhost:${API_PORT}"
  bold "Serving site and API at ${URL}  (Ctrl+C to stop)"
  info "Data is saved in server/.data/"
  open_when_ready "$URL"
  exec node server/index.js
fi

check_port_free "$WEB_PORT" "website" "WEB_PORT"
export WEB_PORT
export ALLOWED_ORIGINS="http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT}"
URL="http://localhost:${WEB_PORT}"
bold "Site at ${URL}, API at ${API_URL}  (Ctrl+C to stop)"
info "Data is saved in server/.data/"
open_when_ready "$URL"
exec npm run dev --silent
