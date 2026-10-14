# AX Workbench plugin

Claude Code와 Codex에서 같은 문제 해결 workflow를 사용할 수 있도록 MCP와
Skill을 하나로 묶은 로컬 plugin입니다.

## Included

- `ax-workflow` skill: localhost MVP/MCP 확인 → 문제 원문 → 5-field 구조화 →
  사용자 수정 → 검증 → review-only handoff
- `setup` skill: 로컬 plugin 로딩 안내
- `ax_workbench` stdio MCP server
- `ax_read_reference`, `ax_structure_problem`, `ax_validate_contract`, `ax_create_handoff`

## Local test

Claude Code:

```bash
claude --plugin-dir ./plugins/ax-workbench
```

Codex local marketplace를 사용하려면 프로젝트 루트에서 다음을 실행합니다.

```bash
codex plugin marketplace add .
codex plugin add ax-workbench@ax-solve-local
codex plugin marketplace list
```

저장소 루트의 `.agents/plugins/marketplace.json`을 통해 `AX Solve Local`이
등록되고 plugin이 설치됩니다. 실제 화면별 기능 명세와 캡처는 [프로젝트 README](../../README.md#기능-명세와-화면-증거)에
정리되어 있습니다.

그 다음 Codex 데스크톱 Plugins 화면에서 `AX Solve Local` → `ax-workbench`를
설치하고 새 세션을 시작합니다. 호환 환경에서는 `.codex-plugin/plugin.json`과
`.codex.mcp.json`을 사용합니다.

Claude Code에서 Skill을 직접 호출하려면 다음을 사용합니다.

```text
/ax-workbench:ax-workflow
```

사용 흐름은 `Request → Structure → Human edit → Validate → Review-only handoff`이며,
MCP가 제공하는 네 도구는 `ax_read_reference`, `ax_structure_problem`,
`ax_validate_contract`, `ax_create_handoff`입니다. `ax_read_reference`는 사용자가
승인한 로컬 경로나 업로드한 HTML 참고자료를 Markdown으로 변환합니다.

Skill을 프로젝트 루트에서 실행하면 `apps/workbench/mcp/server.mjs`를 확인하고,
필요한 경우 `scripts/ax-workbench-local.mjs`로 detached 실행한 뒤
`http://127.0.0.1:8787/apps/workbench/demo/mvp.html`을 로컬 브라우저에서 엽니다.
HTTP MCP discovery와 화면의 `MCP 연결됨` 상태를 확인한 후 문제 구조화를
진행합니다. 서버는 localhost에만 바인딩하며 외부 전송이나 배포는 하지 않습니다.

서버는 외부 전송·메일 발송·업무 확정을 하지 않으며, 결과는 사람이 검토할 수
있는 문서 초안으로만 반환합니다.
