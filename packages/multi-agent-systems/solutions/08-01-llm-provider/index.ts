/**
 * 08장 — LLM Provider 추상화 (docs/08-agent-platform-infra.md)
 *
 * 하나의 인터페이스(LLMProvider) 뒤에 Gemini·Claude 어댑터. env(LLM_PROVIDER)로 전환.
 *
 * 📍 되짚기: docs/08-agent-platform-infra.md / docs/90-must-memorize.md § 핵심 제약
 * 실행: npm run infra:provider   (LLM_PROVIDER=gemini|anthropic)
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
// 환경변수는 shared/env 에서만 주입된다 → 값은 import 해서 쓴다.
// (shared/llm 이 아니라 env 를 직접 보는 이유: llm 은 Gemini 키가 없으면 종료하는데,
//  이 파일은 LLM_PROVIDER=anthropic 만으로도 돌아가야 한다)
import { ANTHROPIC_MODEL, API_KEY, BASE_URL, LLM_PROVIDER, MODEL } from "../../shared/env";

export interface LLMProvider {
  name: string;
  model: string;
  ask(system: string, user: string): Promise<string>;
}

/** geminiProvider가 실제로 쓰는 부분만 담은 최소 인터페이스 — 테스트에서 스텁으로 갈아끼운다. */
export interface OpenAIChatClient {
  chat: {
    completions: {
      create(args: {
        model: string;
        messages: Array<{ role: "system" | "user"; content: string }>;
      }): Promise<{ choices: Array<{ message?: { content?: string | null } }> }>;
    };
  };
}

/** anthropicProvider가 실제로 쓰는 부분만 담은 최소 인터페이스 — 테스트에서 스텁으로 갈아끼운다. */
export interface AnthropicClient {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: "user"; content: string }>;
    }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

// --- Gemini 어댑터 (OpenAI 호환). client 를 주입받는다(anthropicProvider와 같은 모양) —
// 그래야 테스트가 실제 네트워크 없이 스텁으로 검증할 수 있다. ---
export function geminiProvider(client: OpenAIChatClient): LLMProvider {
  const model = MODEL;
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
export function anthropicProvider(client: AnthropicClient): LLMProvider {
  const model = ANTHROPIC_MODEL;
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
        .filter((b) => b.type === "text" && b.text !== undefined)
        .map((b) => b.text)
        .join("");
    },
  };
}

export function getProvider(): LLMProvider {
  const name = LLM_PROVIDER;
  switch (name) {
    case "gemini":
      // BASE_URL 은 LLM_BASE_URL 오버라이드를 반영한다 — GEMINI_BASE 를 직접 쓰면 그 오버라이드가 무시된다.
      return geminiProvider(new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL }));
    case "anthropic":
      return anthropicProvider(new Anthropic()); // ANTHROPIC_API_KEY 자동 로드
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
