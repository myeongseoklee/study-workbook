// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../src/08-01-llm-provider/index.ts를 고쳐라.
import { describe, expect, it } from "vitest";
import { scripted } from "@study/testkit";
import { anthropicProvider } from "../../src/08-01-llm-provider";
import type { AnthropicClient } from "../../src/08-01-llm-provider";
import { ANTHROPIC_MODEL } from "../../shared/env";

function stubAnthropicClient(response: { content: Array<{ type: string; text?: string }> }) {
  const create = scripted<[Record<string, unknown>], Promise<typeof response>>([Promise.resolve(response)]);
  const client: AnthropicClient = { messages: { create } };
  return { client, create };
}

describe("anthropicProvider", () => {
  it("선언한 model로 실제 호출한다 — 계약과 호출이 어긋나지 않는다", async () => {
    const { client, create } = stubAnthropicClient({ content: [{ type: "text", text: "..." }] });
    const provider = anthropicProvider(client);

    await provider.ask("s", "u");

    // name·model 자체는 스캐폴딩이 채워 둔다. 검사할 값은 그 선언대로 **실제로
    // 부르는가**이고, 그건 ask()를 구현해야 드러난다 — 선언과 호출이 갈라지면
    // 벤더를 바꿔도 옛 모델을 계속 부르는 버그가 조용히 남는다.
    expect(provider.name).toBe("anthropic");
    expect(provider.model).toBe(ANTHROPIC_MODEL);
    expect(create.calls[0][0].model).toBe(ANTHROPIC_MODEL);
  });

  it("system을 top-level 파라미터로, user를 messages[0].content로 보낸다", async () => {
    const { client, create } = stubAnthropicClient({ content: [{ type: "text", text: "답" }] });
    const provider = anthropicProvider(client);

    await provider.ask("너는 봇이다", "안녕");

    expect(create.calls[0][0]).toMatchObject({
      model: ANTHROPIC_MODEL,
      system: "너는 봇이다",
      messages: [{ role: "user", content: "안녕" }],
    });
  });

  it("type이 text인 블록의 text를 반환한다", async () => {
    const { client } = stubAnthropicClient({ content: [{ type: "text", text: "안녕하세요" }] });
    const provider = anthropicProvider(client);

    const out = await provider.ask("system", "user");

    expect(out).toBe("안녕하세요");
  });

  it("text 블록이 여러 개면 전부 이어붙인다", async () => {
    const { client } = stubAnthropicClient({
      content: [
        { type: "text", text: "첫 번째. " },
        { type: "text", text: "두 번째." },
      ],
    });
    const provider = anthropicProvider(client);

    const out = await provider.ask("system", "user");

    expect(out).toBe("첫 번째. 두 번째.");
  });

  it("text가 아닌 블록(예: thinking)은 무시한다", async () => {
    const { client } = stubAnthropicClient({
      content: [
        { type: "thinking", text: "속으로 생각 중..." },
        { type: "text", text: "최종 답" },
      ],
    });
    const provider = anthropicProvider(client);

    const out = await provider.ask("system", "user");

    expect(out).toBe("최종 답");
  });
});
