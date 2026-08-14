// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/05-01-eval-harness/extra-1-failure-triage.ts를 고쳐라.
//
// 선택 문제: 실패를 세는 것과 **분류하는 것**은 다르다. "정확도 62%"는 무엇을
// 고쳐야 할지 알려주지 않지만, "실패 12건 중 7건이 라우팅"은 알려준다.
//
// 신호가 겹치는 트레이스가 여럿 있다. 무엇을 답으로 삼을지는 docs/05-eval-and-observability.md
// 의 실패 유형 표를 근거로 판단하라 — 이 파일은 답만 적고 이유는 적지 않는다.
import { describe, expect, it } from "vitest";
import { classifyFailure, summarize } from "../../src/05-01-eval-harness/extra-1-failure-triage";
import type { Trace } from "../../src/05-01-eval-harness/extra-1-failure-triage";

const trace = (over: Partial<Trace> = {}): Trace => ({
  expectedAgent: "analyst",
  maxSteps: 6,
  steps: [{ agent: "analyst", tool: { name: "search", ok: true } }],
  answer: "정상 답변",
  ...over,
});

describe("classifyFailure — 신호가 하나일 때", () => {
  it("툴이 실패했으면 tool-call이다", () => {
    expect(
      classifyFailure(trace({ steps: [{ agent: "analyst", tool: { name: "search", ok: false } }] })),
    ).toBe("tool-call");
  });

  it("기대와 다른 에이전트가 일했으면 routing이다", () => {
    expect(
      classifyFailure(trace({ steps: [{ agent: "ad_expert", tool: { name: "search", ok: true } }] })),
    ).toBe("routing");
  });

  it("스텝이 상한에 닿았으면 infinite-loop다", () => {
    const steps = Array.from({ length: 6 }, () => ({ agent: "analyst", tool: { name: "search", ok: true } }));
    expect(classifyFailure(trace({ steps, maxSteps: 6 }))).toBe("infinite-loop");
  });

  it("스텝이 상한을 넘겼으면 infinite-loop다", () => {
    const steps = Array.from({ length: 7 }, () => ({ agent: "analyst", tool: { name: "s", ok: true } }));
    expect(classifyFailure(trace({ steps, maxSteps: 6 }))).toBe("infinite-loop");
  });

  it("답변에 다른 질문의 흔적이 섞였으면 context-pollution이다", () => {
    expect(classifyFailure(trace({ answer: "정상 답변", leakedFrom: "다른 세션" }))).toBe(
      "context-pollution",
    );
  });

  it("실패 신호가 없으면 unknown이다", () => {
    expect(classifyFailure(trace())).toBe("unknown");
  });
});

describe("classifyFailure — 스텝의 모양", () => {
  it("스텝이 아예 없으면 unknown이다", () => {
    expect(classifyFailure(trace({ steps: [] }))).toBe("unknown");
  });

  it("스텝이 없고 상한도 0이면 unknown이다", () => {
    expect(classifyFailure(trace({ steps: [], maxSteps: 0 }))).toBe("unknown");
  });

  it("툴을 쓰지 않은 정상 스텝뿐이면 unknown이다", () => {
    expect(classifyFailure(trace({ steps: [{ agent: "analyst" }] }))).toBe("unknown");
  });

  it("툴 쓴 스텝과 안 쓴 스텝이 섞여도, 실패한 툴이 없으면 unknown이다", () => {
    const steps = [{ agent: "analyst", tool: { name: "search", ok: true } }, { agent: "analyst" }];
    expect(classifyFailure(trace({ steps }))).toBe("unknown");
  });

  it("툴 쓴 스텝과 안 쓴 스텝이 섞이고 실패한 툴이 있으면 tool-call이다", () => {
    const steps = [{ agent: "analyst" }, { agent: "analyst", tool: { name: "search", ok: false } }];
    expect(classifyFailure(trace({ steps }))).toBe("tool-call");
  });
});

describe("classifyFailure — 신호가 둘 이상일 때", () => {
  it("상한에 닿았고 툴도 실패했으면 infinite-loop다", () => {
    const steps = Array.from({ length: 6 }, () => ({ agent: "analyst", tool: { name: "search", ok: false } }));
    expect(classifyFailure(trace({ steps, maxSteps: 6 }))).toBe("infinite-loop");
  });

  it("상한에 닿았고 오염 흔적도 있으면 infinite-loop다", () => {
    const steps = Array.from({ length: 6 }, () => ({ agent: "analyst", tool: { name: "s", ok: true } }));
    expect(classifyFailure(trace({ steps, maxSteps: 6, leakedFrom: "다른 세션" }))).toBe(
      "infinite-loop",
    );
  });

  it("다른 에이전트가 일했고 툴도 실패했으면 routing이다", () => {
    expect(
      classifyFailure(trace({ steps: [{ agent: "ad_expert", tool: { name: "search", ok: false } }] })),
    ).toBe("routing");
  });

  it("다른 에이전트가 일했고 오염 흔적도 있으면 routing이다", () => {
    expect(
      classifyFailure(
        trace({ steps: [{ agent: "ad_expert", tool: { name: "s", ok: true } }], leakedFrom: "다른 세션" }),
      ),
    ).toBe("routing");
  });

  it("툴이 실패했고 오염 흔적도 있으면 tool-call이다", () => {
    expect(
      classifyFailure(
        trace({ steps: [{ agent: "analyst", tool: { name: "s", ok: false } }], leakedFrom: "다른 세션" }),
      ),
    ).toBe("tool-call");
  });

  it("툴을 안 쓴 스텝에 오염 흔적이 있으면 context-pollution이다", () => {
    expect(
      classifyFailure(trace({ steps: [{ agent: "analyst" }], leakedFrom: "다른 세션" })),
    ).toBe("context-pollution");
  });
});

describe("summarize — 무엇을 먼저 고칠지 보이게", () => {
  it("유형별 건수를 세고 많은 순으로 준다", () => {
    const traces = [
      trace({ steps: [{ agent: "ad_expert", tool: { name: "s", ok: true } }] }),
      trace({ steps: [{ agent: "ad_expert", tool: { name: "s", ok: true } }] }),
      trace({ steps: [{ agent: "analyst", tool: { name: "s", ok: false } }] }),
    ];
    expect(summarize(traces)).toEqual([
      { kind: "routing", count: 2 },
      { kind: "tool-call", count: 1 },
    ]);
  });

  it("건수가 같으면 유형 이름 순으로 정렬한다", () => {
    const traces = [
      trace({ steps: [{ agent: "analyst", tool: { name: "s", ok: false } }] }),
      trace({ steps: [{ agent: "ad_expert", tool: { name: "s", ok: true } }] }),
    ];
    expect(summarize(traces).map((r) => r.kind)).toEqual(["routing", "tool-call"]);
  });

  it("0건인 유형은 넣지 않는다", () => {
    expect(summarize([trace()])).toEqual([{ kind: "unknown", count: 1 }]);
  });

  it("빈 입력은 빈 배열이다", () => {
    expect(summarize([])).toEqual([]);
  });
});
