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
    // 🎯 이 루프 안에 "에이전트 한 스텝"을 구현하라.
    //   - 현재 대화(messages)와 tools 를 모델에 보내 다음 행동을 받는다.
    //   - 응답에 툴 호출이 있으면: 그 툴을 runTool 로 실행하고, 결과를 대화에 다시 넣어 다음 스텝으로.
    //   - 툴 호출이 없으면: 그게 최종 답. 출력하고 루프를 끝낸다.
    //   핵심: 모델 응답도, 툴 실행 결과도 매번 messages 에 쌓아야 모델이 맥락을 잃지 않는다.
    //   개념: docs/01 '툴 호출 4단계' + docs/02.  API 형식(OpenAI)이 막히면 solutions 참고.
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
