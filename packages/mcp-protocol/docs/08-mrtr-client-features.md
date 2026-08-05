# MRTR과 클라이언트 기능 — 서버가 입력을 얻는 유일한 길

## 학습 목표

MRTR(Multi Round-Trip Requests)의 흐름·타입·보안 요구를 구현 수준으로 알고, elicitation의 form/url 두 모드와 그 보안 경계를 설명할 수 있다. deprecated된 sampling·roots가 어떻게 동작했고 왜 퇴역했는지 안다.

## 선수 지식

- [02-core-principles.md](02-core-principles.md)의 "서버는 요청을 시작할 수 없다"
- [03-messages-meta.md](03-messages-meta.md)의 `resultType: "input_required"`

## 핵심 원리 (WHY)

레거시 MCP에서 서버는 처리 도중 클라이언트로 **자기 요청**(`elicitation/create`, `sampling/createMessage`, `roots/list`)을 보낼 수 있었다. 이 양방향 요청 모델은 무상태·수평 확장과 정면충돌한다: 서버 인스턴스 A가 보낸 요청의 응답이 인스턴스 B에 도착하면 처리할 수 없다 — 공유 저장소나 스티키 라우팅이 강제된다.

MRTR은 방향을 뒤집는다. **서버는 "필요한 입력 목록"을 응답으로 돌려주고, 클라이언트가 입력을 모아 원래 요청을 재시도한다.** 재시도는 완전히 독립적인 새 요청이라 어느 인스턴스가 받아도 되고, 서버가 이어가는 데 필요한 문맥은 `requestState`라는 불투명 문자열에 인코딩해 클라이언트에 맡겼다가 돌려받는다. 상태 저장 없이 다회 왕복 대화가 성립한다. **이것은 breaking change다** — 서버발 요청 패턴은 더 이상 지원되지 않는다.

## 필수 지식 (HOW)

### 흐름과 타입

```
클라이언트: tools/call (id:1) ─────────────────▶ 서버
서버: result { resultType: "input_required",
               inputRequests: { 키: 요청... },
               requestState: "불투명" } ◀────────
클라이언트: 사용자/모델에게서 입력 수집
클라이언트: tools/call (id:2, 원래 params
            + inputResponses: { 키: 결과... }
            + requestState 그대로) ────────────▶ 서버
서버: result { resultType: "complete", ... } ◀──
```

- **`InputRequests`**: 서버가 정한 문자열 키 → 요청 객체 맵. 값은 `ElicitRequest` / `CreateMessageRequest`(sampling) / `ListRootsRequest` 중 하나(MUST). 키는 요청 스코프에서 유일
- **`InputResponses`**: 같은 키 → 클라이언트의 결과(`ElicitResult` / `CreateMessageResult` / `ListRootsResult`)
- **`InputRequiredResult`**: `inputRequests?` + `requestState?` — **최소 하나는 필수**(MUST). `requestState`만 있는 응답도 합법("아직 준비 안 됨, 이 상태 갖고 다시 와라" — URL 모드 대기 등)

**지원 범위**: `InputRequiredResult`를 돌려줄 수 있는 요청은 **`tools/call`, `resources/read`, `prompts/get` 셋뿐**(그 외 MUST NOT).

### 서버 요구사항

1. 클라이언트가 capability로 선언 안 한 종류의 inputRequest 전송 금지(MUST) — elicitation 미선언 클라이언트에 `elicitation/create`를 넣으면 안 된다
2. 클라이언트가 입력을 채워 재시도하리라 **가정 금지**(MUST NOT) — 사용자가 거부하거나 그냥 안 올 수 있다
3. 같은 요청에 여러 번 `input_required`로 답해도 된다(정보가 찰 때까지 반복 프롬프트)
4. 재시도의 `inputResponses`에 모르는 항목은 무시(SHOULD), 필요한 정보가 빠졌으면 에러 대신 **다시 `input_required`로 재요청**(SHOULD)

### requestState 보안 — 공격자 통제 입력이다

`requestState`는 클라이언트를 거쳐 돌아오므로 악의적 클라이언트가 변조할 수 있다. 명세 요구:

- 인가·리소스 접근·비즈니스 로직에 영향을 주는 state는 **무결성 보호 필수**(HMAC 또는 AEAD) + 검증 실패 시 거부(MUST). 생략 가능한 유일한 경우: 변조돼봤자 요청 실패가 전부일 때
- **재사용(replay) 방어**를 위해 보호된 페이로드 안에 넣고 수신 시 검증(SHOULD): ① 인증된 주체(다른 주체가 제시하면 거부), ② 짧은 TTL, ③ 원 요청 식별자(메서드명+파라미터 다이제스트 — 다른 요청에 제시하면 거부)
- 주의: 위 세 가지는 재사용 창을 좁힐 뿐 **단일 사용(single-use)을 보장하지 않는다** — 1회성 소비(쿠폰 사용 등)가 필요하면 서버가 서버 측에서 강제해야 한다(MUST)

클라이언트 쪽 의무: `requestState`를 **들여다보거나 파싱·수정·가정 금지**(MUST NOT), 있으면 그대로 에코, 없었으면 재시도에 넣지 말 것. **재시도의 JSON-RPC id는 반드시 새 값**(독립 요청이므로). inputRequests/requestState는 그 요청의 재시도에만 쓴다 — 병렬 다른 요청에 유용 금지.

### Elicitation — 사용자에게 묻기

클라이언트 capability: `"elicitation": { "form": {}, "url": {} }`. **빈 객체 `{}`는 form만 지원과 동치**(하위 호환). 선언했다면 최소 한 모드는 지원해야 하고, 서버는 클라이언트가 지원 안 하는 모드를 보내면 안 된다.

**Form 모드** (`mode: "form"` 또는 생략): 구조화 데이터를 클라이언트 안에서 수집. `message`(왜 필요한지) + `requestedSchema`. 스키마는 **평평한 객체 + 원시 타입만**이라는 의도적 제약(클라이언트가 폼을 만들기 쉽게): string(+`format`: email/uri/date/date-time), number/integer(min/max), boolean, 단일 선택 enum(`enum` 또는 title 있는 `oneOf`+`const`), 다중 선택(배열+`items.enum`/`anyOf`). 모든 원시 타입에 `default` 가능. 중첩 객체·객체 배열 불가.

**URL 모드** (`mode: "url"` + `url` + `message`): 사용자를 외부 URL로 보내 **클라이언트를 거치지 않는** 대역외 상호작용. 자격증명 입력, 결제, 서드파티 OAuth 등. `action: "accept"`는 "사용자가 열기에 동의했다"이지 "상호작용이 끝났다"가 아니다 — 완료 여부는 서버가 재시도 시점에 `requestState`/자체 저장 상태로 판단하고, 안 끝났으면 다시 `input_required`.

**응답 3액션**: `accept`(제출 — form이면 `content`에 데이터) / `decline`(명시적 거부) / `cancel`(닫음·이탈 — 무선택). 서버는 셋 다 처리해야 한다: decline엔 대안 제시, cancel엔 나중에 재프롬프트 등.

**보안 경계 (핵심)**:
- 서버는 form 모드로 **비밀(비밀번호·API 키·액세스 토큰·결제 정보) 요청 금지**(MUST NOT) — 그런 것은 URL 모드로(MUST). 이름·이메일 같은 일반 프로필 정보는 금지 대상이 아니다(사용자가 보고 거부할 수 있음)
- URL 모드는 MCP 클라이언트의 서버 접근 인가용이 아니다 — 그건 [10-authorization.md](10-authorization.md)의 몫. URL 모드는 "서버가 사용자에게서 대역외로 뭔가를 받아야 할 때"다
- 클라이언트: URL 자동 프리페치 금지, 동의 없이 열기 금지, **전체 URL 표시 필수**, LLM·클라이언트가 내용을 못 보는 안전한 방식으로 열기(iOS라면 SFSafariViewController — WkWebView 불가), 도메인 강조·Punycode 경고 권장
- 서버: URL에 사용자 민감 정보·사전 인증된 링크 넣기 금지(MUST NOT — 악성 클라이언트가 사용자를 사칭할 수 있다)
- **피싱 방어**: elicitation URL은 공격자가 피해자에게 전달할 수 있다. 서버는 **URL을 연 사용자 = elicitation을 시작한 사용자**임을 검증해야 한다(MUST) — 예: 자기 도메인의 connect 페이지를 경유시켜 세션 쿠키의 `sub`와 대조 후 서드파티로 리다이렉트. 안 하면 "A가 만든 링크를 B가 완료 → 서드파티 토큰이 A 세션에 바인딩"이라는 계정 탈취가 성립한다

**서드파티 OAuth 패턴** (URL 모드의 대표 용례): MCP 서버가 서드파티 API의 OAuth **클라이언트**가 된다. 요구: 서드파티 자격증명은 MCP 클라이언트를 절대 경유 금지, 클라이언트의 MCP 토큰을 서드파티에 재사용 금지(= token passthrough 금지), 획득한 토큰은 서버가 사용자 정체성에 바인딩해 저장(이 부분만큼은 서버가 stateful).

### Sampling — deprecated지만 알아야 하는 이유

서버가 클라이언트의 LLM에 완성(completion)을 요청하는 기능. `CreateMessageRequest`: `messages`(user/assistant 롤), `modelPreferences`(힌트 + cost/speed/intelligence 우선순위 0~1 — 클라이언트가 최종 선택), `systemPrompt`(클라이언트가 수정·무시 가능), `maxTokens`(클라이언트 **준수 필수**), `temperature`/`stopSequences`/`metadata`(수정·무시 가능). 결과: `role`·`content`·`model`·`stopReason`(`endTurn`/`stopSequence`/`maxTokens`/`toolUse`).

**Sampling with tools**: 요청에 `tools`+`toolChoice`(auto/required/none)를 실으면 모델이 도구를 쓸 수 있다(클라이언트 capability `sampling.tools` 필수). 규칙 두 개가 시험 포인트: ① tool_result를 담은 user 메시지는 **tool_result만** 담아야 한다(다른 타입 혼합 금지 — 프로바이더 API의 전용 롤과 호환 위해), ② tool_use를 담은 assistant 메시지 다음에는 **모든 tool_use id에 대응하는 tool_result**가 와야 다른 메시지가 올 수 있다. 루프는 서버가 돌린다(결과 붙여 재요청, 마지막엔 `toolChoice: none`으로 강제 종료 가능).

**퇴역 이유와 대체**: human-in-the-loop 다중 승인으로 UX가 무겁고, 클라이언트마다 지원이 들쭉날쭉했다. 마이그레이션: **서버가 LLM 프로바이더 API를 직접 호출**. `includeContext`의 `thisServer`/`allServers`는 별도로 먼저 deprecated(생략 또는 `"none"`).

### Roots — deprecated

클라이언트가 서버에 "이 디렉토리들에서 작업하라"고 알려주는 `file://` URI 목록. **접근 통제가 아니라 안내(coordination)** — 명세도 "서버는 경계를 존중해야 한다(SHOULD)"까지만. 실제 보안은 OS 권한·샌드박스의 몫이었다. 퇴역 이유: 정보 전달일 뿐이면 굳이 프로토콜 기능일 필요가 없다. 마이그레이션: 디렉토리를 **도구 인자·리소스 URI·서버 설정**으로 전달.

## 우리 작업과의 연결

코딩 과제 3-4가 MRTR 서버 코어다: `input_required` 응답 생성, requestState 무결성 검증, 재시도 처리. 실무에서는 "예약 확정 전 확인", "부족한 파라미터 묻기"가 전부 이 패턴 위에 선다 — Claude Code 같은 호스트의 승인 다이얼로그가 클라이언트 측 구현이다.

### ⚠️ 암기 필수

- [ ] **MRTR 스코프**: `input_required`는 `tools/call`·`resources/read`·`prompts/get` 3개에서만. inputRequests 값은 elicitation/sampling/roots 3종만. `inputRequests`·`requestState` 중 최소 1개. **재시도는 새 id**
  - 이유: 구현·리뷰에서 범위를 벗어난 사용을 즉시 잡아야 한다
- [ ] **requestState 보안**: 공격자 통제 입력으로 취급 — 로직에 영향 주면 HMAC/AEAD 필수 + 주체·TTL·요청 바인딩으로 재사용 방어 + 단일 사용은 별도로 서버가 강제. 클라이언트는 불투명하게 에코만
  - 이유: MRTR의 유일한 신뢰 경계. 여기가 뚫리면 인가 우회가 된다
- [ ] **elicitation 보안 경계**: form으로 비밀(비밀번호·API키·토큰·결제) 요청 금지 → URL 모드. URL 모드에선 "연 사용자 = 시작한 사용자" 검증(피싱 방어). accept ≠ 완료
  - 이유: 사용자 자격증명이 LLM 컨텍스트·클라이언트 로그로 새는 것을 막는 최전선

## 자가 진단

<details>
<summary>Q1: 서버가 input_required에 inputRequests 없이 requestState만 담아 보냈다. 클라이언트는 뭘 해야 하나? 이게 언제 유용한가?</summary>

**즉답 예시**: 수집할 입력이 없으므로 즉시 재시도해도 된다(MAY) — requestState를 그대로 에코해서. URL 모드 elicitation 후 대역외 상호작용이 끝나길 기다리는 폴링, 또는 서버가 "상태만 갖고 다시 와라"는 대기 시나리오에서 유용하다. inputRequests와 requestState 중 최소 하나만 있으면 합법이다.

</details>

<details>
<summary>Q2: requestState에 주체·TTL·요청 바인딩을 다 넣고 HMAC까지 했다. 1회용 쿠폰 사용 도구라면 이걸로 충분한가?</summary>

**즉답 예시**: 부족하다. 그 세 가지는 재사용 창을 좁히고 크로스 사용자·크로스 요청 재사용을 막을 뿐, TTL 안에서 같은 사용자가 같은 요청으로 여러 번 제시하는 것은 못 막는다. "최대 1회 소비" 불변식은 서버가 서버 측 상태(소비 기록)로 강제해야 한다(MUST).

</details>

<details>
<summary>Q3: URL 모드 elicitation의 응답이 accept인데 서버가 다시 input_required를 보냈다. 버그인가?</summary>

**즉답 예시**: 정상일 수 있다. accept는 "사용자가 URL 열기에 동의했다"일 뿐 대역외 상호작용의 완료가 아니다. 재시도 시점에 서버가 requestState로 완료 여부를 확인했는데 아직이라면 다시 input_required로 답하는 것이 규격 흐름이다. 클라이언트는 사용자가 수동으로 재시도/취소할 수 있는 컨트롤을 제공해야 한다(SHOULD).

</details>

<details>
<summary>Q4: sampling with tools에서 모델이 tool_use 두 개를 냈는데 서버가 하나의 결과만 붙여 다음 완성을 요청했다. 왜 문제인가?</summary>

**즉답 예시**: tool_use를 담은 assistant 메시지 다음에는 **모든** tool_use id에 매칭되는 tool_result로만 구성된 user 메시지가 와야 한다(MUST). 하나가 빠지면 프로바이더 API(전용 tool 롤을 쓰는 OpenAI/Gemini 포함)와의 매핑이 깨지고 병렬 도구 처리가 성립하지 않는다. 두 결과를 모두 채워 보내야 한다.

</details>

## 공식 문서

- [Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr) — 타입, 서버/클라이언트 요구, requestState 보안
- [Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) — form/url, 3액션, 피싱 방어, 서드파티 OAuth 패턴
- [Sampling](https://modelcontextprotocol.io/specification/2026-07-28/client/sampling) — deprecated. 도구 동반 샘플링 규칙
- [Roots](https://modelcontextprotocol.io/specification/2026-07-28/client/roots) — deprecated. 안내 vs 보안 경계
