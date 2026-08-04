# 03. LangGraph 기본기 — 에이전트를 워크플로 엔진으로 다루기 (1~2주차)

## 학습 목표

이 챕터를 다 읽고 실습하면, LangGraph의 `StateGraph`로 상태를 가진 그래프를 짜고, 리듀서로 상태 병합을 통제하고, 체크포인터로 크래시에서 재개하고, 인터럽트로 사람 승인을 끼워넣을 수 있다.

## 선수 지식

[02장](02-what-is-an-agent.md)에서 직접 짠 `while` 루프 에이전트, 그리고 그때 겪은 세 가지 불편함(상태 관리·에러 핸들링·무한 루프). LangGraph는 이걸 대신 해준다.

## 핵심 원리 (WHY) — 이것은 워크플로 엔진이다

> **백엔드 관점 한 문장:** LangGraph는 LLM용 **워크플로 엔진**이다. Temporal이나 Airflow를 써봤다면 그 감각이 그대로 온다 — 노드(작업 단위)를 엣지(전이 규칙)로 잇고, 상태를 지속(persist)시키고, 실패하면 마지막 지점부터 재개한다.

0주차에 직접 짜본 루프는 잘 돌지만, 운영에 올리면 세 가지가 발목을 잡는다:

1. **상태를 어떻게 저장/병합하나** — 여러 노드가 같은 상태를 건드리면 덮어쓰기 충돌이 난다.
2. **크래시하면 처음부터 다시?** — 30분짜리 리서치가 28분에 죽으면 처음부터 재실행은 재앙이다.
3. **중간에 사람 승인을 어떻게 끼우나** — "이 이메일 정말 보낼까요?"를 어떻게 멈추고 물어보나.

LangGraph는 이 셋을 **State + Reducer + Checkpointer + Interrupt**로 푼다. 공식 한국어 책보다 공식 문서 튜토리얼이 최신이니, 개념은 여기서 잡고 API는 문서에서 확인하라.

> **이 워크북은 Node/TypeScript 기준이다.** LangGraph는 JS 정식 버전(`@langchain/langgraph`)이 있고, 개념(StateGraph·리듀서·체크포인터·인터럽트)은 Python판과 동일하다. 아래 API 이름은 JS판 기준으로 적는다.
>
> **패키지 경계 (v1 기준):** 그래프 원시요소(`StateGraph`·`Annotation`·`MemorySaver`)는 `@langchain/langgraph`, **프리빌트 ReAct 에이전트는 `langchain` 패키지의 `createAgent`**다. `@langchain/langgraph/prebuilt` 의 `createReactAgent` 는 `langchain` 으로 옮겨지며 deprecated 됐다 — 옵션 이름도 `llm` → `model` 로 바뀌었다. `langchain` 은 `@langchain/core`(peer)와 `@langchain/langgraph`(dep) 위에 얹히는 상위 패키지이므로 **둘을 대체하지 않는다.**

## 필수 지식 (HOW)

### 1. StateGraph — 상태를 공유하는 그래프

`StateGraph`는 **노드들이 공유 상태(state)를 읽고 쓰며 통신하는 그래프**다. 각 노드의 시그니처는 `State -> Partial<State>` — 노드는 상태를 받아서, 바꿀 부분만 반환한다. 그러면 그 부분이 전체 상태에 병합된다.

- **노드(Node)**: 하나의 작업 단위 (LLM 호출, 툴 실행, 로직 등). 상태를 받아 상태 일부를 반환.
- **엣지(Edge)**: 노드 간 전이. 다음에 어느 노드로 갈지 정한다.
- **조건부 엣지(Conditional Edge)**: 상태 값에 따라 분기 — "툴 호출이 있으면 툴 노드로, 없으면 종료로". 0주차 루프의 `if (toolUse) { ... } else break`가 바로 이것이다.
- **컴파일(`.compile()`)**: `StateGraph`는 **설계도(빌더)일 뿐 바로 실행 못 한다.** `.compile()`을 호출해야 `invoke()`, `stream()` 등으로 실행 가능한 그래프가 된다.

### 2. 리듀서(Reducer) — 상태 병합 규칙

여러 노드(특히 병렬 노드)가 같은 상태 키를 건드리면, **덮어쓸 것인가 합칠 것인가**를 정해야 한다. 이걸 정하는 함수가 리듀서다. 시그니처는 `(기존값, 새값) -> 합쳐진값`.

- 리듀서를 안 주면 **덮어쓰기(overwrite)**가 기본. 새 값이 옛 값을 밀어낸다.
- JS에선 `Annotation.Root({...})`로 상태 채널을 정의하고, 채널에 리듀서를 준다. 예: `Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] })` — "리스트를 덮어쓰지 말고 **이어붙여라(append)**"라는 뜻. 메시지 상태는 프리빌트 `MessagesAnnotation`을 쓰면 append 리듀서가 이미 들어 있다.
- **왜 중요한가:** 리듀서는 **병렬을 안전하게 만든다.** 두 브랜치가 조율(coordination) 없이 같은 리스트에 각자 append 할 수 있다 — 이게 [04장 멀티 에이전트](04-multi-agent-patterns.md)에서 서브에이전트 결과를 모을 때 핵심이 된다. 백엔드의 "동시 쓰기 충돌"을 리듀서가 선언적으로 해결하는 셈이다.

### 3. 체크포인터(Checkpointer) — 지속과 크래시 복구

체크포인터는 **매 노드 실행 후 전체 그래프 상태를 직렬화해서 저장**한다. 덕분에 일시정지/재개와 크래시 복구가 된다. 죽어도 마지막 체크포인트부터 이어서 돈다.

- **MemorySaver** (`@langchain/langgraph`) — 개발/실험용, 프로세스 메모리에 저장 (재시작하면 사라짐)
- **SqliteSaver** (`@langchain/langgraph-checkpoint-sqlite`) — 단일 서버 운영용, 로컬 파일에 지속
- **PostgresSaver** (`@langchain/langgraph-checkpoint-postgres`) — 여러 인스턴스로 확장할 때 (멀티 인스턴스 스케일). JS판은 이 외에 Redis·MongoDB 체크포인터도 `@langchain/langgraph-checkpoint-*` 패키지로 제공

> 백엔드 감각: 이건 이벤트 소싱/워크플로 지속성과 같은 문제다. "상태를 어디에 저장하느냐"는 스케일 요구에 따라 고른다.

### 4. 인터럽트(Interrupt) — 사람 승인 끼워넣기 (Human-in-the-loop)

`interrupt`는 **그래프를 실행 도중 멈추고, 상태를 저장한 뒤, 외부의 재개 신호를 기다린다.** "이 액션 실행 전에 사람 승인을 받자"를 구현하는 원시 기능이다.

- **전제 조건:** 인터럽트를 쓰려면 **반드시 체크포인터가 있어야 한다.** 멈춘 상태를 어딘가 저장해둬야 나중에 재개할 수 있기 때문이다. (이 인과 관계를 놓치면 "왜 인터럽트가 안 되지?"에서 막힌다.)
- **`interruptBefore` vs `interruptAfter`** — 이 구분이 진단 신호다:
  - `interruptBefore`: 노드 실행 **전에** 멈춘다. **승인이 액션을 막는(gate)** 경우 — 이메일을 보내기 전에 승인.
  - `interruptAfter`: 노드가 **먼저 실행되고 나서** 멈춘다. 방금 한 일을 사람이 **검토**하게 할 때. 주의: `interruptAfter`면 승인받으려던 액션이 **이미 실행된 뒤**다.

## 🛠 직접 해볼 것 — 상태 있는 그래프 짜기

- [ ] 0주차의 계산기 에이전트를 LangGraph로 다시 구현: `agent` 노드 + `tool` 노드 + 둘 사이 조건부 엣지(tool_use 있으면 tool 노드로, 없으면 END)
- [ ] 상태에 `messages` 키를 두고 **리듀서로 append** 설정 — 덮어쓰기로 바꿔보고 왜 대화가 깨지는지 관찰
- [ ] **체크포인터 붙이기**: MemorySaver로 시작 → 그래프 중간에 일부러 예외를 던져 죽인 뒤, 같은 thread로 재실행해서 **처음이 아니라 죽은 지점부터** 재개되는지 확인
- [ ] **인터럽트 실습**: "이메일 보내기" 노드 앞에 `interruptBefore`를 걸고, 실행이 멈춰서 사람 입력을 기다리는지 확인 → 승인하면 이어서 실행되는지 확인
- [ ] 체크포인터 없이 인터럽트를 시도해서 **왜 안 되는지** 직접 확인 (전제 조건 체감)

**자가진단:**
1. `StateGraph`를 만들고 바로 `invoke()`하면 왜 안 되는가? (답: `.compile()` 필요)
2. 병렬 노드 둘이 같은 리스트에 결과를 넣을 때 충돌 없이 합치려면 무엇이 필요한가? (답: append 리듀서)
3. 인터럽트가 체크포인터를 요구하는 이유는?
4. 결제 실행을 승인받고 싶다면 `interruptBefore`와 `interruptAfter` 중 무엇을 써야 하나? (답: before — 안 그러면 이미 결제됨)

## ⚠️ 암기 필수

- [ ] **StateGraph는 `.compile()` 해야 실행 가능** — 빌더는 설계도, 컴파일된 것이 실행체.
- [ ] **리듀서 = 상태 병합 규칙. 기본은 덮어쓰기, `append` 리듀서가 병렬을 안전하게 만든다.** (진단: 병렬 결과가 사라지면 리듀서를 의심)
- [ ] **인터럽트는 체크포인터를 전제로 한다.** 체크포인터 없이 인터럽트 불가.
- [ ] **`interruptBefore`(액션 전 승인) vs `interruptAfter`(실행 후 검토, 액션은 이미 실행됨).** 되돌릴 수 없는 액션은 반드시 `before`.
- [ ] 체크포인터 선택: **MemorySaver(개발) / SqliteSaver(단일 서버) / PostgresSaver(멀티 인스턴스).**

## 공식 문서

- [LangGraph.js 공식 문서](https://docs.langchain.com/oss/javascript/langgraph/overview) — StateGraph·Annotation·체크포인터·인터럽트 (JS판). 구 `langchain-ai.github.io/langgraphjs` 는 이곳으로 이전됐다
- [LangChain.js 에이전트 문서](https://docs.langchain.com/oss/javascript/langchain/agents) — `createAgent` 와 미들웨어(HITL·요약·툴 에러) 레퍼런스
- [LangGraph 메모리·지속성 문서 (JS)](https://docs.langchain.com/oss/javascript/langgraph/add-memory) — 체크포인터·Thread 실습
- [@langchain/langgraph-checkpoint (npm)](https://www.npmjs.com/package/@langchain/langgraph-checkpoint) — 체크포인터 인터페이스
- 공식 튜토리얼(어떤 한국어 책보다 최신)에서 Checkpointer·Thread·조건부 엣지 실습을 따라가라.
