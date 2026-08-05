/**
 * 0주차 — 프레임워크 없이 에이전트 만들기 (docs/02-what-is-an-agent.md)
 *
 * 에이전트의 전부: LLM 호출 → tool_call 파싱 → 함수 실행 → 결과 주입 → 반복.
 * (OpenAI 호환 형식. 기본 provider = Gemini)
 *
 * 📍 되짚기: docs/02-what-is-an-agent.md / docs/90-must-memorize.md § 핵심 제약
 */
import OpenAI from "openai";
import { client, MODEL } from "../../shared/llm";

/** 실제 OpenAI 응답의 부분집합 — `refusal`·`annotations` 같은 부가 필드를 요구하지 않아 테스트에서 손으로 만들기 쉽다. */
export interface AssistantMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
}

/** runAgentLoop이 실제로 쓰는 부분만 담은 최소 인터페이스 — 테스트에서 스텁으로 통째로 갈아끼운다. */
export interface ChatClient {
  chat: {
    completions: {
      create(args: {
        model: string;
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
        tools: OpenAI.Chat.Completions.ChatCompletionTool[];
      }): Promise<{ choices: Array<{ message: AssistantMessage }> }>;
    };
  };
}

// ① 개발자가 LLM에게 알려주는 툴 목록 (OpenAI function 형식)
export const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add",
      description: "두 수를 더한다",
      parameters: {
        type: "object",
        properties: { a: { type: "number" }, b: { type: "number" } },
        required: ["a", "b"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "multiply",
      description: "두 수를 곱한다",
      parameters: {
        type: "object",
        properties: { a: { type: "number" }, b: { type: "number" } },
        required: ["a", "b"],
      },
    },
  },
];

// ③ 실제 함수 — 실행 주체는 LLM이 아니라 "당신 코드"다.
export function runTool(name: string, args: any): number {
  if (name === "add") return args.a + args.b;
  if (name === "multiply") return args.a * args.b;
  throw new Error(`알 수 없는 툴: ${name}`);
}

/**
 * 에이전트 한 세션을 끝까지 돈다.
 * - 모델이 tool_call을 반환하면: runTool로 실행하고 결과를 messages에 넣어 다음 스텝으로.
 * - 모델이 tool_call 없이 답하면: 그 content를 최종 답으로 반환하고 끝.
 * - maxSteps를 넘기면 에러를 던진다 (무한 루프 방지).
 */
export async function runAgentLoop(
  chatClient: ChatClient,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  maxSteps: number // [실험] 이 값을 낮추면? → 무한 루프 위험 (타임아웃의 필요성)
): Promise<string> {
  for (let step = 0; step < maxSteps; step++) {
    const res = await chatClient.chat.completions.create({ model: MODEL, messages, tools });
    const msg = res.choices[0].message;

    // 어시스턴트 응답을 히스토리에 쌓는다 (상태 관리)
    messages.push(msg);

    const calls = msg.tool_calls ?? [];

    // tool_call이 없으면 = 최종 답. 루프 종료.
    if (calls.length === 0) {
      return msg.content ?? "";
    }

    // ③④ 각 tool_call을 실행하고 결과를 role:"tool"로 되돌려준다
    for (const c of calls) {
      if (c.type !== "function") continue;
      const args = JSON.parse(c.function.arguments);
      const output = runTool(c.function.name, args);
      console.log(`🔧 ${c.function.name}(${c.function.arguments}) = ${output}`);
      // [실험] 이 push를 주석 처리하면? → LLM이 방금 한 계산을 잊는다 (상태 관리의 필요성)
      messages.push({ role: "tool", tool_call_id: c.id, content: String(output) });
    }
  }

  throw new Error("⛔ MAX_STEPS 초과 — 강제 종료");
}

async function main() {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "user", content: "(3 + 5) 곱하기 2는 얼마야? 반드시 툴을 써서 단계별로 계산해." },
  ];
  const answer = await runAgentLoop(client, messages, 10);
  console.log("\n✅ 최종 답:", answer);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
