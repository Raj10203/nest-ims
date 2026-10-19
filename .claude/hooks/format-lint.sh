#!/usr/bin/env bash
# PostToolUse hook: after Claude writes or edits a TypeScript file under src/ or test/,
# run the project's format and lint scripts inside the app container.
# Exit code 2 sends the output back to Claude so it can fix the problems.
file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')

case "$file" in
  "$CLAUDE_PROJECT_DIR"/src/*.ts | "$CLAUDE_PROJECT_DIR"/test/*.ts) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" || exit 0

if ! docker compose exec -T app true >/dev/null 2>&1; then
  echo "The app container is not running, so format and lint were skipped. Start it with: docker compose up -d app" >&2
  exit 2
fi

if ! output=$(docker compose exec -T app npm run format 2>&1); then
  echo "npm run format failed:" >&2
  echo "$output" >&2
  exit 2
fi

if ! output=$(docker compose exec -T app npm run lint 2>&1); then
  echo "$output" >&2
  exit 2
fi
