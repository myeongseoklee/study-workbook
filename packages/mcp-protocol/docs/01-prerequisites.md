# 선수 지식

## 이 파일을 건너뛰어도 되는 경우

- JSON-RPC 2.0의 요청/응답/알림 구분과 `id` 상관관계를 이미 안다
- OAuth 2.1의 authorization code + PKCE 흐름을 그림으로 그릴 수 있다
- JSON Schema로 객체 구조를 정의·검증해본 적이 있다
- SSE(Server-Sent Events)가 무엇인지, WebSocket과 어떻게 다른지 안다

## 필수 개념 1: JSON-RPC 2.0

MCP의 모든 메시지는 JSON-RPC 2.0 위에 있다. 세 가지 메시지 형태만 알면 된다.

| 형태 | 특징 | 예 |
|---|---|---|
| **요청(Request)** | `id` + `method` + `params?`. 반드시 응답이 온다 | `{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{...}}` |
| **응답(Response)** | 요청과 같은 `id` + `result` 또는 `error` 중 하나 | `{"jsonrpc":"2.0","id":1,"result":{...}}` |
| **알림(Notification)** | `id` 없음. 응답을 기대하지 않는 단방향 | `{"jsonrpc":"2.0","method":"notifications/progress","params":{...}}` |

핵심 메커니즘은 **`id`에 의한 상관관계(correlation)**다. 한 채널 위에 여러 요청이 동시에 흐를 수 있고, 응답이 순서 없이 도착해도 `id`로 어느 요청의 답인지 안다. 그래서 "알림에는 `id`가 없다 = 응답을 매칭할 방법이 없다 = 응답하면 안 된다"가 한 줄로 이어진다.

표준 에러 코드: `-32700`(파싱 실패), `-32600`(잘못된 요청), `-32601`(메서드 없음), `-32602`(잘못된 파라미터), `-32603`(내부 오류). `-32000`~`-32099`는 서버 구현이 정의하는 영역인데, MCP는 이 대역을 다시 쪼개 쓴다([03-messages-meta.md](03-messages-meta.md)).

**더 알아보기**: [JSON-RPC 2.0 명세](https://www.jsonrpc.org/specification)

## 필수 개념 2: SSE (Server-Sent Events)

HTTP 응답을 즉시 끝내지 않고 열어둔 채, 서버가 `text/event-stream` 형식으로 이벤트를 계속 흘려보내는 표준이다. WebSocket과 달리 **단방향(서버→클라이언트)**이고, 별도 프로토콜 업그레이드 없이 평범한 HTTP 응답이다.

MCP의 Streamable HTTP 전송에서 서버는 요청 하나에 대해 "단일 JSON으로 답할지, SSE 스트림으로 답할지"를 요청마다 선택한다. SSE를 고르면 진행 알림 여러 개 → 최종 응답 순서로 흘려보내고 스트림을 닫는다. 콜론(`:`)으로 시작하는 줄은 SSE 표준상 주석(keep-alive용)이며 클라이언트는 무시해야 한다.

**더 알아보기**: [MDN Server-Sent Events](https://developer.mozilla.org/docs/Web/API/Server-sent_events)

## 필수 개념 3: JSON Schema (2020-12)

JSON 데이터의 구조를 JSON으로 선언하는 표준. MCP에서는 도구의 `inputSchema`/`outputSchema`, elicitation의 `requestedSchema`가 전부 JSON Schema다.

```json
{
  "type": "object",
  "properties": {
    "location": { "type": "string", "description": "도시 이름" },
    "units": { "type": "string", "enum": ["metric", "imperial"] }
  },
  "required": ["location"]
}
```

알아둘 것: (1) MCP의 기본 방언(dialect)은 **2020-12**이고, `$schema` 필드로 다른 방언을 명시할 수 있다. (2) `$ref`는 다른 스키마를 참조하는 키워드인데, 네트워크 URI를 가리키는 `$ref`를 자동으로 따라가면 SSRF 통로가 되므로 MCP는 이를 금지한다. (3) `anyOf`/`allOf` 같은 조합 키워드는 검증 비용이 커서 악성 스키마가 DoS 수단이 될 수 있다 — 그래서 구현에 깊이·개수 제한을 요구한다. 상세는 [03-messages-meta.md](03-messages-meta.md).

**더 알아보기**: [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema)

## 필수 개념 4: OAuth 2.1 — authorization code + PKCE

[10-authorization.md](10-authorization.md)를 읽기 위한 최소한만 여기서 잡는다.

**등장인물**: 리소스 서버(RS, 보호된 API), 인가 서버(AS, 토큰 발급자), 클라이언트(토큰을 받아 RS에 접근), 리소스 소유자(사용자).

**authorization code 흐름**: 클라이언트가 사용자를 브라우저로 AS의 `/authorize`에 보낸다 → 사용자가 로그인·동의 → AS가 클라이언트의 `redirect_uri`로 **인가 코드**를 리다이렉트 → 클라이언트가 코드를 AS의 `/token`에 제출해 **액세스 토큰**으로 교환 → 이후 `Authorization: Bearer <토큰>` 헤더로 RS 호출.

**PKCE**가 필요한 이유: 인가 코드는 브라우저 리다이렉트를 거치므로 탈취될 수 있다. 클라이언트가 임의의 비밀(`code_verifier`)을 만들고 그 해시(`code_challenge`, S256)를 인가 요청에 실어 보내면, 토큰 교환 때 원본 verifier를 제시해야 한다. 코드를 훔친 공격자는 verifier가 없어 토큰으로 못 바꾼다. OAuth 2.1은 PKCE를 사실상 기본으로 요구한다.

**용어 두 개 더**: **scope**(토큰이 허용하는 권한 범위 문자열), **audience**(토큰이 "어느 리소스 서버용"인지 — MCP 보안의 중심 개념. `resource` 파라미터(RFC 8707)로 요청하고 서버가 검증한다).

**더 알아보기**: [OAuth 2.1 draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13)

## 필수 개념 5: LLM 도구 호출 (function calling)

LLM API에 도구 정의(이름·설명·입력 스키마)를 주면, 모델이 답변 대신 "이 도구를 이 인자로 불러라"라는 구조화된 요청을 내놓는다. 애플리케이션이 실제 실행을 담당하고 결과를 대화에 다시 넣으면 모델이 이어서 답한다. MCP의 Tools는 이 관행을 **애플리케이션-서버 간 표준 인터페이스**로 끌어올린 것이다 — 도구 정의를 어디서 가져오고(`tools/list`), 실행을 누가 하고(`tools/call`), 결과가 어떤 형태인지를 프로토콜이 정한다.

## 자가 진단

다음 질문에 답할 수 있으면 다음 파일로. 각 질문을 먼저 답해본 뒤 ▶ 토글을 열어 비교.

<details>
<summary>Q1: JSON-RPC 알림(notification)에 응답하면 안 되는 이유를 구조적으로 설명하면?</summary>

**즉답 예시**: 알림에는 `id`가 없다. JSON-RPC의 응답은 `id`로 요청과 매칭되는데, 매칭할 키 자체가 없으므로 응답이라는 개념이 성립하지 않는다. 그래서 명세도 "수신자는 응답을 보내서는 안 된다(MUST NOT)"로 못박는다.

</details>

<details>
<summary>Q2: PKCE는 어떤 공격을 막고, 어떻게 막는가?</summary>

**즉답 예시**: 인가 코드 탈취·주입 공격. 클라이언트가 비밀 `code_verifier`를 만들고 해시(`code_challenge`)만 인가 요청에 보낸다. 토큰 교환 시 원본 verifier를 제시해야 AS가 토큰을 내주므로, 리다이렉트 도중 코드만 훔친 공격자는 토큰으로 교환할 수 없다.

</details>

<details>
<summary>Q3: SSE와 WebSocket의 결정적 차이는? MCP가 SSE를 쓰는 자리는 어디인가?</summary>

**즉답 예시**: SSE는 평범한 HTTP 응답을 열어둔 단방향(서버→클라이언트) 스트림이고, WebSocket은 프로토콜 업그레이드가 필요한 양방향 채널이다. MCP Streamable HTTP에서 서버는 POST 요청에 대한 응답으로 단일 JSON 또는 그 요청에 스코프된 SSE 스트림을 선택할 수 있고, `subscriptions/listen`의 응답 스트림도 SSE다.

</details>

<details>
<summary>Q4: 도구의 `inputSchema`에 `required: ["location"]`이 있는데 클라이언트가 location 없이 호출하면 어떤 계층에서 잡혀야 하는가?</summary>

**즉답 예시**: 서버가 입력을 스키마로 검증해야 한다. MCP에서 이런 실패는 상황에 따라 프로토콜 오류(-32602) 또는 도구 실행 오류(`isError: true`)로 보고되는데, 그 구분 기준(모델이 스스로 고칠 수 있는가)은 [06-tools.md](06-tools.md)에서 다룬다.

</details>
