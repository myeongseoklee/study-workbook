# 암기 카드 — 검색 없이 즉답할 18장

> 이 파일은 반복 복습용. 본문 각 장의 `⚠️ 암기 필수` 항목을 **판단 단위로 묶어** 18장으로 선별했다 (장별 마커 수보다 적다 — 겹치는 것은 카드 하나로 합쳤다). 워크북 파트 1의 문항이 이 카드들과 1:1 대응한다. 모든 규칙의 기준: 프로토콜 리비전 **2026-07-28**.

## A. 구조와 원리

**카드 1 — 참여자 구조** `[02]`
호스트(AI 앱: 보안·동의·LLM 조율·컨텍스트 합성) → 클라이언트(프로토콜 커넥터) —**1:1**— 서버(기능 제공). 서버는 전체 대화를 못 보고, 서버 간 상호작용은 호스트만 중개한다.

**카드 2 — 프리미티브 제어 주체** `[02]`
Tools = **모델** 제어 / Resources = **애플리케이션** 제어 / Prompts = **사용자** 제어(사용 시점). 클라이언트 제공 기능 = Elicitation (Sampling·Roots는 deprecated).

**카드 3 — 무상태 3원칙** `[02][03]`
① 요청은 자기완결 — `_meta`에 `protocolVersion`(필수)·`clientCapabilities`(필수)·`clientInfo`(권장) ② 연결(stdio 프로세스 포함) ≠ 세션 ③ 크로스 요청 상태 = 명시적 핸들. 필수 `_meta` 누락 = `-32602` + (HTTP) 400.

## B. 메시지와 버전

**카드 4 — 에러 코드 5 + 1** `[03]`
`-32602` invalid params(인자·리소스 없음·`_meta` 누락 겸용) / `-32601` method not found(HTTP 404) / `-32020` HeaderMismatch / `-32021` MissingRequiredClientCapability / `-32022` UnsupportedProtocolVersion(→ `data.supported`) — 스펙 3형제는 HTTP 400. 레거시 `-32002`(리소스 없음)는 수신만 수용.

**카드 5 — 에러 대역 파티션** `[03]`
`-32000`~`-32019` = 레거시·구현 정의(신규 할당 금지) / `-32020`~`-32099` = MCP 명세 전용. 자체 에러는 JSON-RPC 예약 대역(`-32768`~`-32000`) 밖에.

**카드 6 — resultType 규칙** `[03]`
모든 result에 필수. `"complete"` / `"input_required"`. **부재 = complete로 간주**(구버전 호환) / **미지의 값 = invalid**.

**카드 7 — 버전 협상** `[04]`
핸드셰이크 없음. 요청마다 버전 선언 → 미지원이면 `-32022` + `data.supported` → 교집합으로 재시도. `server/discover`는 **서버 구현 MUST, 클라이언트 호출 선택**(정보 일괄 조회 + stdio 레거시 프로브용).

**카드 8 — 세대(era) 감지** `[04]`
stdio: `server/discover` 프로브 — DiscoverResult나 인식 가능한 modern 에러(예: -32022) = modern(**폴백 금지**), 그 외 에러·무응답 = legacy(`initialize` 폴백). HTTP: 400의 **본문**에 modern 에러가 있으면 modern. 판정은 서버 단위로 캐시.

**카드 9 — Deprecated 4종 + 마이그레이션** `[04]`
Roots → 도구 인자·리소스 URI·설정 / Sampling → LLM API 직접 호출 / Logging → stderr(stdio)·OpenTelemetry / DCR → CIMD. 유예 최소 12개월. (HTTP+SSE 전송, includeContext도 deprecated.)

## C. 전송

**카드 10 — stdio 규율** `[05]`
stdout = MCP 메시지 전용(개행 구분, 임베디드 개행 금지) / 로그 = stderr. `print()`·`console.log()` 한 줄이 서버를 깨뜨린다. 종료 = stdin 닫기 → 대기 → SIGTERM→SIGKILL. 서버는 stdin EOF에 즉시 종료.

**카드 11 — Streamable HTTP 응답 규칙** `[05]`
단일 MCP 엔드포인트에 요청마다 별도 POST. 요청 → `application/json` **또는** SSE(클라이언트 둘 다 지원 MUST) / 알림 → **202 Accepted**. 필수 헤더 `MCP-Protocol-Version`·`Mcp-Method`·(call/read/get엔) `Mcp-Name` — 본문 불일치 = 400 + `-32020`. SSE 재개 없음 → 끊기면 **새 id로 재발행**.

**카드 12 — 전송별 취소** `[05][09]`
HTTP = **응답 스트림 닫기가 곧 취소** / stdio = `notifications/cancelled`. 서버발 cancelled의 유일한 용도 = `subscriptions/listen` 해체. 경합은 정상 — 무효 취소는 무시, 취소 후 응답도 무시.

**카드 13 — HTTP 보안 기본** `[05]`
`Origin` 검증 필수, 무효면 **403** (DNS 리바인딩 방어). 로컬 서버는 `127.0.0.1` 바인딩(0.0.0.0 금지).

## D. 프리미티브와 패턴

**카드 14 — 도구 오류 2계층** `[06]`
프로토콜 오류(JSON-RPC error: 모르는 도구·깨진 구조) vs 실행 오류(`isError: true` + content: API 실패·값 검증·비즈니스). 기준 = **모델이 인자를 고쳐 재시도해 성공할 수 있는가**. 실행 오류는 모델에 전달 SHOULD.

**카드 15 — MRTR 계약** `[08]`
`input_required`는 **tools/call · resources/read · prompts/get** 3개에서만. inputRequests 값 = elicitation/sampling/roots 3종만, `inputRequests`·`requestState` 중 최소 1개. 재시도 = **새 JSON-RPC id** + requestState 원본 에코(들여다보기 금지). requestState는 공격자 통제 입력 — 로직에 영향 주면 HMAC/AEAD + 주체·TTL·요청 바인딩, 단일 사용은 서버가 별도 강제.

**카드 16 — elicitation 보안 경계** `[08]`
form 모드로 비밀(비밀번호·API 키·토큰·결제) 요청 **금지** → URL 모드로. URL 모드: 자동 프리페치 금지·전체 URL 표시 후 동의·`accept` ≠ 완료. 서버는 "URL 연 사용자 = 시작한 사용자" 검증(피싱 방어).

**카드 17 — 구독·캐시 계약** `[09]`
listen 필터 4종(toolsListChanged / promptsListChanged / resourcesListChanged / resourceSubscriptions), 첫 메시지 = acknowledged(존중 부분집합), 알림마다 `subscriptionId` = listen 요청의 id, 재연결 시 **재구독**. 캐시 힌트(`ttlMs`+`cacheScope`) 의무 6종 = server/discover · tools/list · prompts/list · resources/list · resources/templates/list · resources/read. `private` = 인가 컨텍스트 간 공유 금지. list_changed 수신 = TTL 무시하고 즉시 무효화.

## E. 인가와 보안

**카드 18 — 인가 체인과 토큰 3금칙** `[10][11]`
체인: **401+WWW-Authenticate → PRM(RFC 9728) → AS 메타데이터(RFC 8414/OIDC) → 등록(사전등록 > CIMD > DCR) → PKCE S256(`code_challenge_methods_supported` 없으면 중단) + resource(RFC 8707) → iss 검증(RFC 9207, 정규화 없는 문자열 비교) → Bearer 헤더**. 토큰 3금칙: 쿼리스트링 금지 / audience 불일치 수락 금지 / **passthrough 금지**(상류 호출은 별도 토큰). stdio는 이 체인 대신 환경 자격증명.

---

## 진단 신호 빠른 표

| 증상 | 가장 가능성 높은 원인 | 카드 |
|---|---|---|
| stdio 서버가 붙자마자 죽음 / 파싱 에러 | stdout 오염(print·console.log) | 10 |
| `-32602`인데 인자는 맞음 | 필수 `_meta` 누락 또는 없는 리소스/도구 | 3·4 |
| HTTP 400 + `-32020` | 헤더↔본문 불일치, `Mcp-Param-*` 누락 | 11 |
| HTTP 400 + `-32022` | 버전 미스매치 — `data.supported`로 재시도 | 7 |
| 400인데 본문에 modern 에러 없음 | 레거시 서버 — initialize 폴백 | 8 |
| 알림이 안 옴 | 필터 미신청 / ack 부분집합 미확인 / 재연결 후 미재구독 | 17 |
| 도구 실패를 모델이 계속 반복 | 실행 오류를 JSON-RPC 에러로 내고 있음 | 14 |
| 401 무한 루프 | audience 불일치 토큰 / iss·PKCE 검증 실패 | 18 |
