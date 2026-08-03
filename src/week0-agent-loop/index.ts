/**
 * 0주차 — 프레임워크 없이 에이전트 만들기 (docs/02-what-is-an-agent.md)
 *
 * 에이전트의 전부: LLM 호출 → tool_use 파싱 → 함수 실행 → 결과 주입 → 반복.
 * 이 파일은 "돌아가는 기준선"이다. 실행해서 흐름을 눈으로 본 뒤,
 * 아래 [실험] 주석대로 일부러 망가뜨려 보며 왜 그 장치가 필요한지 체감하라.
 *
 * 실행: npm run week0
 */
import Anthropic from "@anthropic-ai/sdk";
import { client, MODEL } from "../shared/llm";

// ① 개발자가 LLM에게 알려주는 툴 목록 (이름·설명·JSON Schema)
const tools: Anthropic.Tool[] = [
  {
    name: "add",
    description: "두 수를 더한다",
    input_schema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
  {
    name: "multiply",
    description: "두 수를 곱한다",
    input_schema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
];

// ③ 실제 함수 — 실행 주체는 LLM이 아니라 "당신 코드"다.
function runTool(name: string, input: any): number {
  if (name === "add") return input.a + input.b;
  if (name === "multiply") return input.a * input.b;
  throw new Error(`알 수 없는 툴: ${name}`);
}

async function main() {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "(3 + 5) 곱하기 2는 얼마야? 반드시 툴을 써서 단계별로 계산해." },
  ];

  const MAX_STEPS = 10; // [실험] 이 줄을 지우면? → 무한 루프 위험 (타임아웃의 필요성)
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools,
      messages,
    });

    // 어시스턴트 응답을 히스토리에 쌓는다 (상태 관리)
    messages.push({ role: "assistant", content: res.content });

    const toolUses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    // tool_use가 없으면 = 최종 답. 루프 종료.
    if (toolUses.length === 0) {
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      console.log("\n✅ 최종 답:", text);
      return;
    }

    // ③④ 각 tool_use를 실행하고 결과를 tool_result로 되돌려준다
    const results: Anthropic.ToolResultBlockParam[] = toolUses.map((tu) => {
      const output = runTool(tu.name, tu.input);
      console.log(`🔧 ${tu.name}(${JSON.stringify(tu.input)}) = ${output}`);
      return { type: "tool_result", tool_use_id: tu.id, content: String(output) };
    });

    // [실험] 이 push를 주석 처리하면? → LLM이 방금 한 계산을 잊는다 (상태 관리의 필요성)
    messages.push({ role: "user", content: results });
  }

  console.log("\n⛔ MAX_STEPS 초과 — 강제 종료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
