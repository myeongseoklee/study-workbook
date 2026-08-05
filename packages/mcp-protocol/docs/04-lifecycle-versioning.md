# 수명주기와 버전 관리 — server/discover, 협상, 두 세대의 공존

## 학습 목표

핸드셰이크 없는 세계에서 클라이언트와 서버가 버전·능력을 합의하는 방식을 설명할 수 있고, 레거시(initialize 기반) 상대와 만났을 때의 감지·폴백 전략을 전송별로 그릴 수 있다.

## 선수 지식

- [03-messages-meta.md](03-messages-meta.md)의 `_meta` 필수 필드, `-32022`

## 핵심 원리 (WHY)

### 버전 문자열이 날짜인 이유

MCP 버전은 `YYYY-MM-DD` — **마지막으로 하위 호환이 깨진 날짜**다. 하위 호환을 유지하는 변경으로는 버전이 올라가지 않는다. semver처럼 "기능 추가마다 minor 올림"이 아니라, "이 날짜 이후 개정은 전부 호환"이라는 계약이다. 리비전 상태는 Draft(작성 중) / **Current**(현재 = `2026-07-28`) / Final(동결).

### 협상 핸드셰이크가 없는 이유

레거시 MCP는 `initialize` 요청 ↔ 응답 ↔ `notifications/initialized`로 세션을 열고 버전·능력을 한 번 합의했다. 무상태 전환으로 그 "합의된 상태"를 저장할 곳이 사라졌다. 대신 **모든 요청이 자기 버전을 선언하고, 서버가 요청 단위로 수락/거부한다**. 협상은 사라진 게 아니라 낙관적 재시도로 바뀐 것이다: 일단 선호 버전으로 보내고, `-32022`가 오면 서버가 알려준 `supported` 목록에서 골라 재시도.

### 기능에도 수명주기가 있다

리비전과 별개로 개별 기능이 **Deprecated** 상태로 갈 수 있다(feature lifecycle 정책). Deprecated 기능은 명세에 남지만 신규 채택 금지 + 마이그레이션 경로 문서화 + **최소 12개월**(긴급 예외 시 90일) 유예 후 Removed 후보가 된다. `2026-07-28`의 Deprecated 목록은 아래 표.

## 필수 지식 (HOW)

### server/discover — 유일한 필수 RPC

서버는 `server/discover`를 **반드시 구현**한다(MUST). 응답:

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": { "tools": { "listChanged": true }, "resources": {} },
  "_meta": { "io.modelcontextprotocol/serverInfo": { "name": "example", "version": "1.0.0" } },
  "instructions": "LLM에게 주는 이 서버 사용 안내 (선택)",
  "ttlMs": 3600000,
  "cacheScope": "public"
}
```

클라이언트 입장에서 **호출은 선택**이다. 아무 RPC나 바로 보내고 `-32022`를 처리해도 된다. 그럼에도 유용한 두 장면: (1) 서버 정보·능력·버전을 한 방에 얻어 UI에 표시 (tools/list·prompts/list·resources/list를 따로 찔러볼 필요 없음), (2) **stdio에서 레거시 서버 감지 프로브** (아래). 응답은 캐시 가능(`ttlMs`).

능력(capabilities) 방향 정리: **서버 능력**은 `server/discover` 응답으로 광고하고, **클라이언트 능력**은 매 요청 `_meta.clientCapabilities`로 선언한다. 양쪽 다 "선언한 것만 쓸 수 있다" — 서버가 미선언 능력에 의존하면 `-32021`.

### 버전 협상 흐름

1. 클라이언트가 선호 버전을 `_meta`(+ HTTP면 `MCP-Protocol-Version` 헤더)에 실어 요청
2. 서버가 그 버전 미지원이면 `-32022` + `data.supported: [...]`
3. 클라이언트는 교집합에서 골라 재시도, 없으면 사용자에게 에러 표시

클라이언트·서버 모두 **여러 버전 동시 지원 가능**(MAY). 요청마다 다른 버전이어도 된다 — 버전은 연결 속성이 아니라 요청 속성이다.

### 확장(extension) 협상

능력 객체의 `extensions` 맵으로 광고한다. 키는 `_meta` 키 규칙을 따르는 식별자(프리픽스 필수), 값은 확장별 설정 객체(빈 객체 = 설정 없는 지원).

```json
{ "capabilities": { "tools": {}, "extensions": { "io.modelcontextprotocol/tasks": {} } } }
```

한쪽만 지원하면: 지원하는 쪽이 **코어 동작으로 물러나거나 명시적 에러로 거부**해야 한다(MUST). 대표 확장: Tasks(장기 실행 폴링), MCP Apps(인라인 UI), Skills over MCP.

### 두 세대(era)의 공존

| 용어 | 정의 |
|---|---|
| **Modern** | 요청별 메타데이터 방식 — `2026-07-28` 이후 |
| **Legacy** | `initialize` 핸드셰이크로 세션 수립 — `2025-11-25` 이하 |
| **Dual-era** | 둘 다 구현한 쪽 |

**세대 감지는 서버의 속성이지 요청의 속성이 아니다** — 판정 결과를 서버 프로세스(stdio)/오리진(HTTP) 수명 동안 캐시하고, 재시작 후 재사용해도 된다(실패하면 재프로브).

**stdio에서의 감지** (dual-era 클라이언트): 다른 요청 전에 `server/discover` 프로브를 보낸다(SHOULD).
- `DiscoverResult` 반환 → modern. 계속.
- `UnsupportedProtocolVersionError` 같은 **인식 가능한 modern 에러** → modern이되 버전만 안 맞음. `supported`에서 골라 재시도. **initialize로 폴백하지 말 것.**
- 그 외 에러(-32601 등 아무 거나) 또는 타임아웃 → legacy. `initialize`로 폴백.
- 폴백 판정을 특정 에러 코드 하나에 걸지 말 것(MUST NOT) — 레거시 서버의 에러는 구현마다 다르고 아예 침묵할 수도 있다.

modern 전용 클라이언트도 프로브가 권장되는 이유: 일부 레거시 서버는 initialize 전 검증을 안 해서 `tools/call` 같은 세대 모호 메서드를 **레거시 의미론으로 그냥 처리**해버린다. 프로브는 결정적 실패를 보장한다.

**HTTP에서의 감지**: 일단 modern 요청을 보내고, `400`이 오면 **본문을 먼저 확인**한다. 인식 가능한 modern JSON-RPC 에러(-32020/21/22)면 modern 서버이므로 교정·재시도, 본문이 비었거나 못 알아보겠으면 legacy로 폴백해 `initialize`(더 옛날 서버면 HTTP+SSE 전송까지 폴백).

**호환성 매트릭스 요약**: dual-era가 낀 조합은 전부 동작. Modern 클라이언트 × Legacy 서버 = 실패(감지 프로브로 결정적 에러라도 확보). Legacy 클라이언트 × Modern 서버 = 실패 — 레거시엔 fall-forward 수단이 없으므로, modern 전용 서버는 `initialize` 거부 에러 메시지에 자기가 지원하는 버전들을 적어줘야 한다(SHOULD, 그게 사용자가 볼 유일한 진단이다).

**Dual-era 서버**의 분기: 요청에 modern `_meta`가 실려 있으면 무상태로 서빙, `initialize`가 오면 그 협상된 레거시 리비전의 의미론으로 (stdio 프로세스/HTTP 세션 스코프). 같은 엔드포인트에서 동시 서빙 가능.

### Deprecated 레지스트리 (2026-07-28 기준)

| 기능 | 마이그레이션 경로 | 최단 제거 시점 |
|---|---|---|
| **Roots** | 디렉토리·파일을 도구 인자, 리소스 URI, 서버 설정으로 전달 | 2027-07-28 이후 첫 리비전 |
| **Sampling** | LLM 프로바이더 API 직접 통합 | 〃 |
| **Logging** | stdio는 stderr로, 관측은 OpenTelemetry로 | 〃 |
| **Dynamic Client Registration** | Client ID Metadata Documents ([10](10-authorization.md)) | 〃 |
| `includeContext: "thisServer"/"allServers"` | 필드 생략 또는 `"none"` | Sampling과 함께 |
| **HTTP+SSE 전송** (2024-11-05) | Streamable HTTP | SEP-2596 Final 후 3개월 |

`2026-07-28`에서 **아예 제거된 것**(deprecated가 아니라 삭제): `initialize` 핸드셰이크, `ping`, `logging/setLevel`, `notifications/roots/list_changed`, `resources/subscribe`/`unsubscribe`, HTTP GET 스트림, `Mcp-Session-Id`, SSE 재개(`Last-Event-ID`), 서버발 JSON-RPC 요청. 코어에서 확장으로 이동: Tasks.

## 우리 작업과의 연결

지금 시점의 실무 서버는 대부분 dual-era 전환기다. "내 서버가 Claude Desktop 구버전과 최신 Inspector 양쪽에서 동작해야 한다"면 dual-era 서버 패턴(요청 형태로 분기)이 답이고, 클라이언트를 만든다면 stdio 프로브 → 폴백 로직이 첫 구현 과제다. 코딩 과제 3-2가 정확히 이 판정 로직이다.

### ⚠️ 암기 필수

- [ ] **버전 협상 = 낙관적 재시도**: 요청마다 버전 선언 → 미지원이면 `-32022` + `data.supported` → 교집합 재시도. `server/discover`는 서버 구현 필수·클라이언트 호출 선택
  - 이유: 연결 실패의 최다 빈도 시나리오이고, "왜 initialize가 없지?"라는 혼란의 해답
- [ ] **세대 감지 규칙**: stdio = `server/discover` 프로브(인식 가능한 modern 에러면 modern — 폴백 금지 / 그 외·무응답이면 legacy). HTTP = 400 응답의 **본문**으로 판정. 판정은 서버 단위로 캐시
  - 이유: 폴백을 잘못 걸면 modern 서버를 legacy로 강등하거나(기능 손실), legacy 서버에 modern 요청을 계속 던진다(무한 실패)
- [ ] **Deprecated 4종 + 마이그레이션**: Roots→도구 인자·설정 / Sampling→LLM API 직접 / Logging→stderr·OTel / DCR→CIMD. 유예 최소 12개월
  - 이유: 신규 구현에서 뭘 쓰면 안 되는지가 곧 설계 결정. 리뷰에서 가장 자주 걸러야 할 항목

## 자가 진단

<details>
<summary>Q1: stdio 프로브에서 서버가 -32601(method not found)을 돌려줬다. modern인가 legacy인가? -32022였다면?</summary>

**즉답 예시**: `-32601`은 "인식 가능한 modern 에러"가 아니므로 legacy로 판정하고 `initialize`로 폴백한다(레거시 서버는 모르는 pre-initialize 요청에 -32601/-32602 등 구현 정의 에러를 낸다). `-32022`는 modern 서버가 버전만 못 맞춘 것이므로 폴백하지 말고 `data.supported`에서 버전을 골라 modern으로 재시도한다.

</details>

<details>
<summary>Q2: 왜 세대 판정을 요청 단위가 아니라 서버 단위로 캐시하는가?</summary>

**즉답 예시**: 세대는 서버 구현의 속성이라 요청마다 변하지 않는다. 매 요청 프로브하면 왕복이 배로 들고, stdio 레거시 서버는 프로브에 침묵할 수 있어 타임아웃 대기가 반복된다. 그래서 프로세스(stdio)/오리진(HTTP) 수명 동안 캐시하고, 캐시된 가정이 어긋나면 재프로브한다.

</details>

<details>
<summary>Q3: modern 전용 서버가 initialize 요청을 받으면 그냥 -32601만 던지면 될까?</summary>

**즉답 예시**: 동작은 하지만 불친절하다. 레거시 클라이언트는 fall-forward 수단이 없어서 그 에러 메시지가 사용자에게 보일 유일한 진단이다. 명세는 에러에 서버가 지원하는 프로토콜 버전들을 이름으로 적어주라고 권한다(SHOULD) — "이 서버는 2026-07-28 전용입니다, 클라이언트를 업데이트하세요"가 전달되도록.

</details>

<details>
<summary>Q4: 확장을 클라이언트만 지원하고 서버는 모른다. 클라이언트는 어떻게 동작해야 하나?</summary>

**즉답 예시**: 코어 프로토콜 동작으로 물러나거나, 그 기능이 확장 없이는 무의미하면 명시적 에러로 거부해야 한다(MUST 둘 중 하나). 확장은 양쪽이 capabilities.extensions로 서로 광고했을 때만 활성화되는 opt-in이고, 확장 문서가 폴백 동작을 정의해두는 것이 권장이다.

</details>

## 공식 문서

- [Versioning and Compatibility (spec)](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning) — 협상, 확장, 호환성 매트릭스
- [Versioning (docs)](https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning) — 날짜 버전, 리비전 상태, 기능 상태
- [Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) — server/discover 규격
- [Key Changes (changelog)](https://modelcontextprotocol.io/specification/2026-07-28/changelog) — 이 리비전의 전체 변경
- [Deprecated Features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated) — 퇴역 레지스트리
