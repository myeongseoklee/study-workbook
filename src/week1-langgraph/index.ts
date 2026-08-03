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
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
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
  model: process.env.MODEL ?? "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY,
  configuration: {
    baseURL:
      process.env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
});
const checkpointer = new MemorySaver(); // 재개/인터럽트의 전제

async function main() {
  // 🎯 TODO 1: createReactAgent({ llm: model, tools: [add, multiply], checkpointer }) 로 에이전트 생성
  // 🎯 TODO 2: 같은 thread_id 로 두 번 invoke 하기
  //    - config = { configurable: { thread_id: "demo-1" } }
  //    - 1차: "(3 + 5) 곱하기 2는? 툴을 써서 계산해."
  //    - 2차: "방금 결과에 10을 더하면?"  ← 체크포인터가 이전 맥락을 기억하는지 확인
  // 🎯 TODO 3: 각 응답의 마지막 메시지 content 를 출력 (res.messages.at(-1)?.content)
  throw new Error(
    "TODO: createReactAgent + invoke 를 구현하세요. 막히면 solutions/week1-langgraph/index.ts 참고"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/*
 * 🛠 더 해볼 것 (docs/03):
 * - createReactAgent 대신 StateGraph 를 손수 조립 (Annotation.Root + append 리듀서 + 조건부 엣지)
 * - SqliteSaver 로 바꿔 재시작 후에도 상태가 남는지 확인
 * - "이메일 보내기" 노드 앞에 interruptBefore 로 사람 승인 끼우기 / 체크포인터 빼고 왜 안 되는지 확인
 */
