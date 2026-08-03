/**
 * 0주차 — 프레임워크 없이 에이전트 만들기 (docs/02-what-is-an-agent.md)  [연습문제]
 *
 * 에이전트의 전부: LLM 호출 → tool_call 파싱 → 함수 실행 → 결과 주입 → 반복.
 * 아래 main()의 for 루프 안을 직접 구현하라. (툴 정의·runTool 은 이미 채워져 있다)
 * 막히면 정답: solutions/week0-agent-loop/index.ts
 *
 * 실행: npm run week0
 */
import OpenAI from "openai";
import { client, MODEL } from "../shared/llm";

// ① 개발자가 LLM에게 알려주는 툴 목록 (OpenAI function 형식 — scaffolding)
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

// ③ 실제 함수 — 실행 주체는 LLM이 아니라 "당신 코드"다 (scaffolding)
function runTool(name: string, args: any): number {
  if (name === "add") return args.a + args.b;
  if (name === "multiply") return args.a * args.b;
  throw new Error(`알 수 없는 툴: ${name}`);
}

async function main() {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "user", content: "(3 + 5) 곱하기 2는 얼마야? 반드시 툴을 써서 단계별로 계산해." },
  ];

  const MAX_STEPS = 10; // 무한 루프 방지 (이게 왜 필요한지 docs/02에서 체감)
  for (let step = 0; step < MAX_STEPS; step++) {
    // 🎯 TODO 1: client.chat.completions.create({ model: MODEL, messages, tools }) 로 LLM 호출
    // 🎯 TODO 2: res.choices[0].message 를 messages 에 push (상태 관리)
    // 🎯 TODO 3: message.tool_calls 를 꺼낸다 (없으면 빈 배열)
    // 🎯 TODO 4: tool_calls 가 비었으면 = 최종 답. message.content 를 출력하고 return
    // 🎯 TODO 5: 각 tool_call 마다 JSON.parse(c.function.arguments) → runTool 실행
    // 🎯 TODO 6: 실행 결과를 { role: "tool", tool_call_id: c.id, content: String(결과) } 로 push 하고 루프 계속
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
