// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/06-01-rag-retrieve/extra-6-retrieval-eval.ts를 고쳐라.
//
// 선택 문제 F: 검색을 고치려면 먼저 재야 한다. 최종 답만 보면 검색이 나빴는지
// 생성이 나빴는지 갈리지 않는다.
//
// 개념은 docs/06-rag-when-needed.md 의 § 검색을 무엇으로 재나 절에 있다.
// 이 파일은 답만 적고 이유는 적지 않는다.
import { describe, expect, it } from "vitest";
import {
  evaluate,
  precisionAt,
  recallAt,
  reciprocalRank,
} from "../../src/06-01-rag-retrieve/extra-6-retrieval-eval";

// 정답 refund 를 2위로 찾아낸 결과
const R = ["ship", "refund", "membership"];
const REL = ["refund"];

describe("recallAt", () => {
  it("정답이 상위 k 안에 있으면 1이다", () => {
    expect(recallAt(R, REL, 3)).toBeCloseTo(1);
  });

  it("정답이 상위 k 밖이면 0이다", () => {
    expect(recallAt(R, REL, 1)).toBeCloseTo(0);
  });

  it("정답 둘 중 하나만 들어오면 0.5다", () => {
    expect(recallAt(["a", "b", "c", "d"], ["b", "d"], 3)).toBeCloseTo(0.5);
  });

  it("k가 검색 결과보다 크면 있는 만큼만 본다", () => {
    expect(recallAt(R, REL, 100)).toBeCloseTo(1);
  });

  it("정답이 없는 케이스는 거부한다", () => {
    expect(() => recallAt(R, [], 3)).toThrow(/정답/);
  });

  it("k가 1 미만이면 거부한다", () => {
    expect(() => recallAt(R, REL, 0)).toThrow(/k/);
  });
});

describe("precisionAt", () => {
  it("상위 3개 중 하나가 정답이면 1/3이다", () => {
    expect(precisionAt(R, REL, 3)).toBeCloseTo(1 / 3);
  });

  it("같은 문서가 두 번 나와도 한 번으로 센다", () => {
    expect(precisionAt(["a", "a", "b"], ["b"], 3)).toBeCloseTo(0.5);
  });

  it("검색 결과가 비면 0이다", () => {
    expect(precisionAt([], REL, 3)).toBe(0);
  });
});

describe("reciprocalRank", () => {
  it("첫 정답이 2위면 0.5다", () => {
    expect(reciprocalRank(R, REL)).toBeCloseTo(0.5);
  });

  it("첫 정답이 1위면 1이다", () => {
    expect(reciprocalRank(["refund", "ship"], REL)).toBeCloseTo(1);
  });

  it("정답이 하나도 없으면 0이다", () => {
    expect(reciprocalRank(["x", "y"], ["z"])).toBe(0);
  });

  it("앞에 중복이 있어도 순위를 부풀리지 않는다", () => {
    expect(reciprocalRank(["a", "a", "b"], ["b"])).toBeCloseTo(0.5);
  });
});

describe("evaluate", () => {
  it("케이스별 지표를 평균한다", () => {
    const items = [
      { retrieved: R, relevant: REL },
      { retrieved: ["a", "b", "c", "d"], relevant: ["b", "d"] },
    ];
    const out = evaluate(items, 3);
    expect(out.recall).toBeCloseTo(0.75);
    expect(out.precision).toBeCloseTo(1 / 3);
    expect(out.mrr).toBeCloseTo(0.5);
  });

  it("빈 평가셋은 전부 0이다", () => {
    expect(evaluate([], 3)).toEqual({ recall: 0, precision: 0, mrr: 0 });
  });

  it("Recall이 만점이어도 MRR은 낮을 수 있다", () => {
    // 정답을 찾긴 했지만 3위에 둔 경우 — 두 지표를 같이 봐야 하는 이유다
    const out = evaluate([{ retrieved: ["x", "y", "refund"], relevant: REL }], 3);
    expect(out.recall).toBeCloseTo(1);
    expect(out.mrr).toBeCloseTo(1 / 3);
  });
});
