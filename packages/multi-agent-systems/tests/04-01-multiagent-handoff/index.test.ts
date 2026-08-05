// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../src/04-01-multiagent-handoff/index.ts를 고쳐라.
import { describe, expect, it } from "vitest";
import { scripted } from "@study/testkit";
import { ROLES, runCollaboration } from "../../src/04-01-multiagent-handoff";

/** 분석가→전략가→개발자 순서로 응답을 돌려주는 ask 스텁. 호출 인자는 stub.calls로 검사한다. */
function stubAsk(responses: [string, string, string]) {
  return scripted<[string, string], Promise<string>>(responses.map((r) => Promise.resolve(r)));
}

describe("runCollaboration", () => {
  it("분석가 → 전략가 → 개발자 순서로 정확히 3번 호출한다", async () => {
    const ask = stubAsk(["인사이트", "전략", "구현"]);

    await runCollaboration(ask, "성과 데이터");

    expect(ask.calls).toHaveLength(3);
    expect(ask.calls[0][0]).toBe(ROLES.analyst);
    expect(ask.calls[1][0]).toBe(ROLES.adExpert);
    expect(ask.calls[2][0]).toBe(ROLES.developer);
  });

  it("각 단계 결과를 전부 반환한다", async () => {
    const ask = stubAsk(["인사이트", "전략", "구현"]);

    const result = await runCollaboration(ask, "성과 데이터");

    expect(result).toEqual({ analysis: "인사이트", strategy: "전략", impl: "구현" });
  });

  it("분석가의 결과가 전략가에게 넘어간다 (핸드오프 1)", async () => {
    const ask = stubAsk(["A타겟 ROAS가 가장 높다", "전략", "구현"]);

    await runCollaboration(ask, "성과 데이터");

    expect(ask.calls[1][1]).toContain("A타겟 ROAS가 가장 높다");
  });

  it("전략가의 결과가 개발자에게 넘어간다 (핸드오프 2)", async () => {
    const ask = stubAsk(["인사이트", "예산을 A타겟에 60% 배분", "구현"]);

    await runCollaboration(ask, "성과 데이터");

    expect(ask.calls[2][1]).toContain("예산을 A타겟에 60% 배분");
  });

  it("분석가에게는 원본 성과 데이터를 그대로 넘긴다", async () => {
    const ask = stubAsk(["인사이트", "전략", "구현"]);

    await runCollaboration(ask, "지난주 CTR 2.1%");

    expect(ask.calls[0][1]).toContain("지난주 CTR 2.1%");
  });
});
