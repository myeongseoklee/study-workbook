// 이 파일은 고치지 않는다 — 명세다. 통과시키려면 ../../src/06-01-rag-retrieve/extra-5-score-fusion.ts를 고쳐라.
//
// 선택 문제 E: RRF가 버린 "점수의 세기"를 살리는 쪽. 대신 정규화와 가중치를 떠안는다.
//
// 개념은 docs/06-rag-when-needed.md 의 § 점수로 합치기 — 정규화 가중합 절에 있다.
// 이 파일은 답만 적고 이유는 적지 않는다.
import { describe, expect, it } from "vitest";
import { normalize, weightedFusion } from "../../src/06-01-rag-retrieve/extra-5-score-fusion";
import type { ScoredDoc } from "../../src/06-01-rag-retrieve/extra-5-score-fusion";

const d = (id: string, score: number): ScoredDoc => ({ id, score });
const scores = (docs: ScoredDoc[]) => docs.map((x) => x.score);

describe("normalize", () => {
  it("최댓값은 1, 최솟값은 0, 나머지는 그 사이다", () => {
    expect(scores(normalize([d("a", 3), d("b", 1), d("c", 2)]))).toEqual([1, 0, 0.5]);
  });

  it("id와 순서는 그대로 둔다", () => {
    expect(normalize([d("a", 3), d("b", 1)]).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("점수가 전부 같으면 전부 1이다", () => {
    expect(scores(normalize([d("a", 5), d("b", 5)]))).toEqual([1, 1]);
  });

  it("문서가 하나면 1이다", () => {
    expect(scores(normalize([d("a", 7)]))).toEqual([1]);
  });

  it("점수가 전부 같아도 NaN이 나오지 않는다", () => {
    expect(scores(normalize([d("a", 5), d("b", 5)])).some(Number.isNaN)).toBe(false);
  });

  it("빈 배열은 빈 배열이다", () => {
    expect(normalize([])).toEqual([]);
  });
});

describe("weightedFusion", () => {
  const L1 = [d("a", 10), d("b", 5)];
  const L2 = [d("b", 1.0), d("a", 0.5)];

  it("가중치가 큰 쪽의 1위가 최종 1위가 된다", () => {
    expect(weightedFusion([L1, L2], [2, 1])).toEqual(["a", "b"]);
  });

  it("가중치를 반대로 주면 순서가 뒤집힌다", () => {
    expect(weightedFusion([L1, L2], [1, 2])).toEqual(["b", "a"]);
  });

  it("한쪽에만 있는 문서도 결과에 들어간다", () => {
    expect(weightedFusion([L1, [d("c", 1)]], [1, 1])).toEqual(["a", "c", "b"]);
  });

  it("점수가 같으면 처음 등장한 순서를 지킨다", () => {
    expect(weightedFusion([[d("a", 5), d("b", 5)]], [1])).toEqual(["a", "b"]);
  });

  it("boost를 준 문서는 그 배수만큼 올라간다", () => {
    const L = [d("a", 10), d("b", 6), d("c", 2)];
    expect(weightedFusion([L], [1], { boost: { b: 3 } })).toEqual(["b", "a", "c"]);
  });

  it("boost를 주지 않은 문서는 그대로다", () => {
    const L = [d("a", 10), d("b", 6), d("c", 2)];
    expect(weightedFusion([L], [1], { boost: {} })).toEqual(["a", "b", "c"]);
  });

  it("minScore 미만인 문서는 버린다", () => {
    const L = [d("a", 10), d("b", 6), d("c", 2)];
    expect(weightedFusion([L], [1], { minScore: 0.4 })).toEqual(["a", "b"]);
  });

  it("minScore는 boost를 적용한 뒤의 점수로 판정한다", () => {
    // boost 없이는 a, b 가 문턱을 넘는다. boost 를 걸면 c 가 올라와 문턱을
    // 넘고 b 는 내려가 문턱 아래로 떨어진다 — 결과가 뒤집혀야 boost가
    // 정렬 이후가 아니라 점수 계산 단계에서 minScore 앞에 적용된 것이다.
    const L = [d("a", 10), d("b", 6), d("c", 3), d("e", 2)];
    expect(weightedFusion([L], [1], { minScore: 0.4 })).toEqual(["a", "b"]);
    expect(weightedFusion([L], [1], { boost: { c: 4, b: 0.5 }, minScore: 0.4 })).toEqual(["a", "c"]);
  });

  it("가중치 개수가 검색기 수와 다르면 거부한다", () => {
    expect(() => weightedFusion([L1, L2], [1])).toThrow(/가중치/);
  });

  it("검색기가 없으면 빈 배열이다", () => {
    expect(weightedFusion([], [])).toEqual([]);
  });

  it("빈 결과만 들어오면 빈 배열이다", () => {
    expect(weightedFusion([[], []], [1, 1])).toEqual([]);
  });
});
