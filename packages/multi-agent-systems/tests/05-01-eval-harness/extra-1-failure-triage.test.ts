// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/05-01-eval-harness/extra-1-failure-triage.ts를 고쳐라.
//
// 선택 문제: 실패를 세는 것과 **분류하는 것**은 다르다. "정확도 62%"는 무엇을
// 고쳐야 할지 알려주지 않지만, "실패 12건 중 7건이 라우팅"은 알려준다.
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

describe("classifyFailure — 네 유형으로 가른다", () => {
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

  it("답변에 다른 질문의 흔적이 섞였으면 context-pollution이다", () => {
    expect(classifyFailure(trace({ answer: "정상 답변", leakedFrom: "다른 세션" }))).toBe(
      "context-pollution",
    );
  });

  it("실패 신호가 없으면 unknown이다 — 억지로 분류하지 않는다", () => {
    // 분류기가 아무 유형이나 붙이면 통계가 거짓이 된다. 모르는 건 모른다고 해야
    // "unknown이 많다 = 트레이스에 담긴 정보가 부족하다"는 신호를 얻는다.
    expect(classifyFailure(trace())).toBe("unknown");
  });

  it("스텝이 아예 없으면 unknown이다 (경계)", () => {
    expect(classifyFailure(trace({ steps: [] }))).toBe("unknown");
  });
});

describe("classifyFailure — 신호가 겹칠 때의 우선순위", () => {
  it("무한 루프 중 툴도 실패했으면 infinite-loop다 — 루프가 상위 원인이다", () => {
    // 루프를 돌면 그 안에서 툴 실패는 얼마든지 생긴다. 툴을 먼저 보면 진짜
    // 원인(끝나지 않는 것)이 통계에서 사라지고 툴만 계속 고치게 된다.
    const steps = Array.from({ length: 6 }, () => ({ agent: "analyst", tool: { name: "search", ok: false } }));
    expect(classifyFailure(trace({ steps, maxSteps: 6 }))).toBe("infinite-loop");
  });

  it("잘못된 에이전트가 툴까지 실패시켰으면 routing이다 — 애초에 갈 곳이 틀렸다", () => {
    expect(
      classifyFailure(trace({ steps: [{ agent: "ad_expert", tool: { name: "search", ok: false } }] })),
    ).toBe("routing");
  });

  it("오염 신호는 루프·라우팅보다 뒤다 — 눈에 보이는 증상이지 원인이 아니다", () => {
    const steps = Array.from({ length: 6 }, () => ({ agent: "analyst", tool: { name: "s", ok: true } }));
    expect(classifyFailure(trace({ steps, maxSteps: 6, leakedFrom: "다른 세션" }))).toBe(
      "infinite-loop",
    );
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

  it("건수가 같으면 유형 이름 순으로 안정 정렬한다 — 실행마다 순서가 흔들리면 비교를 못 한다", () => {
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
