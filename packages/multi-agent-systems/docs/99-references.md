# 99. 참고 자료 — 검증된 색인

아래 URL·도서 정보는 모두 실제 확인(2026-07-31 기준)했다. 본문은 이 자료들 없이도 이해되도록 썼으니, 이 색인은 **더 깊이 파고 싶을 때** 가는 곳이다.

## 필독 아티클 (무료, 원전)

| 자료 | 링크 | 왜 읽나 | 관련 챕터 |
|------|------|--------|-----------|
| Anthropic, *Building Effective Agents* | https://www.anthropic.com/engineering/building-effective-agents | 워크플로/에이전트 구분과 5가지 패턴의 원전. 한 시간이면 읽는다. | [02](02-what-is-an-agent.md), [05](05-eval-and-observability.md) |
| Anthropic, *How we built our multi-agent research system* | https://www.anthropic.com/engineering/multi-agent-research-system | 오케스트레이터-워커 실전, 2단계 병렬화(90% 단축), 툴 설계(40% 개선). | [04](04-multi-agent-patterns.md), [05](05-eval-and-observability.md), [07](07-should-you-build-multi-agent.md) |
| Cognition (Walden Yan), *Don't Build Multi-Agents* | https://cognition.ai/blog/dont-build-multi-agents | 멀티 에이전트 회의론, 컨텍스트 엔지니어링, 단일 작성자 원칙. | [04](04-multi-agent-patterns.md), [07](07-should-you-build-multi-agent.md) |

> **읽는 순서:** *Building Effective Agents* → (실습 후) *Don't Build Multi-Agents* → *multi-agent research system*. 마지막 두 개는 상반된 입장이니 나란히 읽어 판단 기준을 세워라([07장](07-should-you-build-multi-agent.md)).

## 공식 문서

| 문서 | 링크 | 확인할 내용 |
|------|------|-------------|
| Anthropic Messages API | https://docs.anthropic.com/en/api/messages | LLM 호출·tool_use 요청/응답 구조 |
| Anthropic Tool use 개요 | https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview | function calling 메커니즘 |
| Anthropic TypeScript SDK | https://github.com/anthropics/anthropic-sdk-typescript | Node용 `@anthropic-ai/sdk` |
| LangGraph.js 공식 문서 | https://docs.langchain.com/oss/javascript/langgraph/overview | StateGraph·Annotation·체크포인터·인터럽트 (JS판) |
| LangGraph 메모리·지속성 (JS) | https://docs.langchain.com/oss/javascript/langgraph/add-memory | 체크포인터·Thread |
| LangChain.js | https://docs.langchain.com/oss/javascript/langchain/overview | JS 생태계 전반(RAG·도구·통합) |
| LangChain.js 에이전트 | https://docs.langchain.com/oss/javascript/langchain/agents | `createAgent`(구 `createReactAgent`)·미들웨어 |

> **이 워크북은 Node/TypeScript 기준이다.** LangGraph·LangChain·LangSmith는 버전에 따라 API가 바뀐다. 세부 API는 책보다 **공식 문서 최신판(JS)**을 따라가라 — 이 워크북은 변하지 않는 개념만 본문에 담았다.

## 멀티 에이전트 프레임워크 & 상호운용 프로토콜 ([08장](08-agent-platform-infra.md))

| 자료 | 링크 | 무엇 |
|------|------|------|
| A2A(Agent2Agent) 프로토콜 명세 | https://a2a-protocol.org/ | 에이전트↔에이전트 상호운용 표준(Google, 2025-04). Agent Card·작업 위임 |
| A2A 발표 — Google Developers Blog | https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/ | A2A의 목적·배경 |
| A2A GitHub | https://github.com/a2aproject/A2A | 오픈 프로토콜 저장소·SDK |
| Model Context Protocol 공식 | https://modelcontextprotocol.io/ | 에이전트↔도구/데이터 표준(Anthropic, 2024-11) |
| Introducing MCP — Anthropic | https://www.anthropic.com/news/model-context-protocol | MCP 도입 배경("AI의 USB-C") |
| CrewAI 공식 문서 | https://docs.crewai.com/ | 역할(role/goal/backstory) 기반 크루. 도메인 전문가 팀 멘탈모델 |
| CrewAI GitHub | https://github.com/crewaiinc/crewai | 프레임워크 저장소 |
| AutoGen 공식 문서 | https://microsoft.github.io/autogen/stable/ | 대화형 그룹챗 멀티 에이전트(Microsoft) |
| AutoGen GitHub | https://github.com/microsoft/autogen | 프레임워크 저장소 |

> **MCP vs A2A 한 줄:** MCP는 에이전트에게 손발(도구)을 달아주고, A2A는 에이전트끼리 대화(협업)하게 한다. 방향이 다르므로 함께 쓰인다.

## 도서 (한국어)

### 오케스트레이션 학습용 (지금)

| 책 | 저자/출판 | 성격 | 이 워크북에서의 위치 |
|----|-----------|------|---------------------|
| **에이전트 시대의 AI 시스템 설계** (RAG·최적화·가드레일로 완성하는 32가지 프로덕션 패턴) | 발리아파 락슈마난·하네스 하프케 저 / 류광 역, 한빛미디어, 2026-04-27, 42,000원 | 아키텍처·설계 레벨 | **2순위.** 코드를 좀 만져본 뒤([02~04장] 실습 후) 읽어야 흡수된다. 프로덕션 패턴의 "왜"를 준다. |
| **만들면서 배우는 AI 에이전트 개발 입문+실전** | 박나연 저, 한빛미디어, 2026-05-01 | LangGraph 실습서 (LangChain·LangGraph v1 기반, MCP·A2A 포함) | **1순위 실습 짝꿍.** State/Node/Edge 기초부터 싱글·멀티 에이전트, 핸드오프까지 단계별 구현. [03~04장]과 병행. |

- 에이전트 시대의 AI 시스템 설계: https://product.kyobobook.co.kr/detail/S000219751990
- 만들면서 배우는 AI 에이전트 개발 입문+실전: https://product.kyobobook.co.kr/detail/S000219786427

### RAG 심화용 (7주차, 검색이 실제로 필요해질 때)

| 책 | 링크 | 언제 |
|----|------|------|
| 테디노트의 랭체인을 활용한 RAG 비법노트(기본 & 심화) | https://product.kyobobook.co.kr/detail/S000216574552 | 청킹·리랭킹·하이브리드를 실제로 만질 때. **RAG 실습 1순위.** |
| RAG 마스터: 랭체인으로 완성하는 LLM 서비스 | https://product.kyobobook.co.kr/detail/S000216240484 | 위와 상당 부분 겹침 — **둘 중 하나만.** |
| 벡터 데이터베이스 설계와 구축(Vector DB에서 RAG, Graph DB까지) | https://product.kyobobook.co.kr/detail/S000220428647 | 벡터DB를 직접 운영·튜닝하게 될 때 펴는 레퍼런스. **지금은 보류.** |

> **도서 구매 우선순위 요약:** 지금은 *만들면서 배우는*(실습) + *에이전트 시대의 AI 시스템 설계*(설계) 두 권. RAG 3권은 검색이 실제 병목이 되는 7주차 이후에 판단. 처음부터 RAG 3권을 사면 오케스트레이션을 못 건드린 채 검색만 두 달 배우게 된다.

## 이 워크북의 사실 검증 노트

- 위 아티클 3종·공식 문서 4종의 URL은 웹 검색으로 실재를 확인했다.
- 도서 2종(에이전트 시대의 AI 시스템 설계 / 만들면서 배우는 AI 에이전트 개발)의 저자·출판사·출간일·구성은 교보문고·한빛미디어·알라딘 정보로 교차 확인했다.
- Anthropic 리서치 시스템의 수치(3~5 서브에이전트, 시간 90% 단축, 툴 개선 40%)는 해당 아티클 기준.
- LangGraph 개념(StateGraph `.compile()`, 리듀서, 체크포인터 종류, 인터럽트-체크포인터 의존)은 공식 레퍼런스 기준. **세부 API 시그니처는 버전 의존이라 본문에 고정하지 않았다** — 실습 시 공식 문서 최신판 확인.
- A2A(Google, 2025-04)·MCP(Anthropic, 2024-11)의 출처·방향(에이전트↔에이전트 vs 에이전트↔도구)·Agent Card(`/.well-known/agent.json`) 개념, CrewAI(role/goal/backstory)·AutoGen(그룹챗) 성격은 각 공식 사이트·GitHub로 확인. 프로토콜 세부 필드는 버전 의존이라 본문엔 예시로만 실었다.
