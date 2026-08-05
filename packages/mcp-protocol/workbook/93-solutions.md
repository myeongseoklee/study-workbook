# 정답과 해설 — MCP 프로토콜 정복

> 먼저 [92-workbook.md](92-workbook.md)를 풀고 나서 열어보라. 문항 번호가 그대로 대응한다.

## 파트 1. 회수 연습

### 1-1
호스트 = 사용자가 마주하는 AI 앱. 보안 정책·동의 집행, 인가 결정, LLM 조율, 여러 클라이언트의 컨텍스트 합성. / 클라이언트 = 호스트가 만드는 프로토콜 커넥터. 메시지 왕복, 매 요청에 버전·능력 첨부, 구독 관리, 서버 간 경계 유지. / 서버 = 프리미티브를 노출하는 프로그램(로컬·원격 불문). **클라이언트:서버 = 1:1** — 서버 N개면 클라이언트 N개.

📍 되짚기: `docs/02-core-principles.md` § 원리 2 / 카드 1

### 1-2
Tools = **모델** / Resources = **애플리케이션** / Prompts = **사용자**(사용 시점 결정 — 내용은 서버가 작성). 클라이언트 제공 현역 기능 = **Elicitation** (Sampling·Roots는 deprecated).

📍 되짚기: `docs/02-core-principles.md` § 원리 5 / 카드 2

### 1-3
① 요청은 자기완결(처리에 필요한 모든 정보 포함) ② 연결 ≠ 세션(stdio 프로세스도 대화 연속성의 근거 아님) ③ 크로스 요청 상태는 명시적 핸들. 필수: `io.modelcontextprotocol/protocolVersion`, `io.modelcontextprotocol/clientCapabilities` / 권장: `io.modelcontextprotocol/clientInfo`. 누락 = `-32602` (HTTP면 400).

📍 되짚기: `docs/02-core-principles.md` § 원리 4, `docs/03-messages-meta.md` § `_meta` / 카드 3

### 1-4
`-32602` Invalid params — 인자 오류·**없는 리소스**·**필수 `_meta` 누락** 겸용 / `-32601` Method not found — HTTP **404** / `-32020` HeaderMismatch — 400 / `-32021` MissingRequiredClientCapability(`data.requiredCapabilities`) — 400 / `-32022` UnsupportedProtocolVersion(`data.supported`·`requested`) — 400. `-32002`(구 리소스 없음)는 **방출 금지, 수신은 수용**.

📍 되짚기: `docs/03-messages-meta.md` § 에러 코드 / 카드 4

### 1-5
`-32000`~`-32019` = 레거시·구현 정의(신규 할당 금지, 새 구현은 사용 지양) / `-32020`~`-32099` = MCP 명세 전용(정의된 코드만, 정의된 의미로만). 자체 에러는 JSON-RPC 예약 대역(`-32768`~`-32000`) **바깥**에.

📍 되짚기: `docs/03-messages-meta.md` § 에러 코드 / 카드 5

### 1-6
(a) `"complete"`, `"input_required"` (+ capability로 광고된 확장 값) (b) 부재 = `"complete"`로 간주 — resultType이 없던 구버전 서버와의 호환(MUST) (c) 미지 = invalid — 모르는 미래 값을 아는 척 진행하면 위험. 부재는 "과거"(안전하게 해석 가능), 미지는 "미래"(해석 불가)라 처리가 갈린다.

📍 되짚기: `docs/03-messages-meta.md` § resultType / 카드 6

### 1-7
① 클라이언트가 선호 버전을 `_meta`(+HTTP 헤더)에 실어 요청 ② 서버가 미지원이면 `-32022` + `data.supported` ③ 클라이언트가 교집합에서 골라 재시도(없으면 사용자에게 에러). `server/discover`는 **서버 구현 의무(MUST), 클라이언트 호출 선택(MAY)**.

📍 되짚기: `docs/04-lifecycle-versioning.md` § 버전 협상 / 카드 7

### 1-8
① `DiscoverResult` → modern, 계속 ② 인식 가능한 modern 에러(-32020~-32099, 예: -32022) → modern인데 버전 불일치 — `supported`에서 골라 재시도, **폴백 금지** ③ 그 외 에러 또는 타임아웃 → legacy, `initialize` 폴백. HTTP는 400 응답의 **본문**: 인식 가능한 modern JSON-RPC 에러가 있으면 modern, 없으면 legacy 폴백. 판정은 서버 단위 캐시.

📍 되짚기: `docs/04-lifecycle-versioning.md` § 두 세대의 공존 / 카드 8

### 1-9
Roots → 디렉토리를 도구 인자·리소스 URI·서버 설정으로 / Sampling → LLM 프로바이더 API 직접 통합 / Logging → stderr(stdio)·OpenTelemetry / DCR → Client ID Metadata Documents.

📍 되짚기: `docs/04-lifecycle-versioning.md` § Deprecated 레지스트리 / 카드 9

### 1-10
(a) stdout = 유효한 MCP 메시지 전용, stderr = 로그(클라이언트는 캡처·전달·무시 자유) (b) 메시지당 한 줄, 개행 구분, 메시지 내 개행 금지 (c) ① stdin 닫기 ② 서버 종료 대기 ③ 안 죽으면 강제 종료(SIGTERM → SIGKILL).

📍 되짚기: `docs/05-transports.md` § stdio / 카드 10

### 1-11
(a) `Content-Type: application/json`(단일 객체) 또는 `text/event-stream`(그 요청 스코프 SSE — 관련 알림들 후 최종 응답). 클라이언트는 둘 다 지원 MUST (b) `202 Accepted`, 본문 없음 (c) `MCP-Protocol-Version`, `Mcp-Method`, (tools/call·resources/read·prompts/get엔) `Mcp-Name` — 본문 불일치·누락 = 400 + `-32020`. 끊긴 스트림은 재개 불가 — **새 요청 id로 재발행**.

📍 되짚기: `docs/05-transports.md` § Streamable HTTP / 카드 11

### 1-12
HTTP = 그 요청의 응답 스트림을 닫는 것 자체가 취소(cancelled 알림 불필요) / stdio = `notifications/cancelled`(requestId 지정). 서버발 cancelled의 유일한 용도 = **`subscriptions/listen` 요청을 지목한 구독 스트림 해체**.

📍 되짚기: `docs/05-transports.md` § 취소, `docs/09-subscriptions-utilities.md` / 카드 12

### 1-13
DNS 리바인딩 — 악성 웹페이지가 도메인 해석을 바꿔 브라우저로 로컬 MCP 서버를 조작하는 공격. Origin이 있는데 유효하지 않으면 **403 Forbidden**. 로컬 실행 시 `127.0.0.1` 바인딩(0.0.0.0 금지).

📍 되짚기: `docs/05-transports.md` § 보안 / 카드 13

### 1-14
프로토콜 오류: (a) JSON-RPC `error` 객체 (b) 모르는 도구, 스키마를 어긴 요청 구조/서버 내부 오류. 실행 오류: (a) 정상 result + `isError: true` + content에 설명 (b) 업스트림 API 실패, 입력 값 검증 실패(형식·범위), 비즈니스 로직 오류. (c) 기준: **모델이 인자를 고쳐 재시도하면 성공할 수 있는가** — 있으면 실행 오류(모델에 전달 SHOULD).

📍 되짚기: `docs/06-tools.md` § 오류의 2계층 / 카드 14

### 1-15
(a) `tools/call`, `resources/read`, `prompts/get` (b) `elicitation/create`, `sampling/createMessage`, `roots/list` (c) `inputRequests`·`requestState` 중 **최소 1개**(MUST) (d) 재시도는 독립 요청 — **반드시 새 id** (e) 공격자 통제 입력으로 취급: HMAC/AEAD 무결성 + 검증 실패 거부, 페이로드에 주체·TTL·원 요청 식별자를 넣어 재사용 창 축소, 단일 사용 보장이 필요하면 서버 측 별도 강제.

📍 되짚기: `docs/08-mrtr-client-features.md` / 카드 15

### 1-16
금지: 비밀번호·API 키·액세스 토큰·결제 자격증명(비밀·자격증명류) → **URL 모드**로(대역외, 클라이언트·LLM을 거치지 않음). 피싱 방어: **URL을 연 사용자가 elicitation을 시작한 사용자와 동일함을 서버가 검증**(MUST — 예: 세션 쿠키의 sub 대조 후 서드파티로 리다이렉트). URL 모드의 `accept` = "사용자가 열기에 동의" — **상호작용 완료가 아니다**(완료 판단은 재시도 시점에 서버가).

📍 되짚기: `docs/08-mrtr-client-features.md` § elicitation / 카드 16

### 1-17
(a) `toolsListChanged`, `promptsListChanged`, `resourcesListChanged`, `resourceSubscriptions`(URI 배열) (b) `notifications/subscriptions/acknowledged` — 서버가 실제 존중할 필터 부분집합을 알림 (c) `_meta`의 `io.modelcontextprotocol/subscriptionId` = listen 요청의 JSON-RPC id (d) 재구독(서버는 구독 상태를 재연결 간 유지하지 않음) (e) `server/discover`, `tools/list`, `prompts/list`, `resources/list`, `resources/templates/list`, `resources/read` (f) 같은 인가 컨텍스트에서만 재사용 — 다른 액세스 토큰과 캐시 공유 금지.

📍 되짚기: `docs/09-subscriptions-utilities.md` / 카드 17

### 1-18
401 + `WWW-Authenticate` → PRM 조회(**RFC 9728**) → AS 메타데이터 디스커버리(**RFC 8414** / OIDC Discovery, path-insertion 우선) → 클라이언트 등록(사전등록 > CIMD > DCR) → 인가 요청: PKCE S256(**`code_challenge_methods_supported` 없으면 진행 거부**) + `resource` 파라미터(**RFC 8707**) → 콜백에서 iss 검증(**RFC 9207**, 정규화 없는 문자열 비교) → 토큰 교환 → `Authorization: Bearer`. 3금칙: ① URI 쿼리스트링 금지 ② audience가 자기가 아닌 토큰 수락 금지 ③ passthrough 금지(상류 호출은 별도 토큰).

📍 되짚기: `docs/10-authorization.md` / 카드 18

---

## 파트 2. 판단 문제

### 2-1
(A) **Streamable HTTP + OAuth 2.1 인가**. 20명이 각자 설치 없이 한 배포를 공유해야 하고(원격 서버의 존재 이유), 사용자별 권한·감사가 필요하며 사내 IdP를 AS로 연결할 수 있다. (B) **stdio + 환경 자격증명**. 로컬 파일시스템 접근은 사용자 권한으로 도는 로컬 프로세스가 자연스럽고, 명세도 stdio에는 OAuth 대신 환경 자격증명을 권한다(SHOULD NOT follow). — (B)를 HTTP로 만드는 게 나은 조건: git 저장소가 실제로는 개발자 로컬이 아니라 **공유 서버·클라우드 워크스페이스**에 있거나, 브라우저 기반 호스트처럼 **로컬 프로세스를 띄울 수 없는 클라이언트**를 지원해야 할 때.

📍 되짚기: `docs/05-transports.md`, `docs/10-authorization.md` § 핵심 원리, `docs/12-building-tooling.md` § 배포 경로

### 2-2
① 프로토콜 오류 `-32602` — 그 이름의 도구는 존재하지 않는다. 인자를 고칠 문제가 아니라 호출 구조의 문제 (클라이언트/모델이 tools/list를 다시 봐야 함). ② **실행 오류**(`isError: true`) — "date는 YYYY-MM-DD 형식이어야 합니다" 같은 텍스트를 주면 모델이 고쳐 재시도할 수 있다. ③ **실행 오류** — 업스트림 실패는 명세가 예시한 실행 오류 대표 사례("API failures"). 모델이 재시도·대안(다른 도시, 나중에)을 판단할 수 있다. — 반대로 설계하면: ②③을 JSON-RPC 에러로 내면 모델의 자가수정 루프가 끊겨 사용자에게 원시 에러가 노출되고, ①을 isError로 내면 모델이 존재하지 않는 도구 이름을 계속 "고쳐서" 재시도하는 낭비가 생긴다.

📍 되짚기: `docs/06-tools.md` § 오류의 2계층

### 2-3
400 수신 → **본문 파싱이 먼저다**: (i) 본문이 인식 가능한 modern JSON-RPC 에러(-32020 HeaderMismatch / -32021 / -32022)면 **modern 서버** — -32022면 `data.supported`에서 버전을 골라 재시도, -32020/21이면 요청을 교정해 재시도. 폴백 금지. (ii) 본문이 비었거나 못 알아보는 형태면 legacy — `initialize`로 폴백(더 옛 서버면 HTTP+SSE까지). 판정은 오리진 단위로 캐시. — "400이면 무조건 폴백"의 문제: modern 서버가 버전 불일치나 헤더 문제로 400을 냈을 뿐인데 legacy로 강등된다. initialize를 받은 modern 전용 서버는 그것도 거부하므로 연결이 아예 실패하거나, dual-era 서버라면 불필요하게 레거시 의미론으로 떨어져 modern 기능(MRTR, 구독 등)을 잃는다.

📍 되짚기: `docs/04-lifecycle-versioning.md` § 두 세대의 공존

### 2-4
평가: 규격 위반이다. 무상태 원칙상 서버는 연결·이전 요청에서 아무것도 추론하면 안 되고, 연결은 세션이 아니다 — 클라이언트가 프로세스를 재시작하거나 LB가 다른 인스턴스로 보내면 카트가 증발한다. 올바른 설계: `create_cart` 도구가 **명시적 핸들**(`cart_id`)을 반환하고, `add_item(cart_id, …)`처럼 후속 호출이 인자로 받는다. 핸들 4원칙: ① 소지 ≠ 인증 — 매 호출 호출자 권한을 핸들에 대해 검증(비인증 서버라면 UUIDv4급 엔트로피 + 수명 제한) ② 불투명(내부 구조 인코딩 금지) ③ 수명 정책을 생성 도구의 description에 명시(모델이 보게) ④ 만료·미지 핸들에는 그 사실을 말해주는 응답. — 만료 응답 형태: **실행 오류**(`isError: true` + "카트가 만료되었습니다. create_cart로 새로 만드세요") — 모델이 읽고 새 카트를 만들어 회복한다.

📍 되짚기: `docs/06-tools.md` § 상태가 필요한 도구, `docs/11-security.md` § State Handle Hijacking

### 2-5
문제: form 모드로 액세스 토큰을 받는 것은 명시적 금지(MUST NOT)다 — 토큰이 클라이언트 UI와 LLM 컨텍스트, 로그를 통과하며 유출 표면이 된다. 올바른 설계(URL 모드 + 서버측 OAuth): ① 서버가 자기 도메인의 connect URL로 URL 모드 elicitation 반환(+requestState) ② 클라이언트는 URL 표시·동의 후 브라우저로 열고, accept와 requestState를 담아 재시도 ③ connect 페이지가 **연 사용자 = 시작한 사용자** 검증 후 GitHub 인가 엔드포인트로 리다이렉트 ④ 사용자가 GitHub와 직접 OAuth 완료, 콜백은 서버로 ⑤ 서버가 GitHub 토큰을 **사용자 정체성에 바인딩해 저장** ⑥ 이후 요청에서 저장된 토큰으로 GitHub 호출. — 클라이언트가 준 MCP 토큰을 GitHub에 쓰면 안 되는 이유: 그 토큰의 audience는 우리 서버다. 이를 하류로 넘기는 것이 **token passthrough**(금지) — audience 경계가 깨지고 GitHub 쪽 감사·통제가 무의미해지며, confused deputy 구조가 된다.

📍 되짚기: `docs/08-mrtr-client-features.md` § URL 모드·서드파티 OAuth, `docs/10-authorization.md` § 토큰 규칙

### 2-6
(a) 수신 시각 기록, `now < t_received + 300000`이면 fresh — 재조회 없이 사용. stale이면 다음 필요 시점에 재조회. (b) TTL이 남았어도 **즉시 무효화**(알림 = 무효화 신호, TTL = 알림 사이의 낭비 방지 — 상보적). (c) TTL은 신선도 힌트지 보장이 아니고, 명세가 폴링 트리거로 쓰지 말라고 명시한다(SHOULD NOT) — 필요할 때 신선도만 확인하는 lazy 모델이 맞다. 폴링하려면 지터·백오프 필수. (d) 된다 — `public`은 "사용자 특정 데이터가 없다"는 서버의 선언이라 인가 컨텍스트 밖 재사용이 허용된다. 단 그 판단 책임은 서버에 있고, 사용자별로 다른 목록을 준다면 서버가 `private`으로 냈어야 한다.

📍 되짚기: `docs/09-subscriptions-utilities.md` § 캐싱

### 2-7
① **클라이언트별 동의**: 동적 등록된 각 client_id에 대해 서드파티로 넘어가기 **전** 자체 동의 화면이 있는가. 없으면: 피해자의 서드파티 동의 쿠키를 악용해 공격자의 redirect_uri로 인가 코드가 흘러간다(confused deputy). ② **token passthrough 여부**: 클라이언트가 준 토큰의 audience를 검증하고, 서드파티 호출에는 별도 토큰을 쓰는가. 아니면: 다른 서비스용 도난 토큰으로 우리 서버가 뚫리고, 우리 서버가 유출 프록시가 된다. ③ **redirect_uri·state 처리**: redirect_uri 정확 일치 검증 + state를 동의 승인 후에만 발급하고 콜백에서 단일 사용·만료 검증하는가. 아니면: 동의 화면이 있어도 CSRF·코드 가로채기로 우회된다.

📍 되짚기: `docs/11-security.md` § Confused Deputy·Token Passthrough

### 2-8
(a) 토큰 낭비(정의만으로 컨텍스트 잠식), 지연 증가, **선택 정확도 하락**(모델이 무관한 수백 개를 훑음). (b) Catalog(`search_tools` 메타도구 — 이름+한 줄) → Inspect(`get_tool_details` — 그 도구의 전체 스키마만) → Execute(호출). (c) 도구 정의가 컨텍스트 윈도우의 일정 비율(예: 1~5%)을 넘으면 전환 — 소수 도구면 전부 로드가 오히려 낫다. (d) `tools` 배열 변경은 프롬프트 프리픽스 캐시를 깨서 절약분보다 캐시 미스 비용이 클 수 있다 — 완화: 새 정의를 캐시 경계 뒤에 append하거나, 배열이 안 변하는 단일 `call_tool(name, args)` 메타도구로 라우팅, 서버 연결 해제는 대화 경계에서만. (e) 도구 수가 적고 정의가 짧을 때, 또는 매 턴 거의 모든 도구가 실제로 쓰이는 특화 에이전트일 때 — 검색 왕복 비용이 절약을 초과한다.

📍 되짚기: `docs/12-building-tooling.md` § 확장 2패턴

---

## 파트 3. 재현 과제

코딩 과제의 판정자는 `tests/`다 — 여기에는 정답 코드를 다시 적지 않는다. 각 과제를 통과한 **뒤에** `solutions/`의 같은 파일명을 열어 접근을 비교하라(먼저 열면 과제가 독해로 바뀐다). 참고 구현이 "왜 그 형태인지"는 각 solutions 파일 상단 주석에 있다.

### 3-1
- 판정: `pnpm test 03-01` · 참고 구현: `solutions/03-01-message-rules/index.ts`
- 비교 포인트: id의 "존재"와 "유효성"을 분리했는가, 부재/미지 분기가 명시적인가, 대역 경계가 상수 비교로 읽히는가

📍 되짚기: `docs/03-messages-meta.md` / 카드 4·5·6

### 3-2
- 판정: `pnpm test 04-01` · 참고 구현: `solutions/04-01-version-gate/index.ts`
- 비교 포인트: 검사 순서가 주석으로 정당화돼 있는가, judgeStdioProbe가 코드 하나가 아니라 **대역 집합**으로 판정하는가

📍 되짚기: `docs/04-lifecycle-versioning.md` / 카드 7·8

### 3-3
- 판정: `pnpm test 06-01` · 참고 구현: `solutions/06-01-tool-server/index.ts`
- 비교 포인트: 네 실패 경로의 목적지, 정렬을 등록 시점에 한 번 하는지 요청마다 하는지, 와이어에 handler가 새지 않는 직렬화

📍 되짚기: `docs/06-tools.md` / 카드 14

### 3-4
- 판정: `pnpm test 08-01` · 참고 구현: `solutions/08-01-mrtr-state/index.ts`
- 비교 포인트: 검증 5단계의 순서(무결성 → 주체 → 요청 → 만료), 만료 경계 부등호, "다섯 단계를 다 통과해도 단일 사용은 보장되지 않는다"는 주석

📍 되짚기: `docs/08-mrtr-client-features.md` / 카드 15
