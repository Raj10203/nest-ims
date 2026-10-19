#!/usr/bin/env bash
# Stop hook: when files that shape the system design or add a feature changed,
# ask Claude to check README.md. Asks once per set of changes, skips when
# README.md was edited after them, and never blocks twice in a row.
input=$(cat)
cd "$CLAUDE_PROJECT_DIR" || exit 0
[ "$(echo "$input" | jq -r '.stop_hook_active // false')" = true ] && exit 0

files=$( (git diff HEAD --name-only --diff-filter=ADMR
          git ls-files -o --exclude-standard) | sort -u |
  grep -E '^(src/(entities|config|cli|database/migrations)/|src/[^/]+\.ts$|src/modules/.*(\.module\.ts|\.controller\.ts|/dto/.*)$|Dockerfile$|docker-compose\.yml$|\.github/|azure-pipelines\.yml$|package\.json$|\.env\.example$)' |
  grep -v '\.spec\.ts$')
[ -n "$files" ] || exit 0

readme_time=$(stat -c %Y README.md 2>/dev/null || echo 0)
newer=$(for f in $files; do
  [ -f "$f" ] && [ "$(stat -c %Y "$f")" -gt "$readme_time" ] && echo "$f"
done)
[ -n "$newer" ] || exit 0

state="${TMPDIR:-/tmp}/claude-readme-$(echo "$CLAUDE_PROJECT_DIR" | md5sum | cut -c1-12)"
current=$(for f in $files; do echo "$f"; [ -f "$f" ] && md5sum < "$f"; done | md5sum | cut -d' ' -f1)
[ "$current" = "$(cat "$state" 2>/dev/null)" ] && exit 0
echo "$current" > "$state"

{
  echo "These files changed and can affect the system design or add a feature. Check whether README.md needs an update (architecture, flows, code structure, API surface, env vars, commands, production notes, design decisions). Update only what actually changed and keep it short. If README.md is already accurate, just say so."
  echo
  echo "$files"
} >&2
exit 2
