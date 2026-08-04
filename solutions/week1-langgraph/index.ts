/**
 * 1~2주차 — LangGraph 기본기 (docs/03-langgraph-basics.md)
 *
 * week0에서 손으로 짠 루프를, LangGraph가 "워크플로 엔진"으로 대신 돌려준다.
 * 모델은 ChatOpenAI 를 Gemini(OpenAI 호환) 엔드포인트로 가리켜 쓴다.
 *
 * 실행: npm run week1
 */
// v1부터 프리빌트 에이전트는 langchain 패키지의 createAgent 로 옮겨졌다
// (@langchain/langgraph/prebuilt 의 createReactAgent 는 deprecated).
import { createAgent, tool } from "langchain";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
// 환경변수는 shared/llm 에서만 주입된다(dotenv/config) → 값은 import 해서 쓴다
import { API_KEY, MODEL } from "../shared/llm";

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

// week0 은 OpenAI 호환 엔드포인트로 Gemini 를 불렀지만, 여기선 네이티브 provider 를 쓴다.
// 이유: ChatOpenAI 로 Gemini 3.x 에 툴을 물리면 1턴은 되고 **2턴째에 400** 이 난다 —
// Gemini 가 요구하는 thought_signature 를 OpenAI 호환 변환 과정에서 잃어버리기 때문.
const model = new ChatGoogleGenerativeAI({
  model: MODEL,
  apiKey: API_KEY,
});

// 체크포인터: 매 노드 실행 후 상태를 저장 → 재개/사람승인(interrupt)의 전제
const checkpointer = new MemorySaver();

// createReactAgent 의 llm 옵션은 createAgent 에서 model 로 이름이 바뀌었다
const agent = createAgent({ model, tools: [add, multiply], checkpointer });

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
 * 🛠 더 해볼 것 (docs/03):
 * - createAgent 대신 StateGraph 를 손수 조립 (Annotation.Root + append 리듀서 + 조건부 엣지)
 * - SqliteSaver 로 바꿔 재시작 후에도 상태가 남는지 확인
 * - 사람 승인 끼우기 — 프리빌트에는 interruptBefore 가 없다:
 *     createAgent({ ..., middleware: [humanInTheLoopMiddleware({ interruptOn: { multiply: true } })] })
 *     → 결과의 __interrupt__ 확인 후 agent.invoke(new Command({ resume }), config) 로 재개
 *     (StateGraph 로 조립했다면 .compile({ interruptBefore: ["tools"] }) 쪽)
 * - 체크포인터를 빼고 위 승인이 왜 안 되는지 확인
 */
