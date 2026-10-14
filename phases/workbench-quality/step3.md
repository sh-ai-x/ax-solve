Status: completed

## Read first

- `apps/workbench/demo/mvp.html`
- `tests/e2e/test_workbench.py`
- `tests/e2e/capture_screenshots.py`

## Task

실제 Chromium에서 MCP 연결, 구조화 단계 직접 수정, handoff 승인과 빈 필드 차단을 검증하고 세 가지 핵심 상태를 캡처한다.

## Acceptance Criteria

- `MCP 연결됨 · 4 tools`가 보인다.
- `직접 입력` 편집 화면에서 Goal 변경값이 handoff에 반영된다.
- 빈 Acceptance rubric은 handoff 승인을 막는다.
- `01-input-stage.png`, `02-structured-editing.png`, `03-handoff-ready.png`가 생성된다.

## Verification & Status Update

`python3 -m pytest -q tests/e2e` — 2 tests passed.
`python3 tests/e2e/capture_screenshots.py` — 3 screenshots generated.

## Don't

- 실제 사용자 계정으로 로그인하지 않는다.
- 파일 업로드나 외부 전송을 수행하지 않는다.
