---
name: setup
description: Explain how to load and verify the local AX Workbench plugin in Claude Code or Codex.
disable-model-invocation: true
---

# AX Workbench setup

Explain that the plugin is local and review-only.

- Claude Code: start a session with `claude --plugin-dir ./plugins/ax-workbench`, then use `/reload-plugins` after edits and `/mcp` to confirm `ax_workbench` is connected.
- Codex: add the plugin root to the configured plugin directory or local marketplace, then start a new session so the root `plugin.json` and `mcp.json` are loaded.
- The reusable workflow is the `ax-workflow` skill. It uses the three MCP tools to structure, validate, and create a review-only handoff.
- The plugin does not send mail, confirm work, or execute an agent command.
