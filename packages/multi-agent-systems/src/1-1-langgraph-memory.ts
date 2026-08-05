/**
 * 1~2주차 — LangGraph 기본기 (docs/03-langgraph-basics.md)
 *
 * week0에서 손으로 짠 루프를, LangGraph가 "워크플로 엔진"으로 대신 돌려준다.
 * 툴 정의·모델·체크포인터는 채워져 있다. 에이전트를 만들고 invoke 하는 부분을 구현하라.
 *
 * 명세: tests/1-1-langgraph-memory.test.ts (먼저 읽어라)
 * 막히면 정답: solutions/1-1-langgraph-memory.ts
 * 실행: npm run week1
 */
// v1부터 프리빌트 에이전트는 langchain 패키지의 createAgent 로 옮겨졌다
// (@langchain/langgraph/prebuilt 의 createReactAgent 는 deprecated).
import { createAgent, tool } from "langchain";
import { ChatGoogle } from "@langchain/google";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { z } from "zod";
// 환경변수는 shared/llm 에서만 주입된다(dotenv/config) → 값은 import 해서 쓴다.
// 여기서 process.env.GEMINI_API_KEY 를 직접 읽으면 undefined 다.
import { API_KEY, MODEL } from "../shared/llm";

// scaffolding — 그대로 사용
export const add = tool(async ({ a, b }: { a: number; b: number }) => String(a + b), {
  name: "add",
  description: "두 수를 더한다",
  schema: z.object({ a: z.number(), b: z.number() }),
});
export const multiply = tool(async ({ a, b }: { a: number; b: number }) => String(a * b), {
  name: "multiply",
  description: "두 수를 곱한다",
  schema: z.object({ a: z.number(), b: z.number() }),
});

/**
 * model·tools·checkpointer로 ReAct 에이전트를 만들고, 같은 thread(대화 세션)로 두 번 묻는다.
 * 두 번째 질문이 첫 번째 결과를 참조하므로, 체크포인터가 맥락을 이어주는지가 관찰 대상이다.
 */
export async function runTwoTurnChat(
  model: BaseChatModel,
  tools: unknown[],
  checkpointer: BaseCheckpointSaver
): Promise<{ first: string; second: string }> {
  // 🎯 TODO: 위 model·tools·checkpointer 로 ReAct 에이전트를 만들고, 같은 대화 세션(thread)으로 두 번 물어라.
  //   1) "(3 + 5) 곱하기 2는? 툴을 써서 계산해." → 답
  //   2) 같은 thread 로 "방금 결과에 10을 더하면?" → 체크포인터가 이전 맥락을 기억하는지 확인
  //   힌트: createAgent({ model, tools, checkpointer }), 에이전트의 invoke, thread 를 지정하는 config (docs/03).
  //   막히면 solutions/1-1-langgraph-memory.ts.
  throw new Error("TODO: ReAct 에이전트 생성 + 같은 thread 로 2회 대화를 구현하세요. 막히면 solutions 참고");
}

async function main() {
  // 모델 = Gemini 네이티브 provider (scaffolding)
  // week0 은 OpenAI 호환 엔드포인트로 Gemini 를 불렀지만, 여기선 네이티브를 쓴다.
  // 공식 문서가 그렇게 안내한다 — LangChain 은 ChatOpenAI + baseURL 조합에 대해
  // "공식 OpenAI 스펙을 대상으로 하며 프록시의 provider 고유 필드는 보존되지 않을 수 있다"고
  // 경고하고, Gemini API 문서도 OpenAI 호환은 beta 이며 직접 호출을 권한다.
  // 실제 증상: 툴 호출 후 2턴째에 400 (Gemini 가 요구하는 thought_signature 유실).
  //
  // @langchain/google 이 현재 권장 패키지다 (구 @langchain/google-genai·google-vertexai 대체).
  // apiKey 를 안 주면 GOOGLE_API_KEY 를 찾으므로, 여기선 shared/llm 의 값을 명시로 넘긴다.
  const model = new ChatGoogle({ model: MODEL, apiKey: API_KEY });
  const checkpointer = new MemorySaver(); // 재개/인터럽트의 전제

  const { first, second } = await runTwoTurnChat(model, [add, multiply], checkpointer);
  console.log("\n✅ 최종 답:", first);
  console.log("✅ 후속 답:", second);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

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
