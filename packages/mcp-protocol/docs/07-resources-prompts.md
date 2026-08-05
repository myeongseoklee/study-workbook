# 리소스와 프롬프트 — 컨텍스트 데이터와 사용자 템플릿

## 학습 목표

리소스의 URI 체계·템플릿·어노테이션을 이해하고, "리소스 없음"의 에러 규칙(신·구 코드)을 안다. 프롬프트가 왜 "사용자 제어"이고 어떤 구조로 메시지를 돌려주는지 설명할 수 있다.

## 선수 지식

- [02-core-principles.md](02-core-principles.md)의 프리미티브 제어 주체
- [06-tools.md](06-tools.md)의 리스트 불변식 (리소스·프롬프트에도 동일 적용)

## 핵심 원리 (WHY)

**리소스는 애플리케이션 제어(application-driven)다.** 서버는 "이런 데이터가 있다"고 목록·내용만 제공하고, 그걸 언제 어떻게 모델 컨텍스트에 넣을지는 호스트 앱이 정한다 — 트리뷰로 사용자에게 고르게 하든, 임베딩 검색으로 일부만 뽑든, 통째로 넣든. 도구와 대비하면: 도구는 "모델이 능동적으로 실행", 리소스는 "앱이 수동적 데이터를 골라 공급"이다.

**프롬프트는 사용자 제어(user-controlled)다.** 서버 제작자가 자기 도메인의 모범 사용법을 템플릿으로 담아 노출하고, 사용자가 슬래시 커맨드·메뉴로 명시적으로 발동한다. 제어 주체는 "사용 시점 결정자"다 — 내용은 서버가 쓴다.

## 필수 지식 (HOW)

### 리소스 능력과 메서드

```json
{ "capabilities": { "resources": { "listChanged": true, "subscribe": true } } }
```

`listChanged`(목록 변경 알림)와 `subscribe`(개별 리소스 갱신 알림 — `subscriptions/listen`의 `resourceSubscriptions` 필터 지원) 두 옵션은 **독립적** — 하나만, 둘 다, 둘 다 아님 모두 가능.

| 메서드 | 역할 | 부가 |
|---|---|---|
| `resources/list` | 직접(고정 URI) 리소스 목록 | 페이지네이션·캐시 지원 |
| `resources/templates/list` | URI 템플릿(RFC 6570) 목록 | 페이지네이션·캐시 지원 |
| `resources/read` | URI로 내용 읽기 | 캐시·MRTR 지원. 한 요청에 여러 contents 반환 가능(디렉토리 읽기 등) |

리스트 불변식(연결·부수효과로 불변, 인가로는 가변)은 도구와 동일하다.

### 리소스 정의와 내용

정의: `uri`(유일 식별자), `name`, `title?`, `description?`, `mimeType?`, `size?`(바이트), `icons?`.

내용은 텍스트(`text`) 또는 바이너리(`blob` — base64) 중 하나 + `uri`·`mimeType`.

**URI 스킴**: `https://`는 **클라이언트가 직접 웹에서 가져올 수 있을 때만** 쓴다(SHOULD) — 서버를 거쳐야 읽히는 것이면 커스텀 스킴을 쓰라(서버가 내부적으로 인터넷에서 받아오더라도). `file://`은 파일시스템처럼 행동하는 리소스(실제 물리 FS일 필요 없음. 디렉토리 같은 비정규 파일은 XDG MIME `inode/directory`). `git://`은 버전 관리. 커스텀 스킴은 RFC 3986 준수.

**템플릿**: `uriTemplate: "weather://forecast/{city}/{date}"` 식의 파라미터화. 인자는 completion API로 자동완성 가능([09](09-subscriptions-utilities.md)). 템플릿이 있으면 클라이언트는 무한한 리소스 공간을 유한한 목록으로 발견한다.

**어노테이션** (리소스·템플릿·콘텐츠 블록·도구/프롬프트 콘텐츠 공용):
- `audience`: `["user"]`, `["assistant"]`, 또는 둘 다 — 누구 보라고 만든 데이터인가
- `priority`: 0.0(완전 선택) ~ 1.0(사실상 필수) — 컨텍스트에 넣을 우선순위
- `lastModified`: ISO 8601 — 최신성 정렬·표시

클라이언트는 이걸로 "assistant용 우선순위 0.8 이상만 컨텍스트에 자동 포함" 같은 정책을 만들 수 있다.

### 리소스 에러 규칙

없는 리소스 → **`-32602`(Invalid params)** (MUST). 내부 오류는 `-32603`. 구버전 서버는 `-32002`를 내므로 클라이언트는 그것도 수용(SHOULD). 그리고 **없는 리소스에 빈 `contents` 배열로 답하면 안 된다**(MUST NOT) — 빈 배열은 "존재하는데 내용이 없음"과 "존재하지 않음"을 구분 못 하게 만드는 모호함이다.

보안: URI 검증 필수, `file://` 서빙 시 **경로 순회(directory traversal) 방어** 필수, 민감 리소스 접근 통제.

### 구독 — 개별 리소스 감시

`subscriptions/listen`의 `resourceSubscriptions: ["file:///project/config.json"]` 필터로 구독하면, 변경 시 그 스트림으로 `notifications/resources/updated`(+`uri`)가 온다 → 클라이언트가 `resources/read`로 다시 읽는다. (구 `resources/subscribe` RPC는 제거됨. 역학은 [09](09-subscriptions-utilities.md).)

### 프롬프트

```json
{ "capabilities": { "prompts": { "listChanged": true } } }
```

| 메서드 | 반환 |
|---|---|
| `prompts/list` | 프롬프트 서술자 배열 (`name`, `title?`, `description?`, `arguments?`, `icons?`) — 페이지네이션·캐시 |
| `prompts/get` | `description` + **`messages` 배열** — 인자가 치환된 완성 메시지들. MRTR 지원 |

`arguments`는 `[{ name, description?, required? }]` 목록이고 completion API로 자동완성 가능. `prompts/get`의 응답 메시지는 `role`("user"/"assistant") + `content`이며, content 타입은 text / image / audio / resource_link / **embedded resource**(서버 관리 문서·코드 샘플을 대화에 직접 임베드) — 도구 결과와 같은 팔레트다.

에러: 없는 프롬프트 이름·필수 인자 누락 → `-32602`, 내부 오류 → `-32603`.

### 세 프리미티브의 조합 (여행 플래너 예)

사용자가 "Plan a vacation" **프롬프트**를 인자(목적지·기간·예산)와 함께 발동 → 앱이 **리소스**(캘린더, 과거 여행 기록)를 골라 컨텍스트로 첨부 → 모델이 **도구**(searchFlights, bookHotel, createCalendarEvent)를 순차 호출하며 사용자 승인을 받아 완주. 프리미티브마다 제어 주체가 달라서 이 흐름의 각 단계에 "누가 결정하나"가 명확하다.

## 우리 작업과의 연결

"파일 내용을 모델에 주고 싶다"는 요구가 오면: 모델이 필요할 때 스스로 찾게 하려면 read_file **도구**, 앱·사용자가 골라 붙이게 하려면 **리소스**가 맞다. 반복되는 워크플로우 지시문은 프롬프트로 — cc-system의 슬래시 커맨드가 정확히 이 자리다.

### ⚠️ 암기 필수

- [ ] **리소스 없음 = `-32602`** (구버전 `-32002`는 수신 수용), **빈 contents로 얼버무리기 금지**. `file://` 서빙 시 경로 순회 방어 필수
  - 이유: 진단 신호(코드 겹침 주의)이자, 리소스 서버에서 가장 흔한 두 구현 실수
- [ ] **어노테이션 3종**: `audience`(user/assistant) / `priority`(0~1, 1=사실상 필수) / `lastModified`(ISO 8601)
  - 이유: 클라이언트의 컨텍스트 자동 선별 정책이 이 세 필드 위에 세워진다

## 자가 진단

<details>
<summary>Q1: 서버가 내려받아 가공해서 주는 웹 문서를 리소스로 노출할 때 https:// URI를 쓰면 왜 안 되나?</summary>

**즉답 예시**: `https://` 스킴은 "클라이언트가 서버 없이 직접 그 URL에서 받아도 된다"는 신호다(SHOULD). 서버 가공을 거쳐야 의미가 있는 리소스에 https를 쓰면 클라이언트가 원본을 직접 fetch해서 다른 내용을 얻을 수 있다. 서버가 내부적으로 인터넷에서 받아오더라도 커스텀 스킴(예: `docs://…`)을 쓰라는 게 명세 지침이다.

</details>

<details>
<summary>Q2: resources 능력에서 listChanged와 subscribe의 차이는?</summary>

**즉답 예시**: `listChanged`는 "리소스 **목록**이 바뀌었다"(추가·삭제)는 `notifications/resources/list_changed`를 보낼 수 있다는 뜻이고, `subscribe`는 특정 URI들을 `resourceSubscriptions` 필터로 감시하면 **개별 리소스 내용 변경** 시 `notifications/resources/updated`를 보낼 수 있다는 뜻이다. 둘은 독립적으로 선언한다.

</details>

<details>
<summary>Q3: 도구 결과의 resource_link와 embedded resource의 차이, 그리고 resource_link의 함정은?</summary>

**즉답 예시**: embedded resource는 내용(text/blob)을 결과에 직접 담고, resource_link는 URI만 줘서 클라이언트가 필요하면 읽게(또는 구독하게) 한다. 함정: 도구가 돌려준 resource_link가 `resources/list`에 나타난다는 보장이 없다 — 목록은 발견용 카탈로그일 뿐 링크의 전집합이 아니다.

</details>

<details>
<summary>Q4: 프롬프트가 "사용자 제어"라는 말은 사용자가 프롬프트 내용을 작성한다는 뜻인가?</summary>

**즉답 예시**: 아니다. 내용은 서버가 정의한다. "사용자 제어"는 **사용 시점을 사용자가 명시적으로 결정**한다는 뜻이다 — 모델이 임의로 프롬프트를 발동하지 않고, 슬래시 커맨드·메뉴 선택처럼 사용자의 의도적 행위로 발동된다.

</details>

## 공식 문서

- [Resources (spec)](https://modelcontextprotocol.io/specification/2026-07-28/server/resources) — URI 스킴, 어노테이션, 에러 규칙
- [Prompts (spec)](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts) — 메시지 구조, 인자
- [Server concepts](https://modelcontextprotocol.io/docs/2026-07-28/learn/server-concepts) — 멀티 서버 조합 예제
