# MCP 프로토콜 정복 — 학습 개요

## 왜 이 주제를 학습하는가

MCP(Model Context Protocol)는 AI 애플리케이션을 외부 시스템(데이터·도구·워크플로우)에 연결하는 오픈 표준이다. Claude, ChatGPT, VS Code, Cursor 등 주요 AI 제품이 모두 지원하므로, **한 번 서버를 만들면 모든 클라이언트에 연결된다.** AI 도구를 만들거나 쓰는 개발자에게 MCP는 "선택 가능한 라이브러리"가 아니라 "생태계의 공용 규격"이 되었다.

이 자료는 공식 문서(`modelcontextprotocol.io`)의 **docs 섹션 전체 + specification(프로토콜 명세) 전체**를 학습 대상으로 삼는다. 목표는 두 가지다.

1. **프로토콜을 와이어 수준까지 이해한다** — SDK가 감춰주는 JSON-RPC 메시지, `_meta` 규약, 에러 코드, 전송 규칙을 직접 읽고 쓸 수 있다.
2. **설계·운영 판단을 내릴 수 있다** — "왜 무상태인가", "왜 서버는 요청을 보낼 수 없나", "토큰 passthrough는 왜 금지인가"에 근거를 들어 답할 수 있다.

## 기준 버전 — 반드시 확인하고 시작할 것

이 자료는 **프로토콜 리비전 `2026-07-28`** (2026-08-05 기준 Current 버전)을 기준으로 한다. 이 리비전은 MCP 역사상 가장 큰 구조 변화를 담고 있다:

- `initialize` 핸드셰이크 제거 → **무상태 프로토콜** (모든 요청이 `_meta`에 버전·능력 携帯)
- 서버발 요청 제거 → **MRTR**(Multi Round-Trip Requests) 패턴으로 대체
- `Mcp-Session-Id`·HTTP GET 스트림·SSE 재개(`Last-Event-ID`) 제거
- `resources/subscribe` → **`subscriptions/listen`** 단일 구독 스트림
- Roots·Sampling·Logging·DCR **deprecated**

인터넷의 많은 MCP 자료(블로그, 옛 SDK 예제)는 그 이전(레거시) 리비전 기준이다. **이 자료에서 "레거시"라고 부르는 것이 바깥 자료에서는 "현재 방식"으로 서술되어 있을 수 있다.** 두 세대의 차이 자체가 [04-lifecycle-versioning.md](04-lifecycle-versioning.md)의 학습 항목이다.

## 학습 로드맵

| 순서 | 파일 | 내용 | 예상 |
|---|---|---|---|
| 1 | [01-prerequisites.md](01-prerequisites.md) | JSON-RPC 2.0 · OAuth 2.1 · JSON Schema · SSE 기초 | ~20분 |
| 2 | [02-core-principles.md](02-core-principles.md) | MCP가 푸는 문제, 참여자 구조, 설계 원칙 4가지 | ~25분 |
| 3 | [03-messages-meta.md](03-messages-meta.md) | 메시지 3종, resultType, 에러 코드 체계, `_meta` 규약 | ~30분 |
| 4 | [04-lifecycle-versioning.md](04-lifecycle-versioning.md) | 무상태, server/discover, 버전 협상, 세대(era) 호환 | ~30분 |
| 5 | [05-transports.md](05-transports.md) | stdio, Streamable HTTP, 헤더 미러링, 커스텀 전송 | ~35분 |
| 6 | [06-tools.md](06-tools.md) | 도구 정의·호출, 스키마, 2계층 오류, 상태 핸들 | ~30분 |
| 7 | [07-resources-prompts.md](07-resources-prompts.md) | 리소스·템플릿·어노테이션, 프롬프트 | ~25분 |
| 8 | [08-mrtr-client-features.md](08-mrtr-client-features.md) | MRTR 패턴, elicitation, sampling·roots(deprecated) | ~35분 |
| 9 | [09-subscriptions-utilities.md](09-subscriptions-utilities.md) | 구독, 진행률, 취소, 캐싱, 페이지네이션, 자동완성 | ~30분 |
| 10 | [10-authorization.md](10-authorization.md) | OAuth 2.1 기반 인가 — 디스커버리, 등록, 토큰 규칙 | ~40분 |
| 11 | [11-security.md](11-security.md) | 공격 벡터 카탈로그 — confused deputy, SSRF, 피싱 등 | ~35분 |
| 12 | [12-building-tooling.md](12-building-tooling.md) | 서버·클라이언트 구축, 디버깅, Inspector, 클라이언트 확장 패턴 | ~30분 |
| — | [90-must-memorize.md](90-must-memorize.md) | 암기 카드 18장 (반복 복습용) | 반복 |
| — | [91-glossary.md](91-glossary.md) | 용어 해설집 — 4레이어 인과 구조 | 참조 |
| — | [99-references.md](99-references.md) | 공식 문서 색인 | 참조 |

**총 예상 시간**: 본문 약 6시간 + 워크북 3~4시간

워크북은 [../workbook/92-workbook.md](../workbook/92-workbook.md)(문제) / [../workbook/93-solutions.md](../workbook/93-solutions.md)(정답)로 분리되어 있고, 코딩 과제 4개는 `tests/`(명세)·`src/`(스켈레톤)·`solutions/`(참고 구현)에 실행 가능한 파일로 있다.

## 이 학습 후 할 수 있는 것

- [ ] MCP 요청/응답 JSON을 SDK 없이 손으로 쓰고 읽을 수 있다 (필수 `_meta` 필드 포함)
- [ ] 에러 코드(-32602/-32020/-32021/-32022)만 보고 무엇이 잘못됐는지 진단할 수 있다
- [ ] 서버가 사용자 입력·LLM 완성이 필요할 때 MRTR 흐름을 설계할 수 있다 (requestState 보안 포함)
- [ ] stdio vs Streamable HTTP를 상황에 맞게 선택하고, 각 전송의 취소·종료·보안 규칙을 지킬 수 있다
- [ ] 401부터 토큰 획득까지 MCP 인가 체인을 순서대로 설명하고, 각 단계가 막는 공격을 말할 수 있다
- [ ] 레거시(initialize 기반) 서버·클라이언트와의 호환 전략을 세울 수 있다
- [ ] Inspector로 서버를 검증하는 CI 파이프라인을 짤 수 있다

## 범위 밖 (링크만)

- **Extensions 상세** (Tasks, MCP Apps, 인가 확장) — 코어와의 협상 방식은 본문에서 다루되, 각 확장의 내부 규격은 [공식 extensions 문서](https://modelcontextprotocol.io/extensions/overview) 참조
- **Registry** (서버 배포·게시) — [registry 문서](https://modelcontextprotocol.io/registry/about) 참조
- **언어별 SDK API** — 개념 이해 후 [SDK 문서](https://modelcontextprotocol.io/docs/2026-07-28/sdk)에서 필요할 때 찾으면 된다. 이 자료의 코딩 과제는 일부러 SDK 없이 프로토콜을 직접 구현한다 — 그래야 SDK가 무엇을 감춰주는지 보인다.

## 수치·사실의 출처

이 자료의 모든 프로토콜 규칙(에러 코드, 헤더 이름, MUST/SHOULD 수준)은 공식 명세 `2026-07-28` 리비전에서 가져왔고, 각 파일 끝의 "공식 문서" 절에 해당 페이지 URL을 남겼다. 외부 식별자·사내 정보는 포함하지 않는다(전부 공개 문서 기반).
