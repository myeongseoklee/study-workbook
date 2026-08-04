/**
 * 08장 — LLM Provider 추상화 (docs/08-agent-platform-infra.md)  [정답]
 *
 * 하나의 인터페이스(LLMProvider) 뒤에 Gemini·Claude 어댑터. env(LLM_PROVIDER)로 전환.
 * 실행: npm run infra:provider   (LLM_PROVIDER=gemini|anthropic)
 */
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
// 환경변수는 shared/env 에서만 주입된다 → 값은 import 해서 쓴다.
// (shared/llm 이 아니라 env 를 직접 보는 이유: llm 은 Gemini 키가 없으면 종료하는데,
//  이 파일은 LLM_PROVIDER=anthropic 만으로도 돌아가야 한다)
import { ANTHROPIC_MODEL, API_KEY, GEMINI_BASE, LLM_PROVIDER, MODEL } from "../shared/env";

export interface LLMProvider {
  name: string;
  model: string;
  ask(system: string, user: string): Promise<string>;
}

// --- Gemini 어댑터 (OpenAI 호환) ---
function geminiProvider(): LLMProvider {
  const model = MODEL;
  const client = new OpenAI({ apiKey: API_KEY, baseURL: GEMINI_BASE });
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

// --- Claude(cc) 어댑터 (Anthropic SDK) ---
function anthropicProvider(): LLMProvider {
  const model = ANTHROPIC_MODEL;
  const client = new Anthropic(); // ANTHROPIC_API_KEY 자동 로드 (dotenv 는 shared/env 가 이미 실행)
  return {
    name: "anthropic",
    model,
    async ask(system, user) {
      const res = await client.messages.create({
        model,
        max_tokens: 1024,
        system, // Anthropic 은 system 이 top-level 파라미터
        messages: [{ role: "user", content: user }],
      });
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    },
  };
}

export function getProvider(): LLMProvider {
  const name = LLM_PROVIDER;
  switch (name) {
    case "gemini":
      return geminiProvider();
    case "anthropic":
      return anthropicProvider();
    default:
      throw new Error(`알 수 없는 LLM_PROVIDER: ${name} (gemini | anthropic)`);
  }
}

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
