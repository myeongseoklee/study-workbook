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
> **실습 환경 두 가지 (week1 코드에 이미 반영돼 있다):**
> ① **모델은 네이티브 provider(`@langchain/google` 의 `ChatGoogle`)를 쓴다.** week0처럼 `ChatOpenAI` + Gemini의 OpenAI 호환 엔드포인트로 가면 툴 호출 **2턴째에 400** 이 난다. 공식 문서가 이미 이 조합을 권하지 않는다 — 아래 [프레임워크와 provider 호환](#프레임워크와-provider-호환--week1에서-드러나는-것) 참고.
> ② **환경변수는 `shared/env.ts` 에서만 주입된다**(`import "dotenv/config"`). `.env` 는 그 import 를 실행한 프로세스에만 로드되므로, dotenv 를 import 하지 않은 파일에서 `process.env.GEMINI_API_KEY` 를 읽으면 `undefined` 다 — `npm run week1` 이 키를 못 찾던 원인이 이것이었다. 주차 실습은 `shared/llm`(= env 값 + 키 검증)을 통해 받는다. (`ChatGoogle` 은 `apiKey` 를 생략하면 `GOOGLE_API_KEY` 를 찾으므로, 워크북에선 값을 명시로 넘긴다.)
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
- **재개 신호는 `Command`다.** 멈춘 그래프는 같은 thread로 `graph.invoke(new Command({ resume: <사람의 결정> }), config)` 를 부르면 이어서 돈다 (`Command` 는 `@langchain/langgraph`).

**어디에 거는가 — 두 갈래다 (v1 기준):**

| 쓰는 것 | 승인을 끼우는 방법 |
|---------|-------------------|
| `StateGraph` 직접 조립 | `.compile({ checkpointer, interruptBefore: ["sendEmail"] })` — **노드 경계**에 정적으로 건다. 노드 안에서 동적으로 멈추려면 `interrupt(value)` 를 호출한다 |
| `createAgent` 프리빌트 | `interruptBefore` 옵션이 **없다.** `humanInTheLoopMiddleware` 를 쓴다 — **툴 단위**로 건다 |

```ts
import { createAgent, humanInTheLoopMiddleware } from "langchain";
import { Command } from "@langchain/langgraph";

const agent = createAgent({
  model, tools: [sendEmail], checkpointer,   // 체크포인터는 여기서도 전제 조건
  middleware: [humanInTheLoopMiddleware({
    interruptOn: { sendEmail: { allowedDecisions: ["approve", "edit", "reject"] } },
  })],
});

const res = await agent.invoke({ messages: [...] }, config);
if (res.__interrupt__) {                     // 멈췄다 = 승인 대기 중
  await agent.invoke(new Command({ resume: { decisions: [{ type: "approve" }] } }), config);
}
```

> 개념(멈춤·상태 저장·재개 신호)은 같고 **거는 지점만 노드 → 툴 호출로 옮겨간다.** 프리빌트를 쓰면 "이메일 보내기 노드" 라는 게 없고 툴 호출만 있으니 당연한 귀결이다. 되돌릴 수 없는 액션은 여기서도 실행 **전**에 막아야 한다.

### 5. 프레임워크와 provider 호환 — week1에서 드러나는 것

0주차는 `openai` SDK로 Gemini의 **OpenAI 호환 엔드포인트**를 불러도 잘 돌았다. 그런데 같은 조합을 프레임워크(`ChatOpenAI`)에 얹어 툴 루프를 돌리면 1턴은 되고 **2턴째에 400** 이 난다. 공식 문서 세 곳이 이 결과를 미리 설명한다:

- **LangChain (models 문서, OpenAI 호환 엔드포인트 항목):** `openai` provider는 **공식 OpenAI 스펙**을 대상으로 하며, *"라우터·프록시의 provider 고유 필드는 추출·보존되지 않을 수 있다"*.
- **Gemini API (OpenAI 호환 문서):** 이 호환 계층은 **beta**이고, *"OpenAI 라이브러리를 이미 쓰고 있는 게 아니라면 Gemini API를 직접 호출하기를 권한다"*.
- **Gemini API (thinking 문서):** thinking 모델의 `thought` 블록은 **받은 그대로 전부 다시 보내야 한다**(reasoning 연속성을 담은 `thought_signature`가 들어 있다).

세 문장이 합쳐지면 결론이 나온다. 프레임워크는 응답을 자기 메시지 타입으로 **파싱해서 재구성**하는데, 그 과정에서 스펙에 없는 `thought_signature` 가 떨어진다. 0주차 루프는 받은 메시지 객체를 **그대로** 히스토리에 다시 넣었으니 서명도 함께 살아남았다 — 같은 엔드포인트인데 원시 SDK는 되고 프레임워크는 안 되는 이유다.

> **일반화해서 기억할 것:** OpenAI 호환 계층은 **한 번 호출**에는 충분하지만, **provider 고유 필드를 왕복시켜야 하는 멀티턴 툴 루프**에서 깨진다. 프레임워크에 루프를 맡길 때는 그 provider의 **네이티브 integration**을 쓰는 게 공식 권장 경로다. Gemini의 경우 `@langchain/google` 의 `ChatGoogle` — 구 `@langchain/google-genai`·`@langchain/google-vertexai` 를 대체하는 현재 권장 패키지다.

### 6. 미들웨어 — 프리빌트 에이전트의 확장 지점

`createAgent` 는 그래프를 직접 조립하는 대신 **모델 호출·툴 호출을 감싸는 훅**을 제공한다. 위 HITL도 그중 하나다. 워크북의 다른 장들과 겹치는 것들:

- `humanInTheLoopMiddleware` — 툴 승인 (이 장)
- `summarizationMiddleware` / `contextEditingMiddleware` — 컨텍스트가 길어질 때 압축·정리
- `toolErrorMiddleware` / `toolRetryMiddleware` / `modelFallbackMiddleware` — [0주차에서 손으로 짠 툴 에러 핸들링](02-what-is-an-agent.md)의 프레임워크판
- `toolCallLimitMiddleware` / `modelCallLimitMiddleware` — 루프 폭주 상한 (0주차의 `MAX_STEPS`)
- `createMiddleware({ wrapModelCall, wrapToolCall })` — 위에 없는 건 직접 만든다

> **판단 기준:** 손으로 짠 루프에서 이미 겪어본 문제만 미들웨어로 옮겨라. 미들웨어부터 훑으면 [02장](02-what-is-an-agent.md)이 경고한 "추상화 뒤에서 무엇이 도는지 모르는" 상태로 되돌아간다.

## 🛠 직접 해볼 것 — 상태 있는 그래프 짜기

- [ ] 0주차의 계산기 에이전트를 LangGraph로 다시 구현: `agent` 노드 + `tool` 노드 + 둘 사이 조건부 엣지(tool_use 있으면 tool 노드로, 없으면 END)
- [ ] 상태에 `messages` 키를 두고 **리듀서로 append** 설정 — 덮어쓰기로 바꿔보고 왜 대화가 깨지는지 관찰
- [ ] **체크포인터 붙이기**: MemorySaver로 시작 → 그래프 중간에 일부러 예외를 던져 죽인 뒤, 같은 thread로 재실행해서 **처음이 아니라 죽은 지점부터** 재개되는지 확인
- [ ] **인터럽트 실습**: "이메일 보내기" 노드 앞에 `interruptBefore`를 걸고, 실행이 멈춰서 사람 입력을 기다리는지 확인 → `new Command({ resume })` 로 승인하면 이어서 실행되는지 확인
- [ ] 같은 승인을 `createAgent` + `humanInTheLoopMiddleware` 로도 걸어보고, **거는 지점이 노드에서 툴 호출로 바뀌는 것**을 비교
- [ ] 체크포인터 없이 인터럽트를 시도해서 **왜 안 되는지** 직접 확인 (전제 조건 체감)

**자가진단:**
1. `StateGraph`를 만들고 바로 `invoke()`하면 왜 안 되는가? (답: `.compile()` 필요)
2. 병렬 노드 둘이 같은 리스트에 결과를 넣을 때 충돌 없이 합치려면 무엇이 필요한가? (답: append 리듀서)
3. 인터럽트가 체크포인터를 요구하는 이유는?
4. 결제 실행을 승인받고 싶다면 `interruptBefore`와 `interruptAfter` 중 무엇을 써야 하나? (답: before — 안 그러면 이미 결제됨)
5. `createAgent` 로 만든 에이전트에 `interruptBefore` 를 주려면? (답: 못 준다 — 옵션이 없다. `humanInTheLoopMiddleware` 로 툴 단위로 건다)
6. 프리빌트 `createAgent` 는 어느 패키지에서 오나? (답: `langchain`. `StateGraph`·`MemorySaver` 는 `@langchain/langgraph`)

## ⚠️ 암기 필수

- [ ] **StateGraph는 `.compile()` 해야 실행 가능** — 빌더는 설계도, 컴파일된 것이 실행체.
- [ ] **리듀서 = 상태 병합 규칙. 기본은 덮어쓰기, `append` 리듀서가 병렬을 안전하게 만든다.** (진단: 병렬 결과가 사라지면 리듀서를 의심)
- [ ] **인터럽트는 체크포인터를 전제로 한다.** 체크포인터 없이 인터럽트 불가.
- [ ] **`interruptBefore`(액션 전 승인) vs `interruptAfter`(실행 후 검토, 액션은 이미 실행됨).** 되돌릴 수 없는 액션은 반드시 `before`. 재개는 `new Command({ resume })`.
- [ ] 체크포인터 선택: **MemorySaver(개발) / SqliteSaver(단일 서버) / PostgresSaver(멀티 인스턴스).**
- [ ] **패키지 경계: 그래프 원시요소(`StateGraph`·`Annotation`·`MemorySaver`)는 `@langchain/langgraph`, 프리빌트 에이전트(`createAgent`)와 미들웨어는 `langchain`.** 승인은 그래프에선 `interruptBefore`(노드), 프리빌트에선 `humanInTheLoopMiddleware`(툴).
- [ ] **OpenAI 호환 계층은 단발 호출용. 프레임워크에 멀티턴 툴 루프를 맡기면 네이티브 provider integration 을 쓴다** — 호환 변환이 provider 고유 필드(Gemini `thought_signature` 등)를 버려 2턴째에 깨진다.

## 공식 문서

- [LangGraph.js 공식 문서](https://docs.langchain.com/oss/javascript/langgraph/overview) — StateGraph·Annotation·체크포인터·인터럽트 (JS판). 구 `langchain-ai.github.io/langgraphjs` 는 이곳으로 이전됐다
- [LangChain.js 에이전트 문서](https://docs.langchain.com/oss/javascript/langchain/agents) — `createAgent` 와 미들웨어(HITL·요약·툴 에러) 레퍼런스
- [LangChain.js 모델 문서](https://docs.langchain.com/oss/javascript/langchain/models) — provider별 설정. "Base URL and proxy settings" 절에 OpenAI 호환 엔드포인트의 한계 경고
- [ChatGoogle 통합 문서](https://docs.langchain.com/oss/javascript/integrations/chat/google) — `@langchain/google`(구 `google-genai`·`google-vertexai` 대체)
- [Gemini API — OpenAI 호환성](https://ai.google.dev/gemini-api/docs/openai) / [Thinking·thought signature](https://ai.google.dev/gemini-api/docs/thinking#signatures) — 호환 계층이 beta 인 이유와 서명 왕복 규칙
- [LangGraph 메모리·지속성 문서 (JS)](https://docs.langchain.com/oss/javascript/langgraph/add-memory) — 체크포인터·Thread 실습
- [@langchain/langgraph-checkpoint (npm)](https://www.npmjs.com/package/@langchain/langgraph-checkpoint) — 체크포인터 인터페이스
- 공식 튜토리얼(어떤 한국어 책보다 최신)에서 Checkpointer·Thread·조건부 엣지 실습을 따라가라.
