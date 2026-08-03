/**
 * 0주차 — 프레임워크 없이 에이전트 만들기 (docs/02-what-is-an-agent.md)  [연습문제]
 *
 * 에이전트의 전부: LLM 호출 → tool_use 파싱 → 함수 실행 → 결과 주입 → 반복.
 * 아래 main()의 for 루프 안을 직접 구현하라. (툴 정의·runTool 은 이미 채워져 있다)
 * 막히면 정답: solutions/week0-agent-loop/index.ts
 *
 * 실행: npm run week0
 */
import Anthropic from "@anthropic-ai/sdk";
import { client, MODEL } from "../shared/llm";

// ① 개발자가 LLM에게 알려주는 툴 목록 (scaffolding — 그대로 사용)
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

// ③ 실제 함수 — 실행 주체는 LLM이 아니라 "당신 코드"다 (scaffolding — 그대로 사용)
function runTool(name: string, input: any): number {
  if (name === "add") return input.a + input.b;
  if (name === "multiply") return input.a * input.b;
  throw new Error(`알 수 없는 툴: ${name}`);
}

async function main() {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "(3 + 5) 곱하기 2는 얼마야? 반드시 툴을 써서 단계별로 계산해." },
  ];

  const MAX_STEPS = 10; // 무한 루프 방지 (이게 왜 필요한지 docs/02에서 체감)
  for (let step = 0; step < MAX_STEPS; step++) {
    // 🎯 TODO 1: client.messages.create({ model: MODEL, max_tokens, tools, messages }) 로 LLM 호출
    // 🎯 TODO 2: 응답(res.content)을 messages 에 assistant 로 push (상태 관리)
    // 🎯 TODO 3: res.content 에서 type === "tool_use" 블록들만 골라낸다
    // 🎯 TODO 4: tool_use 가 하나도 없으면 = 최종 답. text 블록을 출력하고 return
    // 🎯 TODO 5: 각 tool_use 를 runTool 로 실행하고 tool_result 블록 배열을 만든다
    //           ({ type: "tool_result", tool_use_id: tu.id, content: String(결과) })
    // 🎯 TODO 6: tool_result 들을 messages 에 user 로 push 하고 루프 계속
    throw new Error(
      "TODO: week0 에이전트 루프를 구현하세요. 막히면 solutions/week0-agent-loop/index.ts 참고"
    );
  }

  console.log("⛔ MAX_STEPS 초과 — 강제 종료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
