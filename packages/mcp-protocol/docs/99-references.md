# 공식 문서 색인

모든 URL은 2026-08-05에 실제 접근해 확인했다. 기준 리비전: `2026-07-28`. 전체 페이지 인덱스는 [llms.txt](https://modelcontextprotocol.io/llms.txt).

## Getting Started · Learn

- [What is MCP?](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro) — 정의, 생태계, 시작점
- [Architecture overview](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture) — 참여자, 2층 구조, 데이터 레이어 워크스루(JSON 예제)
- [Understanding MCP servers](https://modelcontextprotocol.io/docs/2026-07-28/learn/server-concepts) — 프리미티브 3종, 여행 플래너 예제
- [Understanding MCP clients](https://modelcontextprotocol.io/docs/2026-07-28/learn/client-concepts) — elicitation, roots·sampling(deprecated)
- [Versioning](https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning) — 날짜 버전, 리비전·기능 상태

## Specification — 기본 프로토콜

- [Specification 진입점](https://modelcontextprotocol.io/specification/2026-07-28/) — BCP 14 용어, 보안 원칙
- [Architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture) — 설계 원칙 4, 능력 협상
- [Base Protocol Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic) — 메시지, 에러 코드, 무상태, `_meta`, JSON Schema, icons
- [Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning) — 협상, 확장, era 호환성 매트릭스
- [Key Changes (changelog)](https://modelcontextprotocol.io/specification/2026-07-28/changelog) — 2025-11-25 → 2026-07-28 변경 전체
- [Deprecated Features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated) — 퇴역 레지스트리
- [Schema Reference](https://modelcontextprotocol.io/specification/2026-07-28/schema) — 전 타입 레퍼런스 (원전: [schema.ts](https://github.com/modelcontextprotocol/specification/blob/main/schema/2026-07-28/schema.ts))

## Specification — 패턴·전송

- [Message Patterns](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns) — 요청/응답, MRTR, 구독
- [MRTR](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr) — InputRequiredResult, requestState 보안
- [Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions) — listen, ack, 종료
- [Progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress) · [Cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation)
- [Transports Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) · [stdio](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio) · [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)

## Specification — 서버·클라이언트 기능

- [Server Overview](https://modelcontextprotocol.io/specification/2026-07-28/server) · [Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) · [Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) · [Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources) · [Prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- 유틸리티: [Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching) · [Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination) · [Completion](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/completion) · [Logging](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/logging) (deprecated)
- 클라이언트: [Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) · [Sampling](https://modelcontextprotocol.io/specification/2026-07-28/client/sampling) (deprecated) · [Roots](https://modelcontextprotocol.io/specification/2026-07-28/client/roots) (deprecated)

## Specification — 인가

- [Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) — 체인, 스코프, 토큰
- [Authorization Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery)
- [Client Registration](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration) — CIMD/사전등록/DCR
- [Security Considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)

## Develop · Tutorials

- [Build an MCP server](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server) — 5개 언어 날씨 서버 워크스루
- [Build an MCP client](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-client) — LLM 챗봇 클라이언트 워크스루
- [Build with Agent Skills](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-with-agent-skills) — mcp-server-dev 플러그인
- [Connect local servers](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers) · [Connect remote servers](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-remote-servers)
- [Client Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/develop/clients/client-best-practices) — 점진적 발견, 코드 모드
- [Understanding Authorization](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/authorization) — Keycloak 실습(TS/Python/C#)
- [Security Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices) — 공격 벡터 카탈로그

## Tools

- [Debugging](https://modelcontextprotocol.io/docs/2026-07-28/tools/debugging)
- [MCP Inspector](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector) — 하위: [web](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/web) · [cli](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/cli) · [tui](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/tui) · [authorization](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/authorization) · [configuration](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/configuration) · [protocol-eras](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/protocol-eras) · [recipes](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/recipes)

## SDK · 생태계 (범위 밖 참조)

- [SDKs](https://modelcontextprotocol.io/docs/2026-07-28/sdk) — Tier 1: TypeScript·Python·C#·Go
- [Example Servers](https://modelcontextprotocol.io/examples) · [servers 레포](https://github.com/modelcontextprotocol/servers)
- [Extensions Overview](https://modelcontextprotocol.io/extensions/overview) — Tasks, MCP Apps, 인가 확장
- [Registry](https://modelcontextprotocol.io/registry/about)

## 외부 표준 (본문에서 인용)

- [JSON-RPC 2.0](https://www.jsonrpc.org/specification) · [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema)
- [OAuth 2.1 draft-13](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13) · [RFC 9728 PRM](https://datatracker.ietf.org/doc/html/rfc9728) · [RFC 8414 AS Metadata](https://datatracker.ietf.org/doc/html/rfc8414) · [RFC 8707 Resource Indicators](https://www.rfc-editor.org/rfc/rfc8707.html) · [RFC 9207 iss](https://datatracker.ietf.org/doc/html/rfc9207) · [RFC 7591 DCR](https://datatracker.ietf.org/doc/html/rfc7591) · [CIMD draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00)
- [RFC 6570 URI Template](https://datatracker.ietf.org/doc/html/rfc6570) · [RFC 5424 syslog](https://datatracker.ietf.org/doc/html/rfc5424) · [RFC 9110 HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc9110) · [W3C Trace Context](https://www.w3.org/TR/trace-context/)
