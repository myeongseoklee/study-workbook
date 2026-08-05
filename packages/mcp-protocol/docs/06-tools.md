# 도구(Tools) — 모델이 세계에 작용하는 통로

## 학습 목표

도구 정의(스키마·이름·어노테이션)를 규격대로 쓸 수 있고, 프로토콜 오류와 실행 오류의 2계층을 구분해 설계할 수 있으며, 무상태 세계에서 상태 있는 도구(핸들 패턴)를 안전하게 만들 수 있다.

## 선수 지식

- [02-core-principles.md](02-core-principles.md)의 프리미티브 제어 주체, 무상태
- [03-messages-meta.md](03-messages-meta.md)의 JSON Schema 규칙

## 핵심 원리 (WHY)

도구는 **모델 제어(model-controlled)** 프리미티브다 — 모델이 문맥을 보고 스스로 발견(`tools/list`)하고 호출(`tools/call`)을 결정한다. 그 자율성이 가치이자 위험이라서, 명세는 "**항상 human-in-the-loop**(호출 거부 권한)"을 SHOULD로 요구하고, 신뢰 안 되는 서버의 도구 설명·어노테이션을 **untrusted**로 취급하라고 못박는다.

도구 관련 규칙 다수는 "**LLM이 소비자**"라는 사실에서 나온다: 결과에 `isError`를 두는 것(모델이 읽고 자가수정), 리스트의 결정적 순서(프롬프트 캐시 적중), 설명·스키마의 품질이 곧 호출 정확도.

## 필수 지식 (HOW)

### 능력 선언과 리스트 불변식

```json
{ "capabilities": { "tools": { "listChanged": true } } }
```

`tools` 능력을 선언한 서버는 `tools/list`에 응답해야 한다. 리스트는 비어 있어도, 시간에 따라 변해도 되지만 — **연결마다 달라지거나 같은 연결의 다른 요청의 부수효과로 변하면 안 된다**(MUST NOT). 단 **요청에 실린 인가에 따라 달라지는 건 허용** — 자격증명은 연결 상태가 아니라 요청 입력이기 때문이다(무상태 원칙의 응용). `2026-07-28`부터 **결정적 순서**(같은 집합이면 같은 순서)가 SHOULD — 클라이언트 캐시와 LLM 프롬프트 캐시 적중률 때문.

### 도구 정의

```json
{
  "name": "get_weather",
  "title": "Weather Information Provider",
  "description": "Get current weather information for a location",
  "inputSchema": {
    "type": "object",
    "properties": { "location": { "type": "string", "description": "City name or zip code" } },
    "required": ["location"]
  },
  "outputSchema": { "...": "선택 — 구조화 출력의 스키마" },
  "icons": [ { "src": "https://example.com/icon.png", "sizes": ["48x48"] } ],
  "annotations": { "...": "동작 힌트 — untrusted!" }
}
```

- `inputSchema`: 유효한 JSON Schema 객체 필수(`null` 불가). 파라미터 없는 도구는 `{ "type": "object", "additionalProperties": false }` 권장(빈 객체만 수락) 또는 `{ "type": "object" }`(아무 객체나)
- `outputSchema`: 있으면 서버는 그에 맞는 `structuredContent`를 **반드시** 반환, 클라이언트는 검증 SHOULD
- **이름 규칙**(전부 SHOULD): 1~128자, 대소문자 구분, 허용 문자 `A-Za-z0-9_-.`, 공백·쉼표 금지, **서버 내 유일**. 여러 서버를 모으는 호스트는 충돌(두 서버가 모두 `search`)을 스스로 해소해야 한다 — 서버 이름(serverInfo)은 유일성이 보장 안 되므로 구분자로 삼지 말 것

### 결과의 두 채널: content와 structuredContent

**비구조화 `content`**: 타입 배열 — `text` / `image`(base64+MIME) / `audio` / `resource_link`(URI만 — `resources/list`에 있으리란 보장 없음) / `resource`(내용 임베드 — 쓰면 `resources` 능력도 선언 SHOULD). 모든 콘텐츠 타입에 리소스와 같은 `annotations`(audience/priority/lastModified) 부착 가능.

**구조화 `structuredContent`**: 임의 JSON 값. `outputSchema` 있으면 그에 부합해야 한다. 하위 호환을 위해 구조화 결과를 낼 때는 직렬화한 JSON을 TextContent로도 함께 담아라(SHOULD). 주의: 이것은 서버가 만든 결과 데이터지, LLM의 "structured outputs"(스키마 제약 생성)와 무관하다.

### 오류의 2계층 — 이 구분이 도구 설계의 핵심

| 계층 | 형태 | 언제 | 모델이 고칠 수 있나 |
|---|---|---|---|
| **프로토콜 오류** | JSON-RPC `error` (예: `-32602`) | 모르는 도구, 스키마를 어긴 요청 구조, 서버 내부 오류 | 어려움 — 클라이언트가 모델에 전달은 MAY |
| **실행 오류** | `result` + **`isError: true`** + content에 설명 | API 실패, 입력 값 검증 실패(형식·범위), 비즈니스 로직 오류 | **가능** — 클라이언트가 모델에 전달 SHOULD |

기준은 "**모델이 인자를 고쳐 재시도하면 성공할 수 있는가**". "출발일이 과거입니다. 오늘은 2025-08-08" 같은 실행 오류 메시지는 모델이 읽고 스스로 교정한다. 반면 요청 구조 자체가 깨진 것은 모델이 고치기 어렵다. 실행 오류를 JSON-RPC 에러로 내버리면 모델의 자가수정 루프가 끊긴다 — 가장 흔한 서버 설계 실수.

### 상태가 필요한 도구 — 명시적 핸들 패턴 (비규범 가이드)

프로토콜에 세션이 없으므로, 크로스 호출 상태(장바구니·브라우저 컨텍스트·트랜잭션)는 **생성 도구가 핸들을 반환하고 후속 호출이 인자로 받는** 패턴으로 만든다. 와이어에서 핸들은 그냥 문자열 인자다 — 모델이 `basket_id`를 다음 호출로 나른다.

핸들 설계 체크리스트:
- **인가**: 인증 서버에서 핸들은 이름이지 자격이 아니다 — 매 호출 호출자의 권한을 핸들에 대해 검증. 비인증 서버에서는 핸들이 곧 bearer 토큰이므로 충분한 엔트로피(UUIDv4)+수명 제한
- **불투명성**: 내부 구조를 인코딩하면 파싱·추측을 부른다
- **수명**: 핸들은 연결보다 오래 산다 — 보존 정책("24시간 미사용 시 만료")을 **생성 도구의 description에** 적어 모델이 보게 하라
- **만료 오류**: 만료·미지 핸들 호출엔 그렇다고 말해주는 **실행 오류**를 — 모델이 새로 만들어 회복하도록

### 보안 요구

서버 MUST: 모든 입력 검증, 접근 통제, 호출 레이트리밋, 출력 새니타이즈. 클라이언트 SHOULD: 민감 작업 사용자 확인, **호출 전 입력을 사용자에게 표시**(악의적·실수 유출 방지), 결과를 LLM에 넣기 전 검증, `$ref` 규칙 준수, 타임아웃, 감사 로깅.

### 리스트 변경 알림

`listChanged: true`를 선언한 서버는, `toolsListChanged: true`로 `subscriptions/listen`을 연 클라이언트에게 `notifications/tools/list_changed`를 보낸다(SHOULD) → 클라이언트는 `tools/list` 재호출로 갱신. 자세한 구독 역학은 [09](09-subscriptions-utilities.md).

`tools/call`은 MRTR 지원 3개 메서드 중 하나다 — 서버가 `input_required`를 돌려주고 재시도받을 수 있다([08](08-mrtr-client-features.md)).

## 우리 작업과의 연결

코딩 과제 06-01이 이 파일의 축소판이다: tools/list(결정적 순서 + 캐시 힌트)와 tools/call(프로토콜 오류 vs 실행 오류 분기)을 직접 구현한다. 실무에서 도구를 설계할 때 첫 질문은 "이 실패를 모델이 읽고 고칠 수 있게 만들었나?"다.

### ⚠️ 암기 필수

- [ ] **오류 2계층**: 프로토콜 오류(JSON-RPC error — 모르는 도구·깨진 요청 구조) vs 실행 오류(`isError: true` + content — API 실패·값 검증·비즈니스 오류). 기준 = 모델이 인자를 고쳐 재시도해 성공할 수 있는가. 실행 오류는 모델에 전달 SHOULD
  - 이유: 도구 서버 설계에서 가장 자주 틀리는 지점이고, 모델의 자가수정 능력을 살리고 죽이는 갈림길
- [ ] **리스트 불변식**: tools/list는 연결·요청 부수효과로 변하면 안 되고(인가에 따라서는 가능), 결정적 순서 SHOULD(캐시·프롬프트 캐시 때문)
  - 이유: 무상태 원칙이 프리미티브에 구체화된 형태. 캐시 설계의 전제
- [ ] **핸들 4원칙**: 소유≠인증(매 호출 권한 검증) / 불투명 / 수명은 description에 / 만료는 실행 오류로
  - 이유: 무상태 프로토콜에서 상태 있는 서비스를 만드는 표준 답안이자 State Handle Hijacking의 방어선

## 자가 진단

<details>
<summary>Q1: 항공권 검색 도구에 date="2020-01-01"(과거)이 들어왔다. -32602를 던져야 하나?</summary>

**즉답 예시**: 아니다. 요청 구조는 유효하고 값이 비즈니스 규칙에 어긋난 것이므로 **실행 오류**다 — `isError: true` + "출발일은 미래여야 합니다. 오늘은 …" 같은, 모델이 읽고 교정할 수 있는 텍스트. `-32602`는 스키마 위반·모르는 도구처럼 모델이 고치기 어려운 구조 문제에 쓴다. (참고로 이 원칙은 SEP-1303 "입력 검증 오류를 실행 오류로"가 명시화했다.)

</details>

<details>
<summary>Q2: 사용자별로 권한이 다른 서버에서 tools/list가 사용자마다 다른 목록을 주는 건 "리스트는 연결마다 달라지면 안 된다" 위반인가?</summary>

**즉답 예시**: 아니다. 금지된 것은 연결 정체성·요청 부수효과에 따른 변동이다. 인가(요청에 실린 토큰의 스코프)에 따른 변동은 명시적으로 허용된다 — 자격증명은 연결 상태가 아니라 요청별 입력이기 때문. 다만 이 경우 캐시 스코프는 `private`이어야 한다.

</details>

<details>
<summary>Q3: outputSchema를 제공하는 이유가 클라이언트 검증 말고 또 뭐가 있나?</summary>

**즉답 예시**: (1) 타입 정보로 언어 통합이 좋아진다 — 클라이언트가 코드 모드(programmatic tool calling)에서 typed 함수 스텁을 생성할 수 있다. (2) LLM이 결과 파싱 방법을 미리 안다. (3) 문서화·DX. 반대로 outputSchema가 없으면 코드 모드 클라이언트는 결과를 any로 다루거나 작은 모델로 타입 추출을 해야 한다.

</details>

<details>
<summary>Q4: 두 서버가 모두 `search`라는 도구를 노출한다. 호스트는 serverInfo.name으로 구분하면 되나?</summary>

**즉답 예시**: 안 된다 — serverInfo의 이름은 유일성이 보장되지 않는 자기 신고 값이다. 호스트가 자체 구분 전략(예: 자기가 관리하는 서버 식별자를 접두사로 붙인 `github__search`)을 구현해야 한다(SHOULD). 도구 이름의 유일성 스코프는 "한 서버 안"까지만이다.

</details>

## 공식 문서

- [Tools (spec)](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) — 정의, 결과 타입, 오류 2계층, 핸들 패턴, x-mcp-header
- [Server concepts](https://modelcontextprotocol.io/docs/2026-07-28/learn/server-concepts) — 제어 주체와 여행 예제
