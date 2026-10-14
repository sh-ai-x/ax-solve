---
name: ax-workflow
description: Turn a vague work problem into a Korean five-field contract and a review-only handoff using the bundled AX Workbench MCP tools, while opening the local AX Workbench MVP and verifying its localhost MCP connection when run from the ax-solve checkout.
---

# AX Workbench workflow

Use this skill to move one problem through a small, reviewable workflow:

`Request → Structure → Human edit → Validate → Review-only handoff`

## Guardrails

- Ask for one problem sentence and the names of the materials needed to understand it when they are missing.
- Keep the original request and reference names in every downstream result.
- When a user provides an authorized local path, call `ax_read_reference` before structuring; it converts HTML references to Markdown.
- Do not send email, create or confirm tasks, post to Slack, commit code, or transmit source material externally.
- Do not execute the user's workflow or invent an execution command. Starting the documented local preview is the only automatic setup action.
- Keep the preview bound to `127.0.0.1`; do not bind it to `0.0.0.0`, deploy it, or expose source material remotely.
- Treat the five fields as editable by the user; an MCP-generated value is only a draft.

## Workflow

1. If the current working directory contains `apps/workbench/mcp/server.mjs` and `apps/workbench/demo/mvp.html`, prepare the local preview before calling the MCP tool:
   - Prefer the repository helper `node scripts/ax-workbench-local.mjs --open` when it exists. It reuses a healthy server or starts a detached local server, verifies the page and `server/discover`, writes failures to a temporary local log, and opens the browser URL.
   - If the helper is unavailable, check `http://127.0.0.1:8787/apps/workbench/demo/mvp.html`, then start `node apps/workbench/mcp/server.mjs` as a background process with stdout/stderr redirected to a temporary local log, keeping the documented `127.0.0.1:8787` bind.
   - If the process exits or the port remains closed, retry through a persistent host terminal/approved host execution; do not claim the preview is running until both HTTP checks succeed.
   - Verify the page returns HTTP 200 and verify `POST http://127.0.0.1:8787/mcp` with the local `server/discover` request. Do not treat a process start alone as success.
   - Report the URL and whether the page shows the literal `MCP 연결됨` status before continuing.
   - If those project files are absent, do not guess a path or start a remote service. Continue with the bundled plugin MCP and clearly report that the browser preview could not be opened.
2. If reference paths are provided, call `ax_read_reference` for each path. Then call `ax_structure_problem` with the user's sentence and the resulting references. The host may expose the tools with a plugin namespace; use the bundled AX Workbench server.
3. Present the original `Request`, `References`, and all five draft fields in Korean:
   - `Goal`
   - `Constraints`
   - `Success criteria`
   - `Anti-goals`
   - `Acceptance rubric`
4. Let the user edit any field. Preserve edits exactly; do not silently replace them with a regenerated draft.
5. Call `ax_validate_contract` after edits. If fields are missing, list the missing fields and stop before handoff generation.
6. Once complete, call `ax_create_handoff` and return a Markdown document with `Request`, `References`, `Mode: review-only`, `Contract`, `Verification`, and `Readiness`.

The local HTTP MCP used by the browser preview and the bundled stdio MCP used by Claude Code/Codex are separate transports over the same contract logic. The browser preview is for human review; the plugin MCP is the tool path for this skill.

## Output quality

The acceptance rubric must make it possible to check original evidence, owner, due date, and human approval status. If those details are not present in the input, state the gap instead of guessing. Keep the final recommendation focused on the next human review step.
