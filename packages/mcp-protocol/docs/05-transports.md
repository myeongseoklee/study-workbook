# 전송(Transports) — stdio, Streamable HTTP, 헤더 미러링

## 학습 목표

두 표준 전송의 프레이밍·취소·종료 규칙을 정확히 알고, Streamable HTTP의 헤더 미러링(`MCP-Protocol-Version`/`Mcp-Method`/`Mcp-Name`/`Mcp-Param-*`)이 왜 존재하고 어떻게 검증되는지 설명할 수 있다.

## 선수 지식

- [01-prerequisites.md](01-prerequisites.md)의 SSE
- [03-messages-meta.md](03-messages-meta.md)의 `_meta`, `-32020`

## 핵심 원리 (WHY)

**전송은 바인딩(binding)이다.** 메시지의 의미(패턴·프리미티브)는 모든 전송에서 동일하고, 전송이 정하는 것은 (1) 프레이밍·전달 방법, (2) 요청 메타데이터 운반 방법, (3) 취소·종료 신호 방법뿐이다. 그래서 새 메시지 패턴이 생겨도 전송은 바뀔 필요가 없다.

전송이 나를 수 있는 방향은 넷뿐이다: 클라이언트발 요청·알림, 서버발 응답·알림. **서버발 요청, 클라이언트발 응답이라는 방향 자체가 존재하지 않는다** — MRTR의 전송층 표현이다.

메타데이터의 원천은 항상 **본문**(`_meta`)이다. HTTP가 일부를 헤더로 "미러링"하는 것은 중간 장비(로드밸런서·게이트웨이·관측 도구)가 본문 파싱 없이 라우팅·검사할 수 있게 하려는 것이고, 미러가 있으면 불일치 거부 규칙이 따라와야 한다(아래 `-32020`).

## 필수 지식 (HOW)

### stdio 전송

클라이언트가 서버를 **서브프로세스로 실행**한다. 서버는 stdin에서 읽고 stdout에 쓴다.

- 메시지는 **개행 구분**, 메시지 안에 개행 포함 금지(MUST NOT)
- **서버는 stdout에 유효한 MCP 메시지 외에 아무것도 쓰면 안 된다**(MUST NOT). `print()`/`console.log()` 한 줄이 JSON-RPC 스트림을 오염시켜 서버를 깨뜨린다 — 로그는 **stderr**로 (클라이언트는 stderr를 캡처·전달·무시 자유, stderr = 에러라고 가정하지 말 것)
- 클라이언트도 stdin에 유효한 MCP 메시지 외 쓰기 금지, JSON-RPC **응답** 쓰기 금지
- 채널이 하나뿐이므로 서버 메시지 3종이 섞여 온다: ① 응답(`id` 상관), ② 요청 스코프 알림(progress/message), ③ 구독 알림(`_meta`의 `subscriptionId`로 상관 — 클라이언트 MUST)
- **취소**: 요청별 스트림이 없으므로 `notifications/cancelled`(requestId 명시)를 보낸다
- **종료**: 클라이언트가 stdin을 닫고 → 대기 → 안 죽으면 SIGTERM→SIGKILL(POSIX). 서버는 stdin EOF에서 즉시 종료해야 한다(SHOULD) — 유일하게 이식성 있는 우아한 종료 신호
- **예기치 못한 종료**: 무상태라 그냥 재시작하고 미결 요청 재시도, `subscriptions/listen`은 재구독
- 이 프레이밍(개행 구분 JSON-RPC over 신뢰성 있는 양방향 바이트 스트림)은 표준 스트림에 묶여있지 않다 — Unix 소켓·TCP 위의 **커스텀 전송은 이 프레이밍을 재사용하라**(SHOULD)

### Streamable HTTP 전송

서버가 독립 프로세스로 떠서 **단일 MCP 엔드포인트**(예: `https://example.com/mcp`)에 POST를 받는다.

**요청 규칙**: 모든 JSON-RPC 요청·알림이 **각각 별도의 POST**다. `Accept: application/json, text/event-stream` 필수. 본문은 단일 요청 또는 알림 (응답 전송 금지).

**응답 규칙**:
- 본문이 **알림**이면 → `202 Accepted`(본문 없음), 수락 불가면 HTTP 에러 (참고: 이 리비전 코어에는 HTTP로 보낼 클라이언트발 알림이 사실상 없다 — `notifications/cancelled`는 stdio 전용)
- 본문이 **요청**이면 → `Content-Type: application/json`(단일 객체) 또는 `text/event-stream`(그 요청에 스코프된 SSE 스트림). **클라이언트는 둘 다 지원 필수**
- SSE 스트림에는 그 요청 관련 알림들(progress, message) → 최종 응답 순. **독립적 JSON-RPC 요청 전송 금지** — 서버→클라이언트 상호작용은 `InputRequiredResult`로. 최종 응답이 스트림을 종료(SHOULD)
- 프록시 버퍼링 방지로 `X-Accel-Buffering: no` 권장, 장수 스트림엔 SSE 주석(`:`) keep-alive 권장
- **`Last-Event-ID` 재개 없음**: 스트림이 끊기면 그 요청은 유실 — **새 요청 id로 재발행**해야 한다

**취소**: **응답 스트림을 닫는 것 자체가 취소**다(서버 MUST 해석). 요청마다 스트림이 따로 있어 모호하지 않다. `notifications/cancelled` 불필요.

**보안 필수 규칙**:
- **`Origin` 헤더 검증**(MUST) — 있는데 유효하지 않으면 **403**. 브라우저에서 악성 사이트가 DNS 리바인딩으로 로컬 MCP 서버를 조작하는 것을 막는다
- 로컬 실행 시 `0.0.0.0`이 아니라 **127.0.0.1에만 바인딩**(SHOULD)
- 인증 구현(SHOULD) — [10-authorization.md](10-authorization.md)

### 헤더 미러링과 검증

**표준 헤더** (규격 준수에 REQUIRED):

| 헤더 | 원본 필드 | 대상 |
|---|---|---|
| `MCP-Protocol-Version` | `_meta.io.modelcontextprotocol/protocolVersion` | 모든 POST |
| `Mcp-Method` | `method` | 모든 요청 |
| `Mcp-Name` | `params.name` 또는 `params.uri` | `tools/call`, `resources/read`, `prompts/get` |

본문을 처리하는 서버는 **헤더↔본문 일치를 검증해야 한다**(MUST). 불일치·필수 헤더 누락·불량 문자 → **400 + `-32020` HeaderMismatch**. 이유: 로드밸런서는 헤더로 라우팅하고 서버는 본문으로 실행하는데, 둘이 다르면 "게이트웨이는 A 정책을 적용했는데 실제 실행은 B"라는 보안 구멍이 된다. 버전 미지원은 400+`-32022`, 모르는 메서드는 **404+`-32601`**(레거시 HTTP+SSE 서버의 404와 본문으로 구별된다).

**커스텀 헤더 — `x-mcp-header`**: 도구 inputSchema의 프로퍼티에 `"x-mcp-header": "Region"`을 달면, 클라이언트가 호출 인자 값을 `Mcp-Param-Region` 헤더로 미러링한다(클라이언트 MUST 지원, 서버는 선택). 중간 장비가 예컨대 리전별 라우팅을 본문 파싱 없이 할 수 있다. 제약: 빈 값 금지, RFC 9110 토큰 문법, CR/LF 금지, 스키마 내 대소문자 무시 유일, **원시 타입만**(integer/string/boolean — `number` 불가, 정수는 ±2^53-1), **`properties` 체인으로만 정적 도달 가능한 위치만**(`items`·`oneOf`·`$ref` 경유 금지). 위반한 도구 정의는 클라이언트가 **tools/list 결과에서 그 도구만 제외**(MUST)하고 경고 로깅(SHOULD) — 불량 도구 하나가 서버 전체를 못 쓰게 만들지 않도록. stdio 클라이언트는 통째로 무시 가능. 민감 값(비밀번호·토큰·PII)은 헤더로 미러링하지 말 것(SHOULD NOT) — 중간 장비에 노출된다.

**값 인코딩**: 헤더에 안전하게 못 싣는 값(비ASCII, 앞뒤 공백, 개행, 그리고 센티널 패턴 자체와 겹치는 값)은 `=?base64?<UTF-8의 base64>?=` 센티널로 감싼다. 서버는 비교 전에 디코딩(MUST). boolean은 소문자 `true`/`false`, integer는 10진 문자열. 헤더 **이름**은 대소문자 무시, **값**은 대소문자 구분.

값이 `null`이거나 인자에 없으면 헤더 생략(클라이언트 MUST) — 서버도 기대하면 안 된다. 값이 본문에 있는데 헤더가 없으면 서버는 거부(MUST). `-32020`을 받은 클라이언트는 `tools/list`로 스키마 변경을 확인 후 재시도(SHOULD).

### 레거시 HTTP 트래픽 응대 (modern 전용 서버)

- GET/DELETE → `405 Method Not Allowed` (구버전의 GET 스트림·세션 종료 시도)
- `Mcp-Session-Id` 헤더 → 무시, 세션 ID 발급·에코 금지
- `Last-Event-ID` → 무시
- `MCP-Protocol-Version` 헤더가 없는 요청: 2025-06-18 이전 클라이언트 지원 서버라면 `2025-03-26`으로 간주 가능(MAY), 아니면 거부

## 우리 작업과의 연결

로컬 개발 도구(파일시스템·git 서버)는 stdio, 팀·SaaS 통합은 Streamable HTTP가 기본 선택이다. stdio 서버를 짤 때 "stdout은 프로토콜 전용"만 지켜도 디버깅 시간의 절반을 아낀다. 게이트웨이 뒤에 MCP를 배포한다면 `Mcp-Method`/`Mcp-Name` 기반 라우팅·레이트리밋이 설계 도구가 된다.

### ⚠️ 암기 필수

- [ ] **전송별 취소**: Streamable HTTP = 응답 스트림 닫기(그 자체가 신호, cancelled 알림 불필요) / stdio = `notifications/cancelled` 전송. 서버발 cancelled는 `subscriptions/listen` 해체 전용
  - 이유: 반대로 구현하면 HTTP에서는 취소가 전달 안 되고, stdio에서는 취소 수단이 없다
- [ ] **stdio 규율**: stdout = MCP 메시지 전용(개행 구분·임베디드 개행 금지), 로그 = stderr. 종료 = stdin 닫기 → 대기 → SIGTERM→SIGKILL
  - 이유: stdio 서버 장애 1순위 원인이 stdout 오염. 진단 신호로 즉답해야 한다
- [ ] **HTTP 응답 규칙**: 요청 POST → JSON 또는 SSE(클라이언트 둘 다 지원 MUST) / 알림 POST → 202. 필수 헤더 3종(`MCP-Protocol-Version`·`Mcp-Method`·`Mcp-Name`) 불일치 = 400+`-32020`. 스트림 재개 없음 → 끊기면 새 id로 재발행
  - 이유: HTTP 통합·게이트웨이 설계와 400 계열 장애 진단의 판단 기준
- [ ] **Origin 검증 = DNS 리바인딩 방어**: 유효하지 않은 Origin → 403. 로컬 서버는 127.0.0.1 바인딩
  - 이유: 로컬 MCP 서버를 웹페이지가 조작하는 실제 공격의 1차 방어선

## 자가 진단

<details>
<summary>Q1: SSE로 진행 알림을 받던 중 연결이 끊겼다. 클라이언트가 할 일과 하지 말아야 할 일은?</summary>

**즉답 예시**: 이 리비전에는 `Last-Event-ID` 재개가 없다. 끊긴 요청은 유실된 것이므로 **새 요청 id**로 재발행한다. 같은 id 재사용은 금지(미해결 요청 id 중복 규칙). 서버 입장에서는 스트림 단절이 취소 신호이므로 원 요청 작업을 중단했을 것이다.

</details>

<details>
<summary>Q2: 헤더와 본문의 이중 기재는 낭비 같다. 왜 필요하고, 불일치 시 왜 400으로 죽여야 하나?</summary>

**즉답 예시**: 중간 장비(LB·게이트웨이·WAF)가 본문 파싱 없이 라우팅·정책을 적용하게 하려는 것이다. 본문이 진실 원천이지만, 게이트웨이가 헤더 기준으로 정책을 적용한 요청을 서버가 본문 기준으로 실행하면 "정책은 A에, 실행은 B에" 적용되는 우회가 생긴다. 그래서 본문을 처리하는 서버가 최종 파수꾼으로 일치를 검증하고 불일치를 -32020으로 거부한다.

</details>

<details>
<summary>Q3: x-mcp-header가 잘못된 도구가 하나 있는 서버. 클라이언트는 서버 연결을 끊어야 하나?</summary>

**즉답 예시**: 아니다. 그 도구만 tools/list 결과에서 제외하고(MUST) 이유를 경고로 로깅한다(SHOULD). 불량 정의 하나가 나머지 유효한 도구까지 막지 않게 하는 격리 규칙이다. stdio 전송이라면 x-mcp-header를 통째로 무시해도 된다(MAY).

</details>

<details>
<summary>Q4: 왜 커스텀 전송에 stdio 프레이밍 재사용을 권할까?</summary>

**즉답 예시**: stdio 바인딩의 본질은 "신뢰성 있는 양방향 바이트 스트림 위의 개행 구분 JSON-RPC"라서 표준 스트림 고유의 것은 프로세스 수명주기(실행·stderr·EOF 종료)뿐이다. Unix 소켓·TCP도 같은 성질의 채널이므로 프레이밍을 새로 발명하면 상호운용만 깨진다. 채널 고유 부분(연결 수립·종료)만 정의하면 된다.

</details>

## 공식 문서

- [Transports Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) — 바인딩 개념, 커스텀 전송
- [stdio](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio) — 프레이밍, 종료, 프로브
- [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) — 엔드포인트, 헤더 미러링, 값 인코딩, 레거시 응대
