# 구축과 도구 — 개발 워크플로우, 디버깅, Inspector, 클라이언트 확장 패턴

## 학습 목표

서버·클라이언트 개발의 실전 워크플로우(로깅 규율, 설정 함정, 디버깅 순서)를 알고, Inspector 3클라이언트를 목적별로 구분해 쓰며, 대규모 호스트의 두 확장 패턴(점진적 발견, 코드 모드)을 설계에 적용할 수 있다.

## 선수 지식

- [05-transports.md](05-transports.md)의 stdio 규율
- [04-lifecycle-versioning.md](04-lifecycle-versioning.md)의 세대(era)

## 필수 지식 (HOW)

### 서버 개발 워크플로우

SDK는 Tier로 분류된다: **Tier 1** = TypeScript·Python·C#·Go, Tier 2 = Java·Rust·Ruby, Tier 3 = Swift·PHP·Kotlin. 모두 서버·클라이언트·양 전송·타입 안전을 제공한다.

**로깅 규율이 첫 번째 규칙이다** ([05](05-transports.md) 복습): stdio 서버는 stdout 출력 금지 — Python이면 `print()` 대신 `logging`(stderr로 간다), JS면 `console.error`. HTTP 서버는 stdout 로깅이 무해하지만 클라이언트가 stderr를 못 받으므로 자체 수집이나 OpenTelemetry를 쓴다.

**클라이언트(Claude Desktop 등) 연결 시 3대 함정**:
1. **작업 디렉토리 미정의** — 클라이언트가 띄운 서버의 cwd는 `/`일 수 있다. 설정·코드의 경로는 **전부 절대 경로**로
2. **환경변수 상속 제한** — stdio 서버는 플랫폼 의존적인 최소 환경만 물려받는다. 필요한 건 설정의 `env` 키로 명시
3. **재시작 규칙** — 설정·서버 코드 변경 후 클라이언트를 **완전 종료 후 재시작**(창 닫기로는 부족 — macOS Cmd+Q)

Claude Desktop 설정(`claude_desktop_config.json`, macOS `~/Library/Application Support/Claude/`): `mcpServers.{이름}.command/args/env`. 로그는 `~/Library/Logs/Claude/mcp.log`(연결 일반)와 `mcp-server-{이름}.log`(그 서버의 stderr).

**디버깅 순서**: ① 서버를 단독 실행해 기동 확인 → ② Inspector로 프로토콜 검증 → ③ 실제 클라이언트에 붙여 로그 관찰. 연결 실패 시: 클라이언트 로그 → 프로세스 생존 → Inspector 단독 테스트 → `server/discover`로 버전 확인(`-32022`의 `data.supported`) → 요청 `_meta` 필수 필드 확인(`-32602`) / 능력 선언 확인(`-32021`).

**에이전트 스킬로 만들기**: `mcp-server-dev` 플러그인(공식) — `build-mcp-server`(용도 인터뷰 → 배포 모델 추천), `build-mcp-app`(인라인 UI 위젯), `build-mcpb`(로컬 서버를 런타임째 `.mcpb` 번들로 패키징). 배포 경로 판단: 클라우드 API 래핑 = **원격 Streamable HTTP 기본**(설치 마찰 0, OAuth 자연스러움) / 로컬 머신 접근 필요 = **MCPB** / 프로토타입 = 로컬 stdio.

### 클라이언트 개발 핵심

기본 루프: 서버 연결 → `tools/list` → 도구 정의를 LLM에 제공 → 모델의 도구 호출을 MCP `tools/call`로 라우팅 → 결과를 대화에 회수 → 응답. 모범 사례: 프로세스·MCP·모델 API·직렬화 각 경계에서 에러에 문맥 부여, 쿼리 하나의 실패로 세션을 죽이지 않기, 정리(cleanup)는 실패 경로에서도 보장, 서버 커맨드 실행 전 검증·신뢰 확인.

### MCP Inspector — 하나의 패키지, 세 클라이언트

`@modelcontextprotocol/inspector` (Node 22.19+):

| 클라이언트 | 실행 | 용도 |
|---|---|---|
| **Web** (기본) | `npx @modelcontextprotocol/inspector [서버커맨드]` | 브라우저 GUI — 탐색·폼 기반 호출·모니터링 |
| **CLI** | `… --cli <서버> --method tools/list` | 스크립트·CI·에이전트 — 요청 1개 실행 후 종료 |
| **TUI** | `… --tui` | 터미널 인터랙티브(SSH·브라우저 없는 환경) |

셋은 같은 코어를 공유한다 — 같은 전송, 같은 설정 파일, 같은 OAuth 토큰 저장(`~/.mcp-inspector/storage/oauth.json`), 같은 세대(era) 협상.

**알아둘 것들**:
- **세션 토큰**: 웹 백엔드는 프로세스를 spawn할 수 있으므로 `/api/*`가 실행별 토큰으로 보호된다. **출력된 URL(토큰 포함)로 열 것.** `DANGEROUSLY_OMIT_AUTH`와 `DANGEROUSLY_BIND_ALL_INTERFACES`를 함께 켜지 말 것 — 포트에 닿는 누구나 내 머신에서 프로세스를 띄울 수 있게 된다
- **Protocol Era 설정**: 서버별 `legacy`(기본)/`auto`/`modern`. 기본이 legacy인 이유 — 디버깅 도구는 자동 프로브를 하면 안 된다(침묵하는 레거시 stdio 서버에서 멈추고, 기록되는 트랜스크립트를 오염시킨다). modern 동작을 보려면 의도적으로 바꿔야 한다
- **`--`구분자**: `mcp-inspector node server.js -- --config foo` — `--` 뒤는 서버의 인자
- **`--catalog`(쓰기 가능한 내 서버 목록, 없으면 생성) vs `--config`(읽기 전용, 남의 설정 파일 — 절대 안 건드림)**. Claude Desktop/Cursor/VS Code 설정 임포트 가능
- **CLI 종료 코드**: 0 성공 / 1 사용법·기타 / 2 앱 없음(--app-info) / 3 인증 필요 / 4 서버 도달 불가 / 5 도구 오류(`isError:true` 포함 — && 체인이 실패 호출로 진행하지 않게). 실패 시 stderr 마지막 줄에 JSON 에러 한 줄
- **CI 패턴**: `--cli … --stored-auth-only --method tools/list --format json | jq -e '…'` — stored-auth-only는 인터랙티브 OAuth를 절대 시작하지 않고 즉시 실패
- OAuth 콜백: web은 `localhost:6274/oauth/callback`, CLI/TUI는 공유 리스너 `127.0.0.1:6276/oauth/callback`(고정 포트 = IdP에 한 번 등록해 재사용). 웹 UI 기본 포트 6274
- 개발 루프 권장: CLI `--method initialize`로 기동 확인 → 웹에서 탐색 → 엣지(잘못된 입력·양 세대) 테스트 → CLI+jq로 CI에 고정

### 대규모 호스트의 두 확장 패턴 (Client Best Practices)

**1. 점진적 도구 발견 (Progressive Tool Discovery)** — 문제: 서버 수십 개 × 도구 수백 개의 정의를 컨텍스트에 다 실으면 토큰·지연·정확도 모두 나빠진다. 해법: 정의를 미리 주입하지 않고 3층으로 —
- **Catalog**: 모델에게 `search_tools(query)` 메타도구만 제공 → 이름+한 줄 설명 반환
- **Inspect**: 후보의 전체 스키마만 `get_tool_details(name)`로 로드
- **Execute**: 그 도구만 호출

검색 전략은 키워드(BM25)/임베딩/서브에이전트(작은 모델)/하이브리드 — 프로바이더 내장 tool search가 있으면 그것 우선. 전환 시점은 임계값으로(도구 정의가 컨텍스트의 1~5%를 넘으면 전환). 서버 단위로도 확장 — 레지스트리만 유지하고 필요할 때 연결·해제. **프롬프트 캐시 주의**: `tools` 배열 변경은 프리픽스 캐시를 깨므로, 새 정의는 캐시 경계 뒤에 덧붙이거나 안정된 `call_tool` 메타도구 하나로 라우팅하라.

**2. 프로그래매틱 도구 호출 (코드 모드)** — 문제: 직접 호출은 매 중간 결과가 모델 컨텍스트를 통과한다(로그 수천 건 → 티켓 생성 같은 체인에서 낭비). 해법: 모델이 **도구를 호출하는 코드를 작성**하고, 샌드박스에서 실행 — 중간 데이터는 샌드박스 안에서 흐르고 최종 요약만 모델로. 호스트가 도구 스키마(특히 `outputSchema`)로 typed 함수 스텁을 생성하고, 스텁 호출을 가로채 `tools/call`로 브로커한다.

보안 규칙: 샌드박스는 **네트워크 직접 접근 금지**(모든 외부 통신은 호스트 브로커 경유), 자격증명은 호스트만 보유, **스크립트 승인 ≠ 그 안의 모든 도구 호출 승인**(브로커가 호출마다 정책 평가 — 범주적 승인은 가능), 서버 간 데이터 흐름은 untrusted 경계, 타임아웃·메모리 제한, 출력 필터링. 에러 처리: `isError:true`를 예외로 변환해 모델 코드가 try/catch 하게. 두 패턴은 조합된다 — 발견으로 필요한 도구를 찾고, 코드 하나로 묶어 실행.

## 우리 작업과의 연결

cc-system 사용자 관점에서: Claude Code에 서버를 붙이기 전 `npx @modelcontextprotocol/inspector`로 단독 검증하는 습관, CI에서 `--cli --stored-auth-only + jq -e`로 서버 회귀 잡기, 그리고 도구가 많아진 우리 환경에서 ToolSearch가 곧 "점진적 발견" 패턴의 실물이라는 것.

### ⚠️ 암기 필수

- [ ] **연결 실패 진단 순서**: 클라이언트 로그 → 서버 단독 실행 → Inspector → `server/discover`(버전, `-32022`) → `_meta` 필수 필드(`-32602`)·능력(`-32021`). 3대 설정 함정 = 절대 경로 / env 명시 / 완전 재시작
  - 이유: "서버가 안 붙어요"는 반드시 이 순서로 — 90%가 경로·env·stdout 오염이다
- [ ] **Inspector 사용 지도**: web=탐색, CLI=CI·스크립트(종료 코드 0/2/3/4/5, `--stored-auth-only`), TUI=터미널. era 기본 **legacy**(자동 프로브 금지 원칙). 세션 토큰 URL로 열기, OMIT_AUTH+BIND_ALL 동시 금지
  - 이유: 검증 자동화 설계와 Inspector 보안 사고 방지의 최소 지식
- [ ] **확장 2패턴**: 점진적 발견(catalog→inspect→execute, 정의가 컨텍스트 1~5% 넘으면 전환) / 코드 모드(샌드박스 실행, 네트워크 차단·자격증명 호스트 보유·호출별 정책 평가)
  - 이유: 도구 수십·수백 개 시대의 호스트 설계 표준. 트레이드오프(캐시 무효화, 샌드박스 비용)까지 한 묶음

## 자가 진단

<details>
<summary>Q1: Python stdio 서버가 Claude Desktop에서 즉시 죽는다. 코드에 print("서버 시작")이 있다. 원인과 수정은?</summary>

**즉답 예시**: `print()`는 stdout으로 가는데, stdio 전송에서 stdout은 JSON-RPC 메시지 전용이라 그 한 줄이 프로토콜 스트림을 오염시켜 클라이언트 파서를 깨뜨린다. `logging` 모듈(stderr로 출력)로 바꾸면 된다 — 그 stderr는 `mcp-server-{이름}.log`에서 볼 수 있다.

</details>

<details>
<summary>Q2: Inspector의 protocol era 기본값이 auto가 아니라 legacy인 이유는?</summary>

**즉답 예시**: 디버깅 도구는 자기가 관찰 대상에 개입하면 안 된다. auto는 server/discover 프로브를 먼저 보내는데, 침묵하는 레거시 stdio 서버에선 타임아웃까지 멈추고, 무엇보다 기록되는 프로토콜 트랜스크립트에 "내가 보내지 않은 트래픽"이 섞인다. legacy 기본 + 명시적 opt-in이면 Protocol 탭에 보이는 것이 "내가 설정한 대로 행동하는 클라이언트가 보낸 것"과 정확히 일치한다.

</details>

<details>
<summary>Q3: 코드 모드에서 "사용자가 스크립트를 승인했으니 그 안의 도구 호출도 전부 승인된 것"이라는 구현의 문제는?</summary>

**즉답 예시**: 스크립트는 실행 시점에 동적으로 호출을 만들 수 있어서, 승인 시점에 사용자가 본 것과 실제 실행이 다를 수 있다. 브로커는 여전히 스펙상 MCP 호스트이므로 직접 호출과 같은 human-in-the-loop 정책을 샌드박스발 호출에도 적용해야 한다. 실용적 절충은 범주적 승인("이 실행 동안 ticketing_createIssue 허용")이되, 브로커가 매 호출을 그 승인 범위에 대조 평가하는 것이다.

</details>

<details>
<summary>Q4: CI에서 도구 호출이 isError:true로 실패했는데 파이프라인이 성공으로 지나갔다. Inspector CLI 기준 무엇을 놓쳤나?</summary>

**즉답 예시**: CLI는 `tools/call`이 `isError:true`를 반환하면 페이로드는 출력하되 **종료 코드 5**로 끝난다. 파이프라인이 종료 코드를 안 보고 stdout만 파싱했거나, `--format json` 없이 텍스트를 grep했을 가능성이 크다. `set -e`(또는 && 체인) + 종료 코드 분기(3=인증, 4=도달 불가, 5=도구 오류)로 실패 클래스를 나눠 처리해야 한다.

</details>

## 공식 문서

- [Build an MCP server](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server) · [Build an MCP client](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-client) — 언어별 전체 코드
- [Connect local servers](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers) · [Connect remote servers](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-remote-servers)
- [Build with Agent Skills](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-with-agent-skills) — mcp-server-dev 플러그인, 배포 경로
- [Debugging](https://modelcontextprotocol.io/docs/2026-07-28/tools/debugging) — 로깅·설정 함정·진단 순서
- [MCP Inspector](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector) — 하위 페이지: [web](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/web) · [cli](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/cli) · [tui](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/tui) · [authorization](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/authorization) · [configuration](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/configuration) · [protocol-eras](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/protocol-eras) · [recipes](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/recipes)
- [Client Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/develop/clients/client-best-practices) — 점진적 발견, 코드 모드
- [SDKs](https://modelcontextprotocol.io/docs/2026-07-28/sdk) — Tier 목록
