// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/04-01-multiagent-handoff/extra-1-agent-router.ts를 고쳐라.
//
// 선택 문제: 순차 핸드오프를 **오케스트레이터**로 승격한다. 다음에 누가 일할지를
// 코드가 미리 정하지 않고 LLM이 tool_use로 고르게 하는 순간, 모델이 지어낸 이름·
// 병렬 위임·깨진 인자를 코드가 감당해야 한다. 그 판단만 떼어낸 과제다.
import { describe, expect, it } from "vitest";
import { decideNext } from "../../src/04-01-multiagent-handoff/extra-1-agent-router";

const REGISTRY = ["analyst", "ad_expert"];

const msg = (opts: {
  content?: string | null;
  calls?: Array<{ id: string; name: string; args: string }>;
}) => ({
  role: "assistant" as const,
  content: opts.content ?? null,
  tool_calls: opts.calls?.map((c) => ({
    id: c.id,
    type: "function" as const,
    function: { name: c.name, arguments: c.args },
  })),
});

describe("decideNext — 다음 차례를 정한다", () => {
  it("등록된 에이전트를 부르면 그 에이전트로 위임한다", () => {
    const out = decideNext(
      msg({ calls: [{ id: "c1", name: "call_analyst", args: '{"input":"3월 지표 분석"}' }] }),
      REGISTRY,
    );
    expect(out).toEqual({ kind: "agent", name: "analyst", input: "3월 지표 분석" });
  });

  it("툴 호출 없이 내용만 오면 최종 답이다", () => {
    expect(decideNext(msg({ content: "결론입니다" }), REGISTRY)).toEqual({
      kind: "final",
      answer: "결론입니다",
    });
  });

  it("tool_calls가 빈 배열이어도 최종 답으로 본다 (경계)", () => {
    expect(decideNext(msg({ content: "결론", calls: [] }), REGISTRY)).toEqual({
      kind: "final",
      answer: "결론",
    });
  });

  it("등록되지 않은 에이전트를 부르면 error다 — 모델은 이름을 지어낸다", () => {
    const out = decideNext(
      msg({ calls: [{ id: "c1", name: "call_designer", args: "{}" }] }),
      REGISTRY,
    );
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.reason).toMatch(/designer/);
  });

  it("call_ 접두가 없는 툴 이름도 error다 — 위임 규약을 벗어난 호출이다", () => {
    const out = decideNext(msg({ calls: [{ id: "c1", name: "analyst", args: "{}" }] }), REGISTRY);
    expect(out.kind).toBe("error");
  });

  it("한 번에 둘을 부르면 error다 — 최종 답의 작성자는 하나여야 한다", () => {
    // 병렬 위임을 허용하면 두 갈래의 결과를 누가 합치는지가 불분명해지고,
    // 서로 다른 결론이 나왔을 때 최종 답이 어느 쪽인지 알 수 없다.
    const out = decideNext(
      msg({
        calls: [
          { id: "c1", name: "call_analyst", args: "{}" },
          { id: "c2", name: "call_ad_expert", args: "{}" },
        ],
      }),
      REGISTRY,
    );
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.reason).toMatch(/하나|단일|1개/);
  });

  it("인자 JSON이 깨졌으면 error다 — 던지지 않는다", () => {
    // 라우터가 예외를 흘리면 오케스트레이션 루프 전체가 죽는다. 모델이 만든
    // 문자열은 언제든 깨질 수 있으므로 판정 결과로 되돌려야 회복할 수 있다.
    const out = decideNext(
      msg({ calls: [{ id: "c1", name: "call_analyst", args: "{input:" }] }),
      REGISTRY,
    );
    expect(out.kind).toBe("error");
  });

  it("input이 비어 있으면 빈 문자열로 위임한다 (인자 누락은 error가 아니다)", () => {
    const out = decideNext(msg({ calls: [{ id: "c1", name: "call_analyst", args: "{}" }] }), REGISTRY);
    expect(out).toEqual({ kind: "agent", name: "analyst", input: "" });
  });

  it("툴 호출도 내용도 없으면 error다", () => {
    expect(decideNext(msg({}), REGISTRY).kind).toBe("error");
  });
});
