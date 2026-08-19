# 용어 해설집 — 4개 레이어로 구조화

학습 자료 [01]~[12]에 등장한 용어를, 단편적 사전이 아니라 **개념의 인과 구조**로 정리한다.

## 전체 지도

```
│ L4  신뢰와 인가       OAuth 2.1 · PRM · CIMD · audience · passthrough
│                       confused deputy
│
│ L3  기능(프리미티브)  tools · resources · prompts · elicitation
│                       MRTR · subscriptions
│
│ L2  프로토콜 코어     JSON-RPC · _meta · resultType · capability
│                       server/discover · era
│
│ L1  전송(바인딩)      stdio · Streamable HTTP · SSE
│                       헤더 미러링 · Origin 검증
```

아래(L1)로 갈수록 "바이트를 어떻게 나르나"에 가깝고, 위(L4)로 갈수록 "누구를 얼마나 믿나"에 가깝다. 각 레이어는 아래 레이어를 전제한다. **용어를 외울 게 아니라 이 인과의 흐름을 잡는 게 핵심이다.**

---

# L1. 전송 — 메시지를 어떻게 나르는가

## 핵심 인과 흐름

```
전송은 바인딩일 뿐 (의미는 상위 레이어)
   ↓ 로컬 프로세스라면
stdio: 개행 구분 JSON-RPC, stdout은 프로토콜 전용
   ↓ 원격·다중 클라이언트라면
Streamable HTTP: 요청마다 POST, 응답은 JSON 또는 SSE
   ↓ 중간 장비가 본문을 못 읽으니
헤더 미러링 (Mcp-*)
   ↓ 미러가 생기면 불일치 검증이 따라오니
HeaderMismatch (-32020)
```

## 용어

### **transport / binding (전송/바인딩)**
- **정의**: 메시지의 프레이밍·전달·취소·종료 방법만 정하는 계층 — 의미는 정하지 않는다.
- **인접**: → stdio, Streamable HTTP, 커스텀 전송
- **본문 위치**: [05-transports.md](05-transports.md)

### **stdio 전송**
- **정의**: 클라이언트가 서버를 서브프로세스로 띄워 stdin/stdout으로 개행 구분 JSON-RPC를 주고받는 바인딩.
- **직관**: stdout에 프로토콜 외 출력 한 줄이면 서버가 깨진다. 로그는 stderr로.
- **인접**: → 커스텀 전송(같은 프레이밍 재사용 권장), Origin 검증(HTTP 전용이라 무관)
- **본문 위치**: [05-transports.md](05-transports.md)

### **Streamable HTTP** ⭐
- **정의**: 단일 MCP 엔드포인트에 요청마다 POST하고, 응답을 단일 JSON 또는 요청 스코프 SSE 스트림으로 받는 바인딩.
- **직관**: 2026-07-28에서 세션·GET 스트림·재개가 전부 빠지고 "POST 하나 = 대화 하나"로 단순화됐다.
- **인접**: → SSE, 헤더 미러링, subscriptions/listen(장수 스트림도 이 위에)
- **본문 위치**: [05-transports.md](05-transports.md)

### **SSE (Server-Sent Events)**
- **정의**: HTTP 응답을 열어둔 채 서버가 이벤트를 흘려보내는 단방향 스트림 표준.
- **인접**: → Streamable HTTP, HTTP+SSE 전송(2024-11-05의 구식 — deprecated, 다른 것)
- **본문 위치**: [01-prerequisites.md](01-prerequisites.md)

### **헤더 미러링 (Mcp-Method / Mcp-Name / Mcp-Param-*)**
- **정의**: 본문(`_meta`·params)의 일부를 HTTP 헤더로 복제해 중간 장비가 본문 파싱 없이 라우팅하게 하는 규약.
- **직관**: 본문이 진실 원천 — 서버는 일치를 검증하고 불일치를 `-32020`으로 거부한다. `x-mcp-header`로 도구 인자도 미러링 가능.
- **인접**: → HeaderMismatch(-32020), Base64 센티널(`=?base64?…?=`)
- **본문 위치**: [05-transports.md](05-transports.md)

### **Origin 검증 / DNS 리바인딩**
- **정의**: 악성 웹페이지가 도메인의 DNS를 로컬 주소로 바꿔 브라우저로 로컬 서버를 조작하는 공격(리바인딩)과, 그 방어(Origin 헤더 검증, 무효면 403).
- **인접**: → 로컬 서버 침해, 127.0.0.1 바인딩
- **본문 위치**: [05-transports.md](05-transports.md), [11-security.md](11-security.md)

---

# L2. 프로토콜 코어 — 대화의 문법

## 핵심 인과 흐름

```
무상태 결정 (수평 확장·재시도 단순화)
   ↓ 핸드셰이크로 만들던 "합의 상태"가 사라짐
_meta에 버전·능력을 매 요청 携帯
   ↓ 서버가 요청 단위로 수락/거부
UnsupportedProtocolVersionError로 협상 (낙관적 재시도)
   ↓ 구세계(initialize)와 공존해야 함
era 감지 (프로브/400 본문) → dual-era
```

## 용어

### **무상태 (statelessness)** ⭐
- **정의**: 요청 처리에 필요한 모든 정보가 요청 안에 있고, 서버가 이전 요청에서 아무것도 추론하지 않는 성질.
- **직관**: "연결 ≠ 세션". 상태가 필요하면 명시적 핸들로.
- **인접**: → `_meta`, 상태 핸들, MRTR(requestState), 캐싱
- **본문 위치**: [02-core-principles.md](02-core-principles.md)

### **`_meta`**
- **정의**: 요청·응답에 붙는 메타데이터 컨테이너. 예약 키는 reverse DNS 프리픽스 규칙.
- **직관**: 핸드셰이크의 대체물 — `protocolVersion`·`clientCapabilities`(필수)·`clientInfo`(권장)가 여기 탄다.
- **인접**: → progressToken, subscriptionId, traceparent(OTel 예외)
- **본문 위치**: [03-messages-meta.md](03-messages-meta.md)

### **capability (능력)**
- **정의**: 지원 기능의 선언 — 서버는 `server/discover` 응답으로, 클라이언트는 매 요청 `_meta`로.
- **직관**: "선언한 것만 쓸 수 있다". 미선언 능력에 의존하면 `-32021`.
- **인접**: → extensions(능력 안의 확장 맵), listChanged/subscribe(능력의 하위 옵션)
- **본문 위치**: [04-lifecycle-versioning.md](04-lifecycle-versioning.md)

### **resultType**
- **정의**: 모든 result에 필수인 타입 태그. `"complete"` 또는 `"input_required"`.
- **직관**: 부재 = complete(구버전 호환), 미지 = invalid.
- **인접**: → InputRequiredResult, MRTR
- **본문 위치**: [03-messages-meta.md](03-messages-meta.md)

### **server/discover**
- **정의**: 서버의 지원 버전·능력·정체성을 한 번에 돌려주는, 서버 구현 필수 RPC.
- **직관**: 클라이언트 호출은 선택 — UI 표시용 일괄 조회와 stdio 세대 프로브가 주 용도.
- **인접**: → 버전 협상, era 감지, 캐싱(ttlMs)
- **본문 위치**: [04-lifecycle-versioning.md](04-lifecycle-versioning.md)

### **era (세대: modern / legacy / dual-era)** ⭐
- **정의**: modern = 요청별 메타데이터(2026-07-28~), legacy = initialize 핸드셰이크(2025-11-25 이하), dual-era = 양쪽 구현.
- **직관**: 감지 규칙 — stdio는 프로브, HTTP는 400 본문. "인식 가능한 modern 에러 = modern, 폴백 금지".
- **인접**: → server/discover, UnsupportedProtocolVersionError, Inspector의 protocolEra 설정
- **본문 위치**: [04-lifecycle-versioning.md](04-lifecycle-versioning.md)

### **feature lifecycle (기능 수명주기)**
- **정의**: 개별 기능의 Active → Deprecated(최소 12개월, 마이그레이션 문서화) → Removed 상태 정책.
- **인접**: → Deprecated 4종(Roots·Sampling·Logging·DCR)
- **본문 위치**: [04-lifecycle-versioning.md](04-lifecycle-versioning.md)

### **extension (확장)**
- **정의**: 코어 밖의 선택 기능. 능력의 `extensions` 맵으로 양쪽이 광고해야 활성화.
- **직관**: 한쪽만 지원하면 코어 동작으로 후퇴 또는 명시적 에러. 예: Tasks, MCP Apps.
- **본문 위치**: [04-lifecycle-versioning.md](04-lifecycle-versioning.md)

---

# L3. 기능 — 서버와 클라이언트가 주고받는 것

## 핵심 인과 흐름

```
서버가 노출: tools(모델 제어) · resources(앱 제어) · prompts(사용자 제어)
   ↓ 처리 중 서버에 입력이 부족하면 (서버발 요청은 금지므로)
MRTR: input_required + inputRequests + requestState → 재시도
   ↓ 입력의 출처가 사용자라면
elicitation (form: 평평한 스키마 / url: 대역외)
   ↓ 변경을 계속 알고 싶다면
subscriptions/listen (opt-in 필터 → ack → subscriptionId 태깅)
   ↓ 알림 사이의 낭비를 줄이려고
caching (ttlMs / cacheScope) + pagination (불투명 커서)
```

## 용어

### **tool (도구)** ⭐
- **정의**: 모델이 발견·호출을 결정하는 실행 함수. `inputSchema` 필수, `outputSchema` 선택.
- **직관**: 오류 2계층(프로토콜 vs `isError: true`)이 설계의 핵심 — 기준은 "모델이 고쳐 재시도 가능한가".
- **인접**: → structuredContent, annotations(untrusted!), 상태 핸들, x-mcp-header
- **본문 위치**: [06-tools.md](06-tools.md)

### **resource (리소스)**
- **정의**: URI로 식별되는 읽기용 컨텍스트 데이터. 직접 리소스와 URI 템플릿(RFC 6570) 두 발견 경로.
- **직관**: 없는 리소스 = `-32602`(구 -32002 수신 수용), 빈 contents로 얼버무리기 금지.
- **인접**: → annotations(audience/priority/lastModified), URI 스킴(https는 직접 fetch 가능할 때만)
- **본문 위치**: [07-resources-prompts.md](07-resources-prompts.md)

### **prompt (프롬프트)**
- **정의**: 사용자가 명시적으로 발동하는 서버 정의 템플릿. `prompts/get`이 인자 치환된 메시지 배열을 반환.
- **인접**: → completion(인자 자동완성), embedded resource
- **본문 위치**: [07-resources-prompts.md](07-resources-prompts.md)

### **MRTR (Multi Round-Trip Requests)** ⭐
- **정의**: 서버가 `input_required` 결과로 필요 입력을 알리고, 클라이언트가 입력을 모아 원 요청을 새 id로 재시도하는 패턴. 서버발 요청의 대체물.
- **직관**: 무상태에서 다회 왕복을 성립시키는 장치 — 서버의 문맥은 requestState에 실려 클라이언트를 왕복한다.
- **인접**: → InputRequiredResult, requestState, elicitation/sampling/roots
- **본문 위치**: [08-mrtr-client-features.md](08-mrtr-client-features.md)

### **requestState**
- **정의**: 서버만 해석하는 불투명 문자열. 클라이언트는 검사·수정 없이 에코.
- **직관**: 공격자 통제 입력 — 로직에 영향을 주면 HMAC/AEAD + 주체·TTL·요청 바인딩 필수.
- **인접**: → 무상태, replay 방어
- **본문 위치**: [08-mrtr-client-features.md](08-mrtr-client-features.md)

### **elicitation**
- **정의**: 서버가 사용자에게서 정보를 요청하는 클라이언트 기능. form(구조화, 평평한 원시 타입 스키마) / url(대역외) 두 모드.
- **직관**: 비밀은 form 금지 → url로. 응답은 accept/decline/cancel 3액션. accept ≠ 완료(url 모드).
- **인접**: → MRTR, 피싱 방어(사용자 동일성), 서드파티 OAuth 패턴
- **본문 위치**: [08-mrtr-client-features.md](08-mrtr-client-features.md)

### **sampling (샘플링)** — deprecated
- **정의**: 서버가 클라이언트의 LLM에서 완성을 받아오던 기능. 도구 동반 샘플링(tools + toolChoice)까지 있었다.
- **직관**: 퇴역 — LLM 프로바이더 API 직접 통합으로 마이그레이션.
- **본문 위치**: [08-mrtr-client-features.md](08-mrtr-client-features.md)

### **roots (루트)** — deprecated
- **정의**: 클라이언트가 서버에 알려주던 작업 디렉토리 경계(`file://` URI). 접근 통제가 아니라 안내.
- **직관**: 퇴역 — 디렉토리를 도구 인자·설정으로 전달.
- **본문 위치**: [08-mrtr-client-features.md](08-mrtr-client-features.md)

### **subscriptions/listen** ⭐
- **정의**: opt-in 필터로 여는 장수 알림 스트림. ack가 첫 메시지, 모든 알림에 subscriptionId(=요청 id).
- **직관**: 재연결하면 재구독 — 서버는 구독 상태를 기억하지 않는다. 알림은 best effort.
- **인접**: → 필터 4종, graceful closure(빈 result), 캐시 무효화
- **본문 위치**: [09-subscriptions-utilities.md](09-subscriptions-utilities.md)

### **ttlMs / cacheScope**
- **정의**: 결과 신선도 힌트(ms)와 캐시 공유 범위(public/private). 6개 오퍼레이션에 의무.
- **직관**: HTTP Cache-Control의 MCP판. private = 인가 컨텍스트 넘어 공유 금지.
- **인접**: → list_changed(즉시 무효화), 페이지네이션(페이지별 독립)
- **본문 위치**: [09-subscriptions-utilities.md](09-subscriptions-utilities.md)

### **cursor (커서)**
- **정의**: 페이지네이션의 불투명 위치 토큰. 파싱·수정 금지, 빈 문자열도 유효.
- **본문 위치**: [09-subscriptions-utilities.md](09-subscriptions-utilities.md)

### **progressToken**
- **정의**: 진행 알림을 받겠다는 opt-in 토큰(요청 `_meta`). progress 값은 단조 증가.
- **본문 위치**: [09-subscriptions-utilities.md](09-subscriptions-utilities.md)

### **상태 핸들 (state handle)**
- **정의**: 무상태 서버가 크로스 호출 상태를 위해 발급하는 명시적 식별자(도구 결과 → 도구 인자로 왕복).
- **직관**: 소지 ≠ 인증. 난수 생성 + 주체 바인딩 + 만료.
- **인접**: → State Handle Hijacking
- **본문 위치**: [06-tools.md](06-tools.md), [11-security.md](11-security.md)

---

# L4. 신뢰와 인가 — 누구를 얼마나 믿는가

## 핵심 인과 흐름

```
사전 관계 없는 서버에 접속해야 함
   ↓ AS를 모른다 → 디스커버리
401 → PRM(RFC 9728) → AS 메타데이터(RFC 8414/OIDC)
   ↓ 등록돼 있지 않다 → 등록
CIMD(client_id = 자기 호스팅 URL) > DCR(deprecated)
   ↓ 코드 탈취·혼선 방어
PKCE(S256) + resource(RFC 8707) + iss(RFC 9207)
   ↓ 얻은 토큰의 오남용 방어
audience 검증 → passthrough 금지 → confused deputy 방어
```

## 용어

### **PRM (Protected Resource Metadata, RFC 9728)**
- **정의**: MCP 서버가 자기 인가 서버 위치 등을 알리는 메타데이터 문서. 401의 `WWW-Authenticate` 또는 well-known URI로 발견.
- **본문 위치**: [10-authorization.md](10-authorization.md)

### **CIMD (Client ID Metadata Documents)** ⭐
- **정의**: `client_id` 자체가 HTTPS URL이고 그 URL이 클라이언트 메타데이터 JSON을 서빙하는 등록 방식. DCR의 후계.
- **직관**: 등록 상태가 AS에서 클라이언트 도메인으로 이동 — AS 간 이식 가능. 단 localhost 프로세스 사칭은 못 막는다.
- **인접**: → DCR(deprecated), SSRF(AS가 fetch하므로), 신뢰 정책
- **본문 위치**: [10-authorization.md](10-authorization.md)

### **resource 파라미터 / audience (RFC 8707)**
- **정의**: 토큰을 특정 리소스 서버(정규 URI)에 바인딩하도록 인가·토큰 요청에 싣는 파라미터, 그리고 그 결과인 토큰의 수신자 지정.
- **직관**: 서버는 "이 토큰이 나를 위해 발급됐는가"를 검증해야 하고, 아니면 401.
- **인접**: → token passthrough, aud 클레임
- **본문 위치**: [10-authorization.md](10-authorization.md)

### **iss 검증 (RFC 9207)**
- **정의**: 인가 응답의 `iss` 파라미터를 리다이렉트 전에 기록해둔 issuer와 정규화 없이 문자열 비교하는 검증.
- **직관**: mix-up 공격(악성 AS의 코드 가로채기) 방어 — PKCE로는 못 막는다.
- **본문 위치**: [10-authorization.md](10-authorization.md)

### **token passthrough** ⭐
- **정의**: 자기용으로 발급되지 않은 토큰을 받아 하류 API로 그대로 전달하는 **금지된** 안티패턴.
- **직관**: audience 경계 붕괴 + 하류의 오신뢰(confused deputy화) + 감사 추적 붕괴. 상류 호출은 별도 토큰으로.
- **본문 위치**: [10-authorization.md](10-authorization.md), [11-security.md](11-security.md)

### **confused deputy**
- **정의**: 권한 있는 중개자(프록시 서버)가 공격자를 대신해 권한을 행사하게 되는 공격. MCP에선 정적 client_id + 동의 쿠키 + 동적 등록 조합으로 성립.
- **직관**: 방어 = 서드파티로 넘어가기 전 프록시 자체의 per-client 동의.
- **본문 위치**: [11-security.md](11-security.md)

### **scope / step-up**
- **정의**: 토큰의 권한 범위와, 부족 시(403 insufficient_scope) 기존∪신규 스코프로 재인가하는 흐름.
- **직관**: 누적은 클라이언트 책임, 챌린지는 일괄로, scopes_supported는 최소 기본 집합만.
- **본문 위치**: [10-authorization.md](10-authorization.md), [11-security.md](11-security.md)

### **SSRF (Server-Side Request Forgery)**
- **정의**: 디스커버리 URL(악성 서버 통제)을 따라가 내부망·클라우드 메타데이터(169.254.169.254)에 요청하게 되는 공격.
- **직관**: 방어 = HTTPS 강제 + 사설 대역 차단(직접 구현 금지) + 리다이렉트 검증 + egress 프록시. CIMD 받는 AS도 동일.
- **본문 위치**: [11-security.md](11-security.md)

---

# 부록: 자주 나오는 비유

| 비유 | 무엇을 설명하는가 | 출처 |
|---|---|---|
| **"AI 애플리케이션의 USB-C 포트"** | M×N 통합 문제를 표준 커넥터로 M+N화 | [02](02-core-principles.md) |
| **"LSP의 AI판"** | 에디터×언어 문제를 푼 선례의 이식 | [02](02-core-principles.md) |
| **"핸들은 이름이지 자격이 아니다"** | 상태 핸들 소지를 인증으로 착각하지 말 것 | [06](06-tools.md) |
| **"HTTP Cache-Control의 MCP판"** | ttlMs(max-age) / cacheScope(public·private) 대응 | [09](09-subscriptions-utilities.md) |
| **"본문이 진실 원천, 헤더는 거울"** | 헤더 미러링과 -32020 검증의 관계 | [05](05-transports.md) |
