Status: completed

## Read first

- `apps/workbench/mcp/server.mjs`
- `tests/integration/mcp-server.test.mjs`

## Task

MCP JSON-RPC discovery와 구조화·검증·handoff 도구, 정적 MVP serving 경계를 임시 포트에서 검증한다.

## Acceptance Criteria

- `tools/list`가 3개 tool을 노출한다.
- 구조화 결과가 UI가 수정 가능한 contract를 반환한다.
- 직접 수정한 값이 validation과 handoff에 보존된다.
- 같은 서버가 `/mcp`와 MVP HTML을 제공한다.

## Verification & Status Update

`node --test tests/integration/*.test.mjs` — 4 tests passed.

## Don't

- 외부 서비스로 원문을 전송하지 않는다.
- 인증이나 자동 업무 실행을 추가하지 않는다.
