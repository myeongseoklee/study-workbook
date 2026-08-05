/**
 * 0주차 — 프레임워크 없이 에이전트 만들기 (docs/02-what-is-an-agent.md)
 *
 * 에이전트의 전부: LLM 호출 → tool_call 파싱 → 함수 실행 → 결과 주입 → 반복.
 * runAgentLoop() 안을 직접 구현하라. (툴 정의·runTool은 이미 채워져 있다)
 *
 * 명세: tests/02-01-agent-loop/index.test.ts (먼저 읽어라)
 * 막히면 정답: solutions/02-01-agent-loop.ts
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

// ① 개발자가 LLM에게 알려주는 툴 목록 (OpenAI function 형식 — scaffolding)
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

// ③ 실제 함수 — 실행 주체는 LLM이 아니라 "당신 코드"다 (scaffolding)
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
  maxSteps: number
): Promise<string> {
  for (let step = 0; step < maxSteps; step++) {
    const res = await chatClient.chat.completions.create({ model: MODEL, messages, tools });
    const msg = res.choices[0].message;
    messages.push(msg);

    const toolCalls = msg.tool_calls ?? [];

    if (toolCalls.length === 0) {
      return msg.content ?? "";
    }

    const results = toolCalls.map((tool) => {
      const { id, type } = tool;

      let content: string;

      try {
        if (type === "function") {
          content = String(runTool(tool.function.name, JSON.parse(tool.function.arguments)));
        } else if (type === "custom") {
          content = String(runTool(tool.custom.name, JSON.parse(tool.custom.input)));
        } else {
          const _exhaustive: never = tool;
          throw new Error(`알 수 없는 tool_call type: ${(tool as any).type}`);
        }
      } catch (error) {
        content = String(error);
      }

      return {
        tool_call_id: id,
        role: "tool" as const,
        content,
      };
    });

    messages.push(...results);
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
