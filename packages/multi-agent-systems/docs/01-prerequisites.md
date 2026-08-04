# 01. 선수 지식 — 이미 아는 것과 새로 배울 것

## 학습 목표

이 챕터를 다 읽으면, 백엔드 경험 중 어떤 것이 그대로 전이되고 무엇만 새로 배우면 되는지 구분할 수 있고, 실습 환경을 준비할 수 있다.

## 핵심 원리 (WHY) — 당신은 이미 절반을 안다

에이전트 시스템의 실패는 대부분 "LLM이 멍청해서"가 아니라 **분산 시스템을 잘못 다뤄서** 일어난다. 다음은 3년차 백엔드가 이미 아는 것들이고, 그대로 쓰인다:

| 백엔드에서 이미 아는 것 | 에이전트에서 어떻게 다시 쓰이나 |
|---|---|
| **상태 관리** | 에이전트의 대화·중간 결과를 어디에 저장하고 어떻게 병합하나 (→ LangGraph State/Reducer) |
| **재시도(retry)와 백오프** | LLM 호출·툴 호출이 실패하면 어떻게 다시 하나 |
| **타임아웃** | 무한 루프·응답 없는 툴을 어떻게 끊나 |
| **멱등성(idempotency)** | 같은 툴을 두 번 호출해도 안전한가 (재시도의 전제) |
| **관측성(observability)** | 요청이 어디서 느려지고 어디서 깨졌나 추적 (→ 트레이싱) |
| **큐/워커 패턴** | 오케스트레이터가 서브태스크를 뿌리고 결과를 모으는 구조 |

**새로 배울 것은 단 하나:** LLM이라는 **비결정적 컴포넌트**를 통제하는 법. 같은 입력에 다른 출력이 나올 수 있고, 형식을 안 지킬 수 있고, 그럴듯한 거짓을 반환할 수 있다. 이 통제 기술이 이후 모든 챕터의 실질이다.

## 필수 지식 (HOW) — 새로 채워야 할 최소 개념

프레임워크에 들어가기 전에 이 세 가지는 정의 수준으로 알아야 한다. 자세한 어휘는 [91. 용어 해설집](91-glossary.md)에 있다.

### 1. LLM 호출은 그냥 HTTP 요청이다
LLM API 호출은 특별하지 않다. 텍스트(정확히는 토큰 배열)를 보내고 텍스트를 받는 요청/응답이다. 다른 점은 응답이 **비결정적**이고, 요금이 **토큰 단위**로 부과된다는 것뿐이다.

- **토큰(token)**: LLM이 텍스트를 자르는 단위. 대략 영어 1토큰 ≈ 4글자, 한글은 더 잘게 쪼개진다. 입력 토큰과 출력 토큰에 각각 요금이 붙는다.
- **컨텍스트 윈도우(context window)**: 한 번의 호출에 넣을 수 있는 최대 토큰 수. 이걸 넘으면 오래된 내용을 잘라내야 한다. 멀티 에이전트를 쪼개는 이유 중 하나가 "각 에이전트에게 필요한 컨텍스트만 주려고"다.

### 2. 툴 호출 = 함수 호출 (Function Calling / Tool Use)

**핵심 오해부터 풀자: LLM은 함수를 실행하지 않는다.** LLM이 할 수 있는 건 오직 "이 함수를 이 인자로 불러줘"라는 **JSON을 반환하는 것**뿐이다. 실제 실행은 **당신 코드**가 한다. 이 구조화된 요청/응답을 **tool_use**(또는 function calling)라고 한다.

왜 이렇게 나눠져 있나? LLM은 텍스트를 생성하는 모델일 뿐, DB를 조회하거나 API를 때릴 능력이 없다. 그래서 "나 대신 이걸 실행해줘"라고 **주문서(JSON)**를 내밀고, 당신 코드가 주방에서 요리해서 결과를 돌려주는 구조다.

구체적으로 무엇이 오가는지 날씨 조회 예시로 4단계를 따라가 보자:

**① 개발자가 쓸 수 있는 툴 목록을 LLM에 함께 보낸다** (이름·설명·인자 스키마):
```json
{ "name": "get_weather",
  "description": "도시의 현재 날씨를 조회한다",
  "input_schema": { "type": "object",
    "properties": { "city": { "type": "string" } },
    "required": ["city"] } }
```

**② LLM이 "이 툴을 이 인자로 불러줘"라는 JSON을 반환한다** (실행이 아니라 *요청*):
```json
{ "type": "tool_use", "id": "toolu_01",
  "name": "get_weather",
  "input": { "city": "서울" } }
```

**③ 당신 코드가 그 요청을 보고 실제 함수를 실행한다:**
```typescript
if (block.type === "tool_use" && block.name === "get_weather") {
  const result = await getWeather(block.input.city);  // ← 여기서 진짜 실행
}
```

**④ 실행 결과를 대화 히스토리에 넣어 LLM에 다시 보낸다** (`tool_use_id`로 어느 요청의 답인지 연결):
```json
{ "type": "tool_result", "tool_use_id": "toolu_01",
  "content": "서울 12도, 맑음" }
```

그러면 LLM은 이 결과를 받아 "서울은 지금 12도이고 맑습니다"라는 최종 텍스트를 생성한다. **LLM은 ②(요청)와 최종 답(생성)만 하고, ③(실행)은 언제나 당신 코드다.** 이 ①~④가 반복되는 것이 에이전트의 심장이다([02장](02-what-is-an-agent.md)).

### 3. 시스템 프롬프트 = 에이전트의 역할 정의
LLM 호출에는 보통 세 종류의 메시지가 있다: **system**(에이전트의 정체성·규칙), **user**(사용자 입력), **assistant**(LLM 응답). 여기에 tool_use 결과가 대화 히스토리에 쌓인다. 프롬프트 설계는 이후 "context engineering"이라는 이름으로 다시 등장한다([04장](04-multi-agent-patterns.md)).

## 🛠 직접 해볼 것 — 환경 준비

> **이 워크북은 Node/TypeScript 기준이다.** 회사 표준이 Node이므로 주력을 Node로 잡는다. LLM SDK·LangGraph 모두 JS 정식판이 있고, 개념은 언어 중립이다. (파이썬 라이브러리가 꼭 필요한 특정 에이전트만 나중에 별도 서비스로 격리 — [08장](08-agent-platform-infra.md) 참고.)

- [ ] Node 20+ 설치 확인 (`node --version`) — 최신 LTS 권장
- [ ] 프로젝트 초기화 (`npm init -y`), TypeScript 셋업 (`npm i -D typescript tsx @types/node`)
- [ ] LLM SDK 설치: `npm i openai` — 0주차에 프레임워크 없이 쓴다. 기본 provider는 **Gemini 무료 티어**를 OpenAI 호환 엔드포인트로 호출한다
- [ ] API 키 발급 후 환경변수로 등록 (`.env` + `dotenv`) — 무료 키: https://aistudio.google.com/apikey. **코드에 하드코딩하지 말 것**, `.env`는 `.gitignore`에
  - 이 워크북의 규칙: `.env` 는 `import "dotenv/config"` 를 **실행한 프로세스에만** 로드된다. 그래서 주입은 `src/shared/env.ts` 한 곳에서만 하고, 다른 파일은 `process.env` 를 읽지 않고 거기서 export 된 값을 import 한다 (엔트리포인트마다 dotenv 를 챙기는 실수를 구조로 막는다)
- [ ] (여러 벤더를 인터페이스로 추상화하고 Claude(cc)를 어댑터로 두는 것은 [08장](08-agent-platform-infra.md) 연습문제)
- [ ] 무료 티어라도 사용량 한도 확인 — 무한 루프 버그 대비

**자가진단:**
1. tool_use에서 실제로 함수를 실행하는 주체는 LLM인가 당신 코드인가? (답: 당신 코드)
2. 멀티 에이전트로 쪼개면 컨텍스트 윈도우 문제가 왜 완화되는가?
3. 재시도를 안전하게 하려면 툴이 어떤 성질을 가져야 하는가? (답: 멱등성)

## 공식 문서

- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages) — LLM 호출·tool_use의 기본 요청/응답 구조
- [Anthropic Tool use 개요](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — function calling 메커니즘
