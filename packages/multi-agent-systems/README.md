# 멀티 에이전트 시스템 워크북 (Node/TypeScript 실습 환경)

3년차 백엔드 개발자를 위한 멀티 에이전트 시스템 학습 워크북 + **실제로 돌려보는 실습 환경**.
개념 문서는 [`docs/`](docs/)에, 손으로 돌려보는 코드는 [`src/`](src/)에 있다.

## 이 레포의 구조 (tests/src/solutions 3분할)

`src/`는 **핵심 로직이 비어 있는 연습문제**다. 스캐폴드(환경·툴 정의·서버·하네스)는 작동하고,
배워야 할 부분만 `🎯 TODO` 로 남아 있다. `tests/`가 **명세**다 — 무엇을 만들지는 여기 있다.
`client`·`ask`·`fetch` 같은 외부 호출은 실습 함수가 파라미터로 받으므로, 테스트는 실제
LLM API를 부르지 않고 손으로 만든 스텁(canned response)을 주입해 판정한다.
막히면 `solutions/`의 완성본을 열어 대조하라.

```
docs/                      # 학습 문서 (읽기) — 00~08, 90 암기, 91 용어, 99 참고
shared/                    # src/도 solutions/도 아닌 패키지 공용 스캐폴딩 (양쪽이 ../shared로 본다)
├── env.ts                 # ⚠️ 유일한 환경변수 주입 지점(dotenv/config) — 값만 export
│                          #    .env 는 이 import 를 실행한 프로세스에만 로드된다.
│                          #    그래서 다른 파일은 process.env 를 읽지 않고 여기 값을 import
├── llm.ts                 # 공용 LLM 클라이언트(env 값 + 키 검증) — 그대로 사용
└── check.ts               # 환경 점검 (npm run check)
tests/                     # 📋 명세 — 이 파일은 고치지 않는다
├── 0-1-agent-loop.test.ts
├── 1-1-langgraph-memory.test.ts
├── scripted-chat-model.ts  # week1 테스트 전용 헬퍼(BaseChatModel 스텁) — 명세 아님
└── ... (나머지도 src/ 파일명과 1:1)
src/                       # 🎯 연습문제 (여기를 채운다)
├── 0-1-agent-loop.ts      # 02장: 프레임워크 없이 에이전트 루프
├── 1-1-langgraph-memory.ts # 03장: LangGraph + 체크포인터
├── 3-1-multiagent-handoff.ts  # 04장: 광고 3전문가 협업 (앱 레이어)
├── 5-1-eval-harness.ts    # 05장: 평가셋 하네스
├── 7-1-rag-retrieve.ts    # 06장: 최소 RAG
├── 8-1-llm-provider.ts    # 08장: LLM provider 추상화 (Gemini 주고 Claude 어댑터 직접 구현)
├── 8-2-analyst-agent.ts   # 08장: 분석 에이전트를 독립 서비스로 (Fastify)
├── 8-3-ad-expert-agent.ts # 08장: 광고 전략가를 독립 서비스로 (Fastify)
└── 8-4-orchestrator.ts    # 08장: 오케스트레이터 (HTTP로 두 에이전트 호출)
solutions/                 # ✅ 완성본 (막힐 때만 열어보기 — src/ 와 동일 구조, shared/는 같은 파일을 공유)
```

**판정:** `npm test` — 스켈레톤(`src/`)은 TODO 에러로 실패하는 게 정상이다.
`STUDY_TARGET=solutions npm test`로 돌리면 같은 테스트가 `solutions/`를 보고 통과해야 한다.

**환경변수 규칙:** `.env` 는 `import "dotenv/config"` 를 실행한 프로세스에만 로드된다. 그래서 주입은 **`shared/env.ts` 한 곳**에서만 하고, 나머지 파일은 `process.env` 를 읽지 않고 거기서 export 된 값(`API_KEY`·`MODEL`·`BASE_URL`·`LLM_PROVIDER`·`ANTHROPIC_MODEL`)을 import 한다. 주차 실습은 보통 `shared/llm` 을 통해 받으면 키 검증까지 함께 얻는다. 새 환경변수를 추가할 땐 `env.ts` 에 export 를 하나 더 만드는 게 유일한 방법이다.

**LLM provider:** 주차 실습은 **Gemini(무료 티어)** 를 OpenAI 호환 방식으로 쓴다. 여러 벤더(Gemini·Claude·OpenAI)를 인터페이스로 추상화하는 것은 [08장 연습문제](docs/08-agent-platform-infra.md)(`8-1-llm-provider.ts`)에서 다룬다 — 거기서 Claude(cc) 어댑터를 직접 구현한다.

## 시작하기

```bash
# 1) 의존성 설치
npm install

# 2) API 키 설정 (기본 provider = Gemini 무료 티어)
cp .env.example .env
#   .env 를 열어 GEMINI_API_KEY 를 채운다. 무료 키: https://aistudio.google.com/apikey
#   GEMINI_MODEL 기본값은 gemini-3.1-flash-lite. (⚠️ gemini-2.5-* 는 신규 계정엔 404)

# 3) 환경 점검 (여기가 ✅ 되면 세팅 완료 — 이후 에러는 '내 코드' 문제)
npm run check

# 4) 첫 실습 — src/0-1-agent-loop.ts 의 🎯 TODO 를 채운 뒤 실행
npm run week0
```

> Node 20+ 필요. 모든 실행은 `tsx`로 TypeScript를 바로 돌린다(빌드 불필요).
> `src/`는 연습문제라 채우기 전엔 `TODO` 에러가 난다 — 정상이다. `solutions/`에 정답이 있다.

## 실습 순서 (docs와 짝을 이룬다)

| 명령 | 문서 | 무엇을 하나 |
|------|------|-------------|
| `npm run week0` | [02장](docs/02-what-is-an-agent.md) | 프레임워크 없이 계산기 에이전트 루프. 에이전트가 `while` 루프임을 체감 |
| `npm run week1` | [03장](docs/03-langgraph-basics.md) | 프리빌트 `createAgent`(`langchain`)로 같은 걸 다시. 체크포인터(`@langchain/langgraph`)로 대화 상태 유지 |
| `npm run week3` | [04장](docs/04-multi-agent-patterns.md) | 분석가→광고 전략가→개발자 협업 (오케스트레이터 = 내 코드) |
| `npm run week5` | [05장](docs/05-eval-and-observability.md) | 손으로 만든 평가셋으로 통과율 측정 |
| `npm run week7` | [06장](docs/06-rag-when-needed.md) | 최소 RAG (검색→주입→생성) |
| infra (아래) | [08장](docs/08-agent-platform-infra.md) | 에이전트를 독립 서비스로, 오케스트레이터가 HTTP로 호출 |

각 파일 안의 `🎯 TODO` 를 채우면 실행된다. 채우기 전엔 `TODO` 에러가 나는 게 정상. 막히면 `solutions/`의 같은 파일을 열어 대조하라. 하단의 `🛠 더 해볼 것` 주석은 그 주차의 심화 과제다.

### 08장 인프라 실습 (터미널 3개)

```bash
npm run infra:analyst       # 터미널 1 — 분석 에이전트 :8001
npm run infra:ad-expert     # 터미널 2 — 광고 전략가 :8002
npm run infra:orchestrator  # 터미널 3 — 오케스트레이터가 둘을 HTTP로 호출
```

week3(앱 레이어, 함수 호출)와 결과를 비교해 보라 — **바뀐 건 "함수 호출 → HTTP 호출"뿐**이다.

그리고 provider 추상화 연습문제:

```bash
npm run infra:provider                       # 기본 Gemini
LLM_PROVIDER=anthropic npm run infra:provider # Claude 어댑터 (직접 구현 후)
```

## 핵심 관점 (docs 전반의 뼈대)

- **에이전트 = 프롬프트(역할) + 도구.** 협업 = 그걸 순서대로 부르고 결과를 넘기는 코드.
- **LLM은 JSON 요청만, 실행은 언제나 당신 코드.** (이벤트가 아니라 요청/응답)
- **다른 에이전트는 부르는 쪽에겐 그냥 또 하나의 툴.** 이 구조가 모든 층에서 재귀된다.
- **오케스트레이션은 없앨 수 없다 — 위치(중앙집중↔분산)만 바뀐다.**
- **앱 레이어로 충분한데 플랫폼부터 짓지 마라.** 승격 게이트는 [08장](docs/08-agent-platform-infra.md).

## 스택

Node 20+ · TypeScript(tsx) · `openai`(→ Gemini OpenAI 호환, week0·3·5·7) · `langchain`(프리빌트 `createAgent`) · `@langchain/langgraph`(StateGraph·체크포인터) · `@langchain/google`(week1 — 네이티브 Gemini `ChatGoogle`) · `fastify`.

> **week1만 네이티브 provider인 이유:** OpenAI 호환 계층은 **단발 호출엔 충분하지만 멀티턴 툴 루프에서 깨진다.** LangChain 문서는 `openai` provider가 "공식 OpenAI 스펙 대상이며 프록시의 provider 고유 필드는 보존되지 않을 수 있다"고 경고하고, Gemini 문서는 호환 계층이 beta이며 직접 호출을 권하면서 thinking 모델의 `thought` 블록을 **받은 그대로 되돌려보내야 한다**고 못박는다. 실제로 `ChatOpenAI` 로 툴을 물리면 2턴째에 `thought_signature` 누락 400이 난다. week0의 손수 짠 루프는 응답 메시지를 그대로 히스토리에 넣으니 서명이 살아남아 문제가 없다 — 같은 엔드포인트인데 원시 SDK는 되고 프레임워크는 안 되는 이유. 자세한 인과는 [03장](docs/03-langgraph-basics.md).
`@anthropic-ai/sdk`·`@langchain/anthropic`은 08장 provider 추상화 연습문제의 Claude(cc) 어댑터에 쓰인다.
파이썬 라이브러리가 꼭 필요한 에이전트만 별도 서비스로 격리하는 폴리글랏 전략은 [08장](docs/08-agent-platform-infra.md) 참고.
