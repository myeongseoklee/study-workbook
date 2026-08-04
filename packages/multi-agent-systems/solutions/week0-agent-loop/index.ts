/**
 * 0주차 — 프레임워크 없이 에이전트 만들기 (docs/02-what-is-an-agent.md)
 *
 * 에이전트의 전부: LLM 호출 → tool_call 파싱 → 함수 실행 → 결과 주입 → 반복.
 * (OpenAI 호환 형식. 기본 provider = Gemini)
 *
 * 실행: npm run week0
 */
import OpenAI from "openai";
import { client, MODEL } from "../shared/llm";

// ① 개발자가 LLM에게 알려주는 툴 목록 (OpenAI function 형식)
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
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
function runTool(name: string, args: any): number {
  if (name === "add") return args.a + args.b;
  if (name === "multiply") return args.a * args.b;
  throw new Error(`알 수 없는 툴: ${name}`);
}

async function main() {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "user", content: "(3 + 5) 곱하기 2는 얼마야? 반드시 툴을 써서 단계별로 계산해." },
  ];

  const MAX_STEPS = 10; // [실험] 이 줄을 지우면? → 무한 루프 위험 (타임아웃의 필요성)
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.chat.completions.create({ model: MODEL, messages, tools });
    const msg = res.choices[0].message;

    // 어시스턴트 응답을 히스토리에 쌓는다 (상태 관리)
    messages.push(msg);

    const calls = msg.tool_calls ?? [];

    // tool_call 이 없으면 = 최종 답. 루프 종료.
    if (calls.length === 0) {
      console.log("\n✅ 최종 답:", msg.content);
      return;
    }

    // ③④ 각 tool_call 을 실행하고 결과를 role:"tool" 로 되돌려준다
    for (const c of calls) {
      if (c.type !== "function") continue;
      const args = JSON.parse(c.function.arguments);
      const output = runTool(c.function.name, args);
      console.log(`🔧 ${c.function.name}(${c.function.arguments}) = ${output}`);
      // [실험] 이 push를 주석 처리하면? → LLM이 방금 한 계산을 잊는다 (상태 관리의 필요성)
      messages.push({ role: "tool", tool_call_id: c.id, content: String(output) });
    }
  }

  console.log("\n⛔ MAX_STEPS 초과 — 강제 종료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
