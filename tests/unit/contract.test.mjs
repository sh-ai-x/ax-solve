import assert from "node:assert/strict";
import test from "node:test";
import {
  FIELD_KEYS,
  createHandoff,
  deriveContract,
  validateContract
} from "../../apps/workbench/mcp/contract.mjs";

test("deriveContract creates a meeting workflow contract from request and references", () => {
  const contract = deriveContract("회의 후 결정사항과 반복 업무를 정리하고 싶습니다.", ["meeting-notes.md"]);

  assert.equal(FIELD_KEYS.length, 5);
  assert.match(contract.goal, /회의 후 결정사항과 반복 업무/);
  assert.match(contract.constraints, /meeting-notes\.md/);
  assert.match(contract.acceptance_rubric, /담당자/);
});

test("validateContract reports only empty fields", () => {
  const result = validateContract({ goal: "목표" });

  assert.equal(result.complete, false);
  assert.deepEqual(result.missing, [
    "constraints",
    "success_criteria",
    "anti_goals",
    "acceptance_rubric"
  ]);
  assert.equal(result.fields.goal.filled, true);
  assert.equal(result.fields.constraints.filled, false);
});

test("validateContract accepts a directly edited complete contract", () => {
  const result = validateContract({
    goal: "회의 결정사항을 실행 목록으로 정리한다.",
    constraints: "외부 전송 없이 검토한다.",
    success_criteria: "10분 안에 실행 목록을 확인한다.",
    anti_goals: "메일을 자동 발송하지 않는다.",
    acceptance_rubric: "근거, 담당자, 기한, 승인 상태가 포함된다."
  });

  assert.equal(result.complete, true);
  assert.deepEqual(result.missing, []);
});

test("createHandoff preserves edited contract values and readiness", () => {
  const contract = {
    goal: "사용자가 직접 수정한 목표",
    constraints: "외부 전송 금지",
    success_criteria: "10분 내 확인",
    anti_goals: "자동 메일 금지",
    acceptance_rubric: "원문 근거 포함"
  };
  const handoff = createHandoff({
    request: "회의 업무를 정리합니다.",
    refs: ["meeting-notes.md"],
    contract
  });

  assert.match(handoff.markdown, /사용자가 직접 수정한 목표/);
  assert.match(handoff.markdown, /- meeting-notes\.md/);
  assert.match(handoff.markdown, /ready for human review/);
  assert.equal(handoff.json.validation.complete, true);
});
