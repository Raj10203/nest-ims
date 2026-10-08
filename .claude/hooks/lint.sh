#!/usr/bin/env bash
# PostToolUse hook: lint each TypeScript file Claude writes or edits under src/ or test/.
# Exit code 2 sends the lint output back to Claude so it can fix the problems.
file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')

case "$file" in
  "$CLAUDE_PROJECT_DIR"/src/*.ts | "$CLAUDE_PROJECT_DIR"/test/*.ts) ;;
  *) exit 0 ;;
esac

[ -f "$file" ] || exit 0

cd "$CLAUDE_PROJECT_DIR" || exit 0
if ! output=$(npx --no-install oxlint --type-aware "$file" 2>&1); then
  echo "$output" >&2
  exit 2
fi
