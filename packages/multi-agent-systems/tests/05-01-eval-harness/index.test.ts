// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../src/05-01-eval-harness/index.ts를 고쳐라.
import { describe, expect, it } from "vitest";
import { scripted } from "@study/testkit";
import { runEvalSet } from "../../src/05-01-eval-harness";
import type { EvalCase } from "../../src/05-01-eval-harness";

describe("runEvalSet", () => {
  it("각 케이스를 실행해 check로 판정한 결과를 순서대로 돌려준다", async () => {
    const ask = scripted<[string, string], Promise<string>>([
      Promise.resolve("답은 5입니다"),
      Promise.resolve("모름"),
    ]);
    const cases: EvalCase[] = [
      { name: "덧셈", input: "2+3은?", check: (o) => o.includes("5") },
      { name: "곱셈", input: "2*3은?", check: (o) => o.includes("6") },
    ];

    const results = await runEvalSet(ask, "SYSTEM", cases);

    expect(results).toEqual([
      { name: "덧셈", pass: true, out: "답은 5입니다" },
      { name: "곱셈", pass: false, out: "모름" },
    ]);
  });

  it("각 호출에 system을 그대로, input을 user로 넘긴다", async () => {
    const ask = scripted<[string, string], Promise<string>>([Promise.resolve("...")]);
    const cases: EvalCase[] = [{ name: "케이스", input: "질문", check: () => true }];

    await runEvalSet(ask, "너는 친절한 봇이다", cases);

    expect(ask.calls[0]).toEqual(["너는 친절한 봇이다", "질문"]);
  });

  it("input이 빈 문자열이면 '(빈 입력)'으로 대체해서 묻는다", async () => {
    const ask = scripted<[string, string], Promise<string>>([Promise.resolve("응답")]);
    const cases: EvalCase[] = [{ name: "빈값", input: "", check: () => true }];

    await runEvalSet(ask, "SYSTEM", cases);

    expect(ask.calls[0][1]).toBe("(빈 입력)");
  });

  it("빈 평가셋이면 빈 배열을 반환하고 모델을 호출하지 않는다", async () => {
    const ask = scripted<[string, string], Promise<string>>([]);

    const results = await runEvalSet(ask, "SYSTEM", []);

    expect(results).toEqual([]);
    expect(ask.calls).toHaveLength(0);
  });
});
