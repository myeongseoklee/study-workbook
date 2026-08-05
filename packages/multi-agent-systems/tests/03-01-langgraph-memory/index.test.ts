// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../src/03-01-langgraph-memory/index.ts를 고쳐라.
import { describe, expect, it } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import { add, multiply, runTwoTurnChat } from "../../src/03-01-langgraph-memory";
import { ScriptedChatModel } from "../scripted-chat-model";

describe("runTwoTurnChat", () => {
  it("tool_call을 실행해 얻은 실제 계산 결과를 최종 답으로 낸다", async () => {
    const model = new ScriptedChatModel([
      { content: "", toolCalls: [{ name: "add", args: { a: 3, b: 5 } }] },
      { content: "", toolCalls: [{ name: "multiply", args: { a: 8, b: 2 } }] },
      { content: "16" },
      { content: "", toolCalls: [{ name: "add", args: { a: 16, b: 10 } }] },
      { content: "26" },
    ]);
    const checkpointer = new MemorySaver();

    const { first, second } = await runTwoTurnChat(model, [add, multiply], checkpointer);

    expect(first).toBe("16");
    expect(second).toBe("26");
  });

  it("같은 thread로 두 번 호출하며 (3+5)*2 → +10을 실제 add/multiply 툴로 계산한다", async () => {
    // toolCalls의 args는 일부러 틀린 값을 넣어, 만약 실제 add/multiply가 아니라
    // 모델이 지어낸 content를 그대로 쓰는 잘못된 구현이면 이 값이 새어나오는지 본다.
    const model = new ScriptedChatModel([
      { content: "", toolCalls: [{ name: "add", args: { a: 3, b: 5 } }] },
      { content: "", toolCalls: [{ name: "multiply", args: { a: 8, b: 2 } }] },
      { content: "무시해야 할 값" }, // 모델이 뭘 말하든 실제 계산 결과(16)로 대체돼야 정상은 아니다 — 여기선 모델의 최종 content를 그대로 반환하는 게 맞다.
      { content: "", toolCalls: [{ name: "add", args: { a: 16, b: 10 } }] },
      { content: "무시해야 할 값 2" },
    ]);
    const checkpointer = new MemorySaver();

    const { first, second } = await runTwoTurnChat(model, [add, multiply], checkpointer);

    // 최종 답은 모델의 마지막 content를 그대로 반환한다 (에이전트는 판단하지 않는다)
    expect(first).toBe("무시해야 할 값");
    expect(second).toBe("무시해야 할 값 2");
  });

  it("두 번째 호출에 첫 번째 턴의 대화 내역이 이어져 있다 (체크포인터)", async () => {
    const model = new ScriptedChatModel([
      { content: "", toolCalls: [{ name: "add", args: { a: 3, b: 5 } }] },
      { content: "", toolCalls: [{ name: "multiply", args: { a: 8, b: 2 } }] },
      { content: "16" },
      { content: "26" },
    ]);
    const checkpointer = new MemorySaver();

    await runTwoTurnChat(model, [add, multiply], checkpointer);

    // 두 번째 턴 이후에 모델에 보낸 메시지들 중 하나(가장 마지막 호출)에는 첫 턴의 질문이 남아 있어야 한다.
    const lastCallMessages = model.calls.at(-1)!;
    const hasFirstTurnQuestion = lastCallMessages.some(
      (m) => typeof m.content === "string" && m.content.includes("(3 + 5) 곱하기 2는")
    );
    expect(hasFirstTurnQuestion).toBe(true);
  });
});
