// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../src/0-1-agent-loop.ts를 고쳐라.
import { describe, expect, it } from "vitest";
import { scripted } from "@study/testkit";
import { runAgentLoop, runTool } from "../src/0-1-agent-loop";

/** create()가 돌려줄 응답 하나. tool_call 있는 스텝과 최종 답 스텝을 섞어 대본을 짠다. */
function assistantMsg(opts: {
  content?: string | null;
  toolCalls?: Array<{ id: string; name: string; args: Record<string, number> }>;
}) {
  return {
    choices: [
      {
        message: {
          role: "assistant" as const,
          content: opts.content ?? null,
          tool_calls: opts.toolCalls?.map((c) => ({
            id: c.id,
            type: "function" as const,
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          })),
        },
      },
    ],
  };
}

/** create() 호출을 스텁으로 대체한 최소 ChatClient. create의 호출 기록은 create.calls로 본다. */
function stubClient(steps: ReturnType<typeof assistantMsg>[]) {
  const create = scripted<[Record<string, unknown>], Promise<ReturnType<typeof assistantMsg>>>(
    steps.map((s) => Promise.resolve(s)),
  );
  return { client: { chat: { completions: { create } } }, create };
}

describe("runTool", () => {
  it("add·multiply를 계산한다", () => {
    expect(runTool("add", { a: 3, b: 5 })).toBe(8);
    expect(runTool("multiply", { a: 4, b: 2 })).toBe(8);
  });

  it("모르는 툴 이름이면 던진다", () => {
    expect(() => runTool("subtract", { a: 1, b: 1 })).toThrow(/알 수 없는 툴/);
  });
});

describe("runAgentLoop", () => {
  it("tool_call 없이 바로 답하면 한 번만 호출하고 그 content를 반환한다", async () => {
    const { client, create } = stubClient([assistantMsg({ content: "16" })]);

    const answer = await runAgentLoop(client, [{ role: "user", content: "8 곱하기 2는?" }], 10);

    expect(answer).toBe("16");
    expect(create.calls).toHaveLength(1);
  });

  it("tool_call 응답 뒤 최종 답이 오면, 그 사이 runTool 실행 결과를 messages에 role:tool로 되돌린다", async () => {
    const { client, create } = stubClient([
      assistantMsg({ toolCalls: [{ id: "call_1", name: "add", args: { a: 3, b: 5 } }] }),
      assistantMsg({ content: "8" }),
    ]);
    const messages: any[] = [{ role: "user", content: "3 더하기 5는?" }];

    const answer = await runAgentLoop(client, messages, 10);

    expect(answer).toBe("8");
    expect(create.calls).toHaveLength(2);
    // 두 번째 호출에 보낸 messages에 방금 계산한 8이 role:tool로 들어 있어야 한다 — 없으면 모델이 계산을 잊는다.
    const secondCallMessages = create.calls[1][0].messages as any[];
    const toolResult = secondCallMessages.find((m) => m.role === "tool");
    expect(toolResult).toBeDefined();
    expect(toolResult.content).toBe("8");
    expect(toolResult.tool_call_id).toBe("call_1");
  });

  it("한 응답에 tool_call이 여러 개면 전부 실행하고 각각 결과를 되돌린다", async () => {
    const { client, create } = stubClient([
      assistantMsg({
        toolCalls: [
          { id: "call_1", name: "add", args: { a: 3, b: 5 } },
          { id: "call_2", name: "multiply", args: { a: 8, b: 2 } },
        ],
      }),
      assistantMsg({ content: "16" }),
    ]);
    const messages: any[] = [{ role: "user", content: "(3+5) 곱하기 2는?" }];

    await runAgentLoop(client, messages, 10);

    const secondCallMessages = create.calls[1][0].messages as any[];
    const toolResults = secondCallMessages.filter((m) => m.role === "tool");
    expect(toolResults).toHaveLength(2);
    expect(toolResults.find((m) => m.tool_call_id === "call_1").content).toBe("8");
    expect(toolResults.find((m) => m.tool_call_id === "call_2").content).toBe("16");
  });

  it("maxSteps를 넘기도록 계속 tool_call만 오면 던진다 (무한 루프 방지)", async () => {
    const toolCallForever = assistantMsg({ toolCalls: [{ id: "call_x", name: "add", args: { a: 1, b: 1 } }] });
    const { client } = stubClient([toolCallForever, toolCallForever]);
    const messages: any[] = [{ role: "user", content: "끝나지 않는 질문" }];

    await expect(runAgentLoop(client, messages, 2)).rejects.toThrow(/MAX_STEPS/);
  });
});
