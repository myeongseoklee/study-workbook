/**
 * 08장 — LLM Provider 추상화 (docs/08-agent-platform-infra.md)  [연습문제]
 *
 * 플랫폼은 특정 LLM 벤더에 묶이면 안 된다. 하나의 인터페이스(LLMProvider) 뒤에
 * 여러 벤더를 어댑터로 두고, env(LLM_PROVIDER)로 갈아끼운다.
 *
 * Gemini 어댑터는 완성되어 있다. 🎯 Claude(cc) 어댑터를 직접 구현하라.
 * 막히면 정답: solutions/infra/llm-provider.ts
 *
 * 실행: npm run infra:provider   (LLM_PROVIDER=gemini|anthropic 로 전환)
 */
import "dotenv/config";
import OpenAI from "openai";
// import Anthropic from "@anthropic-ai/sdk"; // ← Claude 어댑터에서 주석 해제

// 모든 provider가 지키는 계약(interface)
export interface LLMProvider {
  name: string;
  model: string;
  ask(system: string, user: string): Promise<string>;
}

// --- Gemini 어댑터 (OpenAI 호환) — 완성 ---
function geminiProvider(): LLMProvider {
  const model = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
  const client = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
  return {
    name: "gemini",
    model,
    async ask(system, user) {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return res.choices[0]?.message?.content ?? "";
    },
  };
}

// --- Claude(cc) 어댑터 — 🎯 직접 구현 ---
function anthropicProvider(): LLMProvider {
  // 🎯 TODO: 위 geminiProvider 와 "같은 인터페이스"를 Anthropic SDK로 구현하라.
  //   1) import 를 주석 해제하고 new Anthropic() (ANTHROPIC_API_KEY 자동 로드)
  //   2) model 기본값: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5"
  //   3) ask(system, user):
  //        client.messages.create({ model, max_tokens: 1024, system, messages: [{ role:"user", content:user }] })
  //        → 응답 content 배열에서 type==="text" 블록만 뽑아 이어붙여 반환
  //   힌트: Anthropic 은 system 이 top-level 파라미터(메시지 role 아님), 응답은 content 블록 배열.
  //   막히면 정답: solutions/infra/llm-provider.ts
  throw new Error("TODO: Claude(anthropic) 어댑터를 구현하세요.");
}

// env LLM_PROVIDER 로 어댑터 선택
export function getProvider(): LLMProvider {
  const name = process.env.LLM_PROVIDER ?? "gemini";
  switch (name) {
    case "gemini":
      return geminiProvider();
    case "anthropic":
      return anthropicProvider();
    default:
      throw new Error(`알 수 없는 LLM_PROVIDER: ${name} (gemini | anthropic)`);
  }
}

// 데모: 선택된 provider로 한 번 물어본다 — 어댑터만 바꿔도 나머지 코드는 그대로
async function main() {
  const p = getProvider();
  console.log(`provider=${p.name}, model=${p.model}\n`);
  const out = await p.ask(
    "한국어 한 문장으로만 답하라.",
    "멀티 에이전트 플랫폼에서 LLM provider 추상화가 왜 필요한가?"
  );
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/*
 * 🛠 더 해볼 것:
 * - OpenAI 본토 어댑터 추가 (baseURL 없이 new OpenAI())
 * - 인터페이스에 tool 호출 지원 추가: complete({system, messages, tools}) → {text, toolCalls}
 *   그리고 각 어댑터에서 벤더별 tool 형식(OpenAI function ↔ Anthropic tool_use)을 정규화
 * - week3 오케스트레이터가 이 getProvider() 를 쓰도록 바꿔 provider 무관하게 만들기
 */
