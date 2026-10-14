# AX Workbench 테스트 품질 개선 PRD

## 1. Frame

- Goal: 사용자가 구조화 단계에서 5-field를 직접 입력·수정하고 MCP handoff까지 진행하는 UI workflow를 unit, integration, e2e 테스트로 재현 가능하게 검증한다.
- Target user: 회의·반복 업무 자동화를 설계하는 AX 실무자.
- Situation: 현재 buildless MVP와 local MCP는 동작하지만, 핵심 계약·HTTP 경계·실제 브라우저 흐름을 자동 회귀 테스트로 보호하지 못한다.

## 2. Validate

기존 proposal, 구현 검증, 대표 회의 자동화 시나리오를 재사용했다.

- Evidence 1: 기존 `problem-solving.yaml/html` proposal이 5-field 계약과 사람 승인 handoff를 제품 핵심으로 정의한다.
- Evidence 2: 브라우저 검증에서 Goal 직접 수정값이 handoff에 반영되고 `MCP 연결됨 · 3 tools`가 표시된다.
- Evidence 3: MCP discovery, 구조화, 검증, handoff 호출이 로컬 endpoint에서 모두 응답한다.
- Value score: 테스트 재실행 비용을 낮추고 회귀 오류를 조기에 잡는 품질 가치가 구현 비용보다 크므로 3.0 이상으로 판단한다.
- Ambiguity score: 2/10. 테스트 경계와 대표 시나리오가 확정되었다.

## 3. Non-goals

1. 실제 Claude/Codex 모델 응답 품질 평가 — deterministic contract와 MCP 경계만 검증한다. 요청되면 provider 평가셋을 별도 phase로 만든다.
2. 사내 Slack·메일·문서 connector 연동 — 현재는 파일명 참고자료와 local MCP만 사용한다. 실제 connector는 권한·개인정보 정책 확인 후 추가한다.
3. 자동 메일 발송 또는 업무 확정 — 사람 승인 이전 자동 실행을 금지하는 현재 안전 계약을 유지한다.

## 4. Phase plan

Phase: `phases/workbench-quality/index.json`

1. Contract unit tests: 초안 생성, 누락 필드, 직접 수정값, handoff readiness를 검증한다.
2. MCP integration tests: discovery, 3개 tool, 정적 UI와 HTTP endpoint의 동시 제공을 검증한다.
3. Browser E2E and screenshots: MCP 연결, 구조화 단계 직접 수정, 승인 차단·완료 흐름과 화면 캡처를 검증한다.

## 5. Acceptance criteria

1. `npm run test:unit`이 계약 관련 4개 테스트를 통과한다.
2. `npm run test:integration`이 MCP와 static server 경계 4개 테스트를 통과한다.
3. `npm run test:e2e`가 실제 Chromium에서 직접 수정 및 handoff 승인/차단 시나리오 2개를 통과한다.
4. 입력·구조화·handoff-ready 화면 캡처 3장이 README에 연결된다.
5. 테스트 실패 시 어떤 계층(unit/integration/e2e)에서 실패했는지 명령어 기준으로 재현된다.

## 6. Handoff

- 완료된 구현: `apps/workbench/mcp/contract.mjs`, `apps/workbench/mcp/server.mjs`, `apps/workbench/demo/mvp.html`
- 테스트: `tests/unit/contract.test.mjs`, `tests/integration/mcp-server.test.mjs`, `tests/e2e/test_workbench.py`
- 캡처: `apps/workbench/demo/screenshots/`
- 사용 명령: `npm test`
- 다음 확장: 실제 provider adapter와 connector를 추가할 때 동일한 contract/MCP/E2E 경계를 유지한다.
