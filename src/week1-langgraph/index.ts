/**
 * 1~2주차 — LangGraph 기본기 (docs/03-langgraph-basics.md)
 *
 * week0에서 손으로 짠 루프를, LangGraph가 "워크플로 엔진"으로 대신 돌려준다.
 * 여기선 프리빌트 createReactAgent로 빠르게 돌려보고 체크포인터(재개)를 체감한다.
 * 그다음 [직접 해볼 것]대로 StateGraph를 손수 조립해 보라.
 *
 * 실행: npm run week1
 */
import { ChatAnthropic } from "@langchain/anthropic";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

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

const model = new ChatAnthropic({
  model: process.env.MODEL ?? "claude-sonnet-5",
});

// 체크포인터: 매 노드 실행 후 상태를 저장 → 재개/사람승인(interrupt)의 전제
const checkpointer = new MemorySaver();

const agent = createReactAgent({ llm: model, tools: [add, multiply], checkpointer });

async function main() {
  // 같은 thread_id로 부르면 상태가 이어진다 (체크포인터)
  const config = { configurable: { thread_id: "demo-1" } };

  const res = await agent.invoke(
    { messages: [{ role: "user", content: "(3 + 5) 곱하기 2는? 툴을 써서 계산해." }] },
    config
  );
  console.log("\n✅ 최종 답:", res.messages.at(-1)?.content);

  // 같은 thread로 후속 질문 — 이전 맥락을 기억하는지 확인
  const res2 = await agent.invoke(
    { messages: [{ role: "user", content: "방금 결과에 10을 더하면?" }] },
    config
  );
  console.log("✅ 후속 답:", res2.messages.at(-1)?.content);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/*
 * 🛠 직접 해볼 것 (docs/03 참고):
 * 1. createReactAgent 대신 StateGraph 를 손수 조립:
 *    - Annotation.Root 로 messages 채널 정의(append 리듀서) — 덮어쓰기로 바꿔 대화가 깨지는지 관찰
 *    - agent 노드 + tool 노드 + 조건부 엣지(tool_use 있으면 tool, 없으면 END)
 * 2. SqliteSaver(@langchain/langgraph-checkpoint-sqlite)로 바꿔 재시작 후에도 상태가 남는지 확인
 * 3. "이메일 보내기" 노드 앞에 interruptBefore 를 걸어 사람 승인을 기다리게 만들기
 * 4. 체크포인터를 빼고 interrupt 를 시도해 "왜 안 되는지" 직접 확인
 */
