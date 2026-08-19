// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/06-01-rag-retrieve/extra-4-rerank.ts를 고쳐라.
//
// 선택 문제 D: 싼 검색으로 후보를 좁히고 비싼 판정을 거기에만 쓴다.
//
// 개념은 docs/06-rag-when-needed.md 의 § 3. 리랭킹 절에 있다.
// 이 파일은 답만 적고 이유는 적지 않는다.
import { describe, expect, it } from "vitest";
import { rerank, twoStage } from "../../src/06-01-rag-retrieve/extra-4-rerank";
import type { Candidate, ScoreFn } from "../../src/06-01-rag-retrieve/extra-4-rerank";

const docs = (...ids: string[]): Candidate[] => ids.map((id) => ({ id, text: `${id} 본문` }));

/** text 앞머리의 id로 점수를 찾는 점수 함수를 만든다. */
const byId = (table: Record<string, number>): ScoreFn => (_q, text) => table[text.split(" ")[0]!] ?? 0;

describe("rerank", () => {
  it("점수가 높은 순으로 준다", () => {
    const score = byId({ a: 1, b: 9, c: 5 });
    expect(rerank("질의", docs("a", "b", "c"), score)).toEqual(["b", "c", "a"]);
  });

  it("k를 주면 그만큼만 준다", () => {
    const score = byId({ a: 1, b: 9, c: 5 });
    expect(rerank("질의", docs("a", "b", "c"), score, 2)).toEqual(["b", "c"]);
  });

  it("k를 주지 않으면 후보 전부를 준다", () => {
    const score = byId({ a: 1, b: 9, c: 5 });
    expect(rerank("질의", docs("a", "b", "c"), score)).toHaveLength(3);
  });

  it("점수가 같으면 입력 순서를 지킨다", () => {
    const score = byId({ a: 5, b: 5, c: 5 });
    expect(rerank("질의", docs("a", "b", "c"), score)).toEqual(["a", "b", "c"]);
  });

  it("후보가 없으면 빈 배열이다", () => {
    expect(rerank("질의", [], byId({}))).toEqual([]);
  });

  it("k가 0이거나 음수면 빈 배열이다", () => {
    const score = byId({ a: 1 });
    expect(rerank("질의", docs("a"), score, 0)).toEqual([]);
    expect(rerank("질의", docs("a"), score, -1)).toEqual([]);
  });

  it("후보마다 점수 함수를 정확히 한 번 부른다", () => {
    let calls = 0;
    const score: ScoreFn = (_q, t) => {
      calls++;
      return t.length;
    };
    rerank("질의", docs("a", "b", "c"), score);
    expect(calls).toBe(3);
  });
});

describe("twoStage", () => {
  it("싼 점수로 좁히고 정밀 점수로 줄 세운다", () => {
    const cheap = byId({ a: 9, b: 8, c: 7, d: 1 });
    const precise = byId({ a: 1, b: 5, c: 9, d: 100 });
    // 1단계에서 a,b,c 가 남고 2단계가 그 셋을 다시 세운다
    expect(twoStage("질의", docs("a", "b", "c", "d"), cheap, precise, 3, 3)).toEqual(["c", "b", "a"]);
  });

  it("1단계에서 탈락한 문서는 정밀 점수가 가장 높아도 결과에 없다", () => {
    const cheap = byId({ a: 9, hidden: 0 });
    const precise = byId({ a: 1, hidden: 100 });
    expect(twoStage("질의", docs("a", "hidden"), cheap, precise, 1, 1)).toEqual(["a"]);
  });

  it("정밀 점수는 1단계를 통과한 후보에만 매긴다", () => {
    let preciseCalls = 0;
    const cheap = byId({ a: 9, b: 8, c: 7, d: 6, e: 5 });
    const precise: ScoreFn = (_q, t) => {
      preciseCalls++;
      return t.length;
    };
    twoStage("질의", docs("a", "b", "c", "d", "e"), cheap, precise, 2, 2);
    expect(preciseCalls).toBe(2);
  });

  it("1단계 정원이 문서 수보다 크면 전부가 2단계로 간다", () => {
    const cheap = byId({ a: 1, b: 2 });
    const precise = byId({ a: 5, b: 9 });
    expect(twoStage("질의", docs("a", "b"), cheap, precise, 10, 10)).toEqual(["b", "a"]);
  });

  it("최종 정원만큼만 준다", () => {
    const cheap = byId({ a: 9, b: 8, c: 7 });
    const precise = byId({ a: 1, b: 5, c: 9 });
    expect(twoStage("질의", docs("a", "b", "c"), cheap, precise, 3, 1)).toEqual(["c"]);
  });

  it("문서가 없으면 빈 배열이고 어느 점수도 부르지 않는다", () => {
    let calls = 0;
    const count: ScoreFn = () => {
      calls++;
      return 0;
    };
    expect(twoStage("질의", [], count, count, 5, 3)).toEqual([]);
    expect(calls).toBe(0);
  });
});
