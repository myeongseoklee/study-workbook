// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/06-01-rag-retrieve/extra-1-hybrid-rank.ts를 고쳐라.
//
// 선택 문제: 키워드 검색을 벡터 검색으로 "교체"하면 정확한 코드·ID 질문에서
// 오히려 나빠진다. 둘을 **합치는** 것이 실무의 답이고, 합치는 규칙(RRF)은
// 임베딩 모델 없이도 만들 수 있다.
import { describe, expect, it } from "vitest";
import { cosine, rrf, topK } from "../../src/06-01-rag-retrieve/extra-1-hybrid-rank";

describe("cosine — 방향만 본다", () => {
  it("같은 방향이면 1이다", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
  });

  it("직교하면 0이다", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("반대 방향이면 -1이다", () => {
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("크기는 무관하다 — 길이가 10배여도 같은 방향이면 1이다", () => {
    // 정규화를 빠뜨리면 긴 문서가 항상 이긴다. 유사도가 아니라 내적을 잰 셈이다.
    expect(cosine([3, 4], [30, 40])).toBeCloseTo(1);
  });

  it("영벡터는 0이다 — 0으로 나누지 않는다", () => {
    expect(cosine([0, 0], [1, 2])).toBe(0);
    expect(Number.isNaN(cosine([0, 0], [0, 0]))).toBe(false);
  });
});

describe("topK — 상위 k개", () => {
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

  it("k가 0이면 빈 배열이다 (경계)", () => {
    expect(topK([1, 0], docs, 0)).toEqual([]);
  });

  it("점수가 같으면 입력 순서를 지킨다 — 흔들리면 캐시도 비교도 못 한다", () => {
    const tied = [
      { id: "x", vec: [1, 0] },
      { id: "y", vec: [2, 0] },
    ];
    expect(topK([5, 0], tied, 2)).toEqual(["x", "y"]);
  });
});

describe("rrf — 서로 다른 랭킹을 합친다", () => {
  it("두 랭킹 모두에서 높은 문서가 1위다", () => {
    const keyword = ["a", "b", "c"];
    const vector = ["b", "a", "d"];
    expect(rrf([keyword, vector])[0]).toBe("a");
  });

  it("한쪽에만 있는 문서도 결과에 포함된다 — 각 검색의 사각을 서로 메운다", () => {
    const keyword = ["a"];
    const vector = ["z"];
    expect(rrf([keyword, vector]).sort()).toEqual(["a", "z"]);
  });

  it("한쪽에서 1위여도 다른 쪽에서 빠지면 양쪽 상위인 문서에 밀린다", () => {
    // RRF의 핵심: "한 검색에서만 최고"보다 "두 검색 모두에서 상위"가 강하다.
    const keyword = ["solo", "both"];
    const vector = ["both", "other"];
    expect(rrf([keyword, vector])[0]).toBe("both");
  });

  it("순위만 쓴다 — 점수 스케일이 달라도 합칠 수 있다는 것이 이 방식의 이유다", () => {
    const first = ["a", "b"];
    const second = ["a", "b"];
    expect(rrf([first, second])).toEqual(["a", "b"]);
  });

  it("빈 랭킹이 섞여도 나머지로 계산한다", () => {
    expect(rrf([["a", "b"], []])).toEqual(["a", "b"]);
  });

  it("전부 비었으면 빈 배열이다", () => {
    expect(rrf([[], []])).toEqual([]);
  });

  it("k를 키우면 순위 간 격차가 줄어 뒤 문서가 따라잡을 여지가 커진다", () => {
    // k는 "상위 편중을 얼마나 완화할지"의 손잡이다. 기본 60은 관례값이고,
    // 이 검사는 그 손잡이가 실제로 작동하는지만 본다.
    const a = ["x", "y", "z"];
    const b = ["z", "y", "x"];
    const tight = rrf([a, b], 1);
    const loose = rrf([a, b], 1000);
    expect(tight).toHaveLength(3);
    expect(loose).toHaveLength(3);
    expect(new Set(loose)).toEqual(new Set(["x", "y", "z"]));
  });
});
