#!/usr/bin/env bash
# Stop hook: after each prompt, list the comments in locally changed, staged and
# new .ts files and ask Claude to trim them. Skips when the comments are
# unchanged since the last check, and never blocks twice in a row.
input=$(cat)
cd "$CLAUDE_PROJECT_DIR" || exit 0

files=$( (git diff HEAD --name-only --diff-filter=AM -- 'src/*.ts' 'test/*.ts'
          git ls-files -o --exclude-standard -- 'src/*.ts' 'test/*.ts') |
  sort -u | grep -v '/migrations/')
[ -n "$files" ] || exit 0

comments=$(for f in $files; do
  [ -f "$f" ] && grep -nE '^\s*(//|/\*|\*( |/|$))|[^:]//\s' "$f" | sed "s|^|$f:|"
done)
[ -n "$comments" ] || exit 0

state="${TMPDIR:-/tmp}/claude-comments-$(echo "$CLAUDE_PROJECT_DIR" | md5sum | cut -c1-12)"
current=$(echo "$comments" | md5sum | cut -d' ' -f1)
previous=$(cat "$state" 2>/dev/null)
echo "$current" > "$state"

[ "$(echo "$input" | jq -r '.stop_hook_active // false')" = true ] && exit 0
[ "$current" = "$previous" ] && exit 0

{
  echo "Review the comments below in the changed files. Per CLAUDE.md, keep a comment only if the code is tricky or non-obvious, or it affects another module; explain why, not what. Remove or shorten the rest. Do not touch code, and if nothing needs changing, just say so."
  echo
  echo "$comments"
} >&2
exit 2
