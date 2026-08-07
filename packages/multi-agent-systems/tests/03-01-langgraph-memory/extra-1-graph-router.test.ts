// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/03-01-langgraph-memory/extra-1-graph-router.ts를 고쳐라.
//
// 선택 문제: 프리빌트(createAgent) 대신 StateGraph를 손수 조립할 때 필요한 두 조각을
// 떼어내 만든다. 그래프 자체를 만드는 건 LangGraph API 학습이지만, **루프를 돌릴지
// 끝낼지 정하는 판단**과 **상태를 어떻게 쌓는지**는 프레임워크와 무관한 설계다.
import { describe, expect, it } from "vitest";
import { appendMessages, shouldContinue } from "../../src/03-01-langgraph-memory/extra-1-graph-router";
import type { GraphMessage } from "../../src/03-01-langgraph-memory/extra-1-graph-router";

const user = (content: string): GraphMessage => ({ role: "user", content });
const assistant = (content: string | null, toolCalls?: Array<{ id: string; name: string }>): GraphMessage => ({
  role: "assistant",
  content,
  ...(toolCalls ? { tool_calls: toolCalls } : {}),
});

describe("shouldContinue — 조건부 엣지의 판단", () => {
  it("마지막 메시지에 툴 호출이 있으면 tools로 간다", () => {
    const state = { messages: [user("3 더하기 5는?"), assistant(null, [{ id: "c1", name: "add" }])] };
    expect(shouldContinue(state)).toBe("tools");
  });

  it("툴 호출 없이 답만 있으면 끝낸다", () => {
    const state = { messages: [user("안녕"), assistant("안녕하세요")] };
    expect(shouldContinue(state)).toBe("__end__");
  });

  it("tool_calls가 빈 배열이면 끝낸다 — 있음/없음이 아니라 개수로 판단한다", () => {
    // 프로바이더에 따라 툴을 안 쓴 응답에도 빈 배열이 실려 온다. 키의 존재만
    // 보면 여기서 tools로 가버리고, tools 노드는 실행할 게 없어 빈 결과를
    // 되돌린다 — 그 결과가 다시 모델로 가면서 루프가 돈다.
    const state = { messages: [user("안녕"), assistant("안녕하세요", [])] };
    expect(shouldContinue(state)).toBe("__end__");
  });

  it("메시지가 하나도 없으면 끝낸다 (경계)", () => {
    expect(shouldContinue({ messages: [] })).toBe("__end__");
  });

  it("툴 호출은 **마지막** 메시지만 본다 — 과거의 호출로 다시 들어가지 않는다", () => {
    const state = {
      messages: [
        user("3 더하기 5는?"),
        assistant(null, [{ id: "c1", name: "add" }]),
        { role: "tool" as const, content: "8", tool_call_id: "c1" },
        assistant("8입니다"),
      ],
    };
    expect(shouldContinue(state)).toBe("__end__");
  });
});

describe("appendMessages — 상태 리듀서", () => {
  it("기존 뒤에 새 메시지를 순서대로 붙인다", () => {
    const prev = [user("a")];
    const next = [assistant("b"), user("c")];
    expect(appendMessages(prev, next).map((m) => m.content)).toEqual(["a", "b", "c"]);
  });

  it("원본 배열을 바꾸지 않는다 — 리듀서는 새 상태를 만든다", () => {
    const prev = [user("a")];
    const next = [assistant("b")];
    const out = appendMessages(prev, next);

    expect(prev).toHaveLength(1);
    expect(next).toHaveLength(1);
    expect(out).not.toBe(prev);
  });

  it("빈 업데이트는 기존을 그대로 둔다", () => {
    const prev = [user("a")];
    expect(appendMessages(prev, []).map((m) => m.content)).toEqual(["a"]);
  });

  it("빈 상태에서 시작해도 동작한다 (첫 턴)", () => {
    expect(appendMessages([], [user("첫 질문")]).map((m) => m.content)).toEqual(["첫 질문"]);
  });
});
