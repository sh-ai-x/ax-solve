# AX Workbench

문제의 원문을 실행 가능한 workflow로 정리하되, 사람이 검토하기 전에는
외부 전송이나 업무 확정을 하지 않는 개인용 AX 문제 해결 워크벤치입니다.

## 현재 구현

`문제 입력 → 참고자료 Markdown 변환 → 구조화·직접 수정 → 검증 → 검토용 handoff` 흐름을 제공하며, 저장된 Draft를 여러 개 관리할 수 있습니다.
`ax-workflow` Skill을 실행하면 로컬 MVP와 HTTP MCP를 먼저 확인·실행하고,
브라우저를 `127.0.0.1:8787`로 엽니다.

- 문제 문장과 참고자료 파일을 첫 단계에서 선택합니다. HTML/YAML 참고자료는 MCP가 Markdown으로 변환한 뒤 불러오며, 같은 이름의 파일은 절대경로를 추가할 수 있습니다.
- 구조화 단계에서 변환된 참고자료 Markdown을 직접 수정할 수 있고, 수정한 내용은 handoff와 저장할 Draft에 반영됩니다.
- 구조화 단계에서 `Goal`, `Constraints`, `Success criteria`, `Anti-goals`,
  `Acceptance rubric`을 직접 수정합니다.
- 첫 단계의 원문과 참고자료(파일명·절대경로·내용)는 구조화 화면과 handoff 문서의 `Request`,
  `References`에 그대로 이어집니다.
- handoff는 Markdown·JSON으로 복사하거나 다운로드할 수 있습니다.
- 로컬 저장만 사용하며 로그인, 자동 메일, 업무 확정, 외부 업로드는 없습니다.
- 이전의 `work on meeting-summary` 실행 명령은 사용하지 않습니다.

## localhost 실행

프로젝트 루트에서 다음을 실행합니다.

```bash
node apps/workbench/mcp/server.mjs
```

브라우저:

- [MVP](http://127.0.0.1:8787/apps/workbench/demo/mvp.html)

기존 HTTP MCP endpoint는 `POST http://127.0.0.1:8787/mcp`입니다. 자세한 화면,
캡처, 테스트 설명은 [demo README](./apps/workbench/demo/README.md)를 참고합니다.

## Claude Code·Codex 호환 plugin

플러그인은 [plugins/ax-workbench](./plugins/ax-workbench)에 있습니다. `dev-kit`의
공통 구조처럼 Claude Code와 Codex가 같은 `skills/`를 사용하고, 클라이언트별
manifest/MCP 연결 파일만 분리했습니다.

```text
plugins/ax-workbench/
├── plugin.json                  # Agent Plugins portable manifest
├── mcp.json                     # Codex/Agent Plugins stdio MCP
├── .mcp.json                    # Claude Code MCP connection
├── .codex.mcp.json              # Codex compatibility MCP connection
├── .claude-plugin/plugin.json   # Claude Code manifest
├── .codex-plugin/plugin.json    # Codex compatibility manifest
├── mcp/
│   ├── contract.mjs
│   └── server.mjs
└── skills/
    ├── ax-workflow/SKILL.md
    └── setup/SKILL.md
```

제공하는 MCP 도구는 네 가지입니다.

- `ax_read_reference`: 사용자가 승인한 절대경로 또는 업로드 HTML/YAML을 읽고 Markdown으로 변환
- `ax_structure_problem`: 문제 원문과 참고자료를 5-field 초안으로 구조화
- `ax_validate_contract`: 직접 수정한 계약의 누락 필드 검증
- `ax_create_handoff`: Request·References·Contract·Verification을 포함한
  `review-only` handoff 생성

### Claude Code에서 로컬로 확인

```bash
claude --plugin-dir ./plugins/ax-workbench
```

Claude Code 세션에서 `/reload-plugins` 후 `/mcp`를 실행하면 plugin MCP 연결을
확인할 수 있습니다. 워크플로우 skill은 `/ax-workbench:ax-workflow`로 노출됩니다.

Skill을 사용하면 다음 순서로 진행합니다.

```text
localhost MVP/MCP 확인 → 원문 입력 → ax_structure_problem → 5-field 직접 수정
→ ax_validate_contract → ax_create_handoff → 사람 검토
```

Skill은 `apps/workbench/mcp/server.mjs`가 있는 프로젝트 루트에서만 localhost
MVP를 자동으로 열며, `scripts/ax-workbench-local.mjs`가 서버 재사용·detached
실행·MCP discovery·브라우저 열기를 담당합니다. 서버는 `127.0.0.1`에만
바인딩합니다. 프로젝트 파일이 없으면 plugin의 stdio MCP만 사용하고 경로를
추측하지 않습니다.

직접 호출이 필요한 경우에는 bundled MCP tool을 사용합니다. Claude Code에서는
plugin namespace가 붙어 보일 수 있으므로 `/mcp`에 표시된 실제 tool 이름을
확인합니다.

### Codex에서 로컬 plugin으로 확인

이 저장소에는 재현 가능한 local marketplace가 포함되어 있습니다.

```bash
codex plugin marketplace add .
codex plugin add ax-workbench@ax-solve-local
codex plugin marketplace list
```

저장소 루트에서 위 명령을 실행하면 `.agents/plugins/marketplace.json`을
기반으로 하는 `AX Solve Local` local marketplace가 등록되고 plugin이 설치됩니다.
또는 Codex 데스크톱의 Plugins 화면에서 `AX Solve Local`을 열어 `ax-workbench`를
설치한 뒤 새 세션을 시작합니다. 프로젝트별로 활성화하려면 `.codex/config.toml`에
다음을 추가합니다.

```toml
[plugins."ax-workbench@ax-solve-local"]
enabled = true
```

portable `plugin.json`·`mcp.json`과 `.codex-plugin`·`.codex.mcp.json` 호환
파일을 함께 제공하므로 최신 portable 경로와 호환 경로를 모두 보존합니다.

이 plugin은 로컬 stdio MCP를 사용하므로 실행 중인 웹 서버와 독립적으로 Codex와
Claude Code에서 동일한 구조화·검증·handoff 도구를 제공합니다.

## 테스트

```bash
npm test
```

현재 테스트 범위:

- Unit: 계약 생성·검증·handoff 값 보존
- Integration: 기존 HTTP MCP discovery와 UI 제공
- Plugin: portable/Claude/Codex manifest, skill, stdio MCP handshake와 tool 호출
- E2E: HTML/YAML → Markdown 변환 → 참고자료·계약 직접 수정 → handoff → 여러 Draft 저장·열기·삭제 → 빈 필드 차단

E2E가 완료되면 [screenshots](./apps/workbench/demo/screenshots/)도 다시 생성합니다.

## 기능 명세와 화면 증거

화면 캡처는 [apps/workbench/demo/screenshots](./apps/workbench/demo/screenshots)에
저장되며, 아래 명세의 각 상태를 재현합니다.

| 상태 | 화면 증거 | 기능 명세 | 통과 조건 |
|---|---|---|---|
| 1. 문제 입력·참고자료 | [01-input-and-references.png](./apps/workbench/demo/screenshots/01-input-and-references.png) | 문제와 HTML/YAML 참고자료를 선택하고, 중복 파일을 구분할 절대경로를 입력한다. | 선택한 파일명과 절대경로가 구조화 단계로 전달된다. |
| 2. Markdown·초안 직접 수정 | [02-markdown-editing.png](./apps/workbench/demo/screenshots/02-markdown-editing.png) | MCP가 HTML/YAML을 Markdown으로 바꾼 결과와 5개 계약 필드를 직접 수정한다. | HTML 태그·YAML 원문 대신 편집 가능한 Markdown이 보이고 handoff에 반영된다. |
| 3. 여러 Draft 관리 | [03-saved-drafts.png](./apps/workbench/demo/screenshots/03-saved-drafts.png) | 현재 Claude Code/Codex 작업 디렉터리 범위의 Draft를 여러 개 저장·열기·삭제한다. | 네 번째 `저장된 Draft` 탭에 2개 이상의 Draft와 Workspace 경로가 표시된다. |
| 4. handoff 승인 | [04-handoff-ready.png](./apps/workbench/demo/screenshots/04-handoff-ready.png) | 직접 수정한 초안을 검증하고 사람이 검토할 handoff를 준비한다. | `Ready`, `review-only`, `Request`, `References`, `Verification`이 포함된다. |

### 화면 미리보기

#### 1. 문제 입력·참고자료

![문제 입력과 HTML/YAML 참고자료](./apps/workbench/demo/screenshots/01-input-and-references.png)

#### 2. Markdown·초안 직접 수정

![Markdown 변환과 직접 수정](./apps/workbench/demo/screenshots/02-markdown-editing.png)

#### 3. 여러 Draft 관리

![여러 Draft 관리](./apps/workbench/demo/screenshots/03-saved-drafts.png)

#### 4. handoff 승인

![handoff 승인 화면](./apps/workbench/demo/screenshots/04-handoff-ready.png)

### 기능별 동작

| 기능 | 동작 | 데이터 경계 |
|---|---|---|
| 참고자료 변환 | HTML/YAML 업로드 또는 사용자가 승인한 절대경로를 `ax_read_reference`로 읽어 Markdown으로 변환 | 로컬 MCP 요청만 사용 |
| 문제 입력 | 현재 작업 디렉터리별 Draft 목록에 초안을 저장하고 구조화 단계로 전달 | 외부 업로드 없음 |
| Markdown 편집 | 변환된 참고자료와 5개 계약 필드를 브라우저에서 직접 수정 | 저장 버튼을 누르기 전 변경은 Draft에 반영하지 않음 |
| 구조화 | MCP가 초안을 만들고 사용자가 직접 편집 | MCP 초안은 확정값이 아님 |
| 검증 | 5개 필드가 비어 있는지 확인 | 누락 시 handoff 버튼 차단 |
| handoff | Markdown·JSON 복사/다운로드 | 자동 실행·메일·업무 확정 없음 |
| 여러 Draft | `저장된 Draft` 탭에서 Workspace별 Draft를 열고 삭제 | 브라우저 localStorage 범위이며 외부 저장소 없음 |
| plugin skill | 동일한 Request·References·Contract workflow를 Claude Code/Codex에서 안내 | 검토용 문서만 생성 |

## 다음 단계

현재 plugin은 로컬 검토 workflow MVP입니다. 이후 필요할 때만 실제 Claude/Codex
provider adapter, Archify exporter, 원격 MCP 배포를 별도 범위로 추가합니다.

## 참고한 plugin 형식

- [Claude Code plugin overview](https://code.claude.com/docs/en/plugins)
- [Claude Code plugin components](https://code.claude.com/docs/en/plugins/components)
- [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [OpenAI local MCP plugin](https://developers.openai.com/plugins/deploy/desktop-only)
