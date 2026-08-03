# 멀티 에이전트 시스템 워크북 (Node/TypeScript 실습 환경)

3년차 백엔드 개발자를 위한 멀티 에이전트 시스템 학습 워크북 + **실제로 돌려보는 실습 환경**.
개념 문서는 [`docs/`](docs/)에, 손으로 돌려보는 코드는 [`src/`](src/)에 있다.

## 이 레포의 구조 (연습문제 방식)

`src/`는 **핵심 로직이 비어 있는 연습문제**다. 스캐폴드(환경·툴 정의·서버·하네스)는 작동하고,
배워야 할 부분만 `🎯 TODO` 로 남아 있다. 직접 채워 넣어야 실행된다.
막히면 `solutions/`의 완성본을 열어 대조하라.

```
docs/                      # 학습 문서 (읽기) — 00~08, 90 암기, 91 용어, 99 참고
src/                       # 🎯 연습문제 (여기를 채운다)
├── shared/
│   ├── llm.ts             # 공용 LLM 클라이언트(.env 자동 로드) — 그대로 사용
│   └── check.ts           # 환경 점검 (npm run check)
├── week0-agent-loop/      # 02장: 프레임워크 없이 에이전트 루프
├── week1-langgraph/       # 03장: LangGraph + 체크포인터
├── week3-multiagent/      # 04장: 광고 3전문가 협업 (앱 레이어)
├── week5-eval/            # 05장: 평가셋 하네스
├── week7-rag/             # 06장: 최소 RAG
└── infra/                 # 08장: 에이전트를 독립 서비스로 (Fastify) + 오케스트레이터
solutions/                 # ✅ 완성본 (막힐 때만 열어보기 — src/ 와 동일 구조)
```

## 시작하기

```bash
# 1) 의존성 설치
npm install

# 2) API 키 설정
cp .env.example .env
#   .env 를 열어 ANTHROPIC_API_KEY 를 채운다. MODEL 도 계정에서 쓸 수 있는 ID로 바꾼다.

# 3) 환경 점검 (여기가 ✅ 되면 세팅 완료 — 이후 에러는 '내 코드' 문제)
npm run check

# 4) 첫 실습 — src/week0-agent-loop/index.ts 의 🎯 TODO 를 채운 뒤 실행
npm run week0
```

> Node 20+ 필요. 모든 실행은 `tsx`로 TypeScript를 바로 돌린다(빌드 불필요).
> `src/`는 연습문제라 채우기 전엔 `TODO` 에러가 난다 — 정상이다. `solutions/`에 정답이 있다.

## 실습 순서 (docs와 짝을 이룬다)

| 명령 | 문서 | 무엇을 하나 |
|------|------|-------------|
| `npm run week0` | [02장](docs/02-what-is-an-agent.md) | 프레임워크 없이 계산기 에이전트 루프. 에이전트가 `while` 루프임을 체감 |
| `npm run week1` | [03장](docs/03-langgraph-basics.md) | LangGraph로 같은 걸 다시. 체크포인터로 대화 상태 유지 |
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

## 핵심 관점 (docs 전반의 뼈대)

- **에이전트 = 프롬프트(역할) + 도구.** 협업 = 그걸 순서대로 부르고 결과를 넘기는 코드.
- **LLM은 JSON 요청만, 실행은 언제나 당신 코드.** (이벤트가 아니라 요청/응답)
- **다른 에이전트는 부르는 쪽에겐 그냥 또 하나의 툴.** 이 구조가 모든 층에서 재귀된다.
- **오케스트레이션은 없앨 수 없다 — 위치(중앙집중↔분산)만 바뀐다.**
- **앱 레이어로 충분한데 플랫폼부터 짓지 마라.** 승격 게이트는 [08장](docs/08-agent-platform-infra.md).

## 스택

Node 20+ · TypeScript(tsx) · `@anthropic-ai/sdk` · `@langchain/langgraph` · `fastify`.
파이썬 라이브러리가 꼭 필요한 에이전트만 별도 서비스로 격리하는 폴리글랏 전략은 [08장](docs/08-agent-platform-infra.md) 참고.
