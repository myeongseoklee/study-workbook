/**
 * 1~2주차 — LangGraph 기본기 (docs/03-langgraph-basics.md)  [연습문제]
 *
 * week0에서 손으로 짠 루프를, LangGraph가 "워크플로 엔진"으로 대신 돌려준다.
 * 툴 정의·모델·체크포인터는 채워져 있다. 에이전트를 만들고 invoke 하는 부분을 구현하라.
 * 막히면 정답: solutions/week1-langgraph/index.ts
 *
 * 실행: npm run week1
 */
import { ChatOpenAI } from "@langchain/openai";
// v1부터 프리빌트 에이전트는 langchain 패키지의 createAgent 로 옮겨졌다
// (@langchain/langgraph/prebuilt 의 createReactAgent 는 deprecated).
import { createAgent, tool } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";

// scaffolding — 그대로 사용
const add = tool(async ({ a, b }) => String(a + b), {
  name: "add",
  description: "두 수를 더한다",
  schema: z.object({ a: z.number(), b: z.number() }),
});
const multiply = tool(async ({ a, b }) => String(a * b), {
  name: "multiply",
  description: "두 수를 곱한다",
  schema: z.object({ a: z.number(), b: z.number() }),
});

// 모델 = ChatOpenAI 를 Gemini(OpenAI 호환) 엔드포인트로 (scaffolding)
const model = new ChatOpenAI({
  model: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
  apiKey: process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY,
  configuration: {
    baseURL:
      process.env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
});
const checkpointer = new MemorySaver(); // 재개/인터럽트의 전제

async function main() {
  // 🎯 위 model·tools·checkpointer 로 ReAct 에이전트를 만들고, 같은 대화 세션(thread)으로 두 번 물어라.
  //   1) "(3 + 5) 곱하기 2는? 툴을 써서 계산해." → 답 출력
  //   2) 같은 thread 로 "방금 결과에 10을 더하면?" → 체크포인터가 이전 맥락을 기억하는지 확인
  //   힌트: createAgent({ model, tools, checkpointer }), 에이전트의 invoke, thread 를 지정하는 config (docs/03).
  //   막히면 solutions/week1-langgraph/index.ts.
  throw new Error(
    "TODO: ReAct 에이전트 생성 + 같은 thread 로 2회 대화를 구현하세요. 막히면 solutions 참고"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/*
 * 🛠 더 해볼 것 (docs/03):
 * - createAgent 대신 StateGraph 를 손수 조립 (Annotation.Root + append 리듀서 + 조건부 엣지)
 * - SqliteSaver 로 바꿔 재시작 후에도 상태가 남는지 확인
 * - "이메일 보내기" 노드 앞에 interruptBefore 로 사람 승인 끼우기 / 체크포인터 빼고 왜 안 되는지 확인
 */
