Status: completed

## Read first

- `apps/workbench/mcp/contract.mjs`
- `tests/unit/contract.test.mjs`

## Task

계약 초안, 누락 필드 검증, 직접 수정값 보존, handoff readiness를 Node 내장 test runner로 검증한다.

## Acceptance Criteria

- `npm run test:unit` 통과
- 5-field가 모두 입력된 계약은 ready 상태다.
- 일부 필드가 비어 있으면 누락 목록을 반환한다.

## Verification & Status Update

`node --test tests/unit/*.test.mjs` — 4 tests passed.

## Don't

- 모델 API를 호출하지 않는다.
- 검증 중 계약 값을 자동으로 변경하지 않는다.
