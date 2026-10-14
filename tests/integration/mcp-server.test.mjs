import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createServer } from "../../apps/workbench/mcp/server.mjs";

let server;
let baseUrl;

async function rpc(method, params = {}) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });
  assert.equal(response.status, 200);
  return response.json();
}

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("MCP discovery exposes the supported protocol and tools", async () => {
  const discovery = await rpc("server/discover");
  assert.deepEqual(discovery.result.supportedVersions, ["2026-07-28"]);

  const list = await rpc("tools/list");
  assert.deepEqual(list.result.tools.map((tool) => tool.name), [
    "ax_structure_problem",
    "ax_validate_contract",
    "ax_create_handoff"
  ]);
});

test("structure tool returns a contract that the UI can edit", async () => {
  const response = await rpc("tools/call", {
    name: "ax_structure_problem",
    arguments: {
      request: "회의 후 결정사항과 반복 업무를 자동 정리합니다.",
      refs: [
        { name: "meeting-notes.md", content: "결정: 금요일까지 초안을 검토합니다." },
        { name: "slack-thread.txt", content: "담당: 민지" }
      ]
    }
  });

  const value = response.result.structuredContent;
  assert.equal(value.refs.length, 2);
  assert.equal(value.refs[0].content, "결정: 금요일까지 초안을 검토합니다.");
  assert.match(value.contract.goal, /회의 후 결정사항/);
  assert.match(value.contract.constraints, /slack-thread\.txt/);
});

test("validate and handoff tools preserve edited values", async () => {
  const contract = {
    goal: "직접 수정한 목표",
    constraints: "검토 전 외부 전송 금지",
    success_criteria: "10분 내 실행 목록 확인",
    anti_goals: "자동 메일 발송 금지",
    acceptance_rubric: "근거·담당자·기한·승인 상태 포함"
  };

  const validation = await rpc("tools/call", {
    name: "ax_validate_contract",
    arguments: { contract }
  });
  assert.equal(validation.result.structuredContent.complete, true);

  const handoff = await rpc("tools/call", {
    name: "ax_create_handoff",
    arguments: {
      request: "회의 정리",
      refs: [{ name: "notes.md", content: "결정: 다음 주에 다시 확인" }],
      contract
    }
  });
  assert.match(handoff.result.structuredContent.markdown, /직접 수정한 목표/);
  assert.match(handoff.result.structuredContent.markdown, /결정: 다음 주에 다시 확인/);
  assert.match(handoff.result.structuredContent.markdown, /ready for human review/);
});

test("static MVP is served from the same process as MCP", async () => {
  const response = await fetch(`${baseUrl}/apps/workbench/demo/mvp.html`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /id="mcpStatus"/);
  assert.match(html, /구조화 단계 · 직접 입력/);
  assert.match(html, /id="requestPreview"/);
  assert.match(html, /## Request/);
  assert.match(html, /placeholder="무엇을 해결하거나 자동화할지 입력하세요/);
  assert.doesNotMatch(html, /\/work on meeting-summary/);
});
