// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/06-01-rag-retrieve/extra-1-hybrid-rank.ts를 고쳐라.
//
// 선택 문제 A: 외부 벡터 스토어 없이 검색의 수학과 결합을 직접 구현한다.
//
// 개념은 docs/06-rag-when-needed.md 의 「가깝다를 무엇으로 재나」와
// 「어떻게 합치나」 절에 있다. 이 파일은 답만 적고 이유는 적지 않는다.
import { describe, expect, it } from "vitest";
import { cosine, hybridSearch, rrf, topK } from "../../src/06-01-rag-retrieve/extra-1-hybrid-rank";
import type { HybridDoc } from "../../src/06-01-rag-retrieve/extra-1-hybrid-rank";

describe("cosine", () => {
  it("같은 방향이면 1이다", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
  });

  it("직교하면 0이다", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("반대 방향이면 -1이다", () => {
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("길이가 10배여도 같은 방향이면 1이다", () => {
    expect(cosine([3, 4], [30, 40])).toBeCloseTo(1);
  });

  it("영벡터가 끼면 0이고 NaN이 아니다", () => {
    expect(cosine([0, 0], [1, 2])).toBe(0);
    expect(Number.isNaN(cosine([0, 0], [0, 0]))).toBe(false);
  });

  it("차원이 다르면 잘못된 임베딩 공간을 섞은 것이므로 거부한다", () => {
    expect(() => cosine([1, 0, 99], [1, 0])).toThrow(/차원/);
  });
});

describe("topK", () => {
  const docs = [
    { id: "a", vec: [1, 0] },
    { id: "b", vec: [0.9, 0.1] },
    { id: "c", vec: [0, 1] },
  ];

  it("질의와 가까운 순으로 k개를 준다", () => {
    expect(topK([1, 0], docs, 2)).toEqual(["a", "b"]);
  });

  it("k가 문서 수보다 크면 있는 만큼만 준다", () => {
    expect(topK([1, 0], docs, 10)).toHaveLength(3);
  });

  it("k가 0이면 빈 배열이다", () => {
    expect(topK([1, 0], docs, 0)).toEqual([]);
  });

  it("k가 음수여도 빈 배열이다", () => {
    expect(topK([1, 0], docs, -1)).toEqual([]);
  });

  it("점수가 같으면 입력 순서를 지킨다", () => {
    const tied = [
      { id: "x", vec: [1, 0] },
      { id: "y", vec: [2, 0] },
    ];
    expect(topK([5, 0], tied, 2)).toEqual(["x", "y"]);
  });
});

describe("rrf", () => {
  it("두 랭킹 모두에서 높은 문서가 1위다", () => {
    expect(rrf([["a", "b", "c"], ["b", "a", "d"]])[0]).toBe("a");
  });

  it("한쪽에만 있는 문서도 결과에 포함된다", () => {
    expect(rrf([["a"], ["z"]]).sort()).toEqual(["a", "z"]);
  });

  it("한쪽에서 1위여도 다른 쪽에서 빠지면 양쪽 상위인 문서에 밀린다", () => {
    expect(rrf([["solo", "both"], ["both", "other"]])[0]).toBe("both");
  });

  it("두 랭킹이 같으면 그 순서 그대로다", () => {
    expect(rrf([["a", "b"], ["a", "b"]])).toEqual(["a", "b"]);
  });

  it("빈 랭킹이 섞여도 나머지로 계산한다", () => {
    expect(rrf([["a", "b"], []])).toEqual(["a", "b"]);
  });

  it("전부 비었으면 빈 배열이다", () => {
    expect(rrf([[], []])).toEqual([]);
  });

  it("k가 작으면 한쪽 1위가 이기고, k가 크면 양쪽 3위가 이긴다", () => {
    // A는 첫 랭킹 1위지만 둘째 랭킹에 없다. B는 양쪽 모두 3위다.
    const r1 = ["A", "x", "B"];
    const r2 = ["y", "z", "B"];
    expect(rrf([r1, r2], 0)[0]).toBe("A");
    expect(rrf([r1, r2], 10)[0]).toBe("B");
  });
});

describe("hybridSearch", () => {
  // vec 은 임베딩 모델이 만들었을 값을 대신한다 — 축 하나가 한 주제다.
  const DOCS: HybridDoc[] = [
    { id: "err", text: "ERR_2041 결제 게이트웨이 응답 시간 초과", vec: [1, 0, 0] },
    { id: "refund", text: "구매 후 7일 이내 미개봉 상태면 전액 돌려드립니다", vec: [0, 1, 0] },
    { id: "ship", text: "평일 오후 2시 이전 주문은 당일 출고", vec: [0, 0, 1] },
  ];

  it("코드를 그대로 물으면, 질의 벡터가 다른 문서를 가리켜도 그 문서가 결과에 든다", () => {
    // 질의 벡터는 refund 축이다 — 벡터 검색만으로는 err 를 위로 올리지 못한다.
    expect(hybridSearch("ERR_2041", [0, 1, 0], DOCS, 2)).toContain("err");
  });

  it("문서에 없는 낱말로 물어도 뜻이 통하면 그 문서가 1위다", () => {
    // "환불"이라는 낱말은 어느 문서에도 없다 — 키워드 검색만으로는 못 찾는다.
    expect(hybridSearch("환불 규정이 어떻게 되나요", [0, 1, 0], DOCS, 1)).toEqual(["refund"]);
  });

  it("낱말도 겹치고 벡터도 가까우면 1위다", () => {
    expect(hybridSearch("출고 언제 되나요", [0, 0, 1], DOCS, 1)).toEqual(["ship"]);
  });

  it("k개까지만 준다", () => {
    expect(hybridSearch("ERR_2041", [1, 0, 0], DOCS, 1)).toHaveLength(1);
  });

  it("문서가 없으면 빈 배열이다", () => {
    expect(hybridSearch("무엇이든", [1, 0, 0], [], 3)).toEqual([]);
  });
});
