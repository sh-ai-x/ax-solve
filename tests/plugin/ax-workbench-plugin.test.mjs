import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PLUGIN = path.join(ROOT, "plugins/ax-workbench");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(PLUGIN, relativePath), "utf8"));
}

function startStdioServer() {
  const child = spawn(process.execPath, [path.join(PLUGIN, "mcp/server.mjs")], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"]
  });
  let buffer = "";
  const waiters = new Map();

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      const resolve = waiters.get(message.id);
      if (resolve) {
        waiters.delete(message.id);
        resolve(message);
      }
    }
  });

  return {
    child,
    request(id, method, params = {}) {
      return new Promise((resolve, reject) => {
        waiters.set(id, resolve);
        child.once("error", reject);
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      });
    }
  };
}

test("plugin exposes Claude Code and Codex-compatible package metadata", () => {
  const portable = readJson("plugin.json");
  const claude = readJson(".claude-plugin/plugin.json");
  const codex = readJson(".codex-plugin/plugin.json");
  const portableMcp = readJson("mcp.json");
  const claudeMcp = readJson(".mcp.json");
  const codexMcp = readJson(".codex.mcp.json");
  const marketplace = JSON.parse(
    fs.readFileSync(path.join(ROOT, ".agents/plugins/marketplace.json"), "utf8")
  );

  assert.equal(portable.name, "ax-workbench");
  assert.equal(claude.name, portable.name);
  assert.equal(codex.name, portable.name);
  assert.equal(portable.extensions["com.openai"].onboardingSkill, "./skills/setup/SKILL.md");
  assert.equal(portableMcp.mcpServers.ax_workbench.type, "stdio");
  assert.match(portableMcp.mcpServers.ax_workbench.args[0], /\$\{PLUGIN_ROOT\}/);
  assert.match(claudeMcp.mcpServers.ax_workbench.args[0], /\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.equal(codex.mcpServers, "./.codex.mcp.json");
  assert.equal(codexMcp.mcpServers.ax_workbench.command, "node");
  assert.match(codexMcp.mcpServers.ax_workbench.args[0], /\$\{PLUGIN_ROOT\}/);
  assert.equal(marketplace.plugins[0].source.path, "./plugins/ax-workbench");

  const skill = fs.readFileSync(path.join(PLUGIN, "skills/ax-workflow/SKILL.md"), "utf8");
  assert.match(skill, /ax_structure_problem/);
  assert.match(skill, /ax_validate_contract/);
  assert.match(skill, /ax_create_handoff/);
  assert.match(skill, /apps\/workbench\/mcp\/server\.mjs/);
  assert.match(skill, /127\.0\.0\.1:8787/);
  assert.match(skill, /server\/discover/);
  assert.match(skill, /MCP 연결됨/);
  assert.doesNotMatch(skill, /work on meeting-summary/);
});

test("plugin stdio MCP initializes and preserves request, refs, and edited contract", async () => {
  const server = startStdioServer();
  try {
    const initialized = await server.request(1, "initialize");
    assert.equal(initialized.result.serverInfo.name, "ax-workbench");

    const list = await server.request(2, "tools/list");
    assert.deepEqual(list.result.tools.map((tool) => tool.name), [
      "ax_structure_problem",
      "ax_validate_contract",
      "ax_create_handoff"
    ]);

    const structured = await server.request(3, "tools/call", {
      name: "ax_structure_problem",
      arguments: {
        request: "회의 후 결정사항과 반복 업무를 정리합니다.",
        refs: [
          { name: "meeting-notes.md", content: "결정: 금요일까지 초안을 검토합니다." },
          { name: "slack-thread.txt", content: "담당: 민지" }
        ]
      }
    });
    const contract = structured.result.structuredContent.contract;
    contract.goal = "사용자가 직접 수정한 목표";

    const handoff = await server.request(4, "tools/call", {
      name: "ax_create_handoff",
      arguments: {
        request: structured.result.structuredContent.request,
        refs: structured.result.structuredContent.refs,
        contract
      }
    });
    assert.match(handoff.result.structuredContent.markdown, /## Request/);
    assert.match(handoff.result.structuredContent.markdown, /meeting-notes\.md/);
    assert.match(handoff.result.structuredContent.markdown, /결정: 금요일까지 초안을 검토합니다\./);
    assert.match(handoff.result.structuredContent.markdown, /사용자가 직접 수정한 목표/);
    assert.match(handoff.result.structuredContent.markdown, /review-only/);
  } finally {
    server.child.kill();
  }
});
