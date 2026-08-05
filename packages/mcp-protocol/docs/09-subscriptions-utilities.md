# 구독과 유틸리티 — 알림, 진행률, 취소, 캐싱, 페이지네이션, 자동완성

## 학습 목표

`subscriptions/listen`의 개통·확인·상관관계·종료 규칙을 구현 수준으로 알고, 진행률·취소의 경합 조건 처리, `ttlMs`/`cacheScope` 캐싱 모델, 커서 페이지네이션, completion API를 쓸 수 있다.

## 선수 지식

- [03-messages-meta.md](03-messages-meta.md)의 `_meta`, 알림 규칙
- [05-transports.md](05-transports.md)의 전송별 취소

## 핵심 원리 (WHY)

### 알림은 왜 opt-in 스트림이 되었나

레거시엔 서버가 아무 때나 알림을 밀어넣을 통로(HTTP GET 스트림, 세션)가 있었다. 무상태 세계에선 "서버가 클라이언트를 찾아가는" 채널이 없다. 해법: **클라이언트가 장수 요청(`subscriptions/listen`)을 열어두고, 서버는 그 응답 스트림으로만 변경 알림을 흘린다.** 상태는 그 요청에 스코프되므로 채널이 끊기면 클라이언트가 다시 요청하면 된다 — 프로토콜은 여전히 요청/응답뿐이다.

### 캐시 힌트는 왜 의무가 되었나

리스트가 연결 불변이 되면서([06](06-tools.md)) 캐시가 안전해졌다. 그러나 "얼마나 오래"를 클라이언트가 추측하면 폴링 낭비 또는 낡은 데이터가 된다. 그래서 서버가 신선도(`ttlMs`)와 공유 범위(`cacheScope`)를 응답에 실어주는 것을 **의무화**했다 — HTTP `Cache-Control`의 MCP판이다.

## 필수 지식 (HOW)

### 구독 — subscriptions/listen

**개통**: `notifications` 필터와 함께 요청. 서버는 **요청 안 한 타입 전송 금지**(MUST NOT).

| 필터 필드 | 타입 | 받는 알림 |
|---|---|---|
| `toolsListChanged` | boolean | `notifications/tools/list_changed` |
| `promptsListChanged` | boolean | `notifications/prompts/list_changed` |
| `resourcesListChanged` | boolean | `notifications/resources/list_changed` |
| `resourceSubscriptions` | string[] (URI들) | `notifications/resources/updated` |

**확인(ack)**: 서버의 첫 메시지는 `notifications/subscriptions/acknowledged`(MUST) — 그 전에 그 구독의 알림 금지. ack의 `notifications`는 **서버가 실제로 존중하기로 한 부분집합**(미지원 타입은 빠진다) → 클라이언트는 요청과 대조해 우아하게 처리(SHOULD). stdio에선 이 순서가 채널 단위가 아니라 **구독 id 단위**다(다른 구독 메시지는 끼어들 수 있다).

**상관관계**: 스트림의 모든 알림은 `_meta`의 `io.modelcontextprotocol/subscriptionId`를 携帯(MUST). 값 = **그 `subscriptions/listen` 요청의 JSON-RPC id**. 동시 구독 여러 개 가능 — 이 id로 역다중화한다.

**종료 3경로**: ① 클라이언트 취소 — HTTP는 스트림 닫기, stdio는 `notifications/cancelled`(listen 요청 id 지정). ② 서버 주도 해체(셧다운 등) — **원 요청에 대한 빈 result 응답**을 보내고 닫는 것이 우아한 종료 신호(SHOULD). 응답 없이 뚝 끊기면 예기치 못한 단절 → 클라이언트는 재연결 트리거로 삼을 수 있다. ③ 전송 자체 붕괴. **재연결 후에는 재구독 필수** — 서버는 재연결 간 구독 상태를 들고 있지 않다. 알림은 **best effort**다 — 놓칠 수 있으니 TTL 기반 재조회와 병행하라.

참고: 서버가 `notifications/cancelled`를 보내는 **유일한** 합법 용도가 "listen 요청 id를 지목한 구독 해체"다. 그 외 용도 금지(MUST NOT).

### 진행률 — notifications/progress

받고 싶은 쪽(클라이언트)이 요청 `_meta`에 `progressToken`(문자열/정수, **활성 요청 전체에서 유일**)을 넣는다. 서버는 선택적으로 `{ progressToken, progress, total?, message? }`를 보낸다. 규칙: `progress`는 **단조 증가**(total 몰라도), 부동소수점 허용, 완료 후 전송 중지(MUST), 활성 토큰만 참조(MUST), 양쪽 다 플러딩 방지 레이트리밋(SHOULD). 이 알림은 **요청 스코프** — 그 요청의 응답 스트림으로만 온다(listen 스트림 아님).

### 취소 — 경합을 전제로 설계돼 있다

기본: [05](05-transports.md)대로 HTTP=스트림 닫기, stdio=`notifications/cancelled` (+ `reason?`).

- 취소 알림은 자기가 보낸, 아직 진행 중이라 믿는 요청만 참조(MUST)
- 받은 서버: 처리 중단·자원 해제·**응답 보내지 않기**(SHOULD). 단, 이미 끝났거나 모르는 id면 **무시 가능**(MAY)
- 클라이언트: 취소 후 도착하는 응답은 무시(SHOULD)
- 지연 때문에 "취소가 완료보다 늦게 도착"하는 경합은 정상이다 — 양쪽 다 우아하게(MUST). 그래서 잘못된 취소 알림(모르는 id, 완료된 요청)은 에러가 아니라 **무시**다: 알림은 fire-and-forget이니까

**타임아웃**: 모든 요청에 타임아웃을 걸어라(SHOULD) — 초과 시 취소를 발행하고 대기 중지. 진행 알림이 오면 시계를 리셋해도 되지만(MAY), **최대 타임아웃은 항상 강제**(SHOULD) — 진행 알림만 계속 보내는 상대에게 영원히 잡혀있지 않도록.

### 캐싱 — ttlMs와 cacheScope

**의무 대상**(complete 결과에 MUST): `server/discover`, `tools/list`, `prompts/list`, `resources/list`, `resources/templates/list`, `resources/read`. **`input_required` 결과와 MRTR 재시도(inputResponses/requestState 실린 요청)의 결과는 캐시 불가/금지** — 캐시 키에 없는 입력에 의존하므로.

- **캐시 키** = 메서드 + 결과에 영향 주는 파라미터(uri, cursor 등). 다른 요청의 캐시를 유용 금지(MUST NOT)
- **`ttlMs`**: 신선도 힌트(ms). `now < t_received + ttlMs`면 fresh. `0` = 즉시 stale, 음수 = 0 취급, 부재 = 0 가정(구서버). 서버는 `>= 0` 제공 MUST. **보장이 아니라 힌트** — TTL 안에도 데이터는 바뀔 수 있다. **폴링 간격으로 쓰지 말 것**(SHOULD NOT) — 필요할 때 신선도만 확인. 재조회 실패 시 stale 서빙 가능(MAY)
- **`cacheScope`**: `"public"` = 사용자 무관 데이터, 공유 캐시·게이트웨이가 아무에게나 재서빙 가능 / `"private"` = **같은 인가 컨텍스트에서만 재사용**, 다른 액세스 토큰과 공유 금지(MUST NOT). 인증된 엔드포인트의 public 응답도 컨텍스트 밖으로 공유될 수 있음을 서버가 알고 지정해야 하고, cacheScope만으로 접근 통제를 대신하면 안 된다(MUST NOT)
- **알림과의 관계**: 상보적. `list_changed` 수신 = TTL 남았어도 **즉시 무효화**. TTL은 알림 사이의 불필요한 재조회를 막는다
- **페이지네이션과의 관계**: 페이지마다 독립 캐시(각자 ttl, 시계는 그 페이지 수신 시점부터). 같은 리스트의 모든 페이지는 **같은 cacheScope**(MUST). 페이지 간 일관성 보장 없음 — 스냅샷이 필요하면 처음부터 다시. 커서 무효 에러가 오면 모든 페이지 폐기 후 처음부터(SHOULD)

### 페이지네이션 — 불투명 커서

번호식 페이지가 아니라 **불투명 커서**다. 응답에 `nextCursor`가 있으면 다음 요청 `params.cursor`에 넣어 계속. 대상: `tools/list`, `prompts/list`, `resources/list`, `resources/templates/list`.

- 페이지 크기는 서버가 정한다 — 고정 크기 가정 금지(MUST NOT)
- 커서는 파싱·수정·해석 금지(MUST). **빈 문자열도 유효한 커서** — null 여부 외엔 아무 판단 금지 (빈 문자열을 "끝"으로 취급하는 것이 대표 버그)
- `nextCursor` 부재 = 끝(SHOULD). 무효 커서 → `-32602`(SHOULD)

### 자동완성 — completion/complete

프롬프트·리소스 템플릿 인자의 IDE식 자동완성. 능력 `"completions": {}` 선언 필수.

요청: `ref`(`ref/prompt`+name 또는 `ref/resource`+uri/템플릿) + `argument`(name·현재 입력값) + `context.arguments`(이미 확정된 다른 인자들 — "language=python 정했으니 framework는 fla→flask"처럼 문맥 의존 완성). 응답: `completion.values`(관련도순, **최대 100개**) + `total?` + `hasMore?`. 클라이언트는 디바운스(SHOULD), 서버는 레이트리밋·퍼지매칭(SHOULD). 정보 노출 통제 — 완성이 권한 밖 값을 누설하지 않게(MUST).

### 로깅 — deprecated지만 규칙은 알아두기

`logging` 능력 + `notifications/message`(RFC 5424의 8레벨: debug < info < notice < warning < error < critical < alert < emergency). `2026-07-28`에서 **per-request opt-in**으로 바뀌었다: 요청 `_meta`에 `io.modelcontextprotocol/logLevel`이 있어야만, 그 요청의 응답 스트림으로만 `notifications/message` 전송 가능(없는 요청엔 MUST NOT — listen 스트림으로도 안 됨). 잘못된 레벨 값 → `-32602`. 로그에 자격증명·PII·내부 구조 금지(MUST). 전체 기능이 deprecated — stdio는 stderr, 관측은 OpenTelemetry로.

## 우리 작업과의 연결

MCP 클라이언트(호스트)를 만들 때 이 파일이 캐시 계층의 명세서다: tools/list를 ttlMs만큼 캐시하고, list_changed로 무효화하고, 커서 페이지를 독립 관리한다. "알림이 안 와요"는 대부분 (1) 필터에 그 타입을 안 넣었거나 (2) ack의 부분집합을 확인 안 했거나 (3) 재연결 후 재구독을 빠뜨린 경우다.

### ⚠️ 암기 필수

- [ ] **listen 계약**: 필터 4종(toolsListChanged/promptsListChanged/resourcesListChanged/resourceSubscriptions), 첫 메시지 = acknowledged(존중할 부분집합 반영), 모든 알림에 `subscriptionId` = listen 요청의 JSON-RPC id, 서버 우아한 종료 = 빈 result, **재연결 시 재구독**
  - 이유: 구독 구현·디버깅의 전체 체크리스트가 이 한 줄이다
- [ ] **캐시 의무 6종 + 금지**: server/discover · tools/list · prompts/list · resources/list · resources/templates/list · resources/read에 `ttlMs`+`cacheScope` 필수. input_required와 MRTR 재시도 결과는 캐시 금지. private = 인가 컨텍스트 간 공유 금지
  - 이유: 클라이언트 성능 설계의 근간이자, private/public을 틀리면 곧바로 데이터 유출
- [ ] **진행·취소 경계**: progress는 단조 증가·완료 후 중지·요청 응답 스트림 전용. 취소는 경합 전제 — 무효 취소는 무시, 취소 후 응답도 무시. 타임아웃은 progress로 연장해도 최대치는 강제
  - 이유: 장수 요청 안정성의 3대 규칙 — 어기면 유령 알림·무한 대기가 생긴다

## 자가 진단

<details>
<summary>Q1: listen 요청(id: 7)으로 toolsListChanged와 resourceSubscriptions를 신청했는데 ack의 notifications에 toolsListChanged만 있다. 무슨 뜻이고 뭘 해야 하나?</summary>

**즉답 예시**: 서버가 리소스 구독은 지원하지 않아 필터에서 뺐다는 뜻이다(ack는 존중하기로 한 부분집합). 클라이언트는 요청과 대조해 그 사실을 인지하고(SHOULD), 리소스 갱신은 알림 대신 ttlMs 기반 재조회로 커버하는 등 우아하게 대응해야 한다. 이후 이 스트림의 알림들은 전부 `subscriptionId: 7`을 달고 온다.

</details>

<details>
<summary>Q2: tools/list의 ttlMs가 300000(5분)인데 2분 뒤 list_changed가 왔다. 캐시는?</summary>

**즉답 예시**: 즉시 무효화한다. TTL과 알림은 상보적이고, 관련 알림 수신은 TTL이 남았어도 그 캐시를 stale로 만든다. 다음에 목록이 필요할 때 재조회한다(알림 수신 즉시 백그라운드 재조회를 강제하는 규칙은 아니다 — TTL은 폴링 타이머가 아니다).

</details>

<details>
<summary>Q3: 페이지네이션 응답의 nextCursor가 빈 문자열 ""이다. 끝인가?</summary>

**즉답 예시**: 끝이 아니다. 커서는 불투명 토큰이라 null 여부 외에는 어떤 판단도 금지다 — 빈 문자열도 유효한 커서이므로 다음 요청에 그대로 넣어 계속해야 한다. "끝"의 신호는 nextCursor 필드의 **부재**다.

</details>

<details>
<summary>Q4: 서버가 재시작됐다. stdio 클라이언트가 복구해야 할 것 두 가지는?</summary>

**즉답 예시**: (1) 미결(in-flight) 요청 — 무상태라 그냥 새 요청으로 재시도하면 된다. (2) 활성 구독 — 서버는 구독 상태를 재연결 간 유지하지 않으므로 `subscriptions/listen`을 다시 보내 재구독해야 한다. (판정해둔 서버 세대 캐시는 유지 가능하되, 어긋나면 재프로브.)

</details>

## 공식 문서

- [Message Patterns Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns) — 3패턴 요약
- [Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions) — 필터, ack, 종료
- [Progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress) · [Cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation)
- [Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching) · [Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination) · [Completion](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/completion) · [Logging](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/logging)
