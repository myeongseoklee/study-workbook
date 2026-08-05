# 메시지 규격 — 3종 메시지, resultType, 에러 코드, `_meta`

## 학습 목표

MCP 메시지를 SDK 없이 손으로 쓸 수 있다: 요청·응답·알림의 필수 필드, `resultType`의 처리 규칙, 에러 코드 대역의 의미, 그리고 모든 요청이 携帯해야 하는 `_meta` 필드를 정확히 안다.

## 선수 지식

- [01-prerequisites.md](01-prerequisites.md)의 JSON-RPC 2.0
- [02-core-principles.md](02-core-principles.md)의 무상태 원칙

## 핵심 원리 (WHY)

JSON-RPC 2.0을 그대로 쓰지 않고 MCP가 세 가지를 얹은 이유가 이 파일의 뼈대다.

1. **`id` 규칙 강화** — 기본 JSON-RPC는 `null` id를 허용하지만 MCP는 금지한다. `null`은 "응답 매칭 불가"와 "id를 깜빡함"을 구분 못 하게 만들기 때문이다. 미해결 요청 간 id 중복도 금지 — 상관관계가 프로토콜의 척추라서다.
2. **`resultType` 도입** — 무상태 + MRTR 세계에서 응답은 "끝났다(complete)"와 "입력이 더 필요하다(input_required)" 두 갈래다. 결과 객체만 보고 파싱 방법을 결정할 수 있도록 모든 result에 타입 태그를 박았다.
3. **`_meta` 규약** — 핸드셰이크가 없으니 버전·능력·정체성이 갈 곳이 요청 그 자체뿐이다. 아무 데나 두면 충돌하므로 예약 키 이름 규칙(reverse DNS)까지 정했다.

## 필수 지식 (HOW)

### 메시지 3종의 MCP 추가 규칙

**요청**: `id`는 문자열 또는 정수. **`null` 금지.** 같은 발신자가 응답을 아직 못 받은 요청과 같은 `id` 재사용 금지.

**결과 응답(result)**: 요청과 같은 `id`. `result.resultType` **필수**.
- `"complete"` — 정상 완료, 최종 내용 포함
- `"input_required"` — 미완. `InputRequiredResult`가 담겨 있다 ([08-mrtr-client-features.md](08-mrtr-client-features.md))
- 확장(extension)이 값을 추가할 수 있지만, capability로 광고된 확장의 값만 유효
- **모르는 값 = invalid로 취급.** 반대로 **`resultType`이 없으면 = `"complete"`로 간주** (구버전 서버 호환 — 이전 리비전에는 이 필드가 없었다)

**에러 응답(error)**: 같은 `id`(요청이 망가져 id를 못 읽은 경우만 예외). `error.code`는 정수, `error.message` 필수, `error.data`는 자유형.

**알림**: `id` 금지. 수신자는 응답 금지.

### 에러 코드 체계 — 대역 파티션

JSON-RPC 표준 코드(`-32700`, `-32600`~`-32603`)는 일반 프로토콜 실패에 그대로 쓴다. 구현 정의 대역(`-32000`~`-32099`)을 MCP가 쪼갠 방식이 중요하다:

| 대역 | 소유자 | 규칙 |
|---|---|---|
| `-32000` ~ `-32019` | **레거시/구현** | 정책 도입 전 SDK들이 쓰던 영역. **신규 할당 금지**, 새 구현은 사용 자체를 지양. `-32002` 외에는 특정 의미를 가정하지 말 것 |
| `-32020` ~ `-32099` | **MCP 명세 전용** | 명세가 정의한 코드만, 정의된 의미로만. 임의 방출 금지 |
| 그 외 (예약 대역 밖) | 애플리케이션 | 자체 에러는 `-32768`~`-32000` 바깥에 할당하라(SHOULD) |

명세가 정의한 코드 3개:

| 코드 | 이름 | 언제 | HTTP |
|---|---|---|---|
| `-32020` | `HeaderMismatch` | HTTP 헤더가 본문과 불일치 / 필수 헤더 누락·불량 | 400 |
| `-32021` | `MissingRequiredClientCapability` | 요청 처리에 필요한 능력을 클라이언트가 선언 안 함. `data.requiredCapabilities`에 목록 | 400 |
| `-32022` | `UnsupportedProtocolVersion` | 요청한 버전을 서버가 미지원. `data.supported`에 지원 목록, `data.requested`에 요청값 | 400 |

퇴역 코드: **`-32002`(resource not found)는 2025-11-25 이전 코드**로, 새 서버는 `-32602`를 내야 하지만 클라이언트는 구서버가 보내는 `-32002`도 계속 수용해야 한다(SHOULD). `-32042`(URL elicitation required)는 2025-11-25에만 존재했고 재사용 금지.

주의: `-32602`(Invalid params)는 MCP에서 과적된 코드다 — 잘못된 인자, **존재하지 않는 리소스**, **필수 `_meta` 필드 누락**, 잘못된 커서, 모르는 도구까지 전부 이 코드로 온다. 진단할 때는 `message`와 `data`를 같이 봐야 한다.

### `_meta` — 요청·응답의 메타데이터 규약

**키 이름 규칙**: `[프리픽스/]이름`. 프리픽스는 점으로 구분된 라벨들 + `/`, **reverse DNS 표기 권장**(`com.example/`). 두 번째 라벨이 `modelcontextprotocol`이나 `mcp`인 프리픽스는 전부 예약 (`io.modelcontextprotocol/`, `dev.mcp/` 등. 단 `com.example.mcp/`는 두 번째 라벨이 `example`이라 예약 아님).

**클라이언트 요청의 프로토콜 필드** (매 요청, params._meta 안):

| 키 | 필수 | 내용 |
|---|---|---|
| `io.modelcontextprotocol/protocolVersion` | **필수** | 이 요청의 프로토콜 버전 (예: `"2026-07-28"`) |
| `io.modelcontextprotocol/clientCapabilities` | **필수** | 이 요청에 관련된 클라이언트 능력 |
| `io.modelcontextprotocol/clientInfo` | 권장(SHOULD) | 클라이언트 이름·버전 |
| `io.modelcontextprotocol/logLevel` | 선택 | 이 요청에 대해 받고 싶은 최소 로그 레벨 ([09](09-subscriptions-utilities.md)) |

필수 필드가 빠지면 **`-32602` + (HTTP면) 400**으로 거부해야 한다(MUST). 서버는 선언 안 된 능력에 의존하면 안 되고, 필요하면 `-32021`을 낸다.

**서버 응답 쪽**: 모든 result의 `_meta`에 `io.modelcontextprotocol/serverInfo`(이름·버전)를 넣어야 한다(SHOULD). `clientInfo`/`serverInfo`는 자기 신고 값이라 **표시·로깅·디버깅용**이다 — 동작 분기나 보안 결정에 쓰지 말 것(SHOULD NOT).

**기타 예약 키**: `progressToken`(진행 알림 opt-in), `io.modelcontextprotocol/subscriptionId`(구독 스트림 알림의 상관관계 — 서버 MUST), 그리고 프리픽스 규칙의 예외로 **`traceparent`/`tracestate`/`baggage`**(W3C Trace Context/Baggage 형식의 OpenTelemetry 전파 — 기존 관례 호환을 위한 예외).

### JSON Schema 사용 규칙

- `$schema` 없으면 **2020-12**가 기본. 구현은 2020-12를 반드시 지원하고, 미지원 방언은 우아하게 에러로
- **`$ref`의 네트워크 URI 자동 역참조 금지**(MUST NOT). opt-in으로 허용하더라도 기본 꺼짐 + 호스트 allowlist(최소한 루프백·링크로컬·사설망 거부) + 타임아웃·크기 제한 + 로깅. 해석 못 한 외부 `$ref`는 관대하게 통과시키지 말고 거부(SHOULD)
- 조합 키워드(`anyOf`/`oneOf`/`allOf`/`if-then-else`)와 `$defs`는 검증 비용 폭탄이 될 수 있다 — 스키마 깊이·서브스키마 수·검증 시간에 상한을 둬라(SHOULD). 악성 스키마가 검증기를 DoS 시키는 걸 막는다

### `icons` — 시각 식별자와 그 보안

Tool·Prompt·Resource·Implementation에 `icons` 배열(각각 `src`, `mimeType?`, `sizes?`, `theme?`)을 붙일 수 있다. 렌더링하는 클라이언트는 PNG·JPEG 지원 필수, SVG·WebP 권장. 아이콘은 **untrusted 입력**이다: HTTPS 또는 `data:` URI만 허용(`javascript:`·`file:` 등 거부), 서버와 same-origin 검증, 자격증명 없이 fetch, magic bytes로 실제 타입 검증(SVG는 스크립트를 품을 수 있다), 크기·프레임 폭탄 방어.

## 우리 작업과의 연결

Claude Code에 MCP 서버를 붙였을 때 "Invalid params (-32602)"가 나오면 이제 세 가지를 순서로 의심할 수 있다: (1) 필수 `_meta` 누락(구식 클라이언트가 신식 서버 호출), (2) 인자 스키마 불일치, (3) 없는 리소스/도구 이름. 코드 하나에 원인이 여럿 겹쳐 있음을 아는 것이 진단 속도를 결정한다.

### ⚠️ 암기 필수

- [ ] **에러 코드 5개**: `-32602` invalid params(인자 오류·리소스 없음·필수 `_meta` 누락 겸용) / `-32601` method not found(HTTP 404) / `-32020` HeaderMismatch / `-32021` MissingRequiredClientCapability / `-32022` UnsupportedProtocolVersion (스펙 3형제는 전부 HTTP 400). 레거시 `-32002`(리소스 없음)는 수신만 허용
  - 이유: 장애 중 로그에서 코드만 보고 원인 계층(헤더/능력/버전/인자)을 즉시 갈라야 한다
- [ ] **에러 대역 파티션**: `-32000`~`-32019` 레거시·구현 정의(신규 할당 금지) / `-32020`~`-32099` MCP 명세 전용
  - 이유: 자체 에러 코드를 어디 할당할지, 남의 코드를 어떻게 해석할지의 경계
- [ ] **resultType 규칙**: 모든 result에 필수. `"complete"` / `"input_required"`. **없으면 complete로 간주, 모르는 값은 invalid**
  - 이유: 응답 파서를 짤 때 가장 먼저 갈리는 분기이고, 하위 호환 처리의 대표 사례
- [ ] **필수 `_meta` 2 + 권장 1**: `protocolVersion`(필수) + `clientCapabilities`(필수) + `clientInfo`(권장). 누락 = `-32602` + 400
  - 이유: 무상태 프로토콜의 물리적 실체. 이 세 키가 핸드셰이크를 대체한다

## 자가 진단

<details>
<summary>Q1: 서버 응답에 resultType이 아예 없다. 클라이언트는 어떻게 처리해야 하고, 왜 그런 규칙이 생겼나?</summary>

**즉답 예시**: `"complete"`로 간주해야 한다(MUST). 이전 프로토콜 리비전의 서버들은 이 필드 자체가 없었으므로, 부재를 에러로 처리하면 구서버와의 호환이 전부 깨진다. 반면 "모르는 값"은 미래의 확장 값일 수 있는데 클라이언트가 그 의미를 모른 채 진행하면 위험하므로 invalid로 취급한다 — 부재와 미지(未知)를 다르게 다루는 것이 포인트.

</details>

<details>
<summary>Q2: `com.example.mcp/foo`라는 `_meta` 키는 예약인가 아닌가? `dev.mcp/foo`는?</summary>

**즉답 예시**: 예약 판정 기준은 "프리픽스의 **두 번째 라벨**이 `modelcontextprotocol` 또는 `mcp`인가"다. `com.example.mcp/`의 두 번째 라벨은 `example`이므로 예약 아님. `dev.mcp/`는 두 번째 라벨이 `mcp`라 예약이다.

</details>

<details>
<summary>Q3: 도구 inputSchema 안의 `$ref`가 `https://evil.example/schema.json`을 가리킨다. 클라이언트 검증기는 어떻게 해야 하나?</summary>

**즉답 예시**: 자동으로 fetch하면 안 된다(MUST NOT) — SSRF·데이터 유출 통로가 된다. 기본은 역참조 거부이고, 해석 못 한 `$ref` 때문에 검증이 불가능한 스키마는 "그냥 통과"가 아니라 거부해야 한다(SHOULD). 네트워크 `$ref`가 꼭 필요하면 opt-in + 호스트 allowlist + 타임아웃·크기 제한 + 로깅 조건으로만.

</details>

<details>
<summary>Q4: 같은 -32602라도 세 가지 다른 원인이 올 수 있다. 셋을 대고, 로그에서 어떻게 구분할지?</summary>

**즉답 예시**: (1) 필수 `_meta` 필드 누락 — 요청 본문의 `params._meta`를 확인, (2) 도구/프롬프트 인자가 스키마 위반 또는 모르는 도구 이름 — `message` 문구와 요청 인자 대조, (3) 존재하지 않는 리소스 URI — `data.uri` 확인. 코드가 같으므로 `message`/`data`와 원 요청을 함께 봐야 한다.

</details>

## 공식 문서

- [Base Protocol Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic) — 메시지, 에러 코드, `_meta`, JSON Schema, icons
- [Schema Reference](https://modelcontextprotocol.io/specification/2026-07-28/schema) — 모든 타입의 원전 (TypeScript 스키마가 source of truth)
