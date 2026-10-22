---
name: pr-description
description: Write a plain-language pull request description and release notes for this repo. Use when the user asks for a PR description, PR body, or release notes, or when opening or updating a PR.
---

# PR description

Write for a reviewer or product owner, not a developer. The diff already shows the code, so describe what changes for users and the business, not how it is built. No file names, class names or library names unless a deploy step needs one.

## Steps

1. Find the change set: `git log master..HEAD --oneline` and `git diff master...HEAD --stat`. Read the migrations (`src/database/migrations/`), `.env.example`, `docker-compose.yml`, `package.json` and DTOs to catch schema, config, new services and API contract changes.
2. Write the title as a conventional commit that names the outcome, for example `feat: email verification, background mail jobs and request logging`.
3. Fill the template below. Delete a section only if it is truly empty, and say "None" for Breaking changes and Before release so the reader knows it was checked.

## Template

```markdown
## Summary

One or two sentences: what this PR delivers and why.

## What changes for users and the business

- Behaviour changes in plain words (who can do what, what they now see, what is now blocked).
- One bullet per feature or rule change.

## Database changes

- Each table or column added, renamed or removed, and what it is for.
- Say whether the change is safe while the old version is still running (backward compatible) and what rollback does.
- "None" if there are no migrations.

## Breaking changes

- API or behaviour changes that existing clients, scripts or users must adapt to. "None" if there are none.

## Release notes

Short, user-facing bullets, as they would appear in a changelog.

## Before release (deploy checklist)

Ordered steps someone must do for this to work, for example:

- [ ] New or changed environment variables, with the value to set.
- [ ] New services to provision (broker, mail provider, worker process).
- [ ] Commands to run, in order (build, migrations, seed).
- [ ] Data fixes or manual steps for existing records (for example existing users must verify their email).
- [ ] Anything to restart.
      "Nothing extra" if the PR merges and works on its own.

## How to verify

2 to 4 steps a reviewer can follow to see it working.
```

## Rules

- Lead with business impact. Mention a technical detail only when someone must act on it (a variable, a command, a new server).
- Be specific about numbers that matter to users (time limits, attempt limits, retry counts).
- Never invent a step. If unsure whether something is needed before release, check `.env.example`, the migrations and `CLAUDE.md`.
- Link issues with `Fixes #N` when they exist.
- If the PR mixes unrelated features, say so in the Summary and list them separately.
- To update an open PR: `gh pr edit <n> --title "..." --body-file <file>`.

## Output format

Never create an artifact, file or web page for the result. Print it in the chat as two separate code fences so the user can copy each with the block's copy button:

1. The title in a plain ``` fence.
2. The description in a ````markdown fence (four backticks), because the description contains its own code spans. Start with `## Summary` and put nothing else inside the fence.

Keep any remarks outside the fences, after them, in one or two lines (for example, items you could not verify). Do not add headings or commentary inside the fences.
